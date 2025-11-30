

import React, { useState, useEffect, useRef } from 'react';
import { generateInitialPaper, analyzePaper, improvePaper, generatePaperTitle, fixLatexPaper, reformatPaperWithStyleGuide } from './services/geminiService';
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

        setAuthors([fixedAuthor1, dynamicAuthor2]);
    }, [selectedDiscipline]);

    // Effect to save all article entries to localStorage
    useEffect(() => {
        try {
            localStorage.setItem('article_entries_log', JSON.stringify(articleEntries));
        } catch (error) {
            console.error("Failed to save article entries to localStorage", error);
        }
    }, [articleEntries]);

    // Effect for the automatic scheduler
    useEffect(() => {
        if (!isSchedulerEnabled || isGenerating) {
            if (schedulerTimeoutRef.current) {
                clearTimeout(schedulerTimeoutRef.current);
                schedulerTimeoutRef.current = null;
            }
            return;
        }

        const scheduleNextRun = () => {
            if (schedulerTimeoutRef.current) clearTimeout(schedulerTimeoutRef.current);

            const now = new Date();
            
            const fiveAM = new Date(now);
            fiveAM.setHours(5, 0, 0, 0);
            
            const noon = new Date(now);
            noon.setHours(12, 0, 0, 0);

            const nextDayFiveAM = new Date(now);
            nextDayFiveAM.setDate(now.getDate() + 1);
            nextDayFiveAM.setHours(5, 0, 0, 0);

            let nextRunTime;
            if (now < fiveAM) {
                nextRunTime = fiveAM;
            } else if (now < noon) {
                nextRunTime = noon;
            } else {
                nextRunTime = nextDayFiveAM;
            }
            
            const delay = nextRunTime.getTime() - now.getTime();
            console.log(`Scheduling next automatic run at ${nextRunTime.toLocaleString()} (in ${Math.round(delay/1000/60)} minutes)`);

            schedulerTimeoutRef.current = window.setTimeout(() => {
                console.log("Scheduler triggered! Starting automatic run...");
                if (!isGenerating) handleFullAutomation(7);
                scheduleNextRun();
            }, delay);
        };

        scheduleNextRun();

        return () => {
            if (schedulerTimeoutRef.current) {
                clearTimeout(schedulerTimeoutRef.current);
                schedulerTimeoutRef.current = null;
            }
        };
    }, [isSchedulerEnabled, isGenerating]);


    const getScoreClass = (score: number) => {
        if (score >= 9.5) return 'bg-blue-600'; // MESTRE DOS GÊNIOS
        if (score >= 8.5) return 'bg-green-500';
        if (score >= 7.0) return 'bg-yellow-500';
        return 'bg-red-500';
    };

    const robustCompile = async (
        codeToCompile: string,
        onStatusUpdate: (message: string) => void
    ): Promise<{ pdfFile: File; pdfUrl: string; finalCode: string; }> => {
        console.group("🔍 DEBUG: Starting Robust Compile");
        console.log("Original Code Length:", codeToCompile.length);
        console.log("👇👇👇 FULL LATEX CODE BELOW 👇👇👇");
        console.log(codeToCompile);
        console.log("👆👆👆 FULL LATEX CODE ABOVE 👆👆👆");
        
        const MAX_COMPILE_ATTEMPTS = 3;
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= MAX_COMPILE_ATTEMPTS; attempt++) {
            try {
                onStatusUpdate(`⏳ Compilando (Tentativa ${attempt}/${MAX_COMPILE_ATTEMPTS})...`);
                console.log(`Attempt ${attempt}: Sending request to /compile-latex`);
                
                const response = await fetch('/compile-latex', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ latex: codeToCompile }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    console.error(`Attempt ${attempt} FAILED. Server error:`, errorData);
                    throw new Error(errorData.error || `Falha na compilação (tentativa ${attempt}).`);
                }
                
                const base64Pdf = await response.text();
                console.log(`Attempt ${attempt} SUCCESS. PDF received.`);
                const pdfUrl = `data:application/pdf;base64,${base64Pdf}`;
                const blob = await (await fetch(pdfUrl)).blob();
                const file = new File([blob], "paper.pdf", { type: "application/pdf" });
                
                console.groupEnd();
                return { pdfFile: file, pdfUrl, finalCode: codeToCompile };

            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                console.warn(`Compilation attempt ${attempt} failed:`, lastError.message);
                if (attempt < MAX_COMPILE_ATTEMPTS) await new Promise(resolve => setTimeout(resolve, 1500));
            }
        }
        
        if (lastError) {
            onStatusUpdate(`⚠️ Compilação falhou. Tentando corrigir o código com IA (Modelo: ${analysisModel})...`);
            console.log("Initiating AI Fix...");
            console.log("Error Reason (Full Log sent to AI):", lastError.message);
            
            let fixedCode = '';
            try {
                fixedCode = await fixLatexPaper(codeToCompile, lastError.message, analysisModel);
                console.log("AI Fix Generated. New Code Length:", fixedCode.length);
                console.log("👇👇👇 FIXED LATEX CODE BELOW 👇👇👇");
                console.log(fixedCode);
                console.log("👆👆👆 FIXED LATEX CODE ABOVE 👆👆👆");
            } catch (fixError) {
                const fixErrorMessage = fixError instanceof Error ? fixError.message : String(fixError);
                console.error("AI Fix Failed:", fixErrorMessage);
                throw new Error(`A compilação falhou e a tentativa de correção automática também falhou. Erro original: ${lastError.message}. Erro da correção: ${fixErrorMessage}`);
            }

            onStatusUpdate(`✅ Código corrigido. Tentando compilação final...`);
            try {
                const response = await fetch('/compile-latex', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ latex: fixedCode }),
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    console.error("Final Compilation Failed:", errorData);
                    throw new Error(errorData.error || 'A compilação final falhou mesmo após a correção automática.');
                }
                const base64Pdf = await response.text();
                const pdfUrl = `data:application/pdf;base64,${base64Pdf}`;
                const blob = await (await fetch(pdfUrl)).blob();
                const file = new File([blob], "paper.pdf", { type: "application/pdf" });
                console.groupEnd();
                return { pdfFile: file, pdfUrl, finalCode: fixedCode };
            } catch (finalCompileError) {
                const finalErrorMessage = finalCompileError instanceof Error ? finalCompileError.message : String(finalCompileError);
                console.error("Final Error:", finalErrorMessage);
                console.groupEnd();
                throw new Error(`A compilação falhou após a correção automática. Erro final: ${finalErrorMessage}`);
            }
        }
        console.groupEnd();
        throw new Error("Falha na compilação após todas as tentativas.");
    };

    const handleFullAutomation = async (batchSizeOverride?: number) => {
        // Important: In Continuous Mode, we default to a batch size of 1 to allow for cooldowns between papers.
        // This prevents the "Quota Exhausted" error caused by processing 7 papers (1.5M tokens) simultaneously.
        const articlesToProcess = batchSizeOverride ?? (isContinuousMode ? 1 : numberOfArticles);
        const storedToken = localStorage.getItem('zenodo_api_key');
        if (!storedToken) {
            alert('❌ Token Zenodo não encontrado! Por favor, configure-o nas definições (ícone de engrenagem) antes de iniciar.');
            return;
        }
        setZenodoToken(storedToken);

        // Check if author details are present
        const hasValidAuthor = authors.some(author => author.name && author.affiliation && author.orcid);
        if (authors.length === 0 || !hasValidAuthor) {
            alert('❌ Dados pessoais do autor (Nome, Afiliação, ORCID) não encontrados ou incompletos! Por favor, configure-os no ícone de "pessoa" antes de iniciar.');
            setIsPersonalDataModalOpen(true);
            return;
        }

        isGenerationCancelled.current = false;
        setIsGenerating(true);
        setUploadStatus(null);
        setStep(1);
        
        for (let i = 1; i <= articlesToProcess; i++) {
            if (isGenerationCancelled.current) break;
            
            const articleEntryId = crypto.randomUUID();
            let temporaryTitle = `Artigo ${i} (Geração do Título Falhou)`;
            let currentPaper = '';

            try {
                setIsGenerationComplete(false);
                setGenerationProgress(0);
                setAnalysisResults([]);
                setPaperSources([]);
                setGeneratedTitle('');
                setFinalLatexCode('');

                setGenerationStatus(`Artigo ${i}/${articlesToProcess}: Gerando um título inovador para ${selectedDiscipline} (Modelo: ${analysisModel})...`);
                setGenerationProgress(5);
                // Use getRandomTopic with selectedDiscipline
                const randomTopic = getRandomTopic(selectedDiscipline);
                // Pass selectedDiscipline to the title generator
                temporaryTitle = await generatePaperTitle(randomTopic, language, analysisModel, selectedDiscipline);
                setGeneratedTitle(temporaryTitle);

                setGenerationStatus(`Artigo ${i}/${articlesToProcess}: Gerando a primeira versão (Modelo: ${generationModel})...`);
                setGenerationProgress(15);
                const { paper: initialPaper, sources } = await generateInitialPaper(
                    temporaryTitle, 
                    language, 
                    pageCount, 
                    generationModel, 
                    authors // Pass dynamic authors array
                );
                currentPaper = initialPaper;
                setPaperSources(sources);

                for (let iter = 1; iter <= TOTAL_ITERATIONS; iter++) {
                    if (isGenerationCancelled.current) throw new Error("Operação cancelada pelo usuário.");
                    setGenerationProgress(15 + (iter / TOTAL_ITERATIONS) * 75);
                    setGenerationStatus(`Artigo ${i}/${articlesToProcess}: Analisando (iteração ${iter}/${TOTAL_ITERATIONS}) (Modelo: ${analysisModel})...`);
                    const analysisResult = await analyzePaper(currentPaper, pageCount, analysisModel);
                    const validAnalysisItems = analysisResult.analysis.filter(res => ANALYSIS_TOPICS.some(topic => topic.num === res.topicNum));
                    setAnalysisResults(prev => [...prev, { iteration: iter, results: validAnalysisItems.map(res => ({ topic: ANALYSIS_TOPICS.find(t => t.num === res.topicNum)!, score: res.score, scoreClass: getScoreClass(res.score), improvement: res.improvement })) }]);
                    if (!validAnalysisItems.some(res => res.score < 7.0)) break;
                    if (iter < TOTAL_ITERATIONS) {
                        setGenerationStatus(`Artigo ${i}/${articlesToProcess}: Refinando com base no feedback ${iter}... (Modelo: ${generationModel})`);
                        currentPaper = await improvePaper(currentPaper, { analysis: validAnalysisItems }, language, generationModel);
                    }
                }

                if (isGenerationCancelled.current) continue;

                setFinalLatexCode(currentPaper);
                setGenerationProgress(95);
                let compiledFile: File | null = null;
                const compilationUpdater = (message: string) => setGenerationStatus(`Artigo ${i}/${articlesToProcess}: ${message}`);
                const { pdfFile, finalCode } = await robustCompile(currentPaper, compilationUpdater);
                compiledFile = pdfFile;
                currentPaper = finalCode;

                if (isGenerationCancelled.current) continue;

                setGenerationStatus(`Artigo ${i}/${articlesToProcess}: Publicando no Zenodo...`);
                setGenerationProgress(98);
                const metadataForUpload = extractMetadata(currentPaper, true);
                const keywordsForUpload = currentPaper.match(/\\keywords\{([^}]+)\}/)?.[1] || '';
                let publishedResult: PublishedArticle | null = null;
                
                // Helper to wrap URL with proxy for Zenodo calls in automation loop
                const proxied = (url: string) => `/zenodo-proxy?target=${encodeURIComponent(url)}`;

                for (let attempt = 1; attempt <= 10; attempt++) {
                    if (isGenerationCancelled.current) break;
                    try {
                        const baseUrl = useSandbox ? 'https://sandbox.zenodo.org/api' : 'https://zenodo.org/api';
                        // Use proxy for creation
                        const createResponse = await fetch(proxied(`${baseUrl}/deposit/depositions`), { method: 'POST', headers: { 'Authorization': `Bearer ${storedToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
                        if (!createResponse.ok) throw new Error(`Erro ${createResponse.status} ao criar depósito.`);
                        const deposit = await createResponse.json();
                        
                        const formData = new FormData();
                        formData.append('file', compiledFile, 'paper.pdf');
                        
                        // Use proxy for file upload
                        const uploadResponse = await fetch(proxied(`${baseUrl}/deposit/depositions/${deposit.id}/files`), { method: 'POST', headers: { 'Authorization': `Bearer ${storedToken}` }, body: formData });
                        if (!uploadResponse.ok) throw new Error('Falha no upload do PDF');
                        
                        const creators = authors.filter(a => a.name).map(author => ({
                            name: author.name,
                            orcid: author.orcid || undefined // Affiliation intentionally omitted for Zenodo
                        }));

                        const metadataPayload = { metadata: { title: metadataForUpload.title, upload_type: 'publication', publication_type: 'article', description: metadataForUpload.abstract, creators: creators, keywords: keywordsForUpload.split(',').map(k => k.trim()).filter(k => k) } };
                        // Use proxy for metadata update
                        const metadataResponse = await fetch(proxied(`${baseUrl}/deposit/depositions/${deposit.id}`), { method: 'PUT', headers: { 'Authorization': `Bearer ${storedToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(metadataPayload) });
                        if (!metadataResponse.ok) throw new Error('Falha ao atualizar metadados');
                        // Use proxy for publish
                        const publishResponse = await fetch(proxied(`${baseUrl}/deposit/depositions/${deposit.id}/actions/publish`), { method: 'POST', headers: { 'Authorization': `Bearer ${storedToken}` } });
                        if (!publishResponse.ok) throw new Error('Falha ao publicar');
                        const published = await publishResponse.json();
                        publishedResult = { doi: published.doi, link: useSandbox ? `https://sandbox.zenodo.org/records/${deposit.id}` : `https://zenodo.org/records/${deposit.id}`, title: metadataForUpload.title, date: new Date().toISOString() };
                        break;
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : `Tentativa ${attempt} falhou.`;
                        if (attempt === 10) throw new Error(`Falha ao enviar para o Zenodo após 10 tentativas. Erro final: ${errorMessage}`);
                        const delayTime = 15000 + (5000 * (attempt - 1));
                        setGenerationStatus(`Artigo ${i}/${articlesToProcess}: ❌ ${errorMessage} Aguardando ${delayTime / 1000}s...`);
                        await new Promise(resolve => setTimeout(resolve, delayTime));
                    }
                }
                
                if (publishedResult) {
                    setArticleEntries(prev => [...prev, { id: articleEntryId, title: metadataForUpload.title, date: publishedResult.date, status: 'published', doi: publishedResult.doi, link: publishedResult.link }]);
                } else if (!isGenerationCancelled.current) {
                     throw new Error("Não foi possível publicar no Zenodo após todas as tentativas.");
                }

            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : `Ocorreu um erro desconhecido no artigo ${i}.`;
                console.error(`Error processing article ${i}:`, error);

                // Critical Error Handling: Stop automation on quota errors OR when rotation loop exhausted.
                const lowerMsg = errorMessage.toLowerCase();
                if (
                    lowerMsg.includes('quota') || 
                    lowerMsg.includes('exhausted') || 
                    lowerMsg.includes('rotation loop') ||
                    lowerMsg.includes('api key') // Added check for invalid key exhaustion
                ) {
                    setGenerationStatus(`🛑 Limite de cota atingido em TODAS as chaves de API. A automação será pausada.`);
                    setArticleEntries(prev => [...prev, { id: articleEntryId, title: temporaryTitle, date: new Date().toISOString(), status: 'upload_failed', latexCode: currentPaper, errorMessage: `Pausado por limite de cota global: ${errorMessage}` }]);
                    isGenerationCancelled.current = true; 
                    break;
                }

                // Resilient Handling for other errors
                const status = errorMessage.includes('compilação') ? 'compilation_failed' : 'upload_failed';
                setArticleEntries(prev => [...prev, { id: articleEntryId, title: temporaryTitle, date: new Date().toISOString(), status: status, latexCode: currentPaper, errorMessage: errorMessage }]);
                
                let pauseDuration = 3000;
                if (lowerMsg.includes('network') || lowerMsg.includes('fetch')) {
                    setGenerationStatus(`🔌 Problema de rede detectado. Pausando por 1 minuto...`);
                    pauseDuration = 60000;
                } else {
                     setGenerationStatus(`❌ Erro no artigo ${i}: ${errorMessage}. Continuando para o próximo em 3s...`);
                }
                await new Promise(resolve => setTimeout(resolve, pauseDuration));
                continue; // Continue to the next article in the loop for non-quota errors
            }
        } // end for loop

        setIsGenerating(false); // Stop generation state regardless of how the loop ended.

        if (isGenerationCancelled.current) {
            // Check if the stop was due to quota or manual cancellation
            setGenerationStatus(prevStatus => {
                if (prevStatus.includes('Limite de cota')) {
                    return prevStatus; // Keep the quota message
                }
                return "❌ Automação cancelada pelo usuário."; // Default manual cancellation message
            });
        } else if (isContinuousMode) {
            setGenerationStatus(`✅ Artigo concluído. Pausa estratégica de 60s para recuperar cota da API...`);
            setTimeout(() => {
                // Double-check flags before re-starting
                if (isContinuousMode && !isGenerationCancelled.current) {
                    // Start next cycle with just 1 article to keep cooldowns active
                    handleFullAutomation(1);
                }
            }, 60000); // Increased to 60 seconds wait
        } else {
            // This is for a normal, single batch completion
            setGenerationProgress(100);
            setGenerationStatus(`✅ Processo concluído! ${articlesToProcess} artigos processados.`);
            setStep(4);
        }
    };


    const handleRepublishPending = async (articleId: string) => {
        setIsRepublishingId(articleId);
        setUploadStatus(null);
        
        const articleToRepublish = articleEntries.find(entry => entry.id === articleId);
        if (!articleToRepublish || !articleToRepublish.latexCode) {
            setUploadStatus(<div className="status-message status-error">❌ Erro: Artigo ou código LaTeX não encontrado para republicação.</div>);
            setIsRepublishingId(null);
            return;
        }
    
        const storedToken = localStorage.getItem('zenodo_api_key');
        if (!storedToken) {
            setUploadStatus(<div className="status-message status-error">❌ Token Zenodo não encontrado! Por favor, configure-o nas definições (ícone de engrenagem).</div>);
            setIsRepublishingId(null);
            return;
        }
        setZenodoToken(storedToken);

        // Check if author details are present
        const hasValidAuthor = authors.some(author => author.name && author.affiliation && author.orcid);
        if (authors.length === 0 || !hasValidAuthor) {
            setUploadStatus(<div className="status-message status-error">❌ Dados pessoais do autor (Nome, Afiliação, ORCID) não encontrados ou incompletos! Por favor, configure-os no ícone de "pessoa".</div>);
            setIsPersonalDataModalOpen(true);
            setIsRepublishingId(null);
            return;
        }
        
        // Helper to wrap URL with proxy for republishing
        const proxied = (url: string) => `/zenodo-proxy?target=${encodeURIComponent(url)}`;
    
        try {
            setUploadStatus(<div className="status-message status-info">⏳ Iniciando republicação para "{articleToRepublish.title}"...</div>);
    
            let compiledFile: File | null = null;
            let finalCodeAfterFix = articleToRepublish.latexCode;
    
            try {
                const compilationUpdater = (message: string) => {
                    setUploadStatus(<div className="status-message status-info">⏳ Compilando para republicação: {message}</div>);
                };
                const { pdfFile, finalCode } = await robustCompile(articleToRepublish.latexCode, compilationUpdater);
                compiledFile = pdfFile;
                finalCodeAfterFix = finalCode;
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Falha na compilação para republicação.';
                setUploadStatus(<div className="status-message status-error">❌ Falha na compilação: {errorMessage}</div>);
                setArticleEntries(prev => prev.map(entry => 
                    entry.id === articleId ? { ...entry, status: 'compilation_failed', errorMessage: errorMessage, date: new Date().toISOString(), latexCode: finalCodeAfterFix } : entry
                ));
                setIsRepublishingId(null);
                return;
            }
    
            setUploadStatus(<div className="status-message status-info">🚀 Publicando no Zenodo...</div>);
            const metadataForUpload = extractMetadata(finalCodeAfterFix, true);
            const keywordsForUpload = finalCodeAfterFix.match(/\\keywords\{([^}]+)\}/)?.[1] || '';
    
            const MAX_UPLOAD_RETRIES = 5;
            let publishedResult: PublishedArticle | null = null;
    
            for (let attempt = 1; attempt <= MAX_UPLOAD_RETRIES; attempt++) {
                try {
                    const baseUrl = useSandbox ? 'https://sandbox.zenodo.org/api' : 'https://zenodo.org/api';
                    
                    const createResponse = await fetch(proxied(`${baseUrl}/deposit/depositions`), {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${storedToken}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({})
                    });
                    if (!createResponse.ok) throw new Error(`Erro ${createResponse.status}: Falha ao criar depósito.`);
                    const deposit = await createResponse.json();
    
                    const formData = new FormData();
                    formData.append('file', compiledFile, 'paper.pdf');
                    const uploadResponse = await fetch(proxied(`${baseUrl}/deposit/depositions/${deposit.id}/files`), {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${storedToken}` }, // Content-Type is not needed with FormData
                        body: formData
                    });
                    if (!uploadResponse.ok) throw new Error('Falha no upload do PDF');
    
                    const keywordsArray = keywordsForUpload.split(',').map(k => k.trim()).filter(k => k);
                    const creators = authors.filter(a => a.name).map(author => ({
                        name: author.name,
                        orcid: author.orcid || undefined // Affiliation intentionally omitted for Zenodo
                    }));

                    const metadataPayload = {
                        metadata: {
                            title: metadataForUpload.title,
                            upload_type: 'publication',
                            publication_type: 'article',
                            description: metadataForUpload.abstract,
                            creators: creators, // Use dynamic author details
                            keywords: keywordsArray.length > 0 ? keywordsArray : undefined
                        }
                    };
                    const metadataResponse = await fetch(proxied(`${baseUrl}/deposit/depositions/${deposit.id}`), {
                        method: 'PUT',
                        headers: { 'Authorization': `Bearer ${storedToken}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify(metadataPayload)
                    });
                    if (!metadataResponse.ok) throw new Error('Falha ao atualizar metadados');
    
                    const publishResponse = await fetch(proxied(`${baseUrl}/deposit/depositions/${deposit.id}/actions/publish`), {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${storedToken}` }
                    });
                    if (!publishResponse.ok) throw new Error('Falha ao publicar');
                    const published = await publishResponse.json();
    
                    const zenodoLink = useSandbox ? `https://sandbox.zenodo.org/records/${deposit.id}` : `https://zenodo.org/records/${deposit.id}`;
                    publishedResult = { 
                        doi: published.doi, 
                        link: zenodoLink, 
                        title: metadataForUpload.title,
                        date: new Date().toISOString()
                    };
                    break;
    
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : `Tentativa ${attempt} falhou.`;
                    if (attempt === MAX_UPLOAD_RETRIES) {
                        throw new Error(`Falha ao enviar para o Zenodo após ${MAX_UPLOAD_RETRIES} tentativas. Erro final: ${errorMessage}`);
                    }
                    const delayTime = 15000 + (5000 * (attempt - 1));
                    setUploadStatus(<div className="status-message status-error">❌ ${errorMessage} Aguardando ${delayTime / 1000}s para tentar novamente...</div>);
                    await new Promise(resolve => setTimeout(resolve, delayTime));
                }
            }
    
            if (publishedResult) {
                setUploadStatus(<div className="status-message status-success">✅ Publicado com sucesso! DOI: {publishedResult.doi}</div>);
                setArticleEntries(prev => prev.map(entry => 
                    entry.id === articleId ? { 
                        ...entry, 
                        status: 'published', 
                        doi: publishedResult.doi, 
                        link: publishedResult.link, 
                        date: publishedResult.date,
                        latexCode: undefined,
                        errorMessage: undefined 
                    } : entry
                ));
            } else {
                throw new Error("Não foi possível publicar no Zenodo após todas as tentativas.");
            }
    
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Um erro desconhecido ocorreu durante a republicação.';
            setUploadStatus(<div className="status-message status-error">❌ Erro na republicação: {errorMessage}</div>);
            setArticleEntries(prev => prev.map(entry => 
                entry.id === articleId ? { ...entry, status: 'upload_failed', errorMessage: errorMessage, date: new Date().toISOString() } : entry
            ));
        } finally {
            setIsRepublishingId(null);
        }
    };
    
    const handleProceedToCompile = () => {
        isGenerationCancelled.current = true;
        setLatexCode(finalLatexCode);
        setStep(2);
    }
    
    const extractMetadata = (code: string, returnData = false) => {
        // Use greedy matching (.*) to capture title even if it contains nested braces on the same line.
        const titleMatch = code.match(/\\title\{(.*)\}/);
        
        // Robust cleaning function for LaTeX strings
        const cleanLatexString = (str: string) => {
            if (!str) return '';
            let s = str;
            // 1. Remove standard formatting commands with backslash
            // Recursively remove common formatting commands: \textit{word} -> word, \textbf{word} -> word
            for(let i=0; i<3; i++) {
                s = s.replace(/\\(textit|textbf|emph|textsc|textsf|text|underline)\{([^}]+)\}/g, '$2');
            }
            
            // 2. Extra Robustness: Remove formatting commands WITHOUT backslash
            // This handles cases where '\' might have been stripped prematurely or input was malformed (e.g. textit{Word})
            s = s.replace(/(textit|textbf|emph|textsc|textsf|text|underline)\{([^}]+)\}/g, '$2');

            // 3. Remove escaped characters: \& -> &, \% -> %, \$ -> $
            s = s.replace(/\\([&%$#_{}])/g, '$1');

            // 4. Remove remaining braces if they are just grouping { }
            s = s.replace(/\\{([^}]+)\\}/g, '$1'); // Fixed Regex for brace removal

            // 5. Finally remove remaining backslashes (like in \'e -> 'e)
            s = s.replace(/\\/g, ''); 
            
            return s.trim();
        };

        const title = titleMatch ? cleanLatexString(titleMatch[1]) : 'Untitled Paper';
        
        const abstractMatch = code.match(/\\begin\{abstract\}([\s\S]*?)\\end\{abstract\}/);
        let abstractText = abstractMatch ? abstractMatch[1] : '';
        abstractText = abstractText.replace(/\\noindent\s*/g, '');
        abstractText = cleanLatexString(abstractText);
        
        // Use dynamic author details for metadata extraction
        // The `authors` state already holds the necessary ZenodoAuthor[] structure
        const currentAuthors: Author[] = authors.map(a => ({
            name: a.name,
            affiliation: a.affiliation,
            orcid: a.orcid
        }));
        
        const keywordsMatch = code.match(/\\keywords\{([^}]+)\}/) || code.match(/Palavras-chave:}\s*([^\n]+)/);
        const keywords = keywordsMatch ? keywordsMatch[1] : '';

        const metadata = { title, abstract: abstractText, authors: currentAuthors, keywords };

        if (returnData) {
            return metadata;
        }

        setKeywordsInput(keywords);
        setExtractedMetadata(metadata);
        return metadata;
    }

    const handleCompileLaTeX = async () => {
        setIsCompiling(true);
        setCompilationStatus(<div className="status-message status-info">⏳ Iniciando...</div>);
        setPdfPreviewUrl('');
        setCompiledPdfFile(null);
    
        if (compileMethod === 'texlive') {
            try {
                const statusUpdater = (message: string) => {
                    const isError = message.includes('falhou') || message.includes('Erro');
                    const isWarning = message.includes('⚠️');
                    let className = 'status-info';
                    if (isError) className = 'status-error';
                    else if (isWarning) className = 'status-info';
    
                    setCompilationStatus(<div className={`status-message ${className}`}>{message}</div>);
                };
    
                const { pdfFile, pdfUrl, finalCode } = await robustCompile(latexCode, statusUpdater);
                
                setPdfPreviewUrl(pdfUrl);
                setCompiledPdfFile(pdfFile);
                
                if (finalCode !== latexCode) {
                    setLatexCode(finalCode);
                    setCompilationStatus(
                        <div className="status-message status-success">✅ Código corrigido e PDF compilado! Verifique o preview.</div>
                    );
                } else {
                    setCompilationStatus(
                        <div className="status-message status-success">✅ PDF compilado com sucesso! Verifique o preview.</div>
                    );
                }
    
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Um erro desconhecido ocorreu.';
                setCompilationStatus(<div className="status-message status-error">❌ Erro Final de Compilação: {errorMessage}</div>);
            } finally {
                setIsCompiling(false);
            }
        } else { // overleaf
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = 'https://www.overleaf.com/docs';
            form.target = '_blank';
            
            const input = document.createElement('textarea');
            input.name = 'snip';
            input.value = latexCode;
            form.appendChild(input);
            
            document.body.appendChild(form);
            form.submit();
            document.body.removeChild(form);
            
            setCompilationStatus(
                <div className="status-message status-info">
                    📝 Overleaf aberto em nova aba!<br/><br/>
                    <strong>Próximos passos:</strong><br/>
                    1. Compile o LaTeX no Overleaf<br/>
                    2. Baixe o PDF gerado<br/>
                    3. Faça upload abaixo:<br/><br/>
                    <input type="file" id="manualPdfUpload" accept=".pdf" style={{ marginBottom: '12px' }} onChange={handleManualPDFUpload} />
                </div>
            );
            setIsCompiling(false);
        }
    };
    
    const handleManualPDFUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setCompiledPdfFile(file);
        const url = URL.createObjectURL(file);
        setPdfPreviewUrl(url);
         setCompilationStatus(
            <div className="status-message status-success">✅ PDF carregado! Verifique o preview.</div>
        );
    };

    const handleApplyStyleGuide = async () => {
        setIsReformatting(true);
        setCompilationStatus(<div className="status-message status-info">🤖 Aplicando guia de estilo à bibliografia...</div>);
        try {
            const reformattedCode = await reformatPaperWithStyleGuide(latexCode, selectedStyle, generationModel);
            setLatexCode(reformattedCode);
            setCompilationStatus(
                <div className="status-message status-success">✅ Guia de estilo aplicado com sucesso! O código foi atualizado.</div>
            );
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro desconhecido.";
            setCompilationStatus(
                <div className="status-message status-error">❌ Falha ao aplicar guia de estilo: {errorMessage}</div>
            );
        } finally {
            setIsReformatting(false);
        }
    };

    const handleProceedToUpload = () => {
        if (!compiledPdfFile) {
            alert('❌ Nenhum PDF foi compilado ou carregado!');
            return;
        }
        extractMetadata(latexCode);
        setStep(3);
    };

    const getStepCardClass = (stepNum: number) => {
        let classes = 'step-card cursor-pointer';
        if (step === stepNum) classes += ' active';
        if (step > stepNum) classes += ' completed';
        return classes;
    };
    
    const WORKFLOW_STEPS = [
        { id: 1, title: 'Gerar Artigo', status: 'Configure a IA' },
        { id: 2, title: 'Compilar & Revisar', status: 'Gerar PDF e editar' },
        { id: 3, title: 'Publicar no Zenodo', status: 'Obter DOI' },
        { id: 4, title: 'Artigos Publicados', status: 'Ver e filtrar' }
    ];
    
    const handleToggleContinuousMode = () => {
        const newStatus = !isContinuousMode;
        setIsContinuousMode(newStatus);
        localStorage.setItem('isContinuousMode', String(newStatus));
        if (!newStatus) isGenerationCancelled.current = true;
    };

    const handleToggleScheduler = () => {
        const newStatus = !isSchedulerEnabled;
        setIsSchedulerEnabled(newStatus);
        localStorage.setItem('isSchedulerEnabled', String(newStatus));
    };

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFilter(prev => ({ ...prev, [name]: value }));
    };

    const filteredArticles = articleEntries.filter(entry => {
        if (!entry.date) return false;
        const entryDate = new Date(entry.date);
        const dayMatch = filter.day ? entryDate.getDate().toString().padStart(2, '0') === filter.day.padStart(2, '0') : true;
        const monthMatch = filter.month ? (entryDate.getMonth() + 1).toString().padStart(2, '0') === filter.month.padStart(2, '0') : true;
        const yearMatch = filter.year ? entryDate.getFullYear().toString() === filter.year : true;
        return dayMatch && monthMatch && yearMatch;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
        <div className="min-h-screen bg-gray-100 font-sans text-gray-900">
            <div className="max-w-5xl mx-auto px-4 py-8">
                
                <h1 className="text-4xl font-extrabold text-center mb-8 text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
                    Advanced Scientific Paper Generator
                </h1>

                <div className="flex justify-end gap-2 mb-4">
                     <button onClick={() => setIsPersonalDataModalOpen(true)} className="p-2 text-gray-600 hover:text-indigo-600 transition-colors" title="Personal Data">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    </button>
                    <button onClick={() => setIsApiModalOpen(true)} className="p-2 text-gray-600 hover:text-indigo-600 transition-colors" title="Settings">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </button>
                </div>

                {/* Workflow Steps Tabs */}
                <div className="flex justify-between mb-8 overflow-x-auto pb-2">
                     {WORKFLOW_STEPS.map((s) => (
                        <div 
                            key={s.id} 
                            onClick={() => !isGenerating && setStep(s.id)}
                            className={`flex-1 min-w-[150px] text-center p-3 border-b-4 cursor-pointer transition-colors ${step === s.id ? 'border-indigo-600 text-indigo-700 font-bold' : 'border-gray-200 text-gray-500 hover:text-gray-700'}`}
                        >
                            <div className="text-lg">{s.title}</div>
                            <div className="text-xs font-normal">{s.status}</div>
                        </div>
                    ))}
                </div>

                {/* Step 1: Configuration & Generation */}
                {step === 1 && (
                    <div className="space-y-8 animate-fade-in">
                        <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                                <span className="bg-indigo-100 text-indigo-700 w-8 h-8 rounded-full flex items-center justify-center mr-3 text-sm">1</span>
                                Configuration
                            </h2>
                            
                            <div className="mb-6">
                                <label className="block text-gray-700 font-semibold mb-2 text-center">Language</label>
                                <LanguageSelector languages={LANGUAGES} selectedLanguage={language} onSelect={setLanguage} />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                <div>
                                    <label className="block text-gray-700 font-semibold mb-2">Target Discipline</label>
                                    <select 
                                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                        value={selectedDiscipline}
                                        onChange={(e) => setSelectedDiscipline(e.target.value)}
                                    >
                                        {getAllDisciplines().map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-gray-700 font-semibold mb-2">Paper Length</label>
                                    <PageSelector options={[12, 30, 60, 100]} selectedPageCount={pageCount} onSelect={setPageCount} />
                                </div>
                            </div>

                            <ModelSelector 
                                models={AVAILABLE_MODELS} 
                                selectedModel={generationModel} 
                                onSelect={setGenerationModel} 
                                label="Generation Model"
                            />
                            
                            <ModelSelector 
                                models={AVAILABLE_MODELS} 
                                selectedModel={analysisModel} 
                                onSelect={setAnalysisModel} 
                                label="Analysis & Critique Model"
                            />
                        </section>

                        <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                             <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                                <span className="bg-indigo-100 text-indigo-700 w-8 h-8 rounded-full flex items-center justify-center mr-3 text-sm">2</span>
                                Automation Settings
                            </h2>
                             <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
                                <div className="flex items-center gap-2">
                                    <label className="flex items-center cursor-pointer">
                                        <div className="relative">
                                            <input type="checkbox" className="sr-only" checked={isContinuousMode} onChange={handleToggleContinuousMode} />
                                            <div className={`block w-14 h-8 rounded-full transition-colors ${isContinuousMode ? 'bg-indigo-600' : 'bg-gray-300'}`}></div>
                                            <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${isContinuousMode ? 'transform translate-x-6' : ''}`}></div>
                                        </div>
                                        <div className="ml-3 text-gray-700 font-medium">Continuous Mode</div>
                                    </label>
                                </div>

                                <div className="flex items-center gap-2">
                                     <label className="flex items-center cursor-pointer">
                                        <div className="relative">
                                            <input type="checkbox" className="sr-only" checked={isSchedulerEnabled} onChange={handleToggleScheduler} />
                                            <div className={`block w-14 h-8 rounded-full transition-colors ${isSchedulerEnabled ? 'bg-indigo-600' : 'bg-gray-300'}`}></div>
                                            <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${isSchedulerEnabled ? 'transform translate-x-6' : ''}`}></div>
                                        </div>
                                        <div className="ml-3 text-gray-700 font-medium">Scheduler (05:00 / 12:00)</div>
                                    </label>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                    <label className="text-gray-700 font-medium">Batch Size:</label>
                                    <input 
                                        type="number" 
                                        min="1" 
                                        max="10" 
                                        value={numberOfArticles} 
                                        onChange={(e) => setNumberOfArticles(Math.max(1, parseInt(e.target.value) || 1))}
                                        className="w-16 p-1 border border-gray-300 rounded text-center"
                                        disabled={isContinuousMode} // Continuous mode overrides this to 1
                                    />
                                </div>
                            </div>
                        </section>

                        <div className="text-center">
                            <ActionButton 
                                onClick={() => handleFullAutomation()} 
                                disabled={isGenerating} 
                                isLoading={isGenerating} 
                                text={isContinuousMode ? "Start Continuous Loop" : "Generate Paper(s)"}
                                loadingText="Processing..." 
                            />
                            {isGenerating && (
                                <button 
                                    onClick={() => isGenerationCancelled.current = true}
                                    className="mt-4 text-red-600 underline text-sm hover:text-red-800"
                                >
                                    Stop Automation
                                </button>
                            )}
                        </div>
                        
                        {isGenerating && (
                            <div className="mt-8 p-6 bg-white rounded-xl shadow-lg border-t-4 border-indigo-500 animate-pulse-soft">
                                <h3 className="text-lg font-bold text-gray-800 mb-2 text-center">{generationStatus}</h3>
                                <ProgressBar progress={generationProgress} isVisible={true} />
                                {generatedTitle && <p className="text-center text-gray-600 italic mt-2">Current Title: "{generatedTitle}"</p>}
                            </div>
                        )}

                        {analysisResults.length > 0 && (
                            <div className="mt-8">
                                <h3 className="text-xl font-bold mb-4">Latest Analysis</h3>
                                <ResultsDisplay analysisResults={analysisResults} totalIterations={TOTAL_ITERATIONS} />
                            </div>
                        )}
                        
                        {paperSources.length > 0 && (
                             <div className="mt-8">
                                <SourceDisplay sources={paperSources} />
                             </div>
                        )}
                        
                        {isGenerationComplete && !isContinuousMode && (
                             <div className="text-center mt-8">
                                <button 
                                    onClick={handleProceedToCompile}
                                    className="bg-green-600 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-green-700 transition-transform transform hover:scale-105"
                                >
                                    Proceed to Compilation
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Step 2: Compile & Edit */}
                {step === 2 && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                             <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                                <span className="bg-indigo-100 text-indigo-700 w-8 h-8 rounded-full flex items-center justify-center mr-3 text-sm">2</span>
                                LaTeX Compilation & Editing
                            </h2>

                            <LatexCompiler code={latexCode} onCodeChange={setLatexCode} />

                            <div className="mt-6 border-t pt-6">
                                <h3 className="font-bold text-gray-800 mb-3">Bibliography Formatting</h3>
                                <div className="flex flex-col sm:flex-row items-center gap-4">
                                    <StyleGuideSelector guides={STYLE_GUIDES} selectedGuide={selectedStyle} onSelect={setSelectedStyle} />
                                    <button 
                                        onClick={handleApplyStyleGuide}
                                        disabled={isReformatting}
                                        className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 disabled:opacity-50 font-medium"
                                    >
                                        {isReformatting ? 'Applying...' : 'Apply Style'}
                                    </button>
                                </div>
                            </div>
                            
                            <div className="mt-6 flex flex-wrap gap-4 justify-center">
                                <div className="flex items-center gap-2 border p-2 rounded-lg bg-gray-50">
                                    <input 
                                        type="radio" 
                                        id="texlive" 
                                        name="compileMethod" 
                                        checked={compileMethod === 'texlive'} 
                                        onChange={() => setCompileMethod('texlive')} 
                                    />
                                    <label htmlFor="texlive">TeXLive.net (Direct)</label>
                                </div>
                                <div className="flex items-center gap-2 border p-2 rounded-lg bg-gray-50">
                                    <input 
                                        type="radio" 
                                        id="overleaf" 
                                        name="compileMethod" 
                                        checked={compileMethod === 'overleaf'} 
                                        onChange={() => setCompileMethod('overleaf')} 
                                    />
                                    <label htmlFor="overleaf">Overleaf (Manual)</label>
                                </div>
                            </div>

                            <div className="mt-6 text-center">
                                <button 
                                    onClick={handleCompileLaTeX}
                                    disabled={isCompiling}
                                    className="bg-indigo-600 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-indigo-700 disabled:bg-gray-400 transition-all"
                                >
                                    {isCompiling ? 'Compiling...' : 'Compile PDF'}
                                </button>
                            </div>
                            
                            <div className="mt-4 text-center">
                                {compilationStatus}
                            </div>
                        </div>

                        {pdfPreviewUrl && (
                             <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-200">
                                <h3 className="font-bold mb-2 text-gray-700">PDF Preview</h3>
                                <iframe src={pdfPreviewUrl} className="w-full h-[600px] border rounded" title="PDF Preview"></iframe>
                                <div className="mt-4 text-center">
                                     <button 
                                        onClick={handleProceedToUpload}
                                        className="bg-green-600 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-green-700 transition-transform transform hover:scale-105"
                                    >
                                        Proceed to Zenodo Upload
                                    </button>
                                </div>
                             </div>
                        )}
                    </div>
                )}

                {/* Step 3: Upload */}
                {step === 3 && (
                     <div className="animate-fade-in">
                        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center bg-white p-4 rounded-lg shadow-sm">
                            <span className="bg-indigo-100 text-indigo-700 w-8 h-8 rounded-full flex items-center justify-center mr-3 text-sm">3</span>
                            Zenodo Publication
                        </h2>
                        <ZenodoUploader 
                            ref={uploaderRef}
                            title={extractedMetadata.title}
                            abstractText={extractedMetadata.abstract}
                            keywords={keywordsInput}
                            authors={extractedMetadata.authors.map(a => ({ name: a.name, affiliation: a.affiliation, orcid: a.orcid }))}
                            compiledPdfFile={compiledPdfFile}
                            onFileSelect={(file) => setCompiledPdfFile(file)}
                            onPublishStart={() => { setIsUploading(true); setUploadStatus(null); }}
                            onPublishSuccess={(res) => {
                                setIsUploading(false);
                                setUploadStatus(<div className="status-message status-success">✅ Published! DOI: {res.doi}</div>);
                                setArticleEntries(prev => [...prev, {
                                    id: crypto.randomUUID(),
                                    title: extractedMetadata.title,
                                    date: new Date().toISOString(),
                                    status: 'published',
                                    doi: res.doi,
                                    link: res.zenodoLink
                                }]);
                                alert(`Successfully published! DOI: ${res.doi}`);
                            }}
                            onPublishError={(msg) => {
                                setIsUploading(false);
                                setUploadStatus(<div className="status-message status-error">❌ {msg}</div>);
                            }}
                            extractedMetadata={extractedMetadata}
                        />
                         <div className="mt-6 text-center">
                            <ActionButton 
                                onClick={() => uploaderRef.current?.submit()} 
                                disabled={isUploading || !compiledPdfFile} 
                                isLoading={isUploading} 
                                text="Publish to Zenodo" 
                                loadingText="Publishing..." 
                            />
                            <div className="mt-4">{uploadStatus}</div>
                         </div>
                     </div>
                )}

                {/* Step 4: Published Articles Log */}
                {step === 4 && (
                    <div className="animate-fade-in bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                         <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
                            <span className="bg-indigo-100 text-indigo-700 w-8 h-8 rounded-full flex items-center justify-center mr-3 text-sm">4</span>
                            Article History & Logs
                        </h2>

                        <div className="mb-6 flex flex-wrap gap-4 bg-gray-50 p-4 rounded-lg">
                            <input 
                                type="text" 
                                name="day" 
                                placeholder="DD" 
                                value={filter.day} 
                                onChange={handleFilterChange} 
                                className="w-20 p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500" 
                            />
                            <input 
                                type="text" 
                                name="month" 
                                placeholder="MM" 
                                value={filter.month} 
                                onChange={handleFilterChange} 
                                className="w-20 p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500" 
                            />
                            <input 
                                type="text" 
                                name="year" 
                                placeholder="YYYY" 
                                value={filter.year} 
                                onChange={handleFilterChange} 
                                className="w-24 p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500" 
                            />
                            <div className="text-sm text-gray-500 flex items-center ml-2">Filter by Date</div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {filteredArticles.length > 0 ? filteredArticles.map((article) => (
                                        <tr key={article.id}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {new Date(article.date).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                                {article.title}
                                                {article.errorMessage && <div className="text-xs text-red-500 mt-1 max-w-xs truncate">{article.errorMessage}</div>}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                    article.status === 'published' ? 'bg-green-100 text-green-800' : 
                                                    article.status === 'upload_failed' ? 'bg-red-100 text-red-800' :
                                                    'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                    {article.status === 'published' ? 'Published' : article.status === 'compilation_failed' ? 'Compile Error' : 'Upload Error'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                {article.status === 'published' && article.link ? (
                                                    <a href={article.link} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-900">View Zenodo</a>
                                                ) : (
                                                     <div className="flex flex-col gap-2">
                                                        <button 
                                                            onClick={() => handleRepublishPending(article.id)} 
                                                            disabled={!!isRepublishingId}
                                                            className="text-indigo-600 hover:text-indigo-900 disabled:opacity-50"
                                                        >
                                                            {isRepublishingId === article.id ? 'Retrying...' : 'Retry Publish'}
                                                        </button>
                                                        {article.latexCode && (
                                                            <button 
                                                                onClick={() => {
                                                                    setLatexCode(article.latexCode!);
                                                                    setStep(2);
                                                                }}
                                                                className="text-gray-600 hover:text-gray-900 text-xs"
                                                            >
                                                                Edit LaTeX
                                                            </button>
                                                        )}
                                                     </div>
                                                )}
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-4 text-center text-gray-500">No articles found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            <ApiKeyModal isOpen={isApiModalOpen} onClose={() => setIsApiModalOpen(false)} onSave={() => setIsApiModalOpen(false)} />
            <PersonalDataModal 
                isOpen={isPersonalDataModalOpen} 
                onClose={() => setIsPersonalDataModalOpen(false)} 
                initialData={authors}
                onSave={(data) => {
                    setAuthors(data);
                    setIsPersonalDataModalOpen(false);
                }}
            />
        </div>
    );
};

export default App;
