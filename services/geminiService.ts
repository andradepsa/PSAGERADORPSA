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
export const KeyManager = {
    keys: [] as string[],
    currentIndex: 0,
    initialized: false,

    loadKeys: function() {
        const storedKeys = localStorage.getItem('gemini_api_keys');
        const legacyKey = localStorage.getItem('gemini_api_key') || (process.env.API_KEY as string);
        
        if (storedKeys) {
            try {
                const parsed = JSON.parse(storedKeys);
                this.keys = Array.isArray(parsed) ? parsed.filter(k => k.trim() !== '') : [];
            } catch {
                this.keys = [];
            }
        }
        
        if (this.keys.length === 0 && legacyKey) {
            this.keys = [legacyKey];
        }

        // Always check environment variable if keys list is still empty
        if (this.keys.length === 0 && process.env.API_KEY) {
             this.keys = [process.env.API_KEY];
        }

        this.initialized = true;
    },

    getCurrentKey: function(): string {
        if (!this.initialized) this.loadKeys();
        if (this.keys.length === 0) {
            throw new Error("Gemini API key not found. Please add keys in the settings modal (gear icon).");
        }
        return this.keys[this.currentIndex];
    },
    
    getAllKeys: function(): string[] {
        if (!this.initialized) this.loadKeys();
        return this.keys;
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

// Wrapper to create client with the CURRENT active key OR a specific key
function getAiClient(specificKey?: string): GoogleGenAI {
    const apiKey = specificKey || KeyManager.getCurrentKey();
    return new GoogleGenAI({ apiKey });
}

// Executes an AI model call with automatic key rotation on Quota/429 errors
// If specificKey is provided, rotation is DISABLED for that call.
async function executeWithKeyRotation<T>(
    operation: (client: GoogleGenAI) => Promise<T>, 
    modelName: string,
    specificKey?: string
): Promise<T> {
    
    // Refresh keys from storage in case user added one mid-process
    if (!specificKey) KeyManager.loadKeys(); 

    // If a specific key is forced (Parallel Mode), we only try once or strictly retry on that key without rotation.
    const maxAttempts = specificKey ? 1 : (KeyManager.keys.length > 0 ? KeyManager.keys.length : 1);
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            const client = getAiClient(specificKey);
            return await withRateLimitHandling(() => operation(client));
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
            
            // Check if error is related to quota or exhaustion
            const isQuotaError = 
                errorMessage.includes('429') || 
                errorMessage.includes('quota') || 
                errorMessage.includes('limit') || 
                errorMessage.includes('exhausted');

            // PARALLEL MODE / SPECIFIC KEY HANDLING:
            if (specificKey) {
                // If we are forced to use a specific key and it fails with quota, we cannot rotate.
                // We just throw the error to be handled by the worker.
                throw error;
            }

            // ROTATION MODE HANDLING:
            if (isQuotaError && KeyManager.keys.length > 1) {
                console.warn(`⚠️ API Key (Index ${KeyManager.currentIndex}) exhausted. Attempting to rotate...`);
                KeyManager.rotate();
                await delay(1000); 
                continue; 
            }

            if (attempt === maxAttempts - 1) {
                if (isQuotaError && !specificKey) {
                    throw new Error(`All Gemini API Keys exhausted (Quota/429). Last error: ${errorMessage}`);
                }
                throw error;
            }
            
            throw error;
        }
    }
    
    throw new Error("All Gemini API Keys exhausted (Rotation loop ended without success).");
}

async function withRateLimitHandling<T>(apiCall: () => Promise<T>): Promise<T> {
    const MAX_RETRIES = 5; 
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            return await apiCall(); 
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
            
            if (errorMessage.includes('limit: 0') || errorMessage.includes('quota exceeded for metric')) {
                 throw new Error(`API Quota Exceeded (Limit: 0) or Model Unavailable: ${errorMessage}`);
            }

            if (attempt === MAX_RETRIES) {
                if (errorMessage.includes('429') || errorMessage.includes('quota')) {
                    throw new Error(`Quota Exceeded (429): ${errorMessage}`);
                 }
                 if (errorMessage.includes('503') || errorMessage.includes('overloaded')) {
                    throw new Error("The AI model is temporarily overloaded. Please try again in a few moments.");
                 }
                throw error;
            }

            let backoffTime;
            if (errorMessage.includes('429') || errorMessage.includes('quota')) {
                backoffTime = 2000 + Math.random() * 1000;
            } else {
                console.log("Transient error detected. Using exponential backoff...");
                backoffTime = Math.pow(2, attempt) * 1000 + Math.random() * 500;
            }
            
            console.log(`Waiting for ${backoffTime.toFixed(0)}ms before retrying on same key...`);
            await delay(backoffTime);
        }
    }
    throw new Error("API call failed after internal retries.");
}

// Central dispatcher for different AI models
async function callModel(
    model: string,
    systemInstruction: string,
    userPrompt: string,
    config: {
        jsonOutput?: boolean;
        responseSchema?: any;
        googleSearch?: boolean;
    } = {},
    specificApiKey?: string
): Promise<GenerateContentResponse> {
    if (model.startsWith('gemini-')) {
        return executeWithKeyRotation(async (aiClient) => {
            return aiClient.models.generateContent({
                model: model,
                contents: userPrompt,
                config: {
                    systemInstruction: systemInstruction,
                    ...(config.jsonOutput && { responseMimeType: "application/json" }),
                    ...(config.responseSchema && { responseSchema: config.responseSchema }),
                    ...(config.googleSearch && { tools: [{ googleSearch: {} }] }),
                },
            });
        }, model, specificApiKey);

    } else if (model.startsWith('grok-')) {
        // Grok logic remains unchanged (single key support)
        const apiKey = localStorage.getItem('xai_api_key');
        if (!apiKey) {
            throw new Error("x.ai API key not found. Please set it in the settings modal (gear icon).");
        }

        const messages = [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: userPrompt }
        ];

        const apiCall = async () => {
            const response = await fetch('https://api.x.ai/v1/chat/completions', {
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
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`x.ai API Error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
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

        return withRateLimitHandling(apiCall);
    } else {
        throw new Error(`Unsupported model: ${model}`);
    }
}


export async function generatePaperTitle(topic: string, language: Language, model: string, discipline: string, apiKey?: string): Promise<string> {
    const languageName = LANGUAGES.find(l => l.code === language)?.name || 'English';
    const systemInstruction = `You are an expert academic researcher in the field of ${discipline}. Your task is to generate a single, compelling, and high-impact title for a scientific paper.`;
    const userPrompt = `Based on the topic "${topic}" within the discipline of ${discipline}, generate a single, novel, and specific title for a high-impact research paper. 
    **Requirements:**
    - The title must sound like a genuine, modern academic publication in ${discipline}.
    - It must be concise and impactful.
    - It must be written in **${languageName}**.
    - Your entire response MUST be only the title itself. Do not include quotation marks, labels like "Title:", or any other explanatory text.`;

    const response = await callModel(model, systemInstruction, userPrompt, {}, apiKey);
    
    if (!response.candidates || response.candidates.length === 0) throw new Error("AI returned no candidates for title.");
    if (!response.text) throw new Error("AI returned an empty response text for the title generation.");
    
    return response.text.trim().replace(/"/g, '');
}


function postProcessLatex(latexCode: string): string {
    return latexCode.replace(/,?\s+&\s+/g, ' and ');
}

async function fetchSemanticScholarPapers(query: string, limit: number = 5): Promise<SemanticScholarPaper[]> {
    try {
        const fields = 'paperId,title,authors,abstract,url';
        const response = await fetch(`/semantic-proxy?query=${encodeURIComponent(query)}&limit=${limit}&fields=${fields}`);
        if (!response.ok) throw new Error(`Semantic Scholar API error`);
        const data = await response.json();
        return data.data || [];
    } catch (error) {
        return [];
    }
}


export async function generateInitialPaper(title: string, language: Language, pageCount: number, model: string, authorDetails: PersonalData[], apiKey?: string): Promise<{ paper: string, sources: PaperSource[] }> {
    const languageName = LANGUAGES.find(l => l.code === language)?.name || 'English';
    const babelLanguage = BABEL_LANG_MAP[language];

    let referenceCount = 20;
    if (pageCount === 30) referenceCount = 40;
    else if (pageCount === 60) referenceCount = 60;
    else if (pageCount === 100) referenceCount = 100;

    const referencePlaceholders = Array.from({ length: referenceCount }, (_, i) => `[INSERT REFERENCE ${i + 1} HERE]`).join('\n\n');
    const semanticScholarPapers = await fetchSemanticScholarPapers(title, 5);
    const semanticScholarContext = semanticScholarPapers.length > 0
        ? "\n\n**Additional Academic Sources from Semantic Scholar:**\n" + semanticScholarPapers.map(p => `- Title: ${p.title}\n  Authors: ${p.authors.map(a => a.name).join(', ')}\n  Abstract: ${p.abstract || 'N/A'}\n  URL: ${p.url}`).join('\n---\n')
        : "";

    const latexAuthorsBlock = authorDetails.map((author) => {
        const name = author.name || 'Unknown Author';
        const affiliation = author.affiliation ? `\\\\ ${author.affiliation}` : '';
        const orcid = author.orcid ? `\\\\ \\small ORCID: \\url{https://orcid.org/${author.orcid}}` : '';
        return `${name}${affiliation}${orcid}`;
    }).join(' \\and\n');

    const pdfAuthorNames = authorDetails.map(a => a.name).filter(Boolean).join(', ');

    const systemInstruction = `You are a world-class AI assistant specialized in generating high-quality, well-structured scientific papers in LaTeX format. Your task is to write a complete, coherent, and academically rigorous paper based on a provided title, strictly following a given LaTeX template.
    **Execution Rules:**
    1. Use the Provided Template.
    2. Fill All Placeholders.
    3. Strictly Adhere to Structure.
    4. Language: **${languageName}**.
    5. No markdown fences.
    6. No Ampersands (&) in references.
    7. No URLs in references.`;

    let templateWithBabelAndAuthor = ARTICLE_TEMPLATE.replace('% Babel package will be added dynamically based on language', `\\usepackage[${babelLanguage}]{babel}`)
        .replace('[INSERT REFERENCE COUNT]', String(referenceCount))
        .replace('[INSERT NEW REFERENCE LIST HERE]', referencePlaceholders)
        .replace('__ALL_AUTHORS_LATEX_BLOCK__', latexAuthorsBlock)
        .replace('pdfauthor={__PDF_AUTHOR_NAMES_PLACEHOLDER__}', `pdfauthor={${pdfAuthorNames}}`);

    const userPrompt = `Using the following LaTeX template, generate a complete scientific paper with the title: "${title}".
${semanticScholarContext}
**Template:**
\`\`\`latex
${templateWithBabelAndAuthor}
\`\`\`
`;

    const response = await callModel(model, systemInstruction, userPrompt, { googleSearch: true }, apiKey);
    
    if (!response.text) throw new Error(`AI returned an empty text response.`);

    let paper = response.text.trim().replace(/^```latex\s*|```\s*$/g, '');
    if (!paper.includes('\\end{document}')) paper += '\n\\end{document}';
    
    const sources: PaperSource[] = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.filter(chunk => chunk.web).map(chunk => ({ uri: chunk.web.uri, title: chunk.web.title, })) || [];

    return { paper: postProcessLatex(paper), sources };
}

export async function analyzePaper(paperContent: string, pageCount: number, model: string, apiKey?: string): Promise<AnalysisResult> {
    const analysisTopicsList = ANALYSIS_TOPICS.map(t => `- Topic ${t.num} (${t.name}): ${t.desc}`).join('\n');
    const systemInstruction = `You are an expert academic reviewer AI. Analyze the paper based on topics. Return JSON only.`;
    
    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            analysis: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: { topicNum: { type: Type.NUMBER }, score: { type: Type.NUMBER }, improvement: { type: Type.STRING }, },
                    required: ["topicNum", "score", "improvement"],
                },
            },
        },
        required: ["analysis"],
    };

    const response = await callModel(model, systemInstruction, paperContent, { jsonOutput: true, responseSchema: responseSchema }, apiKey);
    
    if (!response.text) throw new Error("AI returned an empty response for the analysis.");

    try {
        const jsonText = response.text.trim().replace(/^```json\s*|```\s*$/g, '');
        return JSON.parse(jsonText) as AnalysisResult;
    } catch (error) {
        throw new Error("The analysis returned an invalid format.");
    }
}


export async function improvePaper(paperContent: string, analysis: AnalysisResult, language: Language, model: string, apiKey?: string): Promise<string> {
    const languageName = LANGUAGES.find(l => l.code === language)?.name || 'English';
    const improvementPoints = analysis.analysis.filter(item => item.score < 8.5).map(item => {
            const topic = ANALYSIS_TOPICS.find(t => t.num === item.topicNum);
            const topicName = topic ? topic.name : `UNKNOWN TOPIC (${item.topicNum})`;
            return `- **${topicName} (Score: ${item.score})**: ${item.improvement}`;
        }).join('\n');

    const systemInstruction = `You are a world-class AI assistant specialized in editing and improving scientific papers written in LaTeX.
    **Instructions:**
    - Apply changes based on improvement points.
    - Maintain valid LaTeX.
    - Language: **${languageName}**.
    - No ampersands in references.`;

    const userPrompt = `Current Paper Content:\n\n${paperContent}\n\nImprovement Points:\n\n${improvementPoints}\n\nBased on the above improvement points, provide the complete, improved LaTeX source code for the paper.`;

    const response = await callModel(model, systemInstruction, userPrompt, {}, apiKey);
    if (!response.text) throw new Error("AI returned an empty response for improvement.");

    let paper = response.text.trim().replace(/^```latex\s*|```\s*$/g, '');
    if (!paper.includes('\\end{document}')) paper += '\n\\end{document}';

    return postProcessLatex(paper);
}

export async function fixLatexPaper(paperContent: string, compilationError: string, model: string, apiKey?: string): Promise<string> {
    const systemInstruction = `You are an expert LaTeX editor AI. Fix compilation error. Return only corrected LaTeX.`;
    const userPrompt = `Error: ${compilationError}\n\nCode:\n${paperContent}`;
    const response = await callModel(model, systemInstruction, userPrompt, {}, apiKey);
    
    if (!response.text) throw new Error("AI returned an empty response for the fix step.");
    let paper = response.text.trim().replace(/^```latex\s*|```\s*$/g, '');
    if (!paper.includes('\\end{document}')) paper += '\n\\end{document}';
    return postProcessLatex(paper);
}

export async function reformatPaperWithStyleGuide(paperContent: string, styleGuide: StyleGuide, model: string, apiKey?: string): Promise<string> {
    const styleGuideInfo = STYLE_GUIDES.find(g => g.key === styleGuide);
    if (!styleGuideInfo) throw new Error(`Unknown style guide`);

    const systemInstruction = `Reformat bibliography to ${styleGuideInfo.name}. Return full document.`;
    const userPrompt = `LaTeX Document:\n${paperContent}`;

    const response = await callModel(model, systemInstruction, userPrompt, {}, apiKey);
    if (!response.text) throw new Error("AI returned an empty response for reformat.");

    let paper = response.text.trim().replace(/^```latex\s*|```\s*$/g, '');
    if (!paper.includes('\\end{document}')) paper += '\n\\end{document}';
    return postProcessLatex(paper);
}