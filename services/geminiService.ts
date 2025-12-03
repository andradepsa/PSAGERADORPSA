
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import type { Language, AnalysisResult, PaperSource, StyleGuide, SemanticScholarPaper, PersonalData } from '../types';
import { ANALYSIS_TOPICS, LANGUAGES, STYLE_GUIDES, SEMANTIC_SCHOLAR_API_BASE_URL } from '../constants';
import { ARTICLE_TEMPLATE } from './articleTemplate'; // Import the single article template

const BABEL_LANG_MAP: Record<Language, string> = {
    en: 'english',
    pt: 'brazilian',
    es: 'spanish',
    fr: 'french',
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Internal manager for API keys and fallback models
const KeyAndModelManager = {
    keys: [] as string[],
    modelSets: [
        { name: 'gemini-2.5-flash', description: "Primary model" },
        { name: 'gemini-2.0-flash', description: "Fallback model" }
    ],
    currentKeyIndex: 0,
    currentModelSetIndex: 0,
    initialized: false,

    loadKeys: function() {
        const storedKeys = localStorage.getItem('gemini_api_keys');
        let newKeys: string[] = [];
        if (storedKeys) {
            try {
                const parsed = JSON.parse(storedKeys);
                newKeys = Array.isArray(parsed) ? parsed.filter(k => k.trim() !== '') : [];
            } catch { /* ignore parsing errors */ }
        }
        
        // Fallback to legacy single key or env var if no new keys found
        if (newKeys.length === 0) {
            const legacyKey = localStorage.getItem('gemini_api_key') || (process.env.API_KEY as string);
            if (legacyKey) newKeys.push(legacyKey);
        }
        
        this.keys = newKeys;
    },

    initialize: function() {
        if (this.initialized) return;
        this.loadKeys();
        if (this.keys.length > 0) {
            // Random start index to distribute load across multiple browser tabs
            this.currentKeyIndex = Math.floor(Math.random() * this.keys.length);
            console.log(`[KeyManager] Initialized with ${this.keys.length} keys. Starting at random index ${this.currentKeyIndex}.`);
        }
        this.initialized = true;
    },

    getCurrentKey: function(): string {
        this.loadKeys();
        if (this.keys.length === 0) {
            throw new Error("Nenhuma chave de API Gemini foi configurada.");
        }
        if (this.currentKeyIndex >= this.keys.length) {
            this.currentKeyIndex = 0; // Reset if keys were removed
        }
        return this.keys[this.currentKeyIndex];
    },

    getCurrentModelName: function(): string {
        return this.modelSets[this.currentModelSetIndex].name;
    },

    rotateModels: function(): boolean {
        if (this.currentModelSetIndex < this.modelSets.length - 1) {
            this.currentModelSetIndex++;
            console.warn(`[KeyManager] Rotating to model set index ${this.currentModelSetIndex}`);
            return true;
        }
        return false; // No more models to rotate to for this key
    },

    rotateKey: function(): boolean {
        this.loadKeys();
        if (this.keys.length <= 1) {
            return false; // Cannot rotate
        }
        const previousKeyIndex = this.currentKeyIndex;
        this.currentKeyIndex = (this.currentKeyIndex + 1) % this.keys.length;
        this.currentModelSetIndex = 0; // Reset model for the new key
        console.warn(`[KeyManager] API Key at index ${previousKeyIndex} fully exhausted. Rotating to key at index ${this.currentKeyIndex}.`);
        return true;
    }
};

function getAiClient(): GoogleGenAI {
    const apiKey = KeyAndModelManager.getCurrentKey();
    return new GoogleGenAI({ apiKey });
}

function isRotationTrigger(error: any): boolean {
    const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
    return message.includes('429') || message.includes('quota') || message.includes('limit') || message.includes('permission denied') || message.includes('suspended');
}

async function withRateLimitHandling<T>(apiCall: () => Promise<T>): Promise<T> {
    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            return await apiCall();
        } catch (error: any) {
            // If it's a quota error, throw immediately for the outer handler to catch and rotate.
            if (isRotationTrigger(error)) {
                throw error;
            }
            // For other errors (e.g., 500 server errors), retry with backoff.
            if (attempt === MAX_RETRIES) {
                throw error; // Rethrow after final attempt
            }
            const backoffTime = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
            console.log(`[API] Transient error detected. Retrying in ${backoffTime.toFixed(0)}ms...`);
            await delay(backoffTime);
        }
    }
    throw new Error("API call failed after multiple retries for transient errors.");
}

async function executeApiCall<T>(
    operation: (client: GoogleGenAI, modelName: string, config: any) => Promise<T>,
    config: any,
    updateStatus: (message: string) => void
): Promise<T> {
    KeyAndModelManager.initialize();

    const maxAttempts = KeyAndModelManager.keys.length * KeyAndModelManager.modelSets.length;
    if (maxAttempts === 0) throw new Error("Nenhuma chave de API Gemini foi configurada.");

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const client = getAiClient();
        const modelName = KeyAndModelManager.getCurrentModelName();

        console.log(`[API Attempt ${attempt + 1}/${maxAttempts}] KeyIdx: ${KeyAndModelManager.currentKeyIndex}, ModelSetIdx: ${KeyAndModelManager.currentModelSetIndex} (${modelName})`);

        try {
            return await withRateLimitHandling(() => operation(client, modelName, config));
        } catch (error: any) {
            if (isRotationTrigger(error)) {
                console.warn(`[API] Quota/Auth error detected. Error: ${error.message}`);
                
                if (KeyAndModelManager.rotateModels()) {
                    const nextModel = KeyAndModelManager.getCurrentModelName();
                    updateStatus(`Cota atingida. Trocando para o modelo de fallback: ${nextModel}...`);
                    await delay(1000); // Small delay between model switches
                    continue; // Retry with new model, same key
                }
                
                updateStatus(`Todos os modelos de fallback falharam para a chave atual.`);
                
                if (KeyAndModelManager.rotateKey()) {
                    const cooldownMs = 5 * 60 * 1000;
                    updateStatus(`Chave de API esgotada. Pausando por 5 minutos antes de tentar a próxima chave...`);
                    await delay(cooldownMs);
                    continue; // Retry with new key and first model set
                }

                throw new Error("Todas as chaves de API e modelos de fallback foram esgotados.");
            } else {
                // Not a quota error, rethrow
                throw error;
            }
        }
    }
    throw new Error("Falha na operação de IA após o número máximo de tentativas.");
}

function postProcessLatex(latexCode: string): string {
    let code = latexCode.replace(/,?\s+&\s+/g, ' and ');
    code = code.replace(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g, '');
    return code;
}

function stripLatexComments(text: string): string {
    return text.replace(/(^|[^\\])%.*$/gm, '$1').trim();
}

function extractStrategicContext(latex: string): { text: string, isTruncated: boolean } {
    let combined = "";
    const abstractMatch = latex.match(/\\begin\{abstract\}([\s\S]*?)\\end\{abstract\}/i);
    if (abstractMatch) combined += "\\section*{Abstract}\n" + abstractMatch[1].trim() + "\n\n";
    const introMatch = latex.match(/\\section\{(?:Introduction|Introdução)\}([\s\S]*?)(?=\\section\{)/i);
    if (introMatch) {
        combined += "\\section{Introduction}\n" + introMatch[1].trim() + "\n\n";
        combined += "\n% ... [MIDDLE SECTIONS OMITTED FOR AI ANALYSIS EFFICIENCY] ...\n\n";
    }
    const conclusionMatch = latex.match(/\\section\{(?:Conclusion|Conclusão|Considerações Finais)\}([\s\S]*?)(?=\\section\{|\\end\{document\})/i);
    if (conclusionMatch) combined += "\\section{Conclusion}\n" + conclusionMatch[1].trim() + "\n\n";

    const extractDocumentBody = (latexStr: string) => {
        const beginTag = '\\begin{document}';
        const startIndex = latexStr.indexOf(beginTag);
        return startIndex !== -1 ? latexStr.substring(startIndex + beginTag.length).trim() : latexStr;
    };

    if (combined.length < 500) {
        return { text: extractDocumentBody(latex), isTruncated: false };
    }
    return { text: combined, isTruncated: true };
}


async function fetchSemanticScholarPapers(query: string, limit: number = 5): Promise<SemanticScholarPaper[]> {
    try {
        const fields = 'paperId,title,authors,abstract,url';
        const response = await fetch(`/semantic-proxy?query=${encodeURIComponent(query)}&limit=${limit}&fields=${fields}`);
        if (!response.ok) throw new Error(`Semantic Scholar API error (via Proxy): ${response.status}`);
        const data = await response.json();
        return data.data || [];
    } catch (error) {
        console.error("Error fetching from Semantic Scholar:", error);
        return [];
    }
}

// All functions below are refactored to use the new `executeApiCall` executor.

export async function generatePaperTitle(topic: string, language: Language, discipline: string, updateStatus: (message: string) => void): Promise<string> {
    const languageName = LANGUAGES.find(l => l.code === language)?.name || 'English';
    const systemInstruction = `Act as an expert academic researcher in ${discipline}. Generate a single, compelling, high-impact scientific paper title.`;
    const userPrompt = `Topic: "${topic}" in ${discipline}.\nTask: Generate a single, novel, specific, high-impact research title.\nLanguage: **${languageName}**.\nConstraint: Return ONLY the title text. No quotes.`;
    
    const response = await executeApiCall<GenerateContentResponse>(
        (client, modelName, config) => client.models.generateContent({ model: modelName, ...config }),
        { contents: userPrompt, config: { systemInstruction } },
        updateStatus
    );

    if (!response.text) throw new Error("AI returned an empty response for title generation.");
    return response.text.trim().replace(/"/g, '');
}

export async function generateInitialPaper(title: string, language: Language, pageCount: number, authorDetails: PersonalData[], updateStatus: (message: string) => void): Promise<{ paper: string, sources: PaperSource[] }> {
    const languageName = LANGUAGES.find(l => l.code === language)?.name || 'English';
    const babelLanguage = BABEL_LANG_MAP[language];
    const referenceCount = 10;
    const referencePlaceholders = Array.from({ length: referenceCount }, (_, i) => `[INSERT REFERENCE ${i + 1} HERE]`).join('\n\n');
    
    const semanticScholarPapers = await fetchSemanticScholarPapers(title, referenceCount);
    const semanticScholarContext = semanticScholarPapers.length > 0 ? "\n\n**Additional Academic Sources from Semantic Scholar (prioritize these):**\n" + semanticScholarPapers.map(p => `- Title: ${p.title}\n  Authors: ${p.authors.map(a => a.name).join(', ')}\n  Abstract: ${p.abstract || 'N/A'}\n  URL: ${p.url}`).join('\n---\n') : "";
    
    const latexAuthorsBlock = authorDetails.map(author => `${author.name || 'Unknown Author'}${author.affiliation ? `\\\\ ${author.affiliation}` : ''}${author.orcid ? `\\\\ \\small ORCID: \\url{https://orcid.org/${author.orcid}}` : ''}`).join(' \\and\n');
    const pdfAuthorNames = authorDetails.map(a => a.name).filter(Boolean).join(', ');

    const systemInstruction = `Act as a world-class AI specialized in generating LaTeX scientific papers. Write a complete, rigorous paper based on the title, strictly following the provided LaTeX template.\n\n**Rules:**\n1. **Use Template:** Fill all placeholders [INSERT...] with relevant content.\n2. **References:** Generate ${referenceCount} unique, **strictly academic citations**. Format as plain paragraphs (\\noindent ... \\par). NO \\bibitem. NO URLs.\n3. **Language:** Write in **${languageName}**.\n4. **Format:** Return valid LaTeX. NO ampersands (&) unless escaped (\\&). NO CJK characters. **Escape underscores (\\_) in text mode.**\n5. **Structure:** PRESERVE \\author/\\date verbatim.\n6. **Content:** Generate detailed content to meet ~${pageCount} pages.`;
    
    let templateWithBabelAndAuthor = ARTICLE_TEMPLATE.replace('% Babel package will be added dynamically based on language', `\\usepackage[${babelLanguage}]{babel}`).replace('[INSERT REFERENCE COUNT]', String(referenceCount)).replace('[INSERT NEW REFERENCE LIST HERE]', referencePlaceholders).replace('__ALL_AUTHORS_LATEX_BLOCK__', latexAuthorsBlock).replace('pdfauthor={__PDF_AUTHOR_NAMES_PLACEHOLDER__}', `pdfauthor={${pdfAuthorNames}}`);
    const userPrompt = `Title: "${title}".\n${semanticScholarContext}\n**Template:**\n\`\`\`latex\n${templateWithBabelAndAuthor}\n\`\`\``;

    const response = await executeApiCall<GenerateContentResponse>(
        (client, modelName, config) => client.models.generateContent({ model: modelName, ...config }),
        { contents: userPrompt, config: { systemInstruction, tools: [{ googleSearch: {} }] } },
        updateStatus
    );

    if (!response.text) throw new Error("AI returned an empty text response for paper generation.");
    let paper = response.text.trim().replace(/^```latex\s*|```\s*$/g, '');
    if (!paper.includes('\\end{document}')) paper += '\n\\end{document}';
    
    const sources: PaperSource[] = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.filter(c => c.web).map(c => ({ uri: c.web.uri, title: c.web.title })) || [];
    return { paper: postProcessLatex(paper), sources };
}

function cleanJsonOutput(text: string): string {
    return text.trim().replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
}

export async function analyzePaper(paperContent: string, pageCount: number, updateStatus: (message: string) => void): Promise<AnalysisResult> {
    const analysisTopicsList = ANALYSIS_TOPICS.map(t => `- Topic ${t.num} (${t.name}): ${t.desc}`).join('\n');
    const systemInstruction = `Act as an expert academic reviewer. Perform a rigorous, objective analysis of the LaTeX paper.\n\n**Task:**\n1. Analyze paper against criteria.\n2. Score each 0.0-10.0.\n3. Provide ONE concise, critical improvement suggestion per topic.\n4. Topic 28 (Page Count): Score based on target ${pageCount} pages.\n\n**Output:**\n- Return ONLY valid JSON.\n- Schema: { "analysis": [ { "topicNum": number, "score": number, "improvement": string } ] }\n\n**Criteria:**\n${analysisTopicsList}`;
    
    const responseSchema = { type: Type.OBJECT, properties: { analysis: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { topicNum: { type: Type.NUMBER }, score: { type: Type.NUMBER }, improvement: { type: Type.STRING } }, required: ["topicNum", "score", "improvement"] } } }, required: ["analysis"] };
    
    const estimatedPages = Math.max(1, Math.round(paperContent.length / 3000));
    let cleanPaper = stripLatexComments(paperContent).replace(/\\section\{(?:References|Referências)\}[\s\S]*$/, '');
    const hasUnfilledPlaceholders = cleanPaper.includes('[INSERT NEW CONTENT');
    const { text: paperToAnalyze, isTruncated } = extractStrategicContext(cleanPaper);
    const truncationNote = isTruncated ? `\n\n**NOTE:** Text is a STRATEGIC EXTRACT of a ${estimatedPages}-page doc. Assume missing sections exist for scoring.` : "";

    const finalSystemInstruction = systemInstruction + truncationNote;

    const response = await executeApiCall<GenerateContentResponse>(
        (client, modelName, config) => client.models.generateContent({ model: modelName, ...config }),
        { contents: paperToAnalyze, config: { systemInstruction: finalSystemInstruction, responseMimeType: "application/json", responseSchema } },
        updateStatus
    );

    if (!response.text) throw new Error("AI returned an empty response for analysis.");
    const jsonText = cleanJsonOutput(response.text);
    const result = JSON.parse(jsonText) as AnalysisResult;

    if (hasUnfilledPlaceholders) {
        console.warn("⚠️ Placeholder detected. Forcing score downgrade.");
        const structureTopic = result.analysis.find(a => a.topicNum === 13);
        const placeholderCritique = { topicNum: 13, score: 2.0, improvement: "CRITICAL: The document contains unfinished template placeholders. You MUST generate the missing content." };
        if (structureTopic) Object.assign(structureTopic, placeholderCritique);
        else result.analysis.push(placeholderCritique);
    }
    return result;
}

export async function improvePaper(paperContent: string, analysis: AnalysisResult, language: Language, updateStatus: (message: string) => void): Promise<string> {
    const languageName = LANGUAGES.find(l => l.code === language)?.name || 'English';
    const improvementPoints = analysis.analysis.filter(item => item.score < 8.5).map(item => `- **${ANALYSIS_TOPICS.find(t => t.num === item.topicNum)?.name || `TOPIC ${item.topicNum}`}:** ${item.improvement}`).join('\n');

    const systemInstruction = `Act as an expert LaTeX editor. Refine the provided paper body based on suggestions.\n\n**Rules:**\n1. **Scope:** Improve ONLY the provided body content.\n2. **Output:** Return valid LaTeX body (from \\begin{document} to \\end{document}). NO Preamble.\n3. **Language:** **${languageName}**.\n4. **Formatting:** Use 'and' instead of '&'. NO CJK chars. Escape underscores (\\_).\n5. **Placeholders:** Fill any remaining placeholders.`;
    
    const cleanPaper = stripLatexComments(paperContent);
    const docStartIndex = cleanPaper.indexOf('\\begin{document}');
    const [preamble, bodyToImprove] = docStartIndex !== -1 ? [cleanPaper.substring(0, docStartIndex), cleanPaper.substring(docStartIndex)] : ["", cleanPaper];

    const userPrompt = `Context (Preamble - DO NOT EDIT/OUTPUT THIS):\n${preamble}\n\nBody to Improve:\n${bodyToImprove}\n\nFeedback to Apply:\n${improvementPoints}\n\nTask: Return the COMPLETE, IMPROVED body starting with \\begin{document}.`;

    const response = await executeApiCall<GenerateContentResponse>(
        (client, modelName, config) => client.models.generateContent({ model: modelName, ...config }),
        { contents: userPrompt, config: { systemInstruction } },
        updateStatus
    );
    
    if (!response.text) throw new Error("AI returned an empty response for improvement.");
    let improvedBody = response.text.trim().replace(/^```latex\s*|```\s*$/g, '');

    const finalPaper = (docStartIndex !== -1 && !improvedBody.includes('\\documentclass')) ? preamble + "\n" + improvedBody : improvedBody;
    return postProcessLatex(finalPaper.includes('\\end{document}') ? finalPaper : finalPaper + '\n\\end{document}');
}

export async function fixLatexPaper(paperContent: string, compilationError: string, updateStatus: (message: string) => void): Promise<string> {
    const systemInstruction = `Act as an expert LaTeX debugger. Fix compilation errors in the provided LaTeX code.

**Common Fix Strategies:**
1. **"Missing $ inserted"**: Usually caused by unescaped underscores (e.g., "X_cf") in text mode. FIX: Escape them ("X\\_cf") or wrap in math mode ("$X_{cf}$").
2. **"Environment axis undefined"**: The code uses \\begin{axis} but misses \\usepackage{pgfplots}. FIX: Add \\usepackage{pgfplots} and \\pgfplotsset{compat=1.17} to the preamble.
3. **"Environment ... undefined"**: Add the missing package (e.g., tikz, algorithm).
4. **"Unicode character"**: Remove or replace unsupported characters.
5. **"File not found"**: If an image/bibliography file is missing, comment out the include command or replace with a placeholder.

**Rules:**
- Fix ONLY the error reported in the log.
- Do not remove content unless it's the source of the error and unfixable.
- Return the FULL, VALID LaTeX document.
- DO NOT use \\bibitem or \\bibliography. Keep references as plain text lists.`;
    
    const userPrompt = `Error:\n\`\`\`\n${compilationError}\n\`\`\`\n\nCode:\n\`\`\`latex\n${paperContent}\n\`\`\``;
    
    const response = await executeApiCall<GenerateContentResponse>(
        (client, modelName, config) => client.models.generateContent({ model: modelName, ...config }),
        { contents: userPrompt, config: { systemInstruction } },
        updateStatus
    );

    if (!response.text) throw new Error("AI returned an empty response for the fix step.");
    let paper = response.text.trim().replace(/^```latex\s*|```\s*$/g, '');
    if (!paper.includes('\\end{document}')) paper += '\n\\end{document}';
    return postProcessLatex(paper);
}

export async function reformatPaperWithStyleGuide(paperContent: string, styleGuide: StyleGuide, updateStatus: (message: string) => void): Promise<string> {
    const styleGuideInfo = STYLE_GUIDES.find(g => g.key === styleGuide);
    if (!styleGuideInfo) throw new Error(`Unknown style guide: ${styleGuide}`);

    const systemInstruction = `Act as academic editor. Reformat ONLY the References section.\n\n**Rules:**\n1. **Style:** ${styleGuideInfo.name}.\n2. **Scope:** Edit ONLY content in \\section{References}. Keep preamble/body exact.\n3. **Format:** Plain list. NO \\bibitem. NO URLs.\n4. **Output:** Full LaTeX document.`;
    const userPrompt = `Reformat references to ${styleGuideInfo.name}.\n\n**Document:**\n\`\`\`latex\n${paperContent}\n\`\`\``;

    const response = await executeApiCall<GenerateContentResponse>(
        (client, modelName, config) => client.models.generateContent({ model: modelName, ...config }),
        { contents: userPrompt, config: { systemInstruction } },
        updateStatus
    );
    
    if (!response.text) throw new Error("AI returned an empty response for reformatting.");
    let paper = response.text.trim().replace(/^```latex\s*|```\s*$/g, '');
    if (!paper.includes('\\end{document}')) paper += '\n\\end{document}';
    return postProcessLatex(paper);
}
