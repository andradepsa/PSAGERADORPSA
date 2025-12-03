
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

        // Always check environment variable if keys list is still empty
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
    const MAX_RETRIES = 5; 
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            return await apiCall(); 
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
            
            if (errorMessage.includes('limit: 0') || errorMessage.includes('quota exceeded for metric')) {
                 throw new Error(`API Quota Exceeded (Limit: 0) or Model Unavailable: ${errorMessage}`);
            }

            const shouldRotate = isRotationTrigger(error);
            const hasBackupKeys = KeyManager.keys.length > 1;

            if (shouldRotate && hasBackupKeys) {
                throw error;
            }

            if (attempt === MAX_RETRIES) {
                if (shouldRotate) {
                    throw new Error(`Quota Exceeded or Key Suspended: ${errorMessage}`);
                 }
                 if (errorMessage.includes('503') || errorMessage.includes('overloaded')) {
                    throw new Error("The AI model is temporarily overloaded. Please try again in a few moments.");
                 }
                throw error;
            }

            let backoffTime;
            if (shouldRotate) {
                backoffTime = 8000 + Math.random() * 4000;
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
        }, model);

    } else if (model.startsWith('grok-')) {
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


export async function generatePaperTitle(topic: string, language: Language, model: string, discipline: string): Promise<string> {
    const languageName = LANGUAGES.find(l => l.code === language)?.name || 'English';
    const systemInstruction = `Act as an expert academic researcher in ${discipline}. Generate a single, compelling, high-impact scientific paper title.`;
    const userPrompt = `Topic: "${topic}" in ${discipline}.
    Task: Generate a single, novel, specific, high-impact research title.
    Language: **${languageName}**.
    Constraint: Return ONLY the title text. No quotes.`;

    const response = await callModel(model, systemInstruction, userPrompt);
    
    if (!response.candidates || response.candidates.length === 0) {
        throw new Error("AI returned no candidates for title. Prompt likely blocked by safety filters.");
    }
    
    if (!response.text) {
         throw new Error("AI returned an empty response text for the title generation.");
    }
    
    return response.text.trim().replace(/"/g, ''); 
}

/**
 * Strips comments from LaTeX code to save tokens and file size.
 * Matches '%' that are at the start of a line OR not preceded by a backslash.
 */
function stripLatexComments(text: string): string {
    return text.replace(/(^|[^\\])%.*$/gm, '$1').trim();
}

// Programmatic post-processing to fix common LaTeX issues and aggressively clean payload
function postProcessLatex(latexCode: string): string {
    let code = latexCode;

    // 1. Strip comments to significantly reduce size for compilation (fixes 400 Bad Request issues)
    code = stripLatexComments(code);

    // 2. Remove microtype (causes timeouts on some compilers)
    code = code.replace(/\\usepackage(\[.*?\])?\{microtype\}/g, '');

    // 3. Robustly replace ampersands used for authors/text
    code = code.replace(/,?\s+&\s+/g, ' and ');
    
    // 4. CRITICAL: Strip CJK (Chinese, Japanese, Korean) characters
    code = code.replace(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g, '');

    // 5. SURGICAL FIX FOR TOPIC 30 (No Visuals & LaTeX Fixes)
    // Aggressively DELETE figure, table, algorithm environments and includegraphics
    code = code.replace(/\\includegraphics(\[.*?\])?\{.*?\}/gi, '');
    code = code.replace(/\\begin\{figure\*?\}([\s\S]*?)\\end\{figure\*?\}/gi, '');
    code = code.replace(/\\begin\{table\*?\}([\s\S]*?)\\end\{table\*?\}/gi, '');
    code = code.replace(/\\begin\{algorithm\*?\}([\s\S]*?)\\end\{algorithm\*?\}/gi, '');
    code = code.replace(/\\begin\{listing\*?\}([\s\S]*?)\\end\{listing\*?\}/gi, '');
    code = code.replace(/\\begin\{tikzpicture\}([\s\S]*?)\\end\{tikzpicture\}/gi, '');

    return code.trim();
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
    
    // 1. Extract Abstract
    const abstractMatch = latex.match(/\\begin\{abstract\}([\s\S]*?)\\end\{abstract\}/i);
    if (abstractMatch) {
        combined += "\\section*{Abstract}\n" + abstractMatch[1].trim() + "\n\n";
    }

    // 2. Extract Introduction
    const introMatch = latex.match(/\\section\{(?:Introduction|Introdução)\}([\s\S]*?)(?=\\section\{)/i);
    if (introMatch) {
        combined += "\\section{Introduction}\n" + introMatch[1].trim() + "\n\n";
        combined += "\n% ... [MIDDLE SECTIONS (Literature, Methodology, Results, Discussion) OMITTED FOR AI ANALYSIS EFFICIENCY] ...\n\n";
    }

    // 3. Extract Conclusion
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


export async function generateInitialPaper(title: string, language: Language, pageCount: number, model: string, authorDetails: PersonalData[]): Promise<{ paper: string, sources: PaperSource[] }> {
    const languageName = LANGUAGES.find(l => l.code === language)?.name || 'English';
    const babelLanguage = BABEL_LANG_MAP[language];
    const referenceCount = 10;

    const referencePlaceholders = Array.from(
        { length: referenceCount },
        (_, i) => `[INSERT REFERENCE ${i + 1} HERE]`
    ).join('\n\n');

    const semanticScholarPapers = await fetchSemanticScholarPapers(title, referenceCount);
    const semanticScholarContext = semanticScholarPapers.length > 0
        ? "\n\n**Additional Academic Sources from Semantic Scholar (prioritize these):**\n" +
          semanticScholarPapers.map(p => 
              `- Title: ${p.title}\n  Authors: ${p.authors.map(a => a.name).join(', ')}\n  Abstract: ${p.abstract || 'N/A'}\n  URL: ${p.url}`
          ).join('\n---\n')
        : "";

    const latexAuthorsBlock = authorDetails.map((author, index) => {
        const name = author.name || 'Unknown Author';
        const affiliation = author.affiliation ? `\\\\ ${author.affiliation}` : '';
        const orcid = author.orcid ? `\\\\ \\small ORCID: \\url{https://orcid.org/${author.orcid}}` : '';
        return `${name}${affiliation}${orcid}`;
    }).join(' \\and\n'); 

    const pdfAuthorNames = authorDetails.map(a => a.name).filter(Boolean).join(', ');

    const systemInstruction = `Act as a world-class AI specialized in generating LaTeX scientific papers. Write a complete, rigorous paper based on the title, strictly following the provided LaTeX template.

**Rules:**
1.  **Use Template:** Fill all placeholders [INSERT...] with relevant content.
2.  **References:** Generate ${referenceCount} unique, **strictly academic citations**. **AVOID** websites/blogs. Format as plain paragraphs (\\noindent ... \\par). NO \\bibitem. NO URLs.
3.  **Language:** Write in **${languageName}**.
4.  **Format:** Return valid LaTeX. NO ampersands (&) in text (use 'and'). NO CJK characters. Escape special chars (%, _, $).
5.  **Structure:** Do NOT change commands. PRESERVE \\author/\\date verbatim.
6.  **Content:** Generate detailed content for each section to meet ~${pageCount} pages.
7.  **TOPIC 30 ENFORCEMENT (MANDATORY):**
    -   **NO VISUALS:** Do NOT generate any environments like \\begin{figure}, \\begin{table}, or \\includegraphics. Use TEXT ONLY descriptions.
    -   **CRITICAL SYNTAX RULE:** You MUST escape underscores in text mode (e.g., "variable\\_name" NOT "variable_name"). Do not use raw underscores unless in a math block ($x_i$). This avoids "Missing $ inserted" errors.
`;

    let templateWithBabelAndAuthor = ARTICLE_TEMPLATE.replace(
        '% Babel package will be added dynamically based on language',
        `\\usepackage[${babelLanguage}]{babel}`
    ).replace(
        '[INSERT REFERENCE COUNT]',
        String(referenceCount)
    ).replace(
        '[INSERT NEW REFERENCE LIST HERE]',
        referencePlaceholders
    );

    templateWithBabelAndAuthor = templateWithBabelAndAuthor.replace(
        '__ALL_AUTHORS_LATEX_BLOCK__', 
        latexAuthorsBlock
    );
    templateWithBabelAndAuthor = templateWithBabelAndAuthor.replace(
        'pdfauthor={__PDF_AUTHOR_NAMES_PLACEHOLDER__}', 
        `pdfauthor={${pdfAuthorNames}}`
    );

    const userPrompt = `Title: "${title}".
${semanticScholarContext}
**Template:**
\`\`\`latex
${templateWithBabelAndAuthor}
\`\`\`
`;

    const response = await callModel(model, systemInstruction, userPrompt, { googleSearch: true });
    
    if (!response.candidates || response.candidates.length === 0) {
        throw new Error("AI returned no candidates. This usually means the model refused the prompt (safety/policy).");
    }
    
    if (!response.text) {
        const candidate = response.candidates[0];
        const reason = candidate.finishReason || 'UNKNOWN';
        const safetyRatings = candidate.safetyRatings?.map(r => `${r.category}: ${r.probability}`).join(', ') || 'None';
        throw new Error(`AI returned an empty text response. Finish Reason: ${reason}. Safety Ratings: [${safetyRatings}].`);
    }

    let paper = response.text.trim().replace(/^```latex\s*|```\s*$/g, '');
    
    if (!paper.includes('\\end{document}')) {
        paper += '\n\\end{document}';
    }
    
    const sources: PaperSource[] = response.candidates?.[0]?.groundingMetadata?.groundingChunks
        ?.filter(chunk => chunk.web)
        .map(chunk => ({
            uri: chunk.web.uri,
            title: chunk.web.title,
        })) || [];

    return { paper: postProcessLatex(paper), sources };
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
    
    const systemInstruction = `Act as an expert academic reviewer. Perform a rigorous, objective analysis of the LaTeX paper.

    **Task:**
    1.  Analyze paper against criteria.
    2.  Score each 0.0-10.0 (10=perfect).
    3.  Provide ONE concise, critical improvement suggestion per topic.
    4.  Topic 28 (Page Count): Score based on target ${pageCount} pages.

    **Output:**
    -   Return ONLY valid JSON.
    -   Schema: { "analysis": [ { "topicNum": number, "score": number, "improvement": string } ] }
    -   No markdown, no text explanations.

    **Criteria:**
    ${analysisTopicsList}
    `;
    
    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            analysis: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        topicNum: { type: Type.NUMBER },
                        score: { type: Type.NUMBER },
                        improvement: { type: Type.STRING },
                    },
                    required: ["topicNum", "score", "improvement"],
                },
            },
        },
        required: ["analysis"],
    };

    const estimatedPagesFromChars = Math.max(1, Math.round(paperContent.length / 3000));
    let cleanPaper = stripLatexComments(paperContent);
    cleanPaper = cleanPaper.replace(/\\section\{(?:References|Referências)\}[\s\S]*$/, '');
    const hasUnfilledPlaceholders = cleanPaper.includes('[INSERT NEW CONTENT');
    const contextObj = extractStrategicContext(cleanPaper);
    const paperToAnalyze = contextObj.text;

    const truncationNote = contextObj.isTruncated 
        ? `\n\n**NOTE:** Text is a **STRATEGIC EXTRACT** (Abstract+Intro+Conclusion) of a ${estimatedPagesFromChars}-page doc. References are omitted. Assume missing sections exist for structure/page-count scores.`
        : "";

    const finalSystemInstruction = systemInstruction + truncationNote;
    const MAX_PARSE_RETRIES = 3;
    
    for (let attempt = 1; attempt <= MAX_PARSE_RETRIES; attempt++) {
        try {
            const response = await callModel(model, finalSystemInstruction, paperToAnalyze, {
                jsonOutput: true,
                responseSchema: responseSchema
            });

            if (!response.candidates || response.candidates.length === 0) {
                 throw new Error("AI returned no candidates for analysis.");
            }

            if (!response.text) {
                throw new Error("AI returned an empty response for the analysis.");
            }

            const jsonText = cleanJsonOutput(response.text);
            const result = JSON.parse(jsonText) as AnalysisResult;

            if (hasUnfilledPlaceholders) {
                console.warn("⚠️ Placeholder detected in content. Forcing score downgrade.");
                const structureTopicIndex = result.analysis.findIndex(a => a.topicNum === 13);
                const placeholderCritique = {
                    topicNum: 13,
                    score: 2.0,
                    improvement: "CRITICAL: The document contains unfinished template placeholders (e.g., [INSERT NEW CONTENT...]). You MUST generate the missing content for these sections immediately."
                };

                if (structureTopicIndex !== -1) {
                    result.analysis[structureTopicIndex] = placeholderCritique;
                } else {
                    result.analysis.push(placeholderCritique);
                }
            }
            return result;
        } catch (error) {
            console.warn(`Attempt ${attempt} to analyze paper failed (JSON Parse/Validation):`, error);
            if (attempt === MAX_PARSE_RETRIES) {
                throw new Error(`The analysis returned an invalid format after ${MAX_PARSE_RETRIES} attempts. Last error: ${error instanceof Error ? error.message : String(error)}`);
            }
            await delay(2000);
        }
    }
    throw new Error("Unexpected error in analysis loop.");
}


export async function improvePaper(paperContent: string, analysis: AnalysisResult, language: Language, model: string): Promise<string> {
    const languageName = LANGUAGES.find(l => l.code === language)?.name || 'English';
    const improvementPoints = analysis.analysis
        .filter(item => item.score < 8.5)
        .map(item => {
            const topic = ANALYSIS_TOPICS.find(t => t.num === item.topicNum);
            const topicName = topic ? topic.name : `UNKNOWN TOPIC (${item.topicNum})`;
            return `- **${topicName}**: ${item.improvement}`;
        })
        .join('\n');

    const systemInstruction = `Act as an expert LaTeX editor. Refine the provided paper body based on suggestions.

    **Rules:**
    1.  **Scope:** Improve ONLY the provided body content.
    2.  **Output:** Return valid LaTeX body (from \\begin{document} to \\end{document}). NO Preamble.
    3.  **Language:** **${languageName}**.
    4.  **Formatting:** NO \\bibitem. NO URLs. Use 'and' instead of '&'. NO CJK chars.
    5.  **TOPIC 30 ENFORCEMENT (STRICT):**
        -   **NO VISUALS:** Do NOT generate \\begin{figure}, \\includegraphics, or \\begin{table}.
        -   **MATH / MISSING $:** Ensure all math symbols (<, >, =, +, -) are inside $...$.
        -   **UNDERSCORES:** You MUST escape underscores (_) in text mode (use \\_) unless they are math variables inside $...$. This is critical to prevent "Missing $ inserted" errors.
    6.  **No Placeholders:** Search and replace any remaining placeholders with concrete data.
    7.  **Safety:** Do not add \\newpage.
    `;

    const cleanPaper = stripLatexComments(paperContent);
    const docStartIndex = cleanPaper.indexOf('\\begin{document}');
    let preamble = "";
    let bodyToImprove = cleanPaper;

    if (docStartIndex !== -1) {
        preamble = cleanPaper.substring(0, docStartIndex);
        bodyToImprove = cleanPaper.substring(docStartIndex);
    } else {
        console.warn("Could not find \\begin{document} for splitting. Sending full text.");
    }

    const userPrompt = `Context (Preamble - DO NOT EDIT/OUTPUT THIS):
${preamble}

Body to Improve:
${bodyToImprove}

Feedback to Apply:
${improvementPoints}

Task: Return the COMPLETE, IMPROVED body starting with \\begin{document}.`;

    const response = await callModel('gemini-2.5-flash', systemInstruction, userPrompt);
    
    if (!response.candidates || response.candidates.length === 0) {
        throw new Error("AI returned no candidates for improvement.");
    }
    
    if (!response.text) {
        throw new Error("AI returned an empty response for the improvement step.");
    }

    let improvedBody = response.text.trim().replace(/^```latex\s*|```\s*$/g, '');

    if (docStartIndex !== -1 && !improvedBody.includes('\\documentclass')) {
        return postProcessLatex(preamble + "\n" + improvedBody);
    } 
    
    if (!improvedBody.includes('\\end{document}')) {
        improvedBody += '\n\\end{document}';
    }

    return postProcessLatex(improvedBody);
}

export async function fixLatexPaper(paperContent: string, compilationError: string, model: string): Promise<string> {
    const systemInstruction = `Act as an expert LaTeX debugger. Fix compilation errors.

    **CRITICAL PRIORITY: TOPIC 30 ENFORCEMENT**
    1.  **NO VISUALS:** DELETE all \\begin{figure} ... \\end{figure}, \\begin{table} ... \\end{table}, \\includegraphics{...}, \\begin{algorithm} ... \\end{algorithm}. Do NOT comment them out, DELETE them.
    2.  **MATH/UNDERSCORES:** The error "Missing $ inserted" is frequently caused by unescaped underscores in text mode (e.g. "variable_name"). You MUST escape them (variable\\_name) OR wrap the variable in math mode ($variable_name$) if it is a formula. Check context lines in the log.
    3.  **SYNTAX ERROR / 400 BAD REQUEST:** If the error log mentions "Bad Request" or syntax issues without a specific line, assume the document is too large or has invalid characters. Remove unnecessary comments and ensure all environments are closed.

    **General Rules:**
    1.  **Precision:** Fix the specific error found in the log.
    2.  **Output:** Return the FULL, CORRECTED, VALID LaTeX document.
    3.  **Formatting:** No \\bibitem (use plain text), No \\cite (use plain text), No URLs. No CJK chars.
    `;

    const userPrompt = `Error:
\`\`\`
${compilationError}
\`\`\`

Code:
\`\`\`latex
${paperContent}
\`\`\`
`;

    const response = await callModel(model, systemInstruction, userPrompt);
    
    if (!response.text) {
        throw new Error("AI returned an empty response for the fix step.");
    }
    
    let paper = response.text.trim().replace(/^```latex\s*|```\s*$/g, '');
    
    if (!paper.includes('\\end{document}')) {
        paper += '\n\\end{document}';
    }

    return postProcessLatex(paper);
}

export async function reformatPaperWithStyleGuide(paperContent: string, styleGuide: StyleGuide, model: string): Promise<string> {
    const styleGuideInfo = STYLE_GUIDES.find(g => g.key === styleGuide);
    if (!styleGuideInfo) {
        throw new Error(`Unknown style guide: ${styleGuide}`);
    }

    const systemInstruction = `Act as academic editor. Reformat ONLY the References section.

    **Rules:**
    1.  **Style:** ${styleGuideInfo.name}.
    2.  **Scope:** Edit ONLY content in \\section{References}. Keep preamble/body exact.
    3.  **Format:** Plain list. NO \\bibitem. NO URLs.
    4.  **Output:** Full LaTeX document.
    `;

    const userPrompt = `Reformat references to ${styleGuideInfo.name}.

    **Document:**
    \`\`\`latex
    ${paperContent}
    \`\`\`
    `;

    const response = await callModel(model, systemInstruction, userPrompt);
    
    if (!response.text) {
        throw new Error("AI returned an empty response for the reformat step.");
    }

    let paper = response.text.trim().replace(/^```latex\s*|```\s*$/g, '');

    if (!paper.includes('\\end{document}')) {
        paper += '\n\\end{document}';
    }

    return postProcessLatex(paper);
}
