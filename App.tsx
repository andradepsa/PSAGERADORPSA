

import React, { useState, useEffect, useRef } from 'react';
import { generateInitialPaper, analyzePaper, improvePaper, generatePaperTitle, fixLatexPaper, reformatPaperWithStyleGuide } from './services/geminiService';
import type { Language, IterationAnalysis, PaperSource, AnalysisResult, StyleGuide, ArticleEntry } from './types';
import { LANGUAGES, AVAILABLE_MODELS, ANALYSIS_TOPICS, MATH_TOPICS, FIX_OPTIONS, STYLE_GUIDES, TOTAL_ITERATIONS } from './constants';


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
            onStatusUpdate(`⚠️ Compilação falhou. Tentando corrigir o código com IA...`);
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
        const articlesToProcess = batchSizeOverride ?? (isContinuousMode ? 7 : numberOfArticles);
        const storedToken = localStorage.getItem('zenodo_api_key');
        if (!storedToken) {
            alert('❌ Token Zenodo não encontrado! Por favor, configure-o nas definições (ícone de engrenagem) antes de iniciar.');
            return;
        }
        setZenodoToken(storedToken);

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

                setGenerationStatus(`Artigo ${i}/${articlesToProcess}: Gerando um título inovador...`);
                setGenerationProgress(5);
                const randomTopic = MATH_TOPICS[Math.floor(Math.random() * MATH_TOPICS.length)];
                temporaryTitle = await generatePaperTitle(randomTopic, language, analysisModel);
                setGeneratedTitle(temporaryTitle);

                setGenerationStatus(`Artigo ${i}/${articlesToProcess}: Gerando a primeira versão...`);
                setGenerationProgress(15);
                const { paper: initialPaper, sources } = await generateInitialPaper(temporaryTitle, language, pageCount, generationModel);
                currentPaper = initialPaper;
                setPaperSources(sources);

                for (let iter = 1; iter <= TOTAL_ITERATIONS; iter++) {
                    if (isGenerationCancelled.current) throw new Error("Operação cancelada pelo usuário.");
                    setGenerationProgress(15 + (iter / TOTAL_ITERATIONS) * 75);
                    setGenerationStatus(`Artigo ${i}/${articlesToProcess}: Analisando (iteração ${iter}/${TOTAL_ITERATIONS})...`);
                    const analysisResult = await analyzePaper(currentPaper, pageCount, analysisModel);
                    const validAnalysisItems = analysisResult.analysis.filter(res => ANALYSIS_TOPICS.some(topic => topic.num === res.topicNum));
                    setAnalysisResults(prev => [...prev, { iteration: iter, results: validAnalysisItems.map(res => ({ topic: ANALYSIS_TOPICS.find(t => t.num === res.topicNum)!, score: res.score, scoreClass: getScoreClass(res.score), improvement: res.improvement })) }]);
                    if (!validAnalysisItems.some(res => res.score < 7.0)) break;
                    if (iter < TOTAL_ITERATIONS) {
                        setGenerationStatus(`Artigo ${i}/${articlesToProcess}: Refinando com base no feedback ${iter}...`);
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

                for (let attempt = 1; attempt <= 10; attempt++) {
                    if (isGenerationCancelled.current) break;
                    try {
                        const baseUrl = useSandbox ? 'https://sandbox.zenodo.org/api' : 'https://zenodo.org/api';
                        const createResponse = await fetch(`${baseUrl}/deposit/depositions`, { method: 'POST', headers: { 'Authorization': `Bearer ${storedToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
                        if (!createResponse.ok) throw new Error(`Erro ${createResponse.status} ao criar depósito.`);
                        const deposit = await createResponse.json();
                        const formData = new FormData();
                        formData.append('file', compiledFile, 'paper.pdf');
                        const uploadResponse = await fetch(`${baseUrl}/deposit/depositions/${deposit.id}/files`, { method: 'POST', headers: { 'Authorization': `Bearer ${storedToken}` }, body: formData });
                        if (!uploadResponse.ok) throw new Error('Falha no upload do PDF');
                        const metadataPayload = { metadata: { title: metadataForUpload.title, upload_type: 'publication', publication_type: 'article', description: metadataForUpload.abstract, creators: metadataForUpload.authors.filter(a => a.name).map(a => ({ name: a.name, orcid: a.orcid || undefined })), keywords: keywordsForUpload.split(',').map(k => k.trim()).filter(k => k) } };
                        const metadataResponse = await fetch(`${baseUrl}/deposit/depositions/${deposit.id}`, { method: 'PUT', headers: { 'Authorization': `Bearer ${storedToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(metadataPayload) });
                        if (!metadataResponse.ok) throw new Error('Falha ao atualizar metadados');
                        const publishResponse = await fetch(`${baseUrl}/deposit/depositions/${deposit.id}/actions/publish`, { method: 'POST', headers: { 'Authorization': `Bearer ${storedToken}` } });
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

                // Critical Error Handling: Stop automation on quota errors.
                if (errorMessage.toLowerCase().includes('quota')) {
                    setGenerationStatus(`🛑 Limite de cota da API atingido. A automação será pausada e reiniciada no próximo horário agendado.`);
                    setArticleEntries(prev => [...prev, { id: articleEntryId, title: temporaryTitle, date: new Date().toISOString(), status: 'upload_failed', latexCode: currentPaper, errorMessage: `Pausado por limite de cota: ${errorMessage}` }]);
                    isGenerationCancelled.current = true; // Use this flag to signal a hard stop
                    break; // Exit the loop immediately.
                }

                // Resilient Handling for other errors
                const status = errorMessage.includes('compilação') ? 'compilation_failed' : 'upload_failed';
                setArticleEntries(prev => [...prev, { id: articleEntryId, title: temporaryTitle, date: new Date().toISOString(), status: status, latexCode: currentPaper, errorMessage: errorMessage }]);
                
                let pauseDuration = 3000;
                if (errorMessage.toLowerCase().includes('network') || errorMessage.toLowerCase().includes('fetch')) {
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
            setGenerationStatus(`✅ Lote de ${articlesToProcess} artigos concluído. Iniciando próximo lote...`);
            setTimeout(() => {
                // Double-check flags before re-starting
                if (isContinuousMode && !isGenerationCancelled.current) {
                    handleFullAutomation(7);
                }
            }, 5000);
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

    const sortedArticleEntries = articleEntries.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const filteredArticleEntries = sortedArticleEntries.filter(article => {
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
        } catch { return false; }
    });
    
    return (
        <div className="container">
            <ApiKeyModal isOpen={isApiModalOpen} onClose={() => setIsApiModalOpen(false)} onSave={(keys) => { if (keys.gemini) localStorage.setItem('gemini_api_key', keys.gemini); if (keys.zenodo) setZenodoToken(keys.zenodo); if (keys.xai) localStorage.setItem('xai_api_key', keys.xai); setIsApiModalOpen(false); }} />
            <div className="main-header">
                <div className="flex justify-between items-center">
                    <div>
                        <h1>🔬 Fluxo Integrado de Publicação Científica</h1>
                        <p>AI Paper Generator → LaTeX Compiler → Zenodo Uploader</p>
                    </div>
                    <button onClick={() => setIsApiModalOpen(true)} className="p-2 rounded-full hover:bg-gray-200 transition-colors" title="API Key Settings">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </button>
                </div>
            </div>

            <div className="workflow-steps">
                {WORKFLOW_STEPS.map(s => (<div className={getStepCardClass(s.id)} key={s.id} onClick={() => setStep(s.id)}><div className="step-number">{s.id}</div><div className="step-title">{s.title}</div><div className="step-status">{s.status}</div></div>))}
            </div>

            {step === 1 && (
                <div className="card">
                    <h2>📝 Passo 1: Gerar Artigo com IA</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <h3 className="text-lg font-semibold mb-3">Configurações</h3>
                            <div className="space-y-4">
                                <LanguageSelector languages={LANGUAGES} selectedLanguage={language} onSelect={setLanguage} />
                                <ModelSelector models={AVAILABLE_MODELS} selectedModel={analysisModel} onSelect={setAnalysisModel} label="Modelo Rápido (para análise e título):" />
                                <ModelSelector models={AVAILABLE_MODELS} selectedModel={generationModel} onSelect={setGenerationModel} label="Modelo Poderoso (para geração e melhoria):" />
                                <PageSelector options={[12, 30, 60, 100]} selectedPageCount={pageCount} onSelect={setPageCount} />
                                <div>
                                    <label className="font-semibold block mb-2">Número de Artigos a Gerar (Manual):</label>
                                    <input type="number" min="1" max="100" value={numberOfArticles} onChange={(e) => setNumberOfArticles(Math.max(1, Number(e.target.value)))} className="w-full" disabled={isContinuousMode || isSchedulerEnabled} />
                                </div>
                            </div>
                            <div className="mt-6 text-center">
                                <ActionButton onClick={() => handleFullAutomation()} disabled={isGenerating} isLoading={isGenerating} text={`Iniciar Automação (${isContinuousMode || isSchedulerEnabled ? 7 : numberOfArticles} Artigo${(isContinuousMode || isSchedulerEnabled ? 7 : numberOfArticles) > 1 ? 's' : ''})`} loadingText="Em Progresso..." completed={isGenerationComplete} />
                                {isGenerating && (<button onClick={() => { isGenerationCancelled.current = true; setGenerationStatus("🔄 Cancelando após o artigo atual..."); }} className="btn bg-red-600 text-white hover:bg-red-700 mt-4">Cancelar Automação</button>)}
                            </div>
                            
                            <div className="mt-6 border-t pt-6 grid grid-cols-2 gap-4">
                                <div>
                                    <h4 className="font-semibold text-center mb-2 text-gray-700">Automação Contínua (Loop)</h4>
                                    <div className="flex items-center justify-center gap-2"><span className={`font-semibold transition-colors ${!isContinuousMode ? 'text-indigo-600' : 'text-gray-500'}`}>Off</span><label htmlFor="continuousToggle" className="relative inline-flex items-center cursor-pointer"><input type="checkbox" checked={isContinuousMode} onChange={handleToggleContinuousMode} id="continuousToggle" className="sr-only peer" /><div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div></label><span className={`font-semibold transition-colors ${isContinuousMode ? 'text-indigo-600' : 'text-gray-500'}`}>On</span></div>
                                    <p className="text-center text-xs text-gray-500 mt-1">Gera lotes de 7 artigos sem parar.</p>
                                </div>
                                 <div>
                                    <h4 className="font-semibold text-center mb-2 text-gray-700">Agendamento Automático</h4>
                                    <div className="flex items-center justify-center gap-2"><span className={`font-semibold transition-colors ${!isSchedulerEnabled ? 'text-indigo-600' : 'text-gray-500'}`}>Off</span><label htmlFor="schedulerToggle" className="relative inline-flex items-center cursor-pointer"><input type="checkbox" checked={isSchedulerEnabled} onChange={handleToggleScheduler} id="schedulerToggle" className="sr-only peer" /><div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div></label><span className={`font-semibold transition-colors ${isSchedulerEnabled ? 'text-indigo-600' : 'text-gray-500'}`}>On</span></div>
                                    <p className="text-center text-xs text-gray-500 mt-1">Inicia lotes às 05h e 12h.</p>
                                </div>
                            </div>

                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg">
                            {isGenerating ? (
                                <>
                                    <h3 className="text-lg font-semibold mb-3">Progresso da Geração</h3>
                                    <ProgressBar progress={generationProgress} isVisible={isGenerating} />
                                    <p className="text-center text-gray-600 mb-4">{generationStatus}</p>
                                    <div className="border-t pt-4 mt-4"><h4 className="font-semibold mb-2">Resultados da Análise em Tempo Real</h4><ResultsDisplay analysisResults={analysisResults} totalIterations={TOTAL_ITERATIONS} /></div>
                                    <div className="border-t pt-4 mt-4"><h4 className="font-semibold mb-2">Fontes Utilizadas</h4><SourceDisplay sources={paperSources} /></div>
                                </>
                            ) : (
                                <div className="text-center p-8">
                                    <h3 className="text-xl font-semibold text-gray-700">Aguardando Início</h3>
                                    <p className="text-gray-500 mt-2">Configure as opções e inicie a automação. O progresso aparecerá aqui.</p>
                                    {finalLatexCode && (<div className="mt-6"><button onClick={handleProceedToCompile} className="btn btn-success">✅ Geração Concluída! Ir para a Etapa 2</button></div>)}
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
                        <div><LatexCompiler code={latexCode} onCodeChange={setLatexCode} /></div>
                        <div>
                             <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-6 sticky top-5">
                                 <div>
                                    <h3 className="text-lg font-semibold text-gray-800 mb-3">Ferramentas de Formatação</h3>
                                    <div className="p-4 bg-gray-50 rounded-lg space-y-4">
                                        <div><label className="font-semibold block mb-2">Guia de Estilo (Bibliografia):</label><StyleGuideSelector guides={STYLE_GUIDES} selectedGuide={selectedStyle} onSelect={setSelectedStyle} /></div>
                                        <button onClick={handleApplyStyleGuide} disabled={isReformatting || isCompiling} className="btn btn-primary w-full">{isReformatting && <span className="spinner"></span>}{isReformatting ? 'Aplicando Estilo...' : 'Aplicar Guia de Estilo'}</button>
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-800 mb-3">Opções de Compilação</h3>
                                    <div className="p-4 bg-gray-50 rounded-lg space-y-4">
                                        <div className="flex items-center justify-around"><label className="flex items-center cursor-pointer"><input type="radio" name="compileMethod" value="texlive" checked={compileMethod === 'texlive'} onChange={() => setCompileMethod('texlive')} className="form-radio h-4 w-4 text-indigo-600"/><span className="ml-2 text-gray-700">Compilador Online (Recomendado)</span></label><label className="flex items-center cursor-pointer"><input type="radio" name="compileMethod" value="overleaf" checked={compileMethod === 'overleaf'} onChange={() => setCompileMethod('overleaf')} className="form-radio h-4 w-4 text-indigo-600"/><span className="ml-2 text-gray-700">Enviar para Overleaf</span></label></div>
                                        <button onClick={handleCompileLaTeX} disabled={isCompiling || isReformatting} className="btn btn-primary w-full">{isCompiling && <span className="spinner"></span>}{isCompiling ? 'Compilando...' : 'Compilar LaTeX'}</button>
                                    </div>
                                </div>
                                <div className="mt-4">{compilationStatus}</div>
                                {pdfPreviewUrl && (<div className="mt-4"><h3 className="text-lg font-semibold text-gray-800 mb-2">Preview do PDF</h3><div className="iframe-container"><iframe src={pdfPreviewUrl} title="PDF Preview"></iframe></div><button onClick={handleProceedToUpload} className="btn btn-success w-full mt-4">Avançar para a Publicação</button></div>)}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {step === 3 && (
                 <div className="card">
                     <h2>🚀 Passo 3: Publicar no Zenodo</h2>
                     <div className="max-w-3xl mx-auto">
                        <ZenodoUploader ref={uploaderRef} title={extractedMetadata.title} abstractText={extractedMetadata.abstract} keywords={extractedMetadata.keywords} authors={extractedMetadata.authors} compiledPdfFile={compiledPdfFile} onFileSelect={() => {}} onPublishStart={() => { setIsUploading(true); setUploadStatus(<div className="status-message status-info">⏳ Publicando...</div>); }} onPublishSuccess={(result) => { setUploadStatus(<div className="status-message status-success"><p>✅ Publicado com sucesso!</p><p><strong>DOI:</strong> {result.doi}</p><p><strong>Link:</strong> <a href={result.zenodoLink} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">{result.zenodoLink}</a></p></div>); setArticleEntries(prev => prev.map(entry => { if (entry.title === extractedMetadata.title && entry.status !== 'published') { return { ...entry, status: 'published', doi: result.doi, link: result.zenodoLink, date: new Date().toISOString(), latexCode: undefined, errorMessage: undefined, }; } return entry; })); }} onPublishError={(message) => setUploadStatus(<div className="status-message status-error">❌ {message}</div>)} extractedMetadata={extractedMetadata} />
                         <div className="mt-6 text-center"><ActionButton onClick={() => uploaderRef.current?.submit()} disabled={isUploading} isLoading={isUploading} text="Publicar Agora" loadingText="Publicando..." /></div>
                        <div className="mt-4">{uploadStatus}</div>
                     </div>
                 </div>
            )}
            
            {step === 4 && (
                <div className="card">
                    <h2>📚 Passo 4: Artigos Publicados</h2>
                    <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
                        <h3 className="font-semibold mb-2">Filtrar por Data de Publicação/Tentativa</h3>
                        <div className="flex flex-wrap items-center gap-4">
                            <input type="text" name="day" value={filter.day} onChange={handleFilterChange} placeholder="Dia (ex: 5)" className="w-24"/>
                            <input type="text" name="month" value={filter.month} onChange={handleFilterChange} placeholder="Mês (ex: 8)" className="w-24"/>
                            <input type="text" name="year" value={filter.year} onChange={handleFilterChange} placeholder="Ano (ex: 2024)" className="w-32"/>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                         <table className="min-w-full bg-white border border-gray-200">
                            <thead className="bg-gray-100"><tr><th className="py-3 px-4 text-left font-semibold text-gray-600">Título do Artigo</th><th className="py-3 px-4 text-left font-semibold text-gray-600">Data</th><th className="py-3 px-4 text-left font-semibold text-gray-600">Status</th><th className="py-3 px-4 text-left font-semibold text-gray-600">Link/Ação</th></tr></thead>
                            <tbody>
                                {filteredArticleEntries.length > 0 ? filteredArticleEntries.map((article) => (
                                    <tr key={article.id} className="border-b hover:bg-gray-50">
                                        <td className="py-3 px-4">{article.title}</td>
                                        <td className="py-3 px-4">{new Date(article.date).toLocaleString()}</td>
                                        <td className="py-3 px-4">
                                            {article.status === 'published' && <span className="px-2 py-1 text-xs font-semibold text-green-800 bg-green-100 rounded-full">Publicado</span>}
                                            {article.status === 'compilation_failed' && <span className="px-2 py-1 text-xs font-semibold text-red-800 bg-red-100 rounded-full">Falha na Compilação</span>}
                                            {article.status === 'upload_failed' && <span className="px-2 py-1 text-xs font-semibold text-orange-800 bg-orange-100 rounded-full">Falha no Upload</span>}
                                            {article.errorMessage && <p className="text-xs text-gray-500 mt-1">{article.errorMessage}</p>}
                                        </td>
                                        <td className="py-3 px-4">
                                            {article.status === 'published' && article.link ? (<a href={article.link} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">{article.doi || "Ver DOI"}</a>) : (<button onClick={() => handleRepublishPending(article.id)} disabled={isRepublishingId === article.id || !article.latexCode} className="px-3 py-1 text-sm font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-1">{isRepublishingId === article.id && <span className="spinner w-4 h-4"></span>}{isRepublishingId === article.id ? 'Publicando...' : 'Publicar Artigo'}</button>)}
                                        </td>
                                    </tr>
                                )) : (<tr><td colSpan={4} className="text-center py-8 text-gray-500">Nenhum artigo encontrado.</td></tr>)}
                            </tbody>
                        </table>
                        {isRepublishingId && uploadStatus && (<div className="mt-4 p-3 border-l-4 border-indigo-500 bg-indigo-50 text-indigo-800">{uploadStatus}</div>)}
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;