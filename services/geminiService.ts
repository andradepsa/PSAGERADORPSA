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
            // Ensure index is within bounds if keys were removed externally via settings
            if (this.currentIndex >= this.keys.length) {
                this.currentIndex = 0;
            }
        }
    },

    getCurrentKey: function(): string {
        // We load keys to ensure we have the latest list
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

// Wrapper to create client with the CURRENT active key
function getAiClient(): GoogleGenAI {
    const apiKey = KeyManager.getCurrentKey();
    return new GoogleGenAI({ apiKey });
}

// Helper to identify errors that should trigger a key rotation (Quota, Rate Limit, Suspension)
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
        errorMessage.includes('consumer') // often appears in suspension messages
    );
}

// Executes an AI model call with automatic key rotation on Quota/429 errors
async function executeWithKeyRotation<T>(
    operation: (client: GoogleGenAI) => Promise<T>, 
    modelName: string
): Promise<T> {
    
    KeyManager.loadKeys(); 

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            const client = getAiClient();
            return await withRateLimitHandling(() => operation(client));
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
            
            // Check if error is related to quota or exhaustion
            const shouldRotate = isRotationTrigger(error);

            // If it's a quota/auth error and we have more keys, rotate and continue loop
            if (shouldRotate && KeyManager.keys.length > 1) {
                console.warn(`⚠️ API Key (Index ${KeyManager.currentIndex}) exhausted or suspended. Attempting to rotate... Error: ${errorMessage}`);
                KeyManager.rotate();
                
                console.log("Waiting 10 seconds before trying next key to clear IP rate limits...");
                await delay(10000); 
                
                continue; 
            }

            if (attempt === attempt - 1) { // Typo fix logic in original code was 'maxAttempts - 1'
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

const maxAttempts = KeyManager.keys.length > 0 ? KeyManager.keys.length : 1;

async function withRateLimitHandling<T>(apiCall: () => Promise<T>): Promise<T> {
    const MAX_RETRIES = 5; 
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            return await apiCall(); // Success!
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
            
            // Hard failure for model non-existence or strict 0 quota
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

// Central dispatcher for different AI models
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
    console.log(`[Gemini Service] Calling model: ${model}`); // LOG FOR VERIFICATION

    if (model.startsWith('gemini-')) {
        // Wrap the generation logic in the rotation handler
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


export async function generatePaperTitle(topic: string, language: Language, model: string, discipline: string): Promise<string> {
    const languageName = LANGUAGES.find(l => l.code === language)?.name || 'English';
    const systemInstruction = `You are an expert academic researcher in the field of ${discipline}. Generate a single, compelling, and high-impact title for a scientific paper.`;
    const userPrompt = `Based on the topic "${topic}" within the discipline of ${discipline}, generate a single, novel, and specific title for a high-impact research paper. 
    
    **Requirements:**
    - Concise and impactful.
    - Written in **${languageName}**.
    - Your entire response MUST be only the title itself. No quotes.`;

    const response = await callModel(model, systemInstruction, userPrompt);
    
    if (!response.candidates || response.candidates.length === 0) {
        throw new Error("AI returned no candidates for title.");
    }
    
    if (!response.text) {
         throw new Error("AI returned an empty response text for the title generation.");
    }
    
    return response.text.trim().replace(/"/g, ''); 
}

// Programmatic post-processing to fix common LaTeX issues and cleanup formatting
function postProcessLatex(latexCode: string): string {
    let code = latexCode;
    // 1. Convert '&' to 'and' in text (simple heuristic, can be improved)
    code = code.replace(/,?\s+&\s+/g, ' and ');
    
    // 2. Strip CJK characters (costly tokens and usually unwanted in western papers)
    code = code.replace(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g, '');
    
    return code;
}

// Helper function to robustly extract code blocks, ignoring conversational filler
function extractLatexFromResponse(text: string): string {
    // Attempt to find content within ```latex ... ``` blocks
    const latexBlockRegex = /```(?:latex)?\s*([\s\S]*?)```/i;
    const match = text.match(latexBlockRegex);
    
    if (match && match[1]) {
        return match[1].trim();
    }
    
    // Fallback: If no blocks, but text looks like LaTeX, return trimmed text
    // We check for common LaTeX commands to decide
    if (text.includes('\\documentclass') || text.includes('\\section') || text.includes('\\begin{')) {
        // Just strip potential stray fences at start/end
        return text.trim().replace(/^```latex\s*/i, '').replace(/```$/, '');
    }
    
    return text.trim();
}

/**
 * Fetches papers from the Semantic Scholar API based on a query.
 */
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

// Helper to remove comments from LaTeX strings to save tokens
function stripLatexComments(latex: string): string {
    // 1. Remove comments starting with % (but not \%)
    // This regex looks for % that isn't preceded by \
    let cleaned = latex.replace(/(?<!\\)%.*/g, '');
    
    // 2. Collapse multiple blank lines into two
    cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    return cleaned.trim();
}

export async function generateInitialPaper(title: string, language: Language, pageCount: number, model: string, authorDetails: PersonalData[]): Promise<{ paper: string, sources: PaperSource[] }> {
    const languageName = LANGUAGES.find(l => l.code === language)?.name || 'English';
    const babelLanguage = BABEL_LANG_MAP[language];
    const referenceCount = 20;

    const referencePlaceholders = Array.from(
        { length: referenceCount },
        (_, i) => `[INSERT REFERENCE ${i + 1} HERE]`
    ).join('\n\n');

    // Optimization: Fetch fewer papers and truncate abstracts
    const semanticScholarPapers = await fetchSemanticScholarPapers(title, 3); 
    const semanticScholarContext = semanticScholarPapers.length > 0
        ? "\n\n**Sources:**\n" +
          semanticScholarPapers.map(p => {
              const abstractLimit = 200;
              const abstractContent = p.abstract 
                  ? (p.abstract.length > abstractLimit ? p.abstract.substring(0, abstractLimit) + "..." : p.abstract)
                  : 'N/A';
              return `- Title: ${p.title}\n  Authors: ${p.authors.map(a => a.name).join(', ')}\n  Abstract: ${abstractContent}\n  URL: ${p.url}`;
          }).join('\n---\n')
        : "";

    const latexAuthorsBlock = authorDetails.map((author) => {
        const name = author.name || 'Unknown Author';
        const affiliation = author.affiliation ? `\\\\ ${author.affiliation}` : '';
        const orcid = author.orcid ? `\\\\ \\small ORCID: \\url{https://orcid.org/${author.orcid}}` : '';
        return `${name}${affiliation}${orcid}`;
    }).join(' \\and\n');

    const pdfAuthorNames = authorDetails.map(a => a.name).filter(Boolean).join(', ');

    // TOKEN OPTIMIZATION: Clean the template of comments before interpolating
    // This saves tokens sent to the prompt.
    const cleanTemplate = stripLatexComments(ARTICLE_TEMPLATE);

    const systemInstruction = `You are an AI specialized in generating scientific papers in LaTeX. Write a coherent, academically rigorous paper based on the title, following the template strictly.

**Rules:**
1.  **Use Provided Template:** Fill ALL placeholders to reach ~${pageCount} pages.
2.  **Strict Structure:** Do NOT modify \\author, \\date or preamble.
3.  **Language:** ${languageName}.
4.  **Format:** Output only valid LaTeX.
5.  **References:** Academic citations only.
`;

    let templateWithBabelAndAuthor = cleanTemplate.replace(
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

    const userPrompt = `Generate a scientific paper with title: "${title}".
${semanticScholarContext}
**Template:**
\`\`\`latex
${templateWithBabelAndAuthor}
\`\`\`
`;

    const response = await callModel(model, systemInstruction, userPrompt, { googleSearch: true });
    
    if (!response.candidates || response.candidates.length === 0) {
        throw new Error("AI returned no candidates for generation.");
    }
    
    if (!response.text) {
        throw new Error("AI returned an empty text response.");
    }

    let paper = extractLatexFromResponse(response.text);
    
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
        throw new Error("Model output contained a repetition loop.");
    }
    return cleaned.trim();
}

/**
 * STRATEGY: Optimized Analysis Input
 * Removes preamble AND bibliography from analysis to save massive amounts of input tokens.
 * The analysis mostly cares about the body text structure, clarity, and argumentation.
 */
function extractBodyForAnalysis(latex: string): string {
    // Optimization: Remove comments first to clean up the string
    const cleanLatex = stripLatexComments(latex);

    const beginDocIndex = cleanLatex.indexOf('\\begin{document}');
    // If structure is broken, try to use the raw clean latex, otherwise return as is
    if (beginDocIndex === -1) return cleanLatex; 

    const bodyStart = beginDocIndex + '\\begin{document}'.length;
    let body = cleanLatex.substring(bodyStart);

    // Optimization: Strip Bibliography to save tokens.
    // Detect start of references section
    const refSectionMatches = [
        '\\section{References}', 
        '\\section{Referências}', 
        '\\begin{thebibliography}'
    ];
    
    let endContentIndex = -1;
    for (const marker of refSectionMatches) {
        const idx = body.indexOf(marker);
        if (idx !== -1) {
            // Found references start, cut here
            endContentIndex = idx;
            break;
        }
    }

    if (endContentIndex === -1) {
        // If no ref section found (unlikely), cut at end document
        endContentIndex = body.lastIndexOf('\\end{document}');
    }

    if (endContentIndex !== -1) {
        body = body.substring(0, endContentIndex);
    }
    
    // Aggressive optimization: Remove \newpage, \vspace, \hspace to save more tokens
    // These visual formatting commands are irrelevant for content analysis.
    body = body.replace(/\\newpage/g, '').replace(/\\vspace\{[^}]+\}/g, '').replace(/\\hspace\{[^}]+\}/g, '');

    return body.trim();
}

export async function analyzePaper(paperContent: string, pageCount: number, model: string,): Promise<AnalysisResult> {
    // OPTIMIZATION: Send only the body (no preamble, no refs, no comments)
    const contentToAnalyze = extractBodyForAnalysis(paperContent);

    // Shortened system instruction to save tokens
    const analysisTopicsList = ANALYSIS_TOPICS.map(t => `${t.num}:${t.name}`).join(',');
    const systemInstruction = `You are an academic reviewer. Analyze the paper body.
    
    **Topics:** ${analysisTopicsList}
    
    **Task:**
    1. Score each topic (0.0-10.0).
    2. Suggest improvement for each.
    3. Topic 28 (Page Count): Estimate based on text length.

    **Output:** JSON only. Array "a" with objects: "t"(topicNum), "s"(score), "i"(improvement).
    `;
    
    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            a: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        t: { type: Type.NUMBER },
                        s: { type: Type.NUMBER },
                        i: { type: Type.STRING },
                    },
                    required: ["t", "s", "i"],
                },
            },
        },
        required: ["a"],
    };

    const MAX_PARSE_RETRIES = 3;
    
    for (let attempt = 1; attempt <= MAX_PARSE_RETRIES; attempt++) {
        try {
            const response = await callModel(model, systemInstruction, contentToAnalyze, {
                jsonOutput: true,
                responseSchema: responseSchema
            });

            if (!response.candidates || response.candidates.length === 0) throw new Error("No candidates.");
            if (!response.text) throw new Error("Empty response.");

            const jsonText = cleanJsonOutput(response.text);
            const result = JSON.parse(jsonText);
            
            return {
                analysis: result.a.map((item: any) => ({
                    topicNum: item.t,
                    score: item.s,
                    improvement: item.i
                }))
            };

        } catch (error) {
            console.warn(`Attempt ${attempt} to analyze paper failed:`, error);
            if (attempt === MAX_PARSE_RETRIES) throw error;
            await delay(2000);
        }
    }
    
    throw new Error("Unexpected error in analysis loop.");
}

// Helper to split LaTeX into sections for modular improvement
interface ParsedSection {
    title: string; 
    content: string; 
    fullMatch: string; 
}

function parseLatexSections(latex: string): ParsedSection[] {
    const sections: ParsedSection[] = [];
    
    // 1. Extract Abstract
    const abstractMatch = latex.match(/(\\begin\{abstract\})([\s\S]*?)(\\end\{abstract\})/);
    if (abstractMatch) {
        sections.push({
            title: 'Abstract',
            content: abstractMatch[2],
            fullMatch: abstractMatch[0]
        });
    }

    // 2. Extract Sections (\section{...})
    // Improved Regex to avoid matching \section* inside comments or weird formatting
    const sectionRegex = /\\section\{([^}]+)\}/g;
    let match;
    const indices = [];
    while ((match = sectionRegex.exec(latex)) !== null) {
        indices.push({ index: match.index, title: match[1], fullCmd: match[0] });
    }

    for (let i = 0; i < indices.length; i++) {
        const current = indices[i];
        const next = indices[i + 1];
        
        const startContent = current.index + current.fullCmd.length;
        let endContent = next ? next.index : latex.lastIndexOf('\\end{document}');
        if (endContent === -1) endContent = latex.length;

        const content = latex.substring(startContent, endContent);
        
        sections.push({
            title: current.title,
            content: content,
            fullMatch: current.fullCmd + content
        });
    }

    return sections;
}

// Expanded mapping to ensure we can modularly improve almost everything,
// reducing the chance of fallback to 'improvePaperFull'.
const TOPIC_TO_SECTION_KEYWORDS: Record<number, string[]> = {
    8: ['Abstract'],
    9: ['Introduction', 'Introdução'],
    17: ['Introduction', 'Introdução', 'Title'], // Title-Content Alignment
    15: ['Introduction', 'Scope', 'Escopo'], // Scope and Boundaries
    
    4: ['Literature', 'Review', 'Revisão', 'Related Work'],
    25: ['Literature', 'Review', 'Revisão', 'Introduction'], // Theoretical Foundation
    
    5: ['Method', 'Metodologia', 'Materials'],
    2: ['Method', 'Metodologia', 'Materials'], // Methodological Rigor
    
    6: ['Result', 'Resultados'],
    26: ['Result', 'Resultados', 'Discussion'], // Scientific Content Accuracy
    
    7: ['Discussion', 'Discussão'],
    11: ['Discussion', 'Discussão', 'Argumentation'], // Argumentation Strength
    27: ['Discussion', 'Discussão'], // Depth of Critical Analysis
    
    10: ['Conclusion', 'Conclusão'],
    20: ['Conclusion', 'Conclusão', 'Discussion'], // Practical Implications
    18: ['Conclusion', 'Limitation', 'Limitações'], // Limitations
    
    14: ['References', 'Referências']
};

export async function improvePaper(paperContent: string, analysis: AnalysisResult, language: Language, model: string): Promise<string> {
    const lowScoreItems = analysis.analysis.filter(item => item.score < 8.5);

    if (lowScoreItems.length === 0) return paperContent;

    // STRATEGY: Modular Improvement
    const sections = parseLatexSections(paperContent);
    let newPaperContent = paperContent;
    let hasAppliedModularFix = false;

    const sectionsToImprove = new Set<string>(); 
    const globalImprovementPoints: string[] = [];

    lowScoreItems.forEach(item => {
        const keywords = TOPIC_TO_SECTION_KEYWORDS[item.topicNum];
        let mapped = false;
        
        if (keywords) {
            // Find section that matches keyword
            const matchingSection = sections.find(s => keywords.some(k => s.title.toLowerCase().includes(k.toLowerCase())));
            if (matchingSection) {
                sectionsToImprove.add(matchingSection.title);
                mapped = true;
            }
        }
        
        if (!mapped) {
            const topicName = ANALYSIS_TOPICS.find(t => t.num === item.topicNum)?.name || 'Unknown';
            globalImprovementPoints.push(`- ${topicName}: ${item.improvement}`);
        }
    });

    if (sectionsToImprove.size > 0) {
        console.log(`[Modular Improvement] Improving sections: ${Array.from(sectionsToImprove).join(', ')}`);
        
        for (const section of sections) {
            if (sectionsToImprove.has(section.title)) {
                const relevantPoints = lowScoreItems.filter(item => {
                    const keywords = TOPIC_TO_SECTION_KEYWORDS[item.topicNum];
                    // Include if section matches keywords OR if it's a global point being applied to this section for context
                    return keywords && keywords.some(k => section.title.toLowerCase().includes(k.toLowerCase()));
                }).map(item => `- ${item.improvement}`);

                // If this section has specific improvements, apply them. 
                // We also pass global points as context, but emphasize specific points.
                const instructions = [...relevantPoints].join('\n');
                
                // If there are no specific instructions for this section, skip (unless we want to apply global fixes everywhere)
                if (!instructions && globalImprovementPoints.length === 0) continue; 

                const sectionPrompt = `Rewrite the LaTeX section ("${section.title}") to improve it based on:
${instructions}
${globalImprovementPoints.length > 0 ? '\nGeneral Improvements to keep in mind:\n' + globalImprovementPoints.join('\n') : ''}

Return ONLY the rewritten LaTeX code for this section. Do NOT wrap in markdown blocks.`;
                
                try {
                    const response = await callModel(model, "You are a specialized LaTeX editor.", `${sectionPrompt}\n\nCurrent Section Code:\n${section.fullMatch}`);
                    if (response.text) {
                        let improvedSection = extractLatexFromResponse(response.text);
                        improvedSection = postProcessLatex(improvedSection);
                        // Safe replacement: Ensure we replace the exact original string
                        newPaperContent = newPaperContent.replace(section.fullMatch, improvedSection);
                        hasAppliedModularFix = true;
                    }
                } catch (err) {
                    console.error(`Failed to improve section ${section.title}`, err);
                }
            }
        }
    }

    // Only fallback to full rewrite if we had LOW scores but couldn't apply ANY modular fix.
    // This dramatically reduces the chance of expensive full-text generation.
    if (!hasAppliedModularFix && lowScoreItems.length > 0) {
        console.log("[Modular Improvement] No sections mapped or parsing failed. Falling back to Full Rewrite.");
        return improvePaperFull(paperContent, analysis, language, model);
    }

    return newPaperContent;
}

// Fallback full rewrite
async function improvePaperFull(paperContent: string, analysis: AnalysisResult, language: Language, model: string): Promise<string> {
    const languageName = LANGUAGES.find(l => l.code === language)?.name || 'English';
    const improvementPoints = analysis.analysis
        .filter(item => item.score < 8.5)
        .map(item => `- ${item.improvement}`)
        .join('\n');

    const systemInstruction = `You are an AI editor. Refine the LaTeX paper.
    - Follow improvements.
    - Keep preamble/authors same.
    - Language: ${languageName}.
    - No markdown. Valid LaTeX only.`;

    const userPrompt = `Paper:\n${paperContent}\n\nImprove:\n${improvementPoints}\n\nReturn full improved LaTeX.`;

    const response = await callModel(model, systemInstruction, userPrompt);
    
    if (!response.candidates || response.candidates.length === 0) throw new Error("No candidates.");
    if (!response.text) throw new Error("Empty response.");

    let paper = extractLatexFromResponse(response.text);

    if (!paper.includes('\\end{document}')) {
        paper += '\n\\end{document}';
    }

    return postProcessLatex(paper);
}

export async function fixLatexPaper(paperContent: string, compilationError: string, model: string): Promise<string> {
    const systemInstruction = `You are a LaTeX expert. Fix the compilation error.
    1. Identify cause.
    2. Fix only necessary lines.
    3. Return FULL valid LaTeX.`;

    const userPrompt = `Error:\n${compilationError}\n\nCode:\n${paperContent}`;

    const response = await callModel(model, systemInstruction, userPrompt);
    
    if (!response.text) throw new Error("Empty response.");
    
    // Improved extraction that ignores chatty prefixes
    let paper = extractLatexFromResponse(response.text);
    
    if (!paper.includes('\\end{document}')) {
        paper += '\n\\end{document}';
    }

    return postProcessLatex(paper);
}

export async function reformatPaperWithStyleGuide(paperContent: string, styleGuide: StyleGuide, model: string): Promise<string> {
    const styleGuideInfo = STYLE_GUIDES.find(g => g.key === styleGuide);
    if (!styleGuideInfo) throw new Error(`Unknown style guide: ${styleGuide}`);

    const systemInstruction = `Reformat paper bibliography to ${styleGuideInfo.name}. Return full LaTeX.`;
    const userPrompt = `Code:\n${paperContent}`;

    const response = await callModel(model, systemInstruction, userPrompt);
    
    if (!response.text) throw new Error("Empty response.");

    let paper = extractLatexFromResponse(response.text);

    if (!paper.includes('\\end{document}')) {
        paper += '\n\\end{document}';
    }

    return postProcessLatex(paper);
}