import React, { useState, useEffect, useRef } from 'react';
import { generateInitialPaper, analyzePaper, improvePaper, generatePaperTitle, fixLatexPaper, KeyManager } from '../services/geminiService';
import type { Language, PersonalData, ArticleEntry, AnalysisItem } from '../types';
import { ANALYSIS_TOPICS, TOTAL_ITERATIONS, getRandomTopic } from '../constants';

interface ParallelWorkerProps {
    workerId: number;
    apiKey: string;
    language: Language;
    discipline: string;
    pageCount: number;
    analysisModel: string;
    generationModel: string;
    authors: PersonalData[];
    zenodoToken: string;
    useSandbox: boolean;
    onComplete: (entry: ArticleEntry) => void;
    onLogUpdate: (id: number, status: string, progress: number, error?: boolean) => void;
}

const ParallelWorker: React.FC<ParallelWorkerProps> = ({
    workerId, apiKey, language, discipline, pageCount, analysisModel, generationModel, authors, zenodoToken, useSandbox, onComplete, onLogUpdate
}) => {
    const [logs, setLogs] = useState<string[]>([]);
    const hasStarted = useRef(false);

    const addLog = (msg: string) => {
        setLogs(prev => [...prev.slice(-4), msg]); // Keep only last 5 logs visually
    };

    const updateStatus = (status: string, progress: number, isError: boolean = false) => {
        addLog(status);
        onLogUpdate(workerId, status, progress, isError);
    };

    const robustCompile = async (code: string): Promise<{ pdfFile: File; finalCode: string }> => {
        const MAX_ATTEMPTS = 3;
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            updateStatus(`Compilando (Tentativa ${attempt})...`, 90);
            try {
                const response = await fetch('/compile-latex', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ latex: code }),
                });
                if (!response.ok) throw new Error("Erro na API de compilação");
                
                const base64Pdf = await response.text();
                if (base64Pdf.includes('Error')) throw new Error(base64Pdf);

                const blob = await (await fetch(`data:application/pdf;base64,${base64Pdf}`)).blob();
                const file = new File([blob], "paper.pdf", { type: "application/pdf" });
                return { pdfFile: file, finalCode: code };
            } catch (e) {
                if (attempt === MAX_ATTEMPTS) {
                    updateStatus(`Tentando corrigir código LaTeX com IA...`, 92);
                    const fixedCode = await fixLatexPaper(code, (e as Error).message, analysisModel, apiKey);
                    // Try one last compile with fixed code
                    const res = await fetch('/compile-latex', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ latex: fixedCode }),
                    });
                    if(!res.ok) throw new Error("Falha final de compilação");
                    const b64 = await res.text();
                    const blob = await (await fetch(`data:application/pdf;base64,${b64}`)).blob();
                    return { pdfFile: new File([blob], "paper.pdf", { type: "application/pdf" }), finalCode: fixedCode };
                }
                await new Promise(r => setTimeout(r, 2000));
            }
        }
        throw new Error("Compilação falhou");
    };

    const uploadToZenodo = async (file: File, metadata: any, keywords: string) => {
        updateStatus("Enviando para Zenodo...", 95);
        const proxied = (url: string) => `/zenodo-proxy?target=${encodeURIComponent(url)}`;
        const baseUrl = useSandbox ? 'https://sandbox.zenodo.org/api' : 'https://zenodo.org/api';

        // 1. Create
        const createRes = await fetch(proxied(`${baseUrl}/deposit/depositions`), {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${zenodoToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        if (!createRes.ok) throw new Error("Falha ao criar depósito");
        const deposit = await createRes.json();

        // 2. Upload
        const formData = new FormData();
        formData.append('file', file, 'paper.pdf');
        await fetch(proxied(`${baseUrl}/deposit/depositions/${deposit.id}/files`), {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${zenodoToken}` },
            body: formData
        });

        // 3. Metadata
        const creators = authors.map(a => ({ name: a.name, orcid: a.orcid || undefined }));
        await fetch(proxied(`${baseUrl}/deposit/depositions/${deposit.id}`), {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${zenodoToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ metadata: { 
                title: metadata.title, 
                upload_type: 'publication', 
                publication_type: 'article', 
                description: metadata.abstract, 
                creators, 
                keywords: keywords.split(',').map(k => k.trim()) 
            }})
        });

        // 4. Publish
        const pubRes = await fetch(proxied(`${baseUrl}/deposit/depositions/${deposit.id}/actions/publish`), {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${zenodoToken}` }
        });
        if (!pubRes.ok) throw new Error("Falha ao publicar");
        
        return await pubRes.json();
    };

    useEffect(() => {
        if (hasStarted.current) return;
        hasStarted.current = true;

        const run = async () => {
            const tempId = crypto.randomUUID();
            let currentTitle = "Generating Title...";
            let currentCode = "";

            try {
                updateStatus(`Iniciando Robô ${workerId + 1}...`, 5);
                
                // 1. Generate Title
                const topic = getRandomTopic(discipline);
                currentTitle = await generatePaperTitle(topic, language, analysisModel, discipline, apiKey);
                updateStatus(`Título: ${currentTitle.substring(0, 30)}...`, 15);

                // 2. Generate Content
                updateStatus("Escrevendo artigo...", 25);
                const { paper } = await generateInitialPaper(currentTitle, language, pageCount, generationModel, authors, apiKey);
                currentCode = paper;

                // 3. Iterations
                for (let i = 1; i <= TOTAL_ITERATIONS; i++) {
                    updateStatus(`Análise e Refinamento ${i}/${TOTAL_ITERATIONS}`, 30 + (i * 5));
                    const analysis = await analyzePaper(currentCode, pageCount, analysisModel, apiKey);
                    const scores = analysis.analysis.map((a: AnalysisItem) => a.score);
                    const minScore = Math.min(...scores);
                    
                    if (minScore >= 7.0) {
                        updateStatus("Qualidade atingida! Avançando...", 85);
                        break;
                    }
                    if (i < TOTAL_ITERATIONS) {
                        currentCode = await improvePaper(currentCode, analysis, language, generationModel, apiKey);
                    }
                }

                // 4. Compile
                const { pdfFile, finalCode } = await robustCompile(currentCode);
                
                // 5. Upload
                // Basic metadata extraction
                const abstractMatch = finalCode.match(/\\begin\{abstract\}([\s\S]*?)\\end\{abstract\}/);
                const abstract = abstractMatch ? abstractMatch[1].replace(/\\/g, '') : "Abstract not found";
                const keywordsMatch = finalCode.match(/\\keywords\{([^}]+)\}/);
                const keywords = keywordsMatch ? keywordsMatch[1] : "";

                const pubResult = await uploadToZenodo(pdfFile, { title: currentTitle, abstract }, keywords);

                updateStatus("✅ Publicado com Sucesso!", 100);
                onComplete({
                    id: tempId,
                    title: currentTitle,
                    date: new Date().toISOString(),
                    status: 'published',
                    doi: pubResult.doi,
                    link: useSandbox ? `https://sandbox.zenodo.org/records/${pubResult.id}` : `https://zenodo.org/records/${pubResult.id}`
                });

            } catch (error) {
                const msg = error instanceof Error ? error.message : "Erro desconhecido";
                updateStatus(`❌ Falha: ${msg}`, 0, true);
                onComplete({
                    id: tempId,
                    title: currentTitle,
                    date: new Date().toISOString(),
                    status: 'upload_failed',
                    errorMessage: msg,
                    latexCode: currentCode
                });
            }
        };

        run();
    }, []);

    return (
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200 text-xs">
            <h4 className="font-bold text-gray-700 mb-2 truncate" title={apiKey}>🔑 Chave #{workerId + 1}</h4>
            <div className="bg-gray-100 p-2 rounded h-24 overflow-y-auto mb-2 font-mono text-gray-600">
                {logs.map((l, i) => <div key={i}>{l}</div>)}
            </div>
        </div>
    );
};

export default ParallelWorker;