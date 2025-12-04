
import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import type { ZenodoAuthor, ExtractedMetadata } from '../types';

interface ZenodoUploaderProps {
    title: string;
    abstractText: string;
    keywords: string;
    authors: ZenodoAuthor[];
    compiledPdfFile: File | null;
    onFileSelect: (file: File | null) => void;
    onPublishStart: () => void;
    onPublishSuccess: (result: { doi: string; zenodoLink: string; }) => void;
    onPublishError: (message: string) => void;
    extractedMetadata: ExtractedMetadata | null;
}

export interface ZenodoUploaderRef {
    submit: () => void;
}

const ZenodoUploader = forwardRef<ZenodoUploaderRef, ZenodoUploaderProps>(({ 
    title, abstractText, keywords, authors, compiledPdfFile, onFileSelect, onPublishStart, onPublishSuccess, onPublishError,
    extractedMetadata
}, ref) => {
    // Default to TRUE (Sandbox) to avoid 403 errors with testing tokens
    const [useSandbox, setUseSandbox] = useState(true);
    const [zenodoToken, setZenodoToken] = useState(() => localStorage.getItem('zenodo_api_key') || ''); 
    const [publicationLog, setPublicationLog] = useState<string[]>([]);
    const logContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [publicationLog]);

    useEffect(() => {
        if (zenodoToken) {
            localStorage.setItem('zenodo_api_key', zenodoToken);
        }
    }, [zenodoToken]);

    const log = (message: string) => {
        setPublicationLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
    };
    
    // Helper to proxy Zenodo requests
    // Ensures all requests go through the local proxy to avoid 403 Forbidden / CORS errors
    const zenodoFetch = async (url: string, options: RequestInit = {}) => {
        const proxyUrl = `/zenodo-proxy?target=${encodeURIComponent(url)}`;
        return fetch(proxyUrl, options);
    };

    const submit = async () => {
        if (!compiledPdfFile) {
            const errorMsg = "❌ Erro: Nenhum arquivo PDF foi fornecido. Por favor, compile ou faça upload na etapa anterior.";
            log(errorMsg);
            onPublishError(errorMsg);
            return;
        }

        if (!zenodoToken) {
            const errorMsg = "❌ Erro: Por favor, insira seu token do Zenodo.";
            log(errorMsg);
            onPublishError(errorMsg);
            return;
        }

        if (!title || !abstractText) {
            const errorMsg = "❌ Erro: Título e resumo são obrigatórios.";
            log(errorMsg);
            onPublishError(errorMsg);
            return;
        }

        onPublishStart();
        setPublicationLog([]); // Clear previous logs
        log("🚀 Iniciando processo de publicação no Zenodo...");

        const baseUrl = useSandbox 
            ? 'https://sandbox.zenodo.org/api' 
            : 'https://zenodo.org/api';

        try {
            // Step 1: Create a new deposition
            log("📝 Passo 1: Criando depósito no Zenodo...");
            const createResponse = await zenodoFetch(`${baseUrl}/deposit/depositions`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${zenodoToken}`,
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({})
            });

            if (!createResponse.ok) {
                const errorText = await createResponse.text();
                let errorMsg = '';
                
                if (createResponse.status === 403) {
                    errorMsg = `Erro 403 - Token sem permissão (ou Ambiente Incorreto)!\n`;
                    errorMsg += `Verifique:\n`;
                    errorMsg += `1. O Token tem os scopes: 'deposit:write' e 'deposit:actions'?\n`;
                    errorMsg += `2. Você está no ambiente correto? (Sandbox vs Production)\n`;
                    errorMsg += `   - Seu token é do sandbox.zenodo.org? Marque a caixa "Usar Zenodo Sandbox".\n`;
                    errorMsg += `   - Seu token é do zenodo.org? Desmarque a caixa.\n`;
                } else if (createResponse.status === 401) {
                    errorMsg = `Erro 401 - Token inválido ou não fornecido.`;
                } else {
                    errorMsg = `Erro ${createResponse.status}: ${errorText}`;
                }
                throw new Error(errorMsg);
            }

            const deposit = await createResponse.json();
            const depositionId = deposit.id;
            
            log(`✅ Depósito criado. ID: ${depositionId}`);

            // Step 2: Upload the file
            log(`📤 Passo 2: Fazendo upload do arquivo PDF...`);
            const formData = new FormData();
            // Important: 'file' is the field name Zenodo expects
            formData.append('file', compiledPdfFile, compiledPdfFile.name || 'paper.pdf');

            // CRITICAL: When using zenodoFetch (proxy), we let the browser set the multipart boundary.
            // We pass the formData as body.
            // Note: The HTML example uses direct fetch to ${baseUrl}/deposit/depositions/${deposit.id}/files
            // We use the proxy to ensure CORS doesn't block us.
            const uploadResponse = await zenodoFetch(`${baseUrl}/deposit/depositions/${depositionId}/files`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${zenodoToken}` }, // No Content-Type, browser sets multipart
                body: formData
            });

            if (!uploadResponse.ok) {
                const errorText = await uploadResponse.text();
                throw new Error(`Erro ao fazer upload (${uploadResponse.status}): ${errorText}`);
            }
            log("✅ Upload concluído com sucesso.");
            
            // Step 3: Add metadata
            log("📋 Passo 3: Atualizando metadados...");
            const keywordsArray = keywords.split(',').map(k => k.trim()).filter(k => k.length > 0);
            
            const metadataPayload = {
                metadata: {
                    title: title,
                    upload_type: 'publication',
                    publication_type: 'article',
                    description: abstractText,
                    creators: authors.filter(a => a.name.trim().length > 0).map(author => ({
                        name: author.name,
                        affiliation: author.affiliation || undefined,
                        orcid: author.orcid || undefined
                    })),
                    keywords: keywordsArray.length > 0 ? keywordsArray : undefined
                }
            };

            const metadataResponse = await zenodoFetch(`${baseUrl}/deposit/depositions/${depositionId}`, {
                method: 'PUT',
                headers: { 
                    'Authorization': `Bearer ${zenodoToken}`,
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify(metadataPayload)
            });

            if (!metadataResponse.ok) {
                const errorText = await metadataResponse.text();
                throw new Error(`Erro ao atualizar metadados (${metadataResponse.status}): ${errorText}`);
            }
            log("✅ Metadados atualizados com sucesso.");

            // Step 4: Publish
            log("🎯 Passo 4: Publicando artigo...");
            const publishResponse = await zenodoFetch(`${baseUrl}/deposit/depositions/${depositionId}/actions/publish`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${zenodoToken}` }
            });

            if (!publishResponse.ok) {
                const errorText = await publishResponse.text();
                throw new Error(`Erro ao publicar (${publishResponse.status}): ${errorText}`);
            }

            const published = await publishResponse.json();
            
            const zenodoLink = useSandbox 
                ? `https://sandbox.zenodo.org/records/${depositionId}`
                : `https://zenodo.org/records/${depositionId}`;

            log("🎉 Artigo publicado com sucesso!");
            log(`DOI: ${published.doi}`);
            log(`Link: ${zenodoLink}`);

            onPublishSuccess({
                doi: published.doi,
                zenodoLink: zenodoLink
            });

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Um erro desconhecido ocorreu.";
            log(`❌ Erro: ${errorMessage}`);
            onPublishError(errorMessage);
        }
    };

    useImperativeHandle(ref, () => ({
        submit
    }));
    
    return (
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
            <div className="text-center p-4 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg" aria-live="polite">
                {compiledPdfFile ? (
                    <div className="flex items-center justify-center text-green-600">
                        <svg className="h-8 w-8 mr-3 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                        <div>
                            <span className="block text-sm font-semibold">PDF Carregado</span>
                            <span className="block text-xs text-gray-500">{compiledPdfFile.name}</span>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-center text-gray-600">
                         <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span className="text-sm font-semibold block ml-3">Nenhum arquivo PDF. Compile ou carregue um PDF no Passo 2.</span>
                    </div>
                )}
            </div>

            {/* Metadados para o Zenodo */}
            {extractedMetadata && (
                <div className="space-y-4">
                    <div className="form-group">
                        <label htmlFor="zenodoTitle">📌 Título:</label>
                        <input type="text" id="zenodoTitle" value={title} readOnly className="block w-full p-2 border rounded bg-gray-50" aria-label="Paper Title"/>
                    </div>

                    <div className="form-group">
                        <label htmlFor="zenodoAbstract">📄 Resumo/Abstract:</label>
                        <textarea id="zenodoAbstract" rows={4} value={abstractText} readOnly className="block w-full p-2 border rounded bg-gray-50" aria-label="Paper Abstract"></textarea>
                    </div>

                    <div className="form-group">
                        <label>👥 Autores:</label>
                        <div id="authorsList" className="space-y-2">
                            {authors.length > 0 ? (
                                authors.map((author, index) => (
                                    <div key={index} className="author-item p-2 border rounded bg-gray-50">
                                        <input type="text" value={author.name || 'Autor Desconhecido'} readOnly style={{ marginBottom: '4px' }} className="block w-full p-1 text-sm bg-gray-50 border-none font-semibold" aria-label={`Author ${index + 1} Name`}/>
                                        {author.orcid && <input type="text" value={`ORCID: ${author.orcid}`} readOnly className="block w-full p-1 text-xs text-gray-600 bg-gray-50 border-none" aria-label={`Author ${index + 1} ORCID`}/>}
                                    </div>
                                ))
                            ) : (
                                <p className="text-gray-500 text-sm p-2 bg-gray-50 rounded">Nenhum autor extraído automaticamente.</p>
                            )}
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="zenodoKeywords">🏷️ Palavras-chave:</label>
                        <input type="text" id="zenodoKeywords" value={keywords} readOnly className="block w-full p-2 border rounded bg-gray-50" aria-label="Paper Keywords"/>
                    </div>
                </div>
            )}


            {/* Log Panel */}
            {publicationLog.length > 0 && (
                 <div className="mt-4 p-4 bg-gray-900 text-white rounded-lg max-h-48 overflow-y-auto font-mono text-xs border border-gray-700" ref={logContainerRef} aria-live="polite">
                    {publicationLog.map((log, index) => <p key={index} className="whitespace-pre-wrap">{log}</p>)}
                </div>
            )}

            {/* Sandbox Toggle */}
            <div className="flex items-center justify-center pt-4 border-t border-gray-200">
                <label className="flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        id="sandbox"
                        checked={useSandbox}
                        onChange={(e) => setUseSandbox(e.target.checked)}
                        className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        aria-checked={useSandbox}
                    />
                    <span className="ml-2 text-sm font-medium text-gray-900">
                        Usar Zenodo Sandbox (Recomendado para Testes)
                    </span>
                </label>
            </div>
            
            {/* Zenodo Token Input */}
            <div className="form-group mt-4">
                <label htmlFor="zenodoToken">🔑 Token de Acesso do Zenodo:</label>
                <input 
                    type="password" 
                    id="zenodoToken" 
                    placeholder="Cole seu token aqui..." 
                    value={zenodoToken} 
                    onChange={(e) => setZenodoToken(e.target.value)} 
                    className="block w-full p-2 border rounded shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    aria-required="true"
                />
                <p className="mt-1 text-xs text-gray-500">
                    Obtenha em: <a href={useSandbox ? "https://sandbox.zenodo.org/account/settings/applications/" : "https://zenodo.org/account/settings/applications/"} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline font-medium">
                        {useSandbox ? "Zenodo Sandbox" : "Zenodo Production"}
                    </a>. 
                    ⚠️ Necessário marcar os scopes: <strong>deposit:write</strong> e <strong>deposit:actions</strong>.
                </p>
            </div>
        </div>
    );
});

export default ZenodoUploader;
