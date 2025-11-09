import React, { useState, useEffect, useRef } from 'react';
import { generateInitialPaper, analyzePaper, improvePaper, generatePaperTitle, fixLatexPaper, reformatPaperWithStyleGuide } from './services/geminiService';
import type { Language, IterationAnalysis, PaperSource, AnalysisResult, StyleGuide } from './types';
import { LANGUAGES, AVAILABLE_MODELS, ANALYSIS_TOPICS, MATH_TOPICS, FIX_OPTIONS, STYLE_GUIDES } from './constants';
import { addSuccessfulCompilation, addFailedCompilation } from './services/compilationExamples';

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
    console.log('App component rendering...'); // Diagnostic log
    // Overall workflow step
    const [step, setStep] = useState(1);
    const [isApiModalOpen, setIsApiModalOpen] = useState(false);

    // == STEP 1: GENERATION STATE ==
    const [language, setLanguage] = useState<Language>('en');
    const [generationModel, setGenerationModel] = useState('gemini-2.5-pro');
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
     const [publishedArticles, setPublishedArticles] = useState<PublishedArticle[]>(() => {
        try {
            const stored = localStorage.getItem('published_articles_log');
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    });

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
    
    // == SCHEDULER STATE ==
    const [isSchedulerActive, setIsSchedulerActive] = useState(() => {
        return localStorage.getItem('schedulerActive') === 'true';
    });
    const schedulerTimeoutRef = useRef<number | null>(null);
    const uploaderRef = useRef<ZenodoUploaderRef>(null);

    // == STEP 4: PUBLISHED ARTICLES STATE ==
    const [filter, setFilter] = useState({ day: '', month: '', year: '' });
    
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

    // Effect to save published articles to localStorage
    useEffect(() => {
        try {
            localStorage.setItem('published_articles_log', JSON.stringify(publishedArticles));
        } catch (error) {
            console.error("Failed to save published articles to localStorage", error);
        }
    }, [publishedArticles]);


    // Effect for the daily scheduler
    useEffect(() => {
        const scheduleNextRun = () => {
            if (schedulerTimeoutRef.current) {
                clearTimeout(schedulerTimeoutRef.current);
            }

            const now = new Date();
            const nextRun = new Date(now);
            nextRun.setHours(3, 0, 0, 0); // Set to 3:00:00 AM

            if (now >= nextRun) {
                // If it's already past 3 AM today, schedule for 3 AM tomorrow
                nextRun.setDate(nextRun.getDate() + 1);
            }

            const timeoutMs = nextRun.getTime() - now.getTime();
            
            console.log(`Scheduling next automated run for ${nextRun.toLocaleString()}`);

            schedulerTimeoutRef.current = window.setTimeout(() => {
                console.log(`[${new Date().toLocaleString()}] Triggering scheduled daily run...`);
                handleFullAutomation(7); // Run with 7 articles
                // After running, schedule the next one for the following day
                scheduleNextRun();
            }, timeoutMs);
        };

        if (isSchedulerActive) {
            scheduleNextRun();
        } else {
            if (schedulerTimeoutRef.current) {
                clearTimeout(schedulerTimeoutRef.current);
                console.log("Daily scheduler deactivated and cleared.");
            }
        }

        // Cleanup on component unmount
        return () => {
            if (schedulerTimeoutRef.current) {
                clearTimeout(schedulerTimeoutRef.current);
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isSchedulerActive]); // This effect depends only on the active status


    const getScoreClass = (score: number) => {
        if (score >= 8.5) return 'bg-green-500';
        if (score >= 7.0) return 'bg-yellow-500';
        return 'bg-red-500';
    };

    // New function for robust compilation with retries and auto-fixing
    const robustCompile = async (
        codeToCompile: string,
        onStatusUpdate: (message: string) => void
    ): Promise<{ pdfFile: File; pdfUrl: string; finalCode: string; }> => {
        try {
            const MAX_COMPILE_ATTEMPTS = 3;
            let lastError: Error | null = null;

            // --- Part 1: Initial Compilation Attempts ---
            for (let attempt = 1; attempt <= MAX_COMPILE_ATTEMPTS; attempt++) {
                try {
                    onStatusUpdate(`⏳ Compilando (Tentativa ${attempt}/${MAX_COMPILE_ATTEMPTS})...`);
                    const response = await fetch('/compile-latex', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ latex: codeToCompile }),
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || `Falha na compilação (tentativa ${attempt}).`);
                    }
                    
                    const base64Pdf = await response.text();
                    const pdfUrl = `data:application/pdf;base64,${base64Pdf}`;
                    const blob = await (await fetch(pdfUrl)).blob();
                    const file = new File([blob], "paper.pdf", { type: "application/pdf" });
                    
                    addSuccessfulCompilation(codeToCompile);
                    return { pdfFile: file, pdfUrl, finalCode: codeToCompile };

                } catch (error) {
                    lastError = error instanceof Error ? error : new Error(String(error));
                    console.warn(`Compilation attempt ${attempt} failed:`, lastError.message);
                    if (attempt < MAX_COMPILE_ATTEMPTS) {
                        await new Promise(resolve => setTimeout(resolve, 1500));
                    }
                }
            }
            
            // --- Part 2: Automatic Fix and Final Attempt ---
            if (lastError) {
                onStatusUpdate(`⚠️ Compilação falhou. Tentando corrigir o código com IA...`);
                
                let fixedCode = '';
                try {
                    fixedCode = await fixLatexPaper(
                        codeToCompile, 
                        FIX_OPTIONS, // Use all available fix options
                        analysisModel // Use the faster model for fixing
                    );
                } catch (fixError) {
                    const fixErrorMessage = fixError instanceof Error ? fixError.message : String(fixError);
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
                        throw new Error(errorData.error || 'A compilação final falhou mesmo após a correção automática.');
                    }

                    const base64Pdf = await response.text();
                    const pdfUrl = `data:application/pdf;base64,${base64Pdf}`;
                    const blob = await (await fetch(pdfUrl)).blob();
                    const file = new File([blob], "paper.pdf", { type: "application/pdf" });

                    addSuccessfulCompilation(fixedCode);
                    return { pdfFile: file, pdfUrl, finalCode: fixedCode };
                    
                } catch (finalCompileError) {
                    const finalErrorMessage = finalCompileError instanceof Error ? finalCompileError.message : String(finalCompileError);
                    throw new Error(`A compilação falhou após a correção automática. Erro final: ${finalErrorMessage}`);
                }
            }
            throw new Error("Falha na compilação após todas as tentativas.");
        } catch(error) {
            addFailedCompilation(codeToCompile);
            throw error; // Re-throw the error to be handled by the calling function
        }
    };

    const handleFullAutomation = async (articlesToGenerate?: number) => {
        console.log(`[DEBUG] handleFullAutomation called. articlesToGenerate: ${articlesToGenerate}, numberOfArticles state: ${numberOfArticles}`);
        const articlesToProcess = articlesToGenerate ?? numberOfArticles;
        console.log(`[DEBUG] Articles to process in this run: ${articlesToProcess}`);

        // PRE-FLIGHT CHECK FOR ZENODO TOKEN
        const storedToken = localStorage.getItem('zenodo_api_key');
        if (!storedToken) {
            alert('❌ Token Zenodo não encontrado! Por favor, configure-o nas definições (ícone de engrenagem) antes de iniciar o processo automático.');
            return;
        }
        setZenodoToken(storedToken);
    
        // Reset states for the whole batch
        isGenerationCancelled.current = false;
        setIsGenerating(true);
        // Do not clear all published articles, just the temporary status for the current run
        const currentRunArticles: PublishedArticle[] = [];
        setUploadStatus(null);
        setStep(1); // Start at step 1 for visual progress
    
        for (let i = 1; i <= articlesToProcess; i++) {
            console.log(`[DEBUG] Starting article generation loop. Current i: ${i} / ${articlesToProcess}`);
            // Reset states for a single paper run
            setIsGenerationComplete(false);
            setGenerationProgress(0);
            setAnalysisResults([]);
            setPaperSources([]);
            setGeneratedTitle('');
            setFinalLatexCode('');
            let finalPaperCode = '';
    
            try {
                const TOTAL_ITERATIONS = 12;
                let currentPaper = '';
                
                // 1. Generate Title
                setGenerationStatus(`Artigo ${i}/${articlesToProcess}: Gerando um título inovador...`);
                setGenerationProgress(5);
                const randomTopic = MATH_TOPICS[Math.floor(Math.random() * MATH_TOPICS.length)];
                const temporaryTitle = await generatePaperTitle(randomTopic, language, analysisModel);
                setGeneratedTitle(temporaryTitle);
    
                // 2. Generate Initial Paper
                setGenerationStatus(`Artigo ${i}/${articlesToProcess}: Gerando a primeira versão...`);
                setGenerationProgress(15);
                const { paper: initialPaper, sources } = await generateInitialPaper(temporaryTitle, language, pageCount, generationModel);
                currentPaper = initialPaper;
                setPaperSources(sources);
    
                // 3. Iterative Analysis and Improvement
                for (let iter = 1; iter <= TOTAL_ITERATIONS; iter++) {
                    const progress = 15 + (iter / TOTAL_ITERATIONS) * 75;
                    setGenerationProgress(progress);
                    setGenerationStatus(`Artigo ${i}/${articlesToProcess}: Iniciando iteração de análise ${iter}/${TOTAL_ITERATIONS}...`);
    
                    const analysisResult: AnalysisResult = await analyzePaper(currentPaper, pageCount, analysisModel);
                    
                    const iterationData: IterationAnalysis = {
                        iteration: iter,
                        results: analysisResult.analysis.map(res => ({
                            topic: ANALYSIS_TOPICS.find(t => t.name === res.topicName) || { num: -1, name: 'Unknown', desc: '' },
                            score: res.score,
                            scoreClass: getScoreClass(res.score),
                            improvement: res.improvement
                        }))
                    };
                    setAnalysisResults(prev => [...prev, iterationData]);
    
                    const hasLowScores = analysisResult.analysis.some(res => res.score < 7.0);
                    if (!hasLowScores) {
                        setGenerationStatus(`✅ Análise do Artigo ${i} concluída! Alta qualidade atingida.`);
                        break;
                    }
    
                    if (iter < TOTAL_ITERATIONS) {
                        setGenerationStatus(`Artigo ${i}/${articlesToProcess}: Refinando com base no feedback ${iter}...`);
                        const improvedPaper = await improvePaper(currentPaper, analysisResult, language, generationModel);
                        currentPaper = improvedPaper;
                    }
                }
    
                finalPaperCode = currentPaper;
                setFinalLatexCode(finalPaperCode);
                
                // === COMPILE LATEX ===
                setGenerationProgress(95);
                let compiledFile: File | null = null;
                let finalFixedCode = '';

                try {
                    const compilationUpdater = (message: string) => {
                        setGenerationStatus(`Artigo ${i}/${articlesToProcess}: ${message}`);
                    };
                    
                    const { pdfFile, finalCode } = await robustCompile(finalPaperCode, compilationUpdater);
                    compiledFile = pdfFile;
                    finalFixedCode = finalCode;

                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Falha na compilação por motivo desconhecido.';
                    setGenerationStatus(`❌ Falha na compilação do Artigo ${i}. O código foi salvo como exemplo de erro. Pulando para o próximo...`);
                    console.error(`Compilation failed for paper ${i}:`, error);
                    // Wait a moment so the user can read the status update
                    await new Promise(resolve => setTimeout(resolve, 4000)); 
                    continue; // This is the key change: skip to the next iteration of the for loop
                }
                
                // === UPLOAD TO ZENODO ===
                setGenerationStatus(`Artigo ${i}/${articlesToProcess}: Publicando no Zenodo...`);
                setGenerationProgress(98);
                const metadataForUpload = extractMetadata(finalFixedCode, true);
                const keywordsForUpload = finalFixedCode.match(/\\keywords\{([^}]+)\}/)?.[1] || '';
    
                const MAX_UPLOAD_RETRIES = 10;
                let publishedResult: PublishedArticle | null = null;
                for (let attempt = 1; attempt <= MAX_UPLOAD_RETRIES; attempt++) {
                    try {
                        const baseUrl = useSandbox ? 'https://sandbox.zenodo.org/api' : 'https://zenodo.org/api';
                        
                        const createResponse = await fetch(`${baseUrl}/deposit/depositions`, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${storedToken}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify({})
                        });
                        if (!createResponse.ok) throw new Error(`Erro ${createResponse.status}: Falha ao criar depósito.`);
                        const deposit = await createResponse.json();
    
                        const formData = new FormData();
                        formData.append('file', compiledFile, 'paper.pdf');
                        const uploadResponse = await fetch(`${baseUrl}/deposit/depositions/${deposit.id}/files`, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${storedToken}` },
                            body: formData
                        });
                        if (!uploadResponse.ok) throw new Error('Falha no upload do PDF');
    
                        const keywordsArray = keywordsForUpload.split(',').map(k => k.trim()).filter(k => k);
                        const metadataPayload = {
                            metadata: {
                                title: metadataForUpload.title,
                                upload_type: 'publication',
                                publication_type: 'article',
                                description: metadataForUpload.abstract,
                                creators: metadataForUpload.authors.filter(a => a.name).map(a => ({
                                    name: a.name,
                                    orcid: a.orcid || undefined
                                })),
                                keywords: keywordsArray.length > 0 ? keywordsArray : undefined
                            }
                        };
                        const metadataResponse = await fetch(`${baseUrl}/deposit/depositions/${deposit.id}`, {
                            method: 'PUT',
                            headers: { 'Authorization': `Bearer ${storedToken}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify(metadataPayload)
                        });
                        if (!metadataResponse.ok) throw new Error('Falha ao atualizar metadados');
    
                        const publishResponse = await fetch(`${baseUrl}/deposit/depositions/${deposit.id}/actions/publish`, {
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
                        break; // SUCCESS!
    
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : `Tentativa ${attempt} falhou.`;
                        if (attempt === MAX_UPLOAD_RETRIES) {
                            throw new Error(`Falha ao enviar para o Zenodo após ${MAX_UPLOAD_RETRIES} tentativas. Erro final: ${errorMessage}`);
                        }
                        const delayTime = 15000 + (5000 * (attempt - 1));
                        setGenerationStatus(`Artigo ${i}/${articlesToProcess}: ❌ ${errorMessage} Aguardando ${delayTime / 1000}s para tentar novamente...`);
                        await new Promise(resolve => setTimeout(resolve, delayTime));
                    }
                }
                
                if (publishedResult) {
                    currentRunArticles.push(publishedResult);
                    setPublishedArticles(prev => [...prev, publishedResult]);
                } else {
                    throw new Error("Não foi possível publicar no Zenodo após todas as tentativas.");
                }
    
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : `Ocorreu um erro desconhecido no artigo ${i}.`;
                
                if (errorMessage.toLowerCase().includes('quota')) {
                    setGenerationStatus(`⚠️ Limite de cota da API atingido. A automação foi pausada. O processo será retomado no próximo dia agendado.`);
                } else {
                    setGenerationStatus(`❌ Erro no artigo ${i}: ${errorMessage}. Parando automação.`);
                }

                setIsGenerating(false);
                return; // Stop the entire process
            }
        }
    
        // After the loop
        setIsGenerating(false);
        setGenerationProgress(100);
        setGenerationStatus(`✅ Processo concluído! ${currentRunArticles.length} de ${articlesToProcess} artigos publicados.`);
        setStep(4);
    };
    
    const handleProceedToCompile = () => {
        isGenerationCancelled.current = true;
        setLatexCode(finalLatexCode);
        setStep(2);
    }
    
    const extractMetadata = (code: string, returnData = false) => {
        const titleMatch = code.match(/\\title\{([^}]+)\}/);
        const title = titleMatch ? titleMatch[1].replace(/\\/g, '') : 'Untitled Paper';
        
        const abstractMatch = code.match(/\\begin\{abstract\}([\s\S]*?)\\end\{abstract\}/);
        const abstractText = abstractMatch ? abstractMatch[1].trim().replace(/\\noindent\s*/g, '').replace(/\\/g, '') : '';
        
        const authors: Author[] = [{
            name: 'SÉRGIO DE ANDRADE, PAULO',
            affiliation: '',
            orcid: '0009-0004-2555-3178'
        }];
        
        const keywordsMatch = code.match(/\\keywords\{([^}]+)\}/) || code.match(/Palavras-chave:}\s*([^\n]+)/);
        const keywords = keywordsMatch ? keywordsMatch[1] : '';

        const metadata = { title, abstract: abstractText, authors, keywords };

        if (returnData) {
            return metadata;
        }

        setKeywordsInput(keywords);
        setExtractedMetadata(metadata);
        return metadata; // for TS consistency
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

    const handleExportCompilationData = () => {
        const downloadFile = (content: string, fileName: string, contentType: string) => {
            const blob = new Blob([content], { type: contentType });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        };
        
        const instructions = `# Como Integrar o Conhecimento Adquirido

Este arquivo explica como usar os arquivos \`successful_compilations.json\` e \`failed_compilations.json\` para embutir permanentemente o conhecimento de compilação no código-fonte do aplicativo.

## O Conceito: De "Aprendizagem Dinâmica" para "Conhecimento Embutido"

- **Situação Atual (Aprendizagem Dinâmica):** O aplicativo aprende com as interações e armazena os exemplos de sucesso e falha no \`localStorage\` do seu navegador. Esse aprendizado é perdido se os dados do navegador forem limpos.
- **Próximo Passo (Conhecimento Embutido):** Podemos pegar os exemplos mais informativos que você acumulou e incorporá-los diretamente no código-fonte, tornando o aplicativo "inteligente de fábrica".

## Passos para a Integração:

1.  **Crie um novo arquivo de "conhecimento prévio":**
    No diretório \`services/\`, crie um novo arquivo chamado \`preloadedExamples.ts\`.

2.  **Copie os dados dos arquivos JSON:**
    Abra \`successful_compilations.json\` e \`failed_compilations.json\`. Copie o conteúdo de cada um para o novo arquivo \`preloadedExamples.ts\`, estruturando-os como constantes exportadas.

    \`\`\`typescript
    // Em services/preloadedExamples.ts

    export const PRELOADED_SUCCESSFUL_EXAMPLES: string[] = [
        // Cole aqui o conteúdo do array de successful_compilations.json
        // Exemplo:
        // "\\documentclass{article}\\begin{document}Hello World\\end{document}}",
        // "..."
    ];

    export const PRELOADED_FAILED_EXAMPLES: string[] = [
        // Cole aqui o conteúdo do array de failed_compilations.json
        // Exemplo:
        // "\\documentclass{article}\\begin{document}Unbalanced {\\end{document}}",
        // "..."
    ];
    \`\`\`

3.  **Modifique o serviço de exemplos de compilação (\`compilationExamples.ts\`):**
    Altere o arquivo \`services/compilationExamples.ts\` para adotar uma abordagem híbrida, carregando primeiro os exemplos embutidos e depois os do \`localStorage\`.

    \`\`\`typescript
    // Em services/compilationExamples.ts (Exemplo de como ficaria a função getStoredExamples)
    import { PRELOADED_SUCCESSFUL_EXAMPLES, PRELOADED_FAILED_EXAMPLES } from './preloadedExamples';

    const SUCCESSFUL_KEY = 'successful_latex_compilations';
    const FAILED_KEY = 'failed_latex_compilations';

    function getStoredExamples(key: string): string[] {
        let preloaded: string[] = [];
        if (key === SUCCESSFUL_KEY) {
            preloaded = PRELOADED_SUCCESSFUL_EXAMPLES;
        } else if (key === FAILED_KEY) {
            preloaded = PRELOADED_FAILED_EXAMPLES;
        }

        try {
            const stored = localStorage.getItem(key);
            const localExamples = stored ? JSON.parse(stored) : [];
            // Combine e remova duplicatas, dando preferência aos exemplos locais mais recentes.
            const combined = [...preloaded, ...localExamples];
            return [...new Set(combined)]; // Retorna um array com valores únicos
        } catch (e) {
            console.error(\`Error reading \${key} from localStorage\`, e);
            return preloaded; // Retorna os pré-carregados se o localStorage falhar
        }
    }

    // ... o resto do arquivo permanece o mesmo ...
    \`\`\`

## Vantagens Desta Abordagem

- **Inteligência Imediata:** Todo novo usuário se beneficia do conhecimento acumulado.
- **Robustez:** O conhecimento principal não é perdido ao limpar o cache do navegador.
- **Melhor Desempenho Inicial:** A IA tem um ponto de partida muito melhor, potencialmente reduzindo o número de falhas de compilação desde o início.

---
**Aviso:** Sempre que houver uma atualização significativa nos exemplos (após acumular muitos novos dados de compilação), você pode repetir este processo para atualizar os arquivos em \`preloadedExamples.ts\`.
`;
    
        const successfulData = localStorage.getItem('successful_latex_compilations') || '[]';
        const failedData = localStorage.getItem('failed_latex_compilations') || '[]';
    
        try {
            // Beautify the JSON
            const successfulJson = JSON.stringify(JSON.parse(successfulData), null, 2);
            const failedJson = JSON.stringify(JSON.parse(failedData), null, 2);
    
            // Download files
            downloadFile(successfulJson, 'successful_compilations.json', 'application/json');
            downloadFile(failedJson, 'failed_compilations.json', 'application/json');
            downloadFile(instructions, 'instructions-to-embed-data.md', 'text/markdown');
            
            alert('✅ Exportação concluída! Verifique seus downloads para os arquivos JSON e o guia de instruções.');
    
        } catch (e) {
            console.error("Error exporting compilation data:", e);
            alert("❌ Ocorreu um erro ao exportar os dados. Verifique o console para mais detalhes.");
        }
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
    
    const handleToggleScheduler = () => {
        const newStatus = !isSchedulerActive;
        setIsSchedulerActive(newStatus);
        localStorage.setItem('schedulerActive', String(newStatus));
        if (newStatus) {
            alert('✅ Agendador diário ativado! 7 artigos serão gerados todos os dias às 3:00 da manhã.');
        } else {
            alert('❌ Agendador diário desativado.');
        }
    };

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFilter(prev => ({ ...prev, [name]: value }));
    };

    const filteredArticles = publishedArticles.filter(article => {
        if (!article.date) return false;
        try {
            const date = new Date(article.date);
            const year = date.getFullYear().toString();
            const month = (date.getMonth() + 1).toString();
            const day = date.getDate().toString();

            const matchesYear = !filter.year || year === filter.year;
            const matchesMonth = !filter.month || month === filter.month;
            const matchesDay = !filter.day || day === filter.day;
            
            return matchesYear && matchesMonth && matchesDay;
        } catch {
            return false;
        }
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    return (
        <div className="container">
            <ApiKeyModal
                isOpen={isApiModalOpen}
                onClose={() => setIsApiModalOpen(false)}
                onSave={(keys) => {
                    if (keys.gemini) localStorage.setItem('gemini_api_key', keys.gemini);
                    if (keys.zenodo) setZenodoToken(keys.zenodo); // This will also save to localStorage via useEffect
                    if (keys.xai) localStorage.setItem('xai_api_key', keys.xai);
                    setIsApiModalOpen(false);
                }}
            />
            <div className="main-header">
                 <div className="flex justify-between items-center">
                    <div>
                        <h1>🔬 Fluxo Integrado de Publicação Científica</h1>
                        <p>AI Paper Generator → LaTeX Compiler → Zenodo Uploader</p>
                    </div>
                    <button onClick={() => setIsApiModalOpen(true)} className="p-2 rounded-full hover:bg-gray-200 transition-colors" title="API Key Settings">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </button>
                </div>
            </div>

            <div className="workflow-steps">
                {WORKFLOW_STEPS.map(s => (
                    <div className={getStepCardClass(s.id)} key={s.id} onClick={() => setStep(s.id)}>
                        <div className="step-number">{s.id}</div>
                        <div className="step-title">{s.title}</div>
                        <div className="step-status">{s.status}</div>
                    </div>
                ))}
            </div>

            {step === 1 && (
                <div className="card">
                    <h2>📝 Passo 1: Gerar Artigo com IA</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <h3 className="text-lg font-semibold mb-3">Configurações</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="font-semibold block mb-2">Idioma:</label>
                                    <LanguageSelector languages={LANGUAGES} selectedLanguage={language} onSelect={setLanguage} />
                                </div>
                                 <ModelSelector
                                    models={AVAILABLE_MODELS}
                                    selectedModel={analysisModel}
                                    onSelect={setAnalysisModel}
                                    label="Modelo Rápido (para análise e título):"
                                 />
                                <ModelSelector
                                    models={AVAILABLE_MODELS}
                                    selectedModel={generationModel}
                                    onSelect={setGenerationModel}
                                    label="Modelo Poderoso (para geração e melhoria):"
                                />
                                <div>
                                    <label className="font-semibold block mb-2">Tamanho do Artigo:</label>
                                    <PageSelector options={[12, 30, 60, 100]} selectedPageCount={pageCount} onSelect={setPageCount} />
                                </div>
                                <div>
                                    <label className="font-semibold block mb-2">Número de Artigos a Gerar (Manual):</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="100"
                                        value={numberOfArticles}
                                        onChange={(e) => setNumberOfArticles(Math.max(1, Number(e.target.value)))}
                                        className="w-full"
                                    />
                                </div>
                            </div>
                            <div className="mt-6 text-center">
                                <ActionButton
                                    onClick={() => handleFullAutomation()}
                                    disabled={isGenerating || isCompiling || isUploading}
                                    isLoading={isGenerating || isCompiling || isUploading}
                                    text={`Iniciar Automação (${numberOfArticles} Artigo${numberOfArticles > 1 ? 's' : ''})`}
                                    loadingText="Em Progresso..."
                                    completed={isGenerationComplete}
                                />
                            </div>
                            
                            <div className="mt-6 border-t pt-6">
                                <h4 className="font-semibold text-center mb-3 text-gray-700">Automação Diária</h4>
                                <div className="flex items-center justify-center gap-4">
                                    <span className={`font-semibold transition-colors ${!isSchedulerActive ? 'text-indigo-600' : 'text-gray-500'}`}>Desativado</span>
                                    <label htmlFor="schedulerToggle" className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={isSchedulerActive}
                                            onChange={handleToggleScheduler}
                                            id="schedulerToggle"
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                    </label>
                                    <span className={`font-semibold transition-colors ${isSchedulerActive ? 'text-indigo-600' : 'text-gray-500'}`}>Ativado</span>
                                </div>
                                <p className="text-center text-xs text-gray-500 mt-2">Generates 7 articles automatically, every day at 3:00 AM.</p>
                            </div>
                             <div className="mt-6 border-t pt-6 text-center">
                                 <button onClick={handleExportCompilationData} className="text-sm text-indigo-600 hover:underline">
                                    Exportar Dados de Aprendizagem de Compilação
                                </button>
                             </div>

                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg">
                            {isGenerating ? (
                                <>
                                    <h3 className="text-lg font-semibold mb-3">Progresso da Geração</h3>
                                    <ProgressBar progress={generationProgress} isVisible={isGenerating} />
                                    <p className="text-center text-gray-600 mb-4">{generationStatus}</p>
                                    
                                    <div className="border-t pt-4 mt-4">
                                        <h4 className="font-semibold mb-2">Resultados da Análise em Tempo Real</h4>
                                        <ResultsDisplay analysisResults={analysisResults} totalIterations={12} />
                                    </div>
                                    <div className="border-t pt-4 mt-4">
                                        <h4 className="font-semibold mb-2">Fontes Utilizadas</h4>
                                        <SourceDisplay sources={paperSources} />
                                    </div>
                                </>
                            ) : (
                                <div className="text-center p-8">
                                    <h3 className="text-xl font-semibold text-gray-700">Aguardando Início</h3>
                                    <p className="text-gray-500 mt-2">
                                        Configure as opções à esquerda e clique em "Iniciar Automação" para começar. O progresso aparecerá aqui.
                                    </p>
                                    {finalLatexCode && (
                                        <div className="mt-6">
                                             <button onClick={handleProceedToCompile} className="btn btn-success">
                                                ✅ Geração Concluída! Ir para a Etapa 2
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {step === 2 && (
                <div className="card">
                    <h2>🖋️ Passo 2: Compilar & Revisar</h2>
                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div>
                             <LatexCompiler code={latexCode} onCodeChange={setLatexCode} />
                        </div>
                        <div>
                             <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-6 sticky top-5">
                                 <div>
                                    <h3 className="text-lg font-semibold text-gray-800 mb-3">Ferramentas de Formatação</h3>
                                    <div className="p-4 bg-gray-50 rounded-lg space-y-4">
                                        <div>
                                            <label className="font-semibold block mb-2">Guia de Estilo (Bibliografia):</label>
                                            <StyleGuideSelector
                                                guides={STYLE_GUIDES}
                                                selectedGuide={selectedStyle}
                                                onSelect={setSelectedStyle}
                                            />
                                        </div>
                                        <button 
                                            onClick={handleApplyStyleGuide}
                                            disabled={isReformatting || isCompiling}
                                            className="btn btn-primary w-full"
                                        >
                                            {isReformatting && <span className="spinner"></span>}
                                            {isReformatting ? 'Aplicando Estilo...' : 'Aplicar Guia de Estilo'}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-lg font-semibold text-gray-800 mb-3">Opções de Compilação</h3>
                                    <div className="p-4 bg-gray-50 rounded-lg space-y-4">
                                        <div className="flex items-center justify-around">
                                            <label className="flex items-center cursor-pointer">
                                                <input type="radio" name="compileMethod" value="texlive" checked={compileMethod === 'texlive'} onChange={() => setCompileMethod('texlive')} className="form-radio h-4 w-4 text-indigo-600"/>
                                                <span className="ml-2 text-gray-700">Compilador Online (Recomendado)</span>
                                            </label>
                                            <label className="flex items-center cursor-pointer">
                                                <input type="radio" name="compileMethod" value="overleaf" checked={compileMethod === 'overleaf'} onChange={() => setCompileMethod('overleaf')} className="form-radio h-4 w-4 text-indigo-600"/>
                                                <span className="ml-2 text-gray-700">Enviar para Overleaf</span>
                                            </label>
                                        </div>

                                        <button 
                                            onClick={handleCompileLaTeX}
                                            disabled={isCompiling || isReformatting}
                                            className="btn btn-primary w-full"
                                        >
                                            {isCompiling && <span className="spinner"></span>}
                                            {isCompiling ? 'Compilando...' : 'Compilar LaTeX'}
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="mt-4">{compilationStatus}</div>

                                {pdfPreviewUrl && (
                                    <div className="mt-4">
                                        <h3 className="text-lg font-semibold text-gray-800 mb-2">Preview do PDF</h3>
                                        <div className="iframe-container">
                                            <iframe src={pdfPreviewUrl} title="PDF Preview"></iframe>
                                        </div>
                                        <button onClick={handleProceedToUpload} className="btn btn-success w-full mt-4">
                                            Avançar para a Publicação
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {step === 3 && (
                 <div className="card">
                     <h2>🚀 Passo 3: Publicar no Zenodo</h2>
                     <div className="max-w-3xl mx-auto">
                        <ZenodoUploader
                            ref={uploaderRef}
                            title={extractedMetadata.title}
                            abstractText={extractedMetadata.abstract}
                            keywords={extractedMetadata.keywords}
                            authors={extractedMetadata.authors}
                            compiledPdfFile={compiledPdfFile}
                            onFileSelect={() => { /* Managed by parent */ }}
                            onPublishStart={() => {
                                setIsUploading(true);
                                setUploadStatus(<div className="status-message status-info">⏳ Publicando...</div>);
                            }}
                            onPublishSuccess={(result) => {
                                setUploadStatus(
                                    <div className="status-message status-success">
                                        <p>✅ Publicado com sucesso!</p>
                                        <p><strong>DOI:</strong> {result.doi}</p>
                                        <p>
                                            <strong>Link:</strong> <a href={result.zenodoLink} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">{result.zenodoLink}</a>
                                        </p>
                                    </div>
                                );
                                setPublishedArticles(prev => [...prev, {
                                    doi: result.doi,
                                    link: result.zenodoLink,
                                    title: extractedMetadata.title,
                                    date: new Date().toISOString()
                                }]);
                            }}
                            onPublishError={(message) => setUploadStatus(<div className="status-message status-error">❌ {message}</div>)}
                            extractedMetadata={extractedMetadata}
                         />
                         
                         <div className="mt-6 text-center">
                            <ActionButton
                                onClick={() => uploaderRef.current?.submit()}
                                disabled={isUploading}
                                isLoading={isUploading}
                                text="Publicar Agora"
                                loadingText="Publicando..."
                            />
                        </div>
                        <div className="mt-4">{uploadStatus}</div>
                     </div>
                 </div>
            )}
            
            {step === 4 && (
                <div className="card">
                    <h2>📚 Passo 4: Artigos Publicados</h2>
                    <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
                        <h3 className="font-semibold mb-2">Filtrar por Data de Publicação</h3>
                        <div className="flex flex-wrap items-center gap-4">
                            <input type="text" name="day" value={filter.day} onChange={handleFilterChange} placeholder="Dia (ex: 5)" className="w-24"/>
                            <input type="text" name="month" value={filter.month} onChange={handleFilterChange} placeholder="Mês (ex: 8)" className="w-24"/>
                            <input type="text" name="year" value={filter.year} onChange={handleFilterChange} placeholder="Ano (ex: 2024)" className="w-32"/>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                         <table className="min-w-full bg-white border border-gray-200">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="py-3 px-4 text-left font-semibold text-gray-600">Título do Artigo</th>
                                    <th className="py-3 px-4 text-left font-semibold text-gray-600">Data de Publicação</th>
                                    <th className="py-3 px-4 text-left font-semibold text-gray-600">Link DOI</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredArticles.length > 0 ? filteredArticles.map((article, index) => (
                                    <tr key={index} className="border-b hover:bg-gray-50">
                                        <td className="py-3 px-4">{article.title}</td>
                                        <td className="py-3 px-4">{new Date(article.date).toLocaleString()}</td>
                                        <td className="py-3 px-4">
                                            <a href={article.link} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                                                {article.doi}
                                            </a>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={3} className="text-center py-8 text-gray-500">Nenhum artigo publicado encontrado.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;