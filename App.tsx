import React, { useState, useEffect, useRef } from 'react';
import { generateInitialPaper, analyzePaper, improvePaper, generatePaperTitle, fixLatexPaper, reformatPaperWithStyleGuide, KeyManager } from './services/geminiService';
import type { Language, IterationAnalysis, PaperSource, AnalysisResult, StyleGuide, ArticleEntry, PersonalData } from './types';
import { LANGUAGES, AVAILABLE_MODELS, ANALYSIS_TOPICS, ALL_TOPICS_BY_DISCIPLINE, getAllDisciplines, getRandomTopic, FIX_OPTIONS, STYLE_GUIDES, TOTAL_ITERATIONS, DISCIPLINE_AUTHORS } from './constants';


import LanguageSelector from './components/LanguageSelector';
import ModelSelector from './components/ModelSelector';
import PageSelector from './components/PageSelector';
import ActionButton from './components/ActionButton';
import ProgressBar from './components/ProgressBar';
import ResultsDisplay from './components/ResultsDisplay';
import SourceDisplay from './components/SourceDisplay';
import LatexCompiler from './components/LatexCompiler';
import ApiKeyModal from './components/ApiKeyModal';
import StyleGuideSelector from './components/StyleGuideSelector';
// Fix: Import ZenodoUploader component and its Ref type to resolve the "Cannot find name 'ZenodoUploader'" error.
import ZenodoUploader, { type ZenodoUploaderRef } from './components/ZenodoUploader';
import PersonalDataModal from './components/PersonalDataModal'; // Import the new PersonalDataModal
import ParallelWorker from './components/ParallelWorker';

// This is needed for the pdf.js script loaded in index.html
declare const pdfjsLib: any;

type Author = {
    name: string;
    affiliation: string;
    orcid: string;
};

type PublishedArticle = {
    doi: string;
    link: string;
    title: string;
    date: string; // Added date
};

// Main App Component
const App: React.FC = () => {
    // Overall workflow step
    const [step, setStep] = useState(1);
    const [isApiModalOpen, setIsApiModalOpen] = useState(false);
    const [isPersonalDataModalOpen, setIsPersonalDataModalOpen] = useState(false); // New state for personal data modal

    // == STEP 1: GENERATION STATE ==
    const [language, setLanguage] = useState<Language>('en');
    const [generationModel, setGenerationModel] = useState('gemini-2.5-flash');
    const [analysisModel, setAnalysisModel] = useState('gemini-2.5-flash');
    const [pageCount, setPageCount] = useState(12);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationProgress, setGenerationProgress] = useState(0);
    const [generationStatus, setGenerationStatus] = useState('');
    const [generatedTitle, setGeneratedTitle] = useState('');
    const [analysisResults, setAnalysisResults] = useState<IterationAnalysis[]>([]);
    const [paperSources, setPaperSources] = useState<PaperSource[]>([]);
    const [finalLatexCode, setFinalLatexCode] = useState('');
    const [isGenerationComplete, setIsGenerationComplete] = useState(false);
    const isGenerationCancelled = useRef(false);
    const [numberOfArticles, setNumberOfArticles] = useState(1);
    // Replaced publishedArticles with articleEntries
    const [articleEntries, setArticleEntries] = useState<ArticleEntry[]>(() => {
        try {
            const stored = localStorage.getItem('article_entries_log');
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    });
    const [selectedDiscipline, setSelectedDiscipline] = useState<string>(getAllDisciplines()[0]); // Default to the first discipline


    // == STEP 2: COMPILE STATE ==
    const [latexCode, setLatexCode] = useState(`% O código LaTeX gerado aparecerá aqui.`);
    const [compilationStatus, setCompilationStatus] = useState<React.ReactNode>(null);
    const [isCompiling, setIsCompiling] = useState(false);
    const [compileMethod, setCompileMethod] = useState<'texlive' | 'overleaf'>('texlive');
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState('');
    const [compiledPdfFile, setCompiledPdfFile] = useState<File | null>(null);
    const [selectedStyle, setSelectedStyle] = useState<StyleGuide>('abnt');
    const [isReformatting, setIsReformatting] = useState(false);


    // == STEP 3: UPLOAD STATE ==
    const [extractedMetadata, setExtractedMetadata] = useState({
        title: '',
        abstract: '',
        authors: [] as Author[],
        keywords: ''
    });
    const [useSandbox, setUseSandbox] = useState(false);
    // Initialize Zenodo token from localStorage
    const [zenodoToken, setZenodoToken] = useState(() => localStorage.getItem('zenodo_api_key') || '');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<React.ReactNode>(null);
    const [keywordsInput, setKeywordsInput] = useState('');
    
    // State for author personal data, loaded from localStorage
    const [authors, setAuthors] = useState<PersonalData[]>(() => {
        try {
            const stored = localStorage.getItem('all_authors_data');
            const parsed = stored ? JSON.parse(stored) : [];
            if (parsed.length === 0) {
                // Default to a single author if no data found
                return [{ 
                    name: 'SÉRGIO DE ANDRADE, PAULO', 
                    affiliation: 'Faculdade de Guarulhos (FG)', 
                    orcid: '0009-0004-2555-3178' 
                }];
            }
            return parsed;
        } catch {
            return [{ 
                name: 'SÉRGIO DE ANDRADE, PAULO', 
                affiliation: 'Faculdade de Guarulhos (FG)', 
                orcid: '0009-0004-2555-3178' 
            }];
        }
    });

    // == AUTOMATION & SCHEDULER STATE ==
    const [isContinuousMode, setIsContinuousMode] = useState(() => {
        return localStorage.getItem('isContinuousMode') === 'true';
    });
    const [isSchedulerEnabled, setIsSchedulerEnabled] = useState(() => {
        return localStorage.getItem('isSchedulerEnabled') === 'true';
    });
    const schedulerTimeoutRef = useRef<number | null>(null);
    const uploaderRef = useRef<ZenodoUploaderRef>(null);

    // == PARALLEL MODE STATE ==
    const [isParallelMode, setIsParallelMode] = useState(false);
    const [parallelWorkers, setParallelWorkers] = useState<{id: number, status: string, progress: number, error: boolean}[]>([]);

    // == STEP 4: PUBLISHED ARTICLES STATE ==
    const [filter, setFilter] = useState({ day: '', month: '', year: '' });
    const [isRepublishingId, setIsRepublishingId] = useState<string | null>(null); // New state for republishing specific item
    
    // Effect for pdf.js worker
    useEffect(() => {
        if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }
    }, []);
    
    // Update zenodoToken in localStorage whenever it changes
    useEffect(() => {
        if (zenodoToken) {
            localStorage.setItem('zenodo_api_key', zenodoToken);
        } else {
            localStorage.removeItem('zenodo_api_key');
        }
    }, [zenodoToken]);

    // Effect to save all author personal data to localStorage
    useEffect(() => {
        try {
            localStorage.setItem('all_authors_data', JSON.stringify(authors));
        } catch (error) {
            console.error("Failed to save author data to localStorage", error);
        }
    }, [authors]);

    // Effect to automatically update authors based on selected discipline
    useEffect(() => {
        const fixedAuthor1 = {
            name: 'Revista, Zen',
            affiliation: 'Faculdade de Guarulhos (FG)',
            orcid: '0009-0007-6299-2008'
        };

        const author2Name = DISCIPLINE_AUTHORS[selectedDiscipline] || 'RESEARCHER, 10';
        const dynamicAuthor2 = {
            name: author2Name,
            affiliation: 'Faculdade de Guarulhos (FG)',
            orcid: '0009-0007-6299-2008'
        };

        // Check if we already have the default structure to avoid overwriting user custom changes too aggressively
        // Logic: If authors list has 2 entries and matches the pattern, update it. Otherwise keep user changes?
        // Simpler approach for this specific request: Always set authors to these two when discipline changes.
        setAuthors([fixedAuthor1, dynamicAuthor2]);
    }, [selectedDiscipline]);

    const handleSaveApiKeys = ({ gemini, zenodo, xai }: { gemini: string[], zenodo: string, xai: string }) => {
        if (gemini.length > 0) {
            localStorage.setItem('gemini_api_keys', JSON.stringify(gemini));
            // Keep single key for backward compatibility or simple access
            localStorage.setItem('gemini_api_key', gemini[0]);
        } else {
            localStorage.removeItem('gemini_api_keys');
            localStorage.removeItem('gemini_api_key');
        }

        if (zenodo) {
            setZenodoToken(zenodo);
            localStorage.setItem('zenodo_api_key', zenodo);
        } else {
            localStorage.removeItem('zenodo_api_key');
        }

        if (xai) {
            localStorage.setItem('xai_api_key', xai);
        } else {
            localStorage.removeItem('xai_api_key');
        }
        
        // Force reload KeyManager
        KeyManager.loadKeys();
        
        setIsApiModalOpen(false);
    };

    const handleSavePersonalData = (data: PersonalData[]) => {
        setAuthors(data);
        setIsPersonalDataModalOpen(false);
    };

    const runAutomationStep = async (cycleIndex: number) => {
        setIsGenerating(true);
        setGenerationProgress(5);
        setGenerationStatus(`🤖 Starting automation cycle ${cycleIndex + 1}...`);
        
        try {
            // 1. Generate Title
            const topic = getRandomTopic(selectedDiscipline);
            setGenerationStatus('Generating Title...');
            const title = await generatePaperTitle(topic, language, analysisModel, selectedDiscipline);
            setGeneratedTitle(title);
            setGenerationProgress(10);

            // 2. Generate Content
            setGenerationStatus('Writing initial draft...');
            const { paper, sources } = await generateInitialPaper(title, language, pageCount, generationModel, authors);
            setLatexCode(paper);
            setPaperSources(sources);
            setGenerationProgress(30);

            // 3. Iterations
            let currentCode = paper;
            let currentAnalysisResults: IterationAnalysis[] = [];
            
            for (let i = 1; i <= TOTAL_ITERATIONS; i++) {
                setGenerationStatus(`Analyzing iteration ${i}/${TOTAL_ITERATIONS}...`);
                const analysis = await analyzePaper(currentCode, pageCount, analysisModel);
                
                const scores = analysis.analysis.map(a => a.score);
                const minScore = Math.min(...scores);
                
                const scoreClass = (score: number) => score >= 8.5 ? 'bg-green-500' : (score >= 7.0 ? 'bg-yellow-500' : 'bg-red-500');
                
                currentAnalysisResults.push({
                    iteration: i,
                    results: analysis.analysis.map(item => ({
                        topic: ANALYSIS_TOPICS.find(t => t.num === item.topicNum) || { num: item.topicNum, name: 'Unknown', desc: '' },
                        score: item.score,
                        scoreClass: scoreClass(item.score),
                        improvement: item.improvement
                    }))
                });
                setAnalysisResults([...currentAnalysisResults]);
                setGenerationProgress(30 + (i * 5)); // Increment progress

                // Check Early Stop Condition (All scores >= 7.0, aka No Red)
                if (minScore >= 7.0) {
                    setGenerationStatus(`✅ Quality threshold met (Min Score: ${minScore}). Stopping iterations early.`);
                    break;
                }

                if (i < TOTAL_ITERATIONS) {
                    setGenerationStatus(`Improving draft (Iteration ${i})...`);
                    currentCode = await improvePaper(currentCode, analysis, language, generationModel);
                    setLatexCode(currentCode);
                }
            }

            setFinalLatexCode(currentCode);
            setIsGenerationComplete(true);
            setGenerationProgress(80);

            // 4. Compile
            setGenerationStatus('Compiling PDF...');
            // Need a way to compile from here without the UI component's internal state
            // Reusing the fetch logic from LatexCompiler or creating a service function
            // For now, let's assume we can trigger it or call a service. 
            // We'll reimplement basic compilation fetch here for automation
            const compileRes = await fetch('/compile-latex', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ latex: currentCode }),
            });
            
            if (!compileRes.ok) {
                // Try Auto-Fix if compilation fails
                const errorLog = await compileRes.text(); // Get detailed log
                setGenerationStatus('Compilation failed. Attempting auto-fix...');
                const fixedCode = await fixLatexPaper(currentCode, errorLog, analysisModel);
                setLatexCode(fixedCode);
                
                // Retry compile
                const retryRes = await fetch('/compile-latex', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ latex: fixedCode }),
                });
                
                if (!retryRes.ok) throw new Error("Compilation failed after auto-fix.");
                
                const retryBlob = await retryRes.blob();
                setCompiledPdfFile(new File([retryBlob], "paper.pdf", { type: "application/pdf" }));
            } else {
                const blob = await compileRes.blob();
                setCompiledPdfFile(new File([blob], "paper.pdf", { type: "application/pdf" }));
            }
            
            setGenerationProgress(90);

            // 5. Upload (Requires ZenodoUploader to expose a method or separate service)
            // Since ZenodoUploader is a UI component, we might need to refactor or trigger it via Ref
            // Using the Ref approach for now if mounted, or direct service call
            setGenerationStatus('Uploading to Zenodo...');
            // We need to wait a bit for state updates to propagate if we rely on refs
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            if (uploaderRef.current) {
                uploaderRef.current.submit();
            } else {
                console.error("Uploader ref not available. Manual upload required.");
            }

        } catch (error) {
            console.error("Automation Error:", error);
            setGenerationStatus(`Error: ${error instanceof Error ? error.message : String(error)}`);
            
            // CRITICAL FIX: If we hit a "Rotation loop ended" error, stop everything.
            if (error instanceof Error && error.message.includes("Unexpected end of key rotation loop")) {
                setIsContinuousMode(false);
                setIsSchedulerEnabled(false);
                alert("⛔ CRITICAL ERROR: All API Keys are exhausted. Automation stopped.");
                return; // Stop the cycle
            }
        }
    };

    const handleParallelComplete = (entry: ArticleEntry) => {
        setArticleEntries(prev => {
            const updated = [entry, ...prev];
            localStorage.setItem('article_entries_log', JSON.stringify(updated));
            return updated;
        });
    };

    const handleWorkerUpdate = (id: number, status: string, progress: number, error: boolean = false) => {
        setParallelWorkers(prev => {
            const newWorkers = [...prev];
            const index = newWorkers.findIndex(w => w.id === id);
            if (index !== -1) {
                newWorkers[index] = { ...newWorkers[index], status, progress, error };
            }
            return newWorkers;
        });
    };

    const startParallelMode = () => {
        const keys = KeyManager.getAllKeys();
        if (keys.length === 0) {
            alert("Nenhuma chave de API encontrada. Configure nas definições.");
            return;
        }
        
        setIsParallelMode(true);
        // Initialize workers state
        setParallelWorkers(keys.map((_, index) => ({
            id: index,
            status: 'Aguardando início...',
            progress: 0,
            error: false
        })));
    };

    const stopParallelMode = () => {
        setIsParallelMode(false);
        setParallelWorkers([]);
    };

    // --- RENDER HELPERS ---
    const getScoreClass = (score: number) => {
        if (score >= 9.5) return 'bg-blue-600'; // Mestre dos Gênios
        if (score >= 8.5) return 'bg-green-500';
        if (score >= 7.0) return 'bg-yellow-500';
        return 'bg-red-500';
    };

    // ... (rest of the component logic: handleGenerate, etc. - mostly unchanged)
    
    // Dummy handler for manual trigger (simplified for brevity as focus is on automation)
    const handleGenerate = () => { runAutomationStep(0); };

    return (
        <div className="container mx-auto p-4 sm:p-6">
            {/* Header Area */}
            <div className="flex justify-end mb-4 gap-2">
                <button
                    onClick={() => setIsPersonalDataModalOpen(true)}
                    className="p-2 text-gray-600 hover:text-indigo-600 transition-colors rounded-full hover:bg-gray-100"
                    title="Configurações de Dados Pessoais"
                >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                </button>
                <button
                    onClick={() => setIsApiModalOpen(true)}
                    className="p-2 text-gray-600 hover:text-indigo-600 transition-colors rounded-full hover:bg-gray-100"
                    title="API Settings"
                >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </button>
            </div>

            <div className="main-header text-center">
                <h1 className="text-3xl font-bold text-gray-800">🔬 Gerador de Artigos Científicos Avançado</h1>
                <p className="text-gray-500">IA generativa com revisão por pares simulada e publicação automática.</p>
                
                <div className="flex flex-wrap justify-center gap-4 mt-6">
                    <div className="flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-lg border border-indigo-100">
                        <span className="text-sm font-semibold text-indigo-700">Disciplina:</span>
                        <select 
                            value={selectedDiscipline} 
                            onChange={(e) => setSelectedDiscipline(e.target.value)}
                            className="bg-white border-none text-sm font-medium text-gray-700 focus:ring-0 cursor-pointer"
                        >
                            {getAllDisciplines().map(d => (
                                <option key={d} value={d}>{d}</option>
                            ))}
                        </select>
                    </div>
                    
                    <button
                        onClick={startParallelMode}
                        className={`px-4 py-2 rounded-lg font-bold text-white shadow transition-all ${isParallelMode ? 'bg-red-500 hover:bg-red-600' : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:scale-105'}`}
                    >
                        {isParallelMode ? '🛑 PARAR PARALELO' : '🚀 MODO PARALELO MASSIVO'}
                    </button>
                </div>
            </div>

            {/* PARALLEL MODE GRID */}
            {isParallelMode ? (
                <div className="space-y-6">
                    <div className="flex justify-between items-center bg-gray-800 text-white p-4 rounded-lg shadow-lg">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <span className="animate-pulse">⚡</span> Painel de Controle Paralelo
                        </h2>
                        <button onClick={stopParallelMode} className="bg-red-500 hover:bg-red-600 px-3 py-1 rounded text-sm font-bold">
                            Encerrar Sessão
                        </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {KeyManager.getAllKeys().map((key, index) => (
                            <ParallelWorker
                                key={index}
                                workerId={index}
                                apiKey={key}
                                language={language}
                                discipline={selectedDiscipline}
                                pageCount={pageCount}
                                analysisModel={analysisModel}
                                generationModel={generationModel}
                                authors={authors}
                                zenodoToken={zenodoToken}
                                useSandbox={useSandbox}
                                onComplete={handleParallelComplete}
                                onLogUpdate={handleWorkerUpdate}
                            />
                        ))}
                    </div>
                </div>
            ) : (
                <>
                    {/* STANDARD MODE WORKFLOW STEPS */}
                    <div className="workflow-steps">
                        {[1, 2, 3, 4].map((s) => (
                            <div key={s} className={`step-card ${step === s ? 'active' : ''} ${step > s ? 'completed' : ''}`} onClick={() => setStep(s)}>
                                <div className="step-number">{step > s ? '✓' : s}</div>
                                <div className="step-title">
                                    {s === 1 ? 'Gerar Artigo' : s === 2 ? 'Compilar & Revisar' : s === 3 ? 'Publicar no Zenodo' : 'Artigos Publicados'}
                                </div>
                                <div className="step-status">
                                    {s === 1 ? 'Configure a IA' : s === 2 ? 'Gerar PDF e editar' : s === 3 ? 'Obter DOI' : 'Ver e filtrar'}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Step 1: Generation Configuration */}
                    <div className={step === 1 ? 'block' : 'hidden'}>
                        <div className="card">
                            <LanguageSelector languages={LANGUAGES} selectedLanguage={language} onSelect={setLanguage} />
                            <ModelSelector models={AVAILABLE_MODELS} selectedModel={generationModel} onSelect={setGenerationModel} label="Modelo de Geração (Escrita)" />
                            <PageSelector options={[12, 30, 60, 100]} selectedPageCount={pageCount} onSelect={setPageCount} />
                            
                            {isGenerating ? (
                                <div className="text-center py-10">
                                    <div className="spinner mx-auto mb-4" style={{ width: '40px', height: '40px', borderColor: '#667eea', borderTopColor: 'transparent' }}></div>
                                    <h3 className="text-xl font-bold text-gray-700 animate-pulse">{generationStatus}</h3>
                                    <ProgressBar progress={generationProgress} isVisible={true} />
                                </div>
                            ) : (
                                <ActionButton onClick={handleGenerate} disabled={isGenerating} isLoading={isGenerating} text="Iniciar Geração Única" loadingText="Processando..." />
                            )}
                        </div>
                        <ResultsDisplay analysisResults={analysisResults} totalIterations={TOTAL_ITERATIONS} />
                    </div>

                    {/* Step 2: Compile & Edit */}
                    <div className={step === 2 ? 'block' : 'hidden'}>
                        <div className="card">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-bold">Editor LaTeX</h2>
                                <button className="btn btn-primary bg-indigo-600" onClick={async () => {
                                    /* Manual compile logic here, similar to runAutomationStep compile part */
                                    setIsCompiling(true);
                                    try {
                                        const res = await fetch('/compile-latex', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ latex: latexCode }),
                                        });
                                        if (res.ok) {
                                            const blob = await res.blob();
                                            const url = URL.createObjectURL(blob);
                                            setPdfPreviewUrl(url);
                                            setCompiledPdfFile(new File([blob], "paper.pdf", { type: "application/pdf" }));
                                        }
                                    } catch(e) { console.error(e); }
                                    setIsCompiling(false);
                                }}>Compilar PDF</button>
                            </div>
                            <LatexCompiler code={latexCode} onCodeChange={setLatexCode} />
                            {pdfPreviewUrl && (
                                <div className="mt-6 h-[600px] border rounded-lg overflow-hidden">
                                    <iframe src={pdfPreviewUrl} className="w-full h-full"></iframe>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Step 3: Zenodo Upload */}
                    <div className={step === 3 ? 'block' : 'hidden'}>
                        <ZenodoUploader 
                            ref={uploaderRef}
                            title={generatedTitle}
                            abstractText={extractedMetadata.abstract || "Abstract placeholder..."}
                            keywords={extractedMetadata.keywords || "science, ai"}
                            authors={authors.map(a => ({ name: a.name, affiliation: a.affiliation, orcid: a.orcid }))}
                            compiledPdfFile={compiledPdfFile}
                            onFileSelect={setCompiledPdfFile}
                            onPublishStart={() => setIsUploading(true)}
                            onPublishSuccess={(res) => { setIsUploading(false); /* Add to logs */ }}
                            onPublishError={(err) => { setIsUploading(false); alert(err); }}
                            extractedMetadata={extractedMetadata.title ? extractedMetadata : null}
                        />
                    </div>

                    {/* Step 4: Published Articles */}
                    <div className={step === 4 ? 'block' : 'hidden'}>
                        <div className="card">
                            <div className="flex flex-wrap gap-4 mb-6 items-end">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Filtrar por Data:</label>
                                    <div className="flex gap-2">
                                        <input type="text" placeholder="Dia (ex: 5)" className="w-20 p-2 border rounded" value={filter.day} onChange={e => setFilter({...filter, day: e.target.value})} />
                                        <input type="text" placeholder="Mês (ex: 8)" className="w-20 p-2 border rounded" value={filter.month} onChange={e => setFilter({...filter, month: e.target.value})} />
                                        <input type="text" placeholder="Ano (ex: 2024)" className="w-24 p-2 border rounded" value={filter.year} onChange={e => setFilter({...filter, year: e.target.value})} />
                                    </div>
                                </div>
                                <button onClick={() => {
                                    if(confirm("Tem certeza que deseja apagar todo o histórico?")) {
                                        localStorage.removeItem('article_entries_log');
                                        setArticleEntries([]);
                                    }
                                }} className="ml-auto text-red-500 hover:text-red-700 font-bold">Limpar Histórico</button>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Título do Artigo</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Link/Ação</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {articleEntries.filter(entry => {
                                            if (!entry.date) return false;
                                            const date = new Date(entry.date);
                                            const d = String(date.getDate());
                                            const m = String(date.getMonth() + 1);
                                            const y = String(date.getFullYear());
                                            return (
                                                (!filter.day || d === filter.day || d === '0'+filter.day) &&
                                                (!filter.month || m === filter.month || m === '0'+filter.month) &&
                                                (!filter.year || y === filter.year)
                                            );
                                        }).map((entry) => (
                                            <tr key={entry.id}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{entry.title || "(Geração do Título Falhou)"}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(entry.date).toLocaleString()}</td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                        entry.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                    }`}>
                                                        {entry.status === 'published' ? 'Publicado' : 'Falha no Upload'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {entry.status === 'published' && entry.link ? (
                                                        <a href={entry.link} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-900">Ver no Zenodo</a>
                                                    ) : (
                                                        <div className="flex flex-col gap-1">
                                                            <span className="text-xs text-red-500 max-w-xs truncate" title={entry.errorMessage}>{entry.errorMessage}</span>
                                                            <button 
                                                                onClick={() => {
                                                                    /* Republish logic needs to be robust, essentially recreating state for step 3 */
                                                                    if (entry.latexCode) {
                                                                        setGeneratedTitle(entry.title);
                                                                        setLatexCode(entry.latexCode);
                                                                        setStep(3); // Go to upload step
                                                                        // Need to recompile or just load code
                                                                    }
                                                                }}
                                                                className="text-blue-600 hover:text-blue-800 text-xs font-bold"
                                                            >
                                                                Tentar Novamente
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </>
            )}

            <ApiKeyModal 
                isOpen={isApiModalOpen} 
                onClose={() => setIsApiModalOpen(false)} 
                onSave={handleSaveApiKeys}
            />
            <PersonalDataModal
                isOpen={isPersonalDataModalOpen}
                onClose={() => setIsPersonalDataModalOpen(false)}
                onSave={handleSavePersonalData}
                initialData={authors}
            />
        </div>
    );
};

export default App;