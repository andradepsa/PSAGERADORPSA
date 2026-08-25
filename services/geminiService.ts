
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import type { Language, AnalysisResult, PaperSource, StyleGuide, SemanticScholarPaper, PersonalData } from '../types';
import { ANALYSIS_TOPICS, LANGUAGES, FIX_OPTIONS, STYLE_GUIDES, SEMANTIC_SCHOLAR_API_BASE_URL } from '../constants';
import { ARTICLE_TEMPLATE } from './articleTemplate'; // Import the single article template

const BABEL_LANG_MAP: Record<Language, string> = {
    en: 'english',
    pt: 'brazilian',
    es: 'spanish',
    fr: 'french',
};

// Internal Key Manager to track rotation state
const KeyManager = {
    keys: [] as string[],
    currentIndex: 0,
    initialized: false,

    loadKeys: function() {
        const storedKeys = localStorage.getItem('gemini_api_keys');
        const legacyKey = localStorage.getItem('gemini_api_key') || (process.env.API_KEY as string);
        
        let newKeys: string[] = [];

        if (storedKeys) {
            try {
                const parsed = JSON.parse(storedKeys);
                newKeys = Array.isArray(parsed) ? parsed.filter(k => k.trim() !== '') : [];
            } catch {
                newKeys = [];
            }
        }
        
        if (newKeys.length === 0 && legacyKey) {
            newKeys = [legacyKey];
        }

        if (newKeys.length === 0 && process.env.API_KEY) {
             newKeys = [process.env.API_KEY];
        }

        this.keys = newKeys;

        if (!this.initialized && this.keys.length > 0) {
            this.currentIndex = Math.floor(Math.random() * this.keys.length);
            console.log(`[KeyManager] Window initialized. Randomly selected starting API Key Index: ${this.currentIndex + 1}/${this.keys.length}`);
            this.initialized = true;
        } else if (this.keys.length > 0) {
            if (this.currentIndex >= this.keys.length) {
                this.currentIndex = 0;
            }
        }
    },

    getCurrentKey: function(): string {
        this.loadKeys(); 
        if (this.keys.length === 0) {
            throw new Error("Gemini API key not found. Please add keys in the settings modal (gear icon).");
        }
        return this.keys[this.currentIndex];
    },

    rotate: function(): boolean {
        if (this.keys.length <= 1) return false;
        
        const prevIndex = this.currentIndex;
        this.currentIndex = (this.currentIndex + 1) % this.keys.length;
        console.warn(`🔄 Rotating API Key: Switching from index ${prevIndex} to ${this.currentIndex}`);
        return true;
    }
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function getAiClient(): GoogleGenAI {
    const apiKey = KeyManager.getCurrentKey();
    return new GoogleGenAI({ apiKey });
}

function isRotationTrigger(error: any): boolean {
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    return (
        errorMessage.includes('429') || 
        errorMessage.includes('quota') || 
        errorMessage.includes('limit') || 
        errorMessage.includes('exhausted') ||
        errorMessage.includes('403') || 
        errorMessage.includes('permission denied') ||
        errorMessage.includes('suspended') ||
        errorMessage.includes('consumer')
    );
}

async function executeWithKeyRotation<T>(
    operation: (client: GoogleGenAI) => Promise<T>, 
    modelName: string
): Promise<T> {
    
    KeyManager.loadKeys(); 
    const maxAttempts = KeyManager.keys.length > 0 ? KeyManager.keys.length : 1;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            const client = getAiClient();
            return await withRateLimitHandling(() => operation(client));
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
            const shouldRotate = isRotationTrigger(error);

            if (shouldRotate && KeyManager.keys.length > 1) {
                console.warn(`⚠️ API Key (Index ${KeyManager.currentIndex}) exhausted or suspended. Attempting to rotate... Error: ${errorMessage}`);
                KeyManager.rotate();
                console.log("Waiting 10 seconds before trying next key to clear IP rate limits...");
                await delay(10000); 
                continue; 
            }

            if (attempt === maxAttempts - 1) {
                if (shouldRotate) {
                    throw new Error(`All Gemini API Keys exhausted (Quota/Suspended). Last error: ${errorMessage}`);
                }
                throw error;
            }
            throw error;
        }
    }
    throw new Error("All Gemini API Keys exhausted (Rotation loop ended without success).");
}

async function withRateLimitHandling<T>(apiCall: () => Promise<T>): Promise<T> {
    const MAX_RETRIES = 3; 
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            return await apiCall(); 
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
            
            if (errorMessage.includes('limit: 0') || errorMessage.includes('quota exceeded for metric')) {
                 throw new Error(`API Quota Exceeded (Limit: 0) or Model Unavailable: ${errorMessage}`);
            }

            // If model is not found (404/deprecated), don't waste time retrying on same model, fail immediately so fallback cascade triggers
            if (errorMessage.includes('404') || errorMessage.includes('not found') || errorMessage.includes('no longer available')) {
                throw error;
            }

            const shouldRotate = isRotationTrigger(error);

            if (shouldRotate) {
                // Fail-fast on quota exhausted/permission/suspended key errors.
                // This lets executeWithKeyRotation rotate keys instantly,
                // or lets callModel trigger the next model fallback instantly!
                throw error;
            }

            if (attempt === MAX_RETRIES) {
                 if (errorMessage.includes('503') || errorMessage.includes('overloaded')) {
                    throw new Error("The AI model is temporarily overloaded. Please try again in a few moments.");
                 }
                throw error;
            }

            console.log("Transient error detected. Using exponential backoff...");
            const backoffTime = Math.min(4000, Math.pow(2, attempt) * 1000 + Math.random() * 500);
            
            console.log(`Waiting for ${backoffTime.toFixed(0)}ms before retrying on same key...`);
            await delay(backoffTime);
        }
    }
    throw new Error("API call failed after internal retries.");
}

let lastExternalCallTime = 0;

async function withExternalRateLimit<T>(apiCall: () => Promise<T>): Promise<T> {
    const MIN_COOLDOWN = 6000; // 6 seconds spacing (prevents rate limits on free providers)
    const MAX_RETRIES = 4;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        const now = Date.now();
        const elapsed = now - lastExternalCallTime;
        if (elapsed < MIN_COOLDOWN) {
            const waitTime = MIN_COOLDOWN - elapsed;
            console.log(`[External Cooldown] Spacing requests. Waiting ${waitTime}ms to avoid 429...`);
            await delay(waitTime);
        }

        try {
            lastExternalCallTime = Date.now();
            return await apiCall();
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            const is429 = errorMsg.includes('429') || errorMsg.toLowerCase().includes('too many requests') || errorMsg.toLowerCase().includes('rate limit');

            if (is429 && attempt < MAX_RETRIES) {
                const backoff = attempt * 12000; // Progressive wait: 12s, 24s, 36s, 48s to clear server windows
                console.warn(`[External Rate Limit] Received 429 (Attempt ${attempt}/${MAX_RETRIES}). Waiting ${backoff / 1000} seconds to clear rate limit...`);
                await delay(backoff);
                continue;
            }
            throw error;
        }
    }
    throw new Error("External API call failed after multiple rate limit retries.");
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 40000, timeoutErrorMsg: string = "Operação excedeu o tempo limite."): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(timeoutErrorMsg)), timeoutMs);
    });
    try {
        return await Promise.race([promise, timeoutPromise]);
    } finally {
        if (timer) clearTimeout(timer);
    }
}

function getGeminiCandidateModels(requestedModel: string): string[] {
    const standardPool = [
        'gemini-3.7-flash',
        'gemini-3.6-flash',
        'gemini-flash-latest',
        'gemini-3.1-pro-preview',
        'gemini-3.1-flash-lite'
    ];

    if (requestedModel === 'gemini-3.7-flash') {
        return ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-flash-latest', 'gemini-3.1-pro-preview', 'gemini-3.1-flash-lite'];
    }
    if (requestedModel === 'gemini-3.1-pro-preview') {
        return ['gemini-3.1-pro-preview', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
    }
    if (requestedModel === 'gemini-3.1-flash-lite') {
        return ['gemini-3.1-flash-lite', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-flash-latest'];
    }
    if (requestedModel.startsWith('gemini-')) {
        return [requestedModel, ...standardPool.filter(m => m !== requestedModel)];
    }
    return standardPool;
}

async function callModel(
    model: string,
    systemInstruction: string,
    userPrompt: string,
    config: {
        jsonOutput?: boolean;
        responseSchema?: any;
        googleSearch?: boolean;
    } = {}
): Promise<GenerateContentResponse> {
    console.log(`[Gemini Service] Calling model: ${model}`);

    const runCall = async (targetModel: string) => {
        return await executeWithKeyRotation(async (aiClient) => {
            return await withTimeout(
                aiClient.models.generateContent({
                    model: targetModel,
                    contents: userPrompt,
                    config: {
                        systemInstruction: systemInstruction,
                        ...(config.jsonOutput && { responseMimeType: "application/json" }),
                        ...(config.responseSchema && { responseSchema: config.responseSchema }),
                        ...(config.googleSearch && { tools: [{ googleSearch: {} }] }),
                    },
                }),
                40000,
                `Timeout: A chamada ao modelo ${targetModel} excedeu 40 segundos.`
            );
        }, targetModel);
    };

    const runGeminiFallback = async (originalModel: string, lastError: any) => {
        console.warn(`[Gemini Service] Model ${originalModel} encountered error: ${lastError instanceof Error ? lastError.message : String(lastError)}. Initiating resilient Gemini fallback cascade...`);
        const fallbackChain = [
            'gemini-3.7-flash',
            'gemini-3.6-flash',
            'gemini-flash-latest',
            'gemini-3.1-pro-preview',
            'gemini-3.1-flash-lite'
        ];
        let finalError = lastError;
        for (const targetModel of fallbackChain) {
            try {
                console.warn(`[Gemini Service] Attempting fallback to ${targetModel}...`);
                return await runCall(targetModel);
            } catch (fallbackErr) {
                finalError = fallbackErr;
                console.warn(`[Gemini Service] Fallback to ${targetModel} also failed: ${fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)}. Trying next in cascade...`);
                continue;
            }
        }
        throw finalError;
    };

    if (model.startsWith('gemini-')) {
        const candidateModels = getGeminiCandidateModels(model);
        let lastError: any = null;

        for (const targetModel of candidateModels) {
            try {
                if (targetModel !== candidateModels[0]) {
                    console.warn(`[Gemini Service] Switching to alternate model: ${targetModel}`);
                }
                return await runCall(targetModel);
            } catch (error) {
                lastError = error;
                console.warn(`[Gemini Service] Model ${targetModel} failed: ${error instanceof Error ? error.message : String(error)}. Advancing cascade...`);
                continue;
            }
        }
        throw lastError || new Error("All Gemini model candidates in the cascade failed.");

    } else if (model.startsWith('grok-')) {
        try {
            const apiKey = localStorage.getItem('xai_api_key');
            if (!apiKey) {
                throw new Error("x.ai API key not found. Please set it in the settings modal (gear icon).");
            }

            const messages = [
                { role: 'system', content: systemInstruction },
                { role: 'user', content: userPrompt }
            ];

            const apiCall = async () => {
                const response = await withTimeout(
                    fetch('https://api.x.ai/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`
                        },
                        body: JSON.stringify({
                            model: model,
                            messages: messages,
                            stream: false,
                            temperature: 0,
                        })
                    }),
                    40000,
                    "x.ai request timed out."
                );

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(`x.ai API Error: ${response.status} - ${(errorData as any).error?.message || 'Unknown error'}`);
                }

                const data = await response.json();
                const text = data.choices?.[0]?.message?.content || '';
                
                const reconstructedResponse = {
                    candidates: [{
                        content: { parts: [{ text: text }], role: 'model' },
                        finishReason: 'STOP',
                        index: 0,
                        safetyRatings: [],
                        groundingMetadata: { groundingChunks: [] }
                    }],
                    functionCalls: [],
                    get text() {
                        return this.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
                    }
                };
                return reconstructedResponse as GenerateContentResponse;
            };

            return await withExternalRateLimit(apiCall);
        } catch (error) {
            return await runGeminiFallback(model, error);
        }
    } else if (model === 'stealth/ox-alpha') {
        try {
            const apiKey = localStorage.getItem('openrouter_api_key');
            if (!apiKey) {
                throw new Error("OpenRouter API key not found. Please set it in the settings modal (gear icon).");
            }

            const messages = [
                { role: 'system', content: systemInstruction },
                { role: 'user', content: userPrompt }
            ];

            const apiCall = async () => {
                const safeReferer = (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin !== 'null') 
                    ? window.location.origin 
                    : 'https://ai.studio';

                const response = await withTimeout(
                    fetch('https://openrouter.ai/api/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`,
                            'HTTP-Referer': safeReferer,
                            'X-Title': 'Scientific Paper Generator'
                        },
                        body: JSON.stringify({
                            model: model,
                            messages: messages,
                            reasoning: {
                                max_tokens: 4096
                            },
                            stream: false,
                            temperature: 0.2,
                        })
                    }),
                    45000,
                    "OpenRouter request timed out."
                );

                if (!response.ok) {
                    let errorMsg = `OpenRouter API Error: ${response.status}`;
                    try {
                        const errorData = await response.json();
                        errorMsg += ` - ${errorData.error?.message || 'Unknown error'}`;
                    } catch (_) {
                        try {
                            const errorText = await response.text();
                            errorMsg += ` - ${errorText.substring(0, 150)}`;
                        } catch (__) {}
                    }
                    throw new Error(errorMsg);
                }

                const data = await response.json();
                const text = data.choices?.[0]?.message?.content || '';
                
                const reconstructedResponse = {
                    candidates: [{
                        content: { parts: [{ text: text }], role: 'model' },
                        finishReason: 'STOP',
                        index: 0,
                        safetyRatings: [],
                        groundingMetadata: { groundingChunks: [] }
                    }],
                    functionCalls: [],
                    get text() {
                        return this.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
                    }
                };
                return reconstructedResponse as GenerateContentResponse;
            };

            return await withExternalRateLimit(apiCall);
        } catch (error) {
            return await runGeminiFallback(model, error);
        }
    } else {
        throw new Error(`Unsupported model: ${model}`);
    }
}

export async function generatePaperTitle(topic: string, language: Language, model: string, discipline: string): Promise<string> {
    const languageName = LANGUAGES.find(l => l.code === language)?.name || 'English';
    const systemInstruction = `Act as an expert academic researcher in ${discipline}. Generate a single, compelling, high-impact scientific paper title.`;
    const userPrompt = `Topic: "${topic}" in ${discipline}.
    Task: Generate a single, novel, specific, high-impact research title.
    Language: **${languageName}**.
    Constraint: Return ONLY the title text. No quotes.`;

    try {
        const response = await callModel(model, systemInstruction, userPrompt);
        if (response.text && response.text.trim()) {
            return response.text.trim().replace(/"/g, '').replace(/\n+/g, ' ');
        }
    } catch (err) {
        console.warn(`[Title Generator] AI Title failed: ${err instanceof Error ? err.message : String(err)}. Using high-impact deterministic title.`);
    }

    // Unbreakable fallback title if all API connections fail
    if (language === 'pt') {
        return `Avanços e Desafios Metodológicos em ${topic}: Uma Abordagem Integrada em ${discipline}`;
    } else if (language === 'es') {
        return `Avances y Desafíos Metodológicos en ${topic}: Un Enfoque Integrado en ${discipline}`;
    } else if (language === 'fr') {
        return `Avancées et Défis Méthodologiques dans ${topic}: Une Approche Intégrée en ${discipline}`;
    }
    return `Advances and Methodological Frameworks in ${topic}: An Integrated Perspective in ${discipline}`;
}

function postProcessLatex(latexCode: string): string {
    let code = latexCode;
    // Allow figure environments so TikZ and tables compile perfectly!
    code = code.replace(/\\includegraphics\s*(\[.*?\])?\s*\{.*?\}/g, '% [Image removed for compatibility]');
    code = code.replace(/\\captionof\s*\{figure\}\s*\{.*?\}/g, '');
    
    // Replace problematic raw Unicode characters with standard LaTeX macros
    code = code.replace(/\u2014/g, '---'); // em-dash
    code = code.replace(/\u2013/g, '--');  // en-dash
    code = code.replace(/\u201c/g, '``');   // left double quote
    code = code.replace(/\u201d/g, "''");   // right double quote
    code = code.replace(/\u2018/g, '`');    // left single quote
    code = code.replace(/\u2019/g, "'");    // right single quote
    code = code.replace(/\u2026/g, '\\ldots{}'); // ellipsis
    
    code = code.replace(/,?\s+&\s+/g, ' and ');
    code = code.replace(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g, '');
    const environments = ['itemize', 'enumerate', 'description'];
    environments.forEach(env => {
        const beginRegex = new RegExp(`\\\\begin\\{${env}\\}`, 'g');
        const endRegex = new RegExp(`\\\\end\\{${env}\\}`, 'g');
        const openCount = (code.match(beginRegex) || []).length;
        const closeCount = (code.match(endRegex) || []).length;
        if (openCount > closeCount) {
            const diff = openCount - closeCount;
            const closingTags = `\\end{${env}}`.repeat(diff);
            const docEndIdx = code.lastIndexOf('\\end{document}');
            if (docEndIdx !== -1) {
                code = code.substring(0, docEndIdx) + `\n${closingTags}\n` + code.substring(docEndIdx);
            } else {
                code += `\n${closingTags}`;
            }
        }
    });
    if (!code.includes('\\end{document}')) {
        code += '\n\\end{document}';
    }
    const docClassIdx = code.indexOf('\\documentclass');
    if (docClassIdx > 0) {
        code = code.substring(docClassIdx);
    }
    return code;
}

function extractLatexFromResponse(text: string): string {
    if (!text) return '';
    const match = text.match(/```latex\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
        return match[1].trim();
    }
    let cleaned = text.trim();
    if (cleaned.startsWith('```latex')) cleaned = cleaned.substring(8);
    else if (cleaned.startsWith('```')) cleaned = cleaned.substring(3);
    if (cleaned.endsWith('```')) cleaned = cleaned.substring(0, cleaned.length - 3);
    return cleaned.trim();
}

function stripLatexComments(text: string): string {
    return text.replace(/(^|[^\\])%.*$/gm, '$1').trim();
}

function extractDocumentBody(latex: string): string {
    const beginTag = '\\begin{document}';
    const endTag = '\\end{document}';
    const startIndex = latex.indexOf(beginTag);
    const endIndex = latex.lastIndexOf(endTag);
    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
        return latex.substring(startIndex + beginTag.length, endIndex).trim();
    }
    return latex;
}

function extractStrategicContext(latex: string): { text: string, isTruncated: boolean } {
    let combined = "";
    const abstractMatch = latex.match(/\\begin\{abstract\}([\s\S]*?)\\end\{abstract\}/i);
    if (abstractMatch) {
        combined += "\\section*{Abstract}\n" + abstractMatch[1].trim() + "\n\n";
    }
    const introMatch = latex.match(/\\section\{(?:Introduction|Introdução)\}([\s\S]*?)(?=\\section\{)/i);
    if (introMatch) {
        combined += "\\section{Introduction}\n" + introMatch[1].trim() + "\n\n";
        combined += "\n% ... [MIDDLE SECTIONS (Literature, Methodology, Results, Discussion) OMITTED FOR AI ANALYSIS EFFICIENCY] ...\n\n";
    }
    const conclusionMatch = latex.match(/\\section\{(?:Conclusion|Conclusão|Considerações Finais)\}([\s\S]*?)(?=\\section\{|\\end\{document\})/i);
    if (conclusionMatch) {
        combined += "\\section{Conclusion}\n" + conclusionMatch[1].trim() + "\n\n";
    }
    if (combined.length < 500) {
        return { text: extractDocumentBody(latex), isTruncated: false };
    }
    return { text: combined, isTruncated: true };
}

async function fetchSemanticScholarPapers(query: string, limit: number = 5): Promise<SemanticScholarPaper[]> {
    try {
        const fields = 'paperId,title,authors,abstract,url'; 
        const response = await fetch(`/semantic-proxy?query=${encodeURIComponent(query)}&limit=${limit}&fields=${fields}`);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Semantic Scholar API error (via Proxy): ${response.status} - ${errorText}`);
        }
        const data = await response.json();
        return data.data || [];
    } catch (error) {
        console.error("Error fetching from Semantic Scholar:", error);
        return [];
    }
}

export async function generateInitialPaper(
    title: string, 
    language: Language, 
    pageCount: number, 
    model: string, 
    authorDetails: PersonalData[],
    onProgress?: (status: string) => void,
    discipline?: string
): Promise<{ paper: string, sources: PaperSource[] }> {
    const languageName = LANGUAGES.find(l => l.code === language)?.name || 'English';
    const babelLanguage = BABEL_LANG_MAP[language];
    const referenceCount = 10;
    const referencePlaceholders = Array.from({ length: referenceCount }, (_, i) => `[INSERT REFERENCE ${i + 1} HERE]`).join('\n\n');
    
    if (onProgress) onProgress("Buscando fontes acadêmicas e referências no Semantic Scholar...");
    const semanticScholarPapers = await fetchSemanticScholarPapers(title, referenceCount);
    const semanticScholarContext = semanticScholarPapers.length > 0
        ? "\n\n**Additional Academic Sources from Semantic Scholar (prioritize these):**\n" +
          semanticScholarPapers.map(p => `- Title: ${p.title}\n  Authors: ${p.authors.map(a => a.name).join(', ')}\n  Abstract: ${p.abstract || 'N/A'}\n  URL: ${p.url}`).join('\n---\n')
        : "";

    const latexAuthorsBlock = authorDetails.map((author) => {
        const name = author.name || 'Unknown Author';
        const affiliation = author.affiliation ? `\\\\ ${author.affiliation}` : '';
        const orcid = author.orcid ? `\\\\ \\small ORCID: \\url{https://orcid.org/${author.orcid}}` : '';
        return `${name}${affiliation}${orcid}`;
    }).join(' \\and\n');
    const pdfAuthorNames = authorDetails.map(a => a.name).filter(Boolean).join(', ');

    // 1. Initialize overall paper LaTeX code template
    let finalPaperCode = ARTICLE_TEMPLATE.replace('% Babel package will be added dynamically based on language', `\\usepackage[${babelLanguage}]{babel}`).replace('[INSERT REFERENCE COUNT]', String(referenceCount)).replace('[INSERT NEW REFERENCE LIST HERE]', referencePlaceholders);
    finalPaperCode = finalPaperCode.replace('__ALL_AUTHORS_LATEX_BLOCK__', latexAuthorsBlock);
    finalPaperCode = finalPaperCode.replace('pdfauthor={__PDF_AUTHOR_NAMES_PLACEHOLDER__}', `pdfauthor={${pdfAuthorNames}}`);
    finalPaperCode = finalPaperCode.replace(/\[INSERT NEW TITLE HERE\]/g, title);

    const discName = discipline || 'Academic Research';

    const cleanSegment = (text: string): string => {
        if (!text) return '';
        let cleaned = extractLatexFromResponse(text);
        cleaned = cleaned.replace(/\\documentclass[\s\S]*?\\begin\{document\}/g, '');
        cleaned = cleaned.replace(/\\end\{document\}/g, '');
        cleaned = cleaned.replace(/\\maketitle/g, '');
        cleaned = cleaned.replace(/\\title\{.*?\}/g, '');
        cleaned = cleaned.replace(/\\author\{.*?\}/g, '');
        cleaned = cleaned.replace(/\\date\{.*?\}/g, '');
        cleaned = cleaned.replace(/\\begin\{abstract\}/g, '');
        cleaned = cleaned.replace(/\\end\{abstract\}/g, '');
        return cleaned.trim();
    };

    // Define segments/sections to write sequentially
    const segments = [
        {
            id: 'abstract',
            name: language === 'pt' ? 'Resumo & Palavras-chave' : language === 'es' ? 'Resumen & Palabras clave' : 'Abstract & Keywords',
            placeholder: '[INSERT NEW COMPLETE ABSTRACT HERE. This must be plain text without LaTeX commands.]',
            keywordsPlaceholder: '[INSERT COMMA-SEPARATED KEYWORDS HERE]',
            prompt: `Write the Abstract and Keywords for the scientific paper titled "${title}" in the field of ${discName}.
The abstract must be a single paragraph of dense, rigorous, comprehensive academic summary (approx. 200-250 words) outlining the research context, objective, methodology, key findings, and implications.
Also provide 4 to 6 comma-separated keywords.
Provide your response strictly in the following format:
ABSTRACT:
<your abstract text here>
KEYWORDS:
<your keywords here>`
        },
        {
            id: 'introduction',
            name: language === 'pt' ? 'Introdução' : language === 'es' ? 'Introducción' : 'Introduction',
            placeholder: '[INSERT NEW CONTENT FOR INTRODUCTION SECTION HERE. The content must be extensive and detailed to meet the required page count.]',
            prompt: (context: string) => `Write the complete "Introduction" section for the scientific paper titled "${title}" in the field of ${discName}.
Context:
${context}

The introduction must be highly detailed, comprehensive, and academically rigorous (minimum 500-800 words), covering the general background, problem statement, research gap, specific objective of this paper, and the outline of the sections.
Do NOT write the document preamble or section headers. Write ONLY the paragraph body content. Use standard LaTeX paragraphs separated by double newlines.`
        },
        {
            id: 'literature',
            name: language === 'pt' ? 'Revisão de Literatura' : language === 'es' ? 'Revisión de Literatura' : 'Literature Review',
            placeholder: '[INSERT NEW CONTENT FOR LITERATURE REVIEW SECTION HERE. The content must be extensive and detailed to meet the required page count.]',
            prompt: (context: string) => `Write the complete "Literature Review" section for the scientific paper titled "${title}" in ${discName}.
Context:
${context}
${semanticScholarContext}

Provide a deep, critical review of previous scholarly works, comparing and contrasting different theoretical frameworks and empirical studies, and highlighting the gap this research addresses (minimum 600-900 words).
Do NOT write the section header. Write ONLY the paragraph body content. Use citations like [1], [2], etc., where appropriate.`
        },
        {
            id: 'methodology',
            name: language === 'pt' ? 'Metodologia' : language === 'es' ? 'Metodología' : 'Methodology',
            placeholder: '[INSERT NEW CONTENT FOR METHODOLOGY SECTION HERE. The content must be extensive and detailed to meet the required page count.]',
            prompt: (context: string) => `Write the complete "Methodology" section for the scientific paper titled "${title}" in ${discName}.
Context:
${context}

Describe the research design, data collection procedures, sample characteristics, variables/instruments, and analytical/statistical techniques in precise detail (minimum 500-800 words).
Do NOT write the section header. Write ONLY the body content. You are highly encouraged to include mathematical equations in LaTeX format, itemized steps, or a beautiful professional flowchart/diagram using native LaTeX TikZ commands to visually represent the methodology.`
        },
        {
            id: 'results',
            name: language === 'pt' ? 'Resultados' : language === 'es' ? 'Resultados' : 'Results',
            placeholder: '[INSERT NEW CONTENT FOR RESULTS SECTION HERE. The content must be extensive and detailed to meet the required page count.]',
            prompt: (context: string) => `Write the complete "Results" section for the scientific paper titled "${title}" in ${discName}.
Context:
${context}

Present the empirical findings and analysis of data with high scientific precision (minimum 500-800 words).
Do NOT write the section header. Write ONLY the body content. You are highly encouraged to include LaTeX tables (e.g. using tabular, with clean academic formatting) or beautiful vector plots/charts using native pgfplots/TikZ commands to illustrate the results.`
        },
        {
            id: 'discussion',
            name: language === 'pt' ? 'Discussão' : language === 'es' ? 'Discusión' : 'Discussion',
            placeholder: '[INSERT NEW CONTENT FOR DISCUSSION SECTION HERE. The content must be extensive and detailed to meet the required page count.]',
            prompt: (context: string) => `Write the complete "Discussion" section for the scientific paper titled "${title}" in ${discName}.
Context:
${context}

Interpret the empirical findings, discuss how they support or challenge previous literature, analyze theoretical and practical implications, and clearly address any limitations of the study (minimum 500-800 words).
Do NOT write the section header. Write ONLY the body content.`
        },
        {
            id: 'conclusion',
            name: language === 'pt' ? 'Conclusão' : language === 'es' ? 'Conclusión' : 'Conclusion',
            placeholder: '[INSERT NEW CONTENT FOR CONCLUSION SECTION HERE. The content must be extensive and detailed to meet the required page count.]',
            prompt: (context: string) => `Write the complete "Conclusion" section for the scientific paper titled "${title}" in ${discName}.
Context:
${context}

Summarize the key findings, restate the main contributions, and suggest future avenues for research (approx. 300-500 words).
Do NOT write the section header. Write ONLY the body content.`
        },
        {
            id: 'references',
            name: language === 'pt' ? 'Referências Bibliográficas' : language === 'es' ? 'Referencias' : 'References',
            placeholder: '[INSERT NEW REFERENCE LIST HERE]',
            prompt: (context: string) => `Generate the complete list of academic references for the paper titled "${title}" in ${discName}.
The list should contain exactly 10 high-quality, strictly academic citations in standard academic format (APA or IEEE) relevant to the topic.
Provide the response as plain paragraphs, each starting with \\noindent and ending with \\par.
CRITICAL: Absolutely DO NOT use \\begin{thebibliography} or \\bibitem. Generate exactly 10 bibliography entries.
Example:
\\noindent [1] Author, A. (2025). Title of the article. *Journal Name*, 1(2), 10-20. \\par
\\noindent [2] Author, B. (2026). Book Title. *Publisher*. \\par`
        }
    ];

    let runningContext = `Title: ${title}\nDiscipline: ${discName}`;
    let gatheredSources: PaperSource[] = [];

    const COOLDOWN_SECONDS = 8; // Confortável espaçamento de 8 segundos entre as chamadas de seções

    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];

        if (onProgress) {
            onProgress(`Escrevendo a seção: ${seg.name}... (Parte ${i + 1} de ${segments.length})`);
        }

        const systemInstruction = `Act as an expert academic researcher and LaTeX writer.
Your task is to write the specific section: "${seg.name}" for a scientific paper titled "${title}" in ${discName}.
Language: Write the entire section content strictly in **${languageName}**.
LaTeX Rules:
1. Do NOT write the document preamble, \\documentclass, or \\begin{document}. Just write the text of this section.
2. Ensure there are NO unescaped ampersands (&) or raw unicode characters (use LaTeX macros instead).
3. Do NOT use \\includegraphics. If you want to include figures or charts, write them using beautiful native TikZ or pgfplots environments.
4. Keep the style highly formal, objective, and scholarly.`;

        const userPrompt = typeof seg.prompt === 'function' ? seg.prompt(runningContext) : seg.prompt;
        
        let attempts = 0;
        let responseText = '';
        let stepSources: PaperSource[] = [];

        while (attempts < 2) {
            try {
                const response = await callModel(model, systemInstruction, userPrompt, { googleSearch: true });
                if (response.text) {
                    responseText = response.text;
                    stepSources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.filter(chunk => chunk.web).map(chunk => ({ uri: chunk.web.uri, title: chunk.web.title, })) || [];
                    break;
                }
            } catch (err) {
                attempts++;
                if (attempts >= 2) throw err;
                if (onProgress) onProgress(`Retentando seção ${seg.name} em 5 segundos devido a erro temporário...`);
                await delay(5000);
            }
        }

        if (!responseText) {
            throw new Error(`A geração da seção ${seg.name} retornou um texto vazio.`);
        }

        gatheredSources = [...gatheredSources, ...stepSources];

        if (seg.id === 'abstract') {
            let abstractText = '';
            let keywordsText = '';
            const abstractMatch = responseText.match(/ABSTRACT:\s*([\s\S]*?)(?=KEYWORDS:|$)/i);
            const keywordsMatch = responseText.match(/KEYWORDS:\s*([\s\S]*?)$/i);
            
            if (abstractMatch) {
                abstractText = abstractMatch[1].trim();
            } else {
                abstractText = responseText.replace(/ABSTRACT:/i, '').replace(/KEYWORDS:[\s\S]*$/i, '').trim();
            }
            
            if (keywordsMatch) {
                keywordsText = keywordsMatch[1].trim();
            } else {
                keywordsText = 'scientific paper, academic research, analysis';
            }

            finalPaperCode = finalPaperCode.replace(seg.placeholder, abstractText);
            if (seg.keywordsPlaceholder) {
                finalPaperCode = finalPaperCode.replace(seg.keywordsPlaceholder, keywordsText);
            }
            runningContext += `\n\nAbstract: ${abstractText.substring(0, 400)}`;
        } else {
            const cleanedBody = cleanSegment(responseText);
            finalPaperCode = finalPaperCode.replace(seg.placeholder, cleanedBody);
            runningContext += `\n\n${seg.name}: ${cleanedBody.substring(0, 300)}...`;
        }

        // Aguardar o cooldown anti-bloqueio entre seções (exceto após a última seção)
        if (i < segments.length - 1) {
            for (let sec = COOLDOWN_SECONDS; sec > 0; sec--) {
                if (onProgress) {
                    onProgress(`Pausa anti-bloqueio: Aguardando ${sec}s antes de iniciar a seção "${segments[i + 1].name}"...`);
                }
                await delay(1000);
            }
        }
    }

    // Unify all sources gathered along the path, removing duplicates
    const uniqueSources: PaperSource[] = [];
    const seenUris = new Set<string>();
    for (const src of gatheredSources) {
        if (!seenUris.has(src.uri)) {
            seenUris.add(src.uri);
            uniqueSources.push(src);
        }
    }

    return { paper: postProcessLatex(finalPaperCode), sources: uniqueSources };
}

function cleanJsonOutput(text: string): string {
    let cleaned = text.trim();
    cleaned = cleaned.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '');
    if (cleaned.includes("nobreak\nobreak") || cleaned.includes("nobreaknobreak")) {
        throw new Error("Model output contained a repetition loop (nobreak).");
    }
    return cleaned.trim();
}

export async function analyzePaper(paperContent: string, pageCount: number, model: string): Promise<AnalysisResult> {
    const analysisTopicsList = ANALYSIS_TOPICS.map(t => `- Topic ${t.num} (${t.name}): ${t.desc}`).join('\n');
    const systemInstruction = `Act as an expert academic reviewer. Perform a rigorous, objective analysis of the LaTeX paper.\n**Task:**\n1. Analyze against criteria.\n2. Score 0-10.\n3. One concise improvement per topic.\n**Output:** JSON only: { "analysis": [ { "topicNum": number, "score": number, "improvement": string } ] }`;
    const responseSchema = { type: Type.OBJECT, properties: { analysis: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { topicNum: { type: Type.NUMBER }, score: { type: Type.NUMBER }, improvement: { type: Type.STRING }, }, required: ["topicNum", "score", "improvement"], }, }, }, required: ["analysis"], };
    const estimatedPagesFromChars = Math.max(1, Math.round(paperContent.length / 3000));
    let cleanPaper = stripLatexComments(paperContent);
    cleanPaper = cleanPaper.replace(/\\section\{(?:References|Referências)\}[\s\S]*$/, '');
    const hasUnfilledPlaceholders = cleanPaper.includes('[INSERT NEW CONTENT');
    const contextObj = extractStrategicContext(cleanPaper);
    const paperToAnalyze = contextObj.text;
    const truncationNote = contextObj.isTruncated ? `\n\n**NOTE:** Text is a **STRATEGIC EXTRACT** of a ${estimatedPagesFromChars}-page doc.` : "";
    const finalSystemInstruction = systemInstruction + truncationNote;
    const MAX_PARSE_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_PARSE_RETRIES; attempt++) {
        try {
            const response = await callModel(model, finalSystemInstruction, paperToAnalyze, { jsonOutput: true, responseSchema: responseSchema });
            if (!response.text) throw new Error("AI returned an empty response for the analysis.");
            const jsonText = cleanJsonOutput(response.text);
            const result = JSON.parse(jsonText) as AnalysisResult;
            if (hasUnfilledPlaceholders) {
                const structureTopicIndex = result.analysis.findIndex(a => a.topicNum === 13);
                const placeholderCritique = { topicNum: 13, score: 2.0, improvement: "CRITICAL: Document contains placeholders (e.g., [INSERT NEW CONTENT...]). You MUST generate the missing content." };
                if (structureTopicIndex !== -1) result.analysis[structureTopicIndex] = placeholderCritique;
                else result.analysis.push(placeholderCritique);
            }
            return result;
        } catch (error) {
            console.warn(`Attempt ${attempt} to analyze paper failed:`, error);
            if (attempt === MAX_PARSE_RETRIES) throw error;
            await delay(2000);
        }
    }
    throw new Error("Unexpected error in analysis loop.");
}

export async function improvePaper(paperContent: string, analysis: AnalysisResult, language: Language, model: string): Promise<string> {
    const languageName = LANGUAGES.find(l => l.code === language)?.name || 'English';
    const improvementPoints = analysis.analysis.filter(item => item.score < 8.5).map(item => {
        const topic = ANALYSIS_TOPICS.find(t => t.num === item.topicNum);
        return `- **${topic?.name || 'TOPIC ' + item.topicNum}**: ${item.improvement}`;
    }).join('\n');
    const systemInstruction = `Act as an expert LaTeX editor. Refine paper body.\n**Rules:**\n1. Improve ONLY provided body.\n2. Output valid LaTeX body starting with \\begin{document}.\n3. Language: ${languageName}.`;
    const cleanPaper = stripLatexComments(paperContent);
    const docStartIndex = cleanPaper.indexOf('\\begin{document}');
    let preamble = "";
    let bodyToImprove = cleanPaper;
    if (docStartIndex !== -1) {
        preamble = cleanPaper.substring(0, docStartIndex);
        bodyToImprove = cleanPaper.substring(docStartIndex);
    }
    const userPrompt = `Context: ${preamble}\nBody: ${bodyToImprove}\nFeedback: ${improvementPoints}\nTask: Return COMPLETE improved body.`;
    const response = await callModel(model, systemInstruction, userPrompt);
    if (!response.text) throw new Error("AI returned an empty response for improvement.");
    let improvedBody = extractLatexFromResponse(response.text);
    if (docStartIndex !== -1 && !improvedBody.includes('\\documentclass')) {
        return postProcessLatex(preamble + "\n" + improvedBody);
    } 
    if (!improvedBody.includes('\\end{document}')) improvedBody += '\n\\end{document}';
    return postProcessLatex(improvedBody);
}

export async function fixLatexPaper(paperContent: string, compilationError: string, model: string): Promise<string> {
    const systemInstruction = `Act as expert LaTeX debugger. Fix errors.\n**Rules:**\n1. Fix ONLY error.\n2. Output full document.\n3. Replace & with 'and', remove CJK, remove \\includegraphics.`;
    const userPrompt = `Error: ${compilationError}\nCode: ${paperContent}`;
    const response = await callModel(model, systemInstruction, userPrompt);
    if (!response.text) throw new Error("AI returned an empty response for the fix step.");
    let paper = extractLatexFromResponse(response.text);
    if (!paper.includes('\\end{document}')) paper += '\n\\end{document}';
    return postProcessLatex(paper);
}

export async function reformatPaperWithStyleGuide(paperContent: string, styleGuide: StyleGuide, model: string): Promise<string> {
    const styleGuideInfo = STYLE_GUIDES.find(g => g.key === styleGuide);
    if (!styleGuideInfo) throw new Error(`Unknown style: ${styleGuide}`);
    const systemInstruction = `Act as editor. Reformat ONLY References section to ${styleGuideInfo.name}. NO \\bibitem.`;
    const userPrompt = `Reformat: ${paperContent}`;
    const response = await callModel(model, systemInstruction, userPrompt);
    if (!response.text) throw new Error("AI returned empty response for reformat.");
    let paper = extractLatexFromResponse(response.text);
    if (!paper.includes('\\end{document}')) paper += '\n\\end{document}';
    return postProcessLatex(paper);
}
