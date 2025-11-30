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

// Simplified Key Retrieval - SINGLE KEY SUPPORT
function getGeminiApiKey(): string {
    const key = localStorage.getItem('gemini_api_key') || (process.env.API_KEY as string);
    if (!key) {
        throw new Error("Gemini API key not found. Please add your key in the settings modal (gear icon).");
    }
    return key;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Wrapper to create client with the CURRENT active key
function getAiClient(): GoogleGenAI {
    const apiKey = getGeminiApiKey();
    return new GoogleGenAI({ apiKey });
}

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

            // If it's the last attempt, propagate error
            if (attempt === MAX_RETRIES) {
                if (errorMessage.includes('503') || errorMessage.includes('overloaded')) {
                    throw new Error("The AI model is temporarily overloaded. Please try again in a few moments.");
                 }
                throw error;
            }

            // Exponential backoff
            const backoffTime = Math.pow(2, attempt) * 1000 + Math.random() * 500;
            console.log(`Waiting for ${backoffTime.toFixed(0)}ms before retrying...`);
            await delay(backoffTime);
        }
    }
    throw new Error("API call failed after internal retries.");
}

// Helper to execute with retry
async function executeWithRetry<T>(
    operation: (client: GoogleGenAI) => Promise<T>
): Promise<T> {
    const client = getAiClient();
    return await withRateLimitHandling(() => operation(client));
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
        return executeWithRetry(async (aiClient) => {
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
        });

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

    // Updated system instruction to be dynamic based on the discipline
    const systemInstruction = `You are an expert academic researcher in the field of ${discipline}. Your task is to generate a single, compelling, and high-impact title for a scientific paper.`;
    
    // Updated user prompt to remove hardcoded "mathematical" bias
    const userPrompt = `Based on the topic "${topic}" within the discipline of ${discipline}, generate a single, novel, and specific title for a high-impact research paper. 
    
    **Requirements:**
    - The title must sound like a genuine, modern academic publication in ${discipline}.
    - It must be concise and impactful.
    - It must be written in **${languageName}**.
    - Your entire response MUST be only the title itself. Do not include quotation marks, labels like "Title:", or any other explanatory text.`;

    const response = await callModel(model, systemInstruction, userPrompt);
    
    if (!response.candidates || response.candidates.length === 0) {
        throw new Error("AI returned no candidates for title. Prompt likely blocked by safety filters.");
    }
    
    // Safety check for empty response
    if (!response.text) {
         throw new Error("AI returned an empty response text for the title generation.");
    }
    
    return response.text.trim().replace(/"/g, ''); // Clean up any accidental quotes
}


// Programmatic post-processing to fix common LaTeX issues
function postProcessLatex(latexCode: string): string {
    // Robustly replace ampersands used for authors in bibliographies
    let code = latexCode.replace(/,?\s+&\s+/g, ' and ');
    
    // CRITICAL: Strip CJK (Chinese, Japanese, Korean) characters
    // The default pdflatex compiler does not support these characters and will crash.
    // We remove them to ensure the paper compiles.
    // Ranges:
    // \u4e00-\u9fff (Common CJK)
    // \u3400-\u4dbf (Extension A)
    // \uf900-\ufaff (Compatibility)
    // \u3040-\u309f (Hiragana)
    // \u30a0-\u30ff (Katakana)
    // \uac00-\ud7af (Hangul)
    code = code.replace(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g, '');

    return code;
}

/**
 * Fetches papers from the Semantic Scholar API based on a query.
 * PROXIED to avoid CORS issues in the browser.
 * @param query The search query string (e.g., paper title).
 * @param limit The maximum number of papers to fetch.
 * @returns A promise that resolves to an array of SemanticScholarPaper objects.
 */
async function fetchSemanticScholarPapers(query: string, limit: number = 5): Promise<SemanticScholarPaper[]> {
    try {
        const fields = 'paperId,title,authors,abstract,url'; // Requesting specific fields
        
        // Use the local proxy instead of direct call
        const response = await fetch(`/semantic-proxy?query=${encodeURIComponent(query)}&limit=${limit}&fields=${fields}`);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Semantic Scholar API error (via Proxy): ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        // Semantic Scholar API returns data.data for the list of papers
        return data.data || [];
    } catch (error) {
        console.error("Error fetching from Semantic Scholar:", error);
        return [];
    }
}


export async function generateInitialPaper(title: string, language: Language, pageCount: number, model: string, authorDetails: PersonalData[]): Promise<{ paper: string, sources: PaperSource[] }> {
    const languageName = LANGUAGES.find(l => l.code === language)?.name || 'English';
    const babelLanguage = BABEL_LANG_MAP[language];

    let referenceCount = 20;
    if (pageCount === 30) referenceCount = 40;
    else if (pageCount === 60) referenceCount = 60;
    else if (pageCount === 100) referenceCount = 100;

    const referencePlaceholders = Array.from(
        { length: referenceCount },
        (_, i) => `[INSERT REFERENCE ${i + 1} HERE]`
    ).join('\n\n');

    // Fetch Semantic Scholar papers
    const semanticScholarPapers = await fetchSemanticScholarPapers(title, 5); // Fetch top 5 relevant papers
    const semanticScholarContext = semanticScholarPapers.length > 0
        ? "\n\n**Additional Academic Sources from Semantic Scholar (prioritize these for high-quality references):**\n" +
          semanticScholarPapers.map(p => 
              `- Title: ${p.title}\n  Authors: ${p.authors.map(a => a.name).join(', ')}\n  Abstract: ${p.abstract || 'N/A'}\n  URL: ${p.url}`
          ).join('\n---\n')
        : "";

    // Generate LaTeX author block for multiple authors
    const latexAuthorsBlock = authorDetails.map((author, index) => {
        const name = author.name || 'Unknown Author';
        const affiliation = author.affiliation ? `\\\\ ${author.affiliation}` : '';
        const orcid = author.orcid ? `\\\\ \\small ORCID: \\url{https://orcid.org/${author.orcid}}` : '';
        return `${name}${affiliation}${orcid}`;
    }).join(' \\and\n'); // Use \and for multiple authors in LaTeX

    const pdfAuthorNames = authorDetails.map(a => a.name).filter(Boolean).join(', ');


    const systemInstruction = `You are a world-class AI assistant specialized in generating high-quality, well-structured scientific papers in LaTeX format. Your task is to write a complete, coherent, and academically rigorous paper based on a provided title, strictly following a given LaTeX template.

**Execution Rules:**
1.  **Use the Provided Template:** You will be given a LaTeX template with placeholders like [INSERT ... HERE]. Your entire output MUST be the complete LaTeX document after filling in these placeholders with new, relevant content.
2.  **Fill All Placeholders:** You must replace all placeholders with content appropriate for the new paper's title.
    -   \`[INSERT NEW TITLE HERE]\`: Replace with the new title.
    -   \`[INSERT NEW COMPLETE ABSTRACT HERE]\`: Write a new abstract for the paper in the \`\\begin{abstract}\` environment. The abstract text itself must not contain any LaTeX commands.
    -   \`[INSERT COMMA-SEPARATED KEYWORDS HERE]\`: Provide new keywords relevant to the title.
    -   \`[INSERT NEW CONTENT FOR ... SECTION HERE]\`: Write substantial, high-quality academic content for each section (Introduction, Literature Review, etc.) to generate a paper of approximately **${pageCount} pages**.
    -   \`[INSERT REFERENCE 1 HERE]\` through \`[INSERT REFERENCE ${referenceCount} HERE]\`: For each of these placeholders, generate a single, unique academic reference relevant to the title. **Use Google Search grounding and the provided "Additional Academic Sources from Semantic Scholar" for this. Prioritize the quality and academic rigor of the Semantic Scholar sources first for references.** Each generated reference must be a plain paragraph, for example, starting with \`\\noindent\` and ending with \`\\par\`. Do NOT use \`\\bibitem\` or \`thebibliography\`.
3.  **Strictly Adhere to Structure:** Do NOT modify the LaTeX structure provided in the template. Do not add or remove packages, or alter the section commands. **CRITICAL: The \\author{} and \\date{} commands and their content are pre-filled by the application and should be preserved verbatim by the LLM. Do NOT change or overwrite them. The author block will be dynamically generated before this prompt is sent to you.** The only exception is adding the correct babel package for the language.
4.  **Language:** The entire paper must be written in **${languageName}**.
5.  **Output Format:** The entire output MUST be a single, valid, and complete LaTeX document. Do not include any explanatory text, markdown formatting, or code fences (like \`\`\`latex\`) around the LaTeX code.
6.  **CRITICAL RULE - AVOID AMPERSAND:** To prevent compilation errors, you **MUST NOT** use the ampersand character ('&').
    -   In the bibliography/reference section, you MUST use the word 'and' to separate author names.
    -   **Example (Incorrect):** "Smith, J. & Doe, J."
    -   **Example (Correct):** "Smith, J. and J. Doe."
7.  **CRITICAL RULE - OTHER CHARACTERS:** You must also properly escape other special LaTeX characters like '%', '$', '#', '_', '{', '}'. For example, an underscore must be written as \`\\_\`.
8.  **CRITICAL RULE - NO URLs:** References must **NOT** contain any URLs or web links. Format them as academic citations only, without any \`\\url{}\` commands.
9.  **CRITICAL RULE - NO CJK CHARACTERS:** Do **NOT** use Chinese, Japanese, or Korean characters (like 霸, ba) in the document. The compiler strictly supports Latin characters only. If a term is inherently Asian, use its Pinyin or Romanized transliteration instead (e.g., use "Ba" instead of the character).
10. **CRITICAL RULE - METADATA:** Do NOT place complex content inside the \`\\hypersetup{...}\` command. Only the title and author should be there.
`;

    // Dynamically insert the babel package and reference placeholders into the template for the prompt
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

    // Replace dynamic author information using new, client-side generated block
    templateWithBabelAndAuthor = templateWithBabelAndAuthor.replace(
        '__ALL_AUTHORS_LATEX_BLOCK__', // This placeholder now represents the entire \author block
        latexAuthorsBlock
    );
    templateWithBabelAndAuthor = templateWithBabelAndAuthor.replace(
        'pdfauthor={__PDF_AUTHOR_NAMES_PLACEHOLDER__}', // Placeholder for pdfauthor in hypersetup
        `pdfauthor={${pdfAuthorNames}}`
    );

    const userPrompt = `Using the following LaTeX template, generate a complete scientific paper with the title: "${title}".
${semanticScholarContext}
**Template:**
\`\`\`latex
${templateWithBabelAndAuthor}
\`\`\`
`;

    const response = await callModel(model, systemInstruction, userPrompt, { googleSearch: true });
    
    // Detailed error reporting for empty responses
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
    
    // Ensure the paper ends with \end{document}
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

// Robust JSON cleaner to handle AI hallucinations
function cleanJsonOutput(text: string): string {
    let cleaned = text.trim();
    // Remove markdown code blocks
    cleaned = cleaned.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '');
    
    // Check for repetition loops like "\nobreak\nobreak"
    if (cleaned.includes("nobreak\nobreak") || cleaned.includes("nobreaknobreak")) {
        throw new Error("Model output contained a repetition loop (nobreak).");
    }
    
    return cleaned.trim();
}

export async function analyzePaper(paperContent: string, pageCount: number, model: string): Promise<AnalysisResult> {
    const analysisTopicsList = ANALYSIS_TOPICS.map(t => `- Topic ${t.num} (${t.name}): ${t.desc}`).join('\n');
    const systemInstruction = `You are an expert academic reviewer AI. Your task is to perform a rigorous, objective, and multi-faceted analysis of a provided scientific paper written in LaTeX.

    **Input:** You will receive the full LaTeX source code of a scientific paper and a list of analysis topics with numeric identifiers.
    
    **Task:**
    1.  Analyze the paper based on the provided quality criteria.
    2.  For each criterion, provide a numeric score from 0.0 to 10.0, where 10.0 is flawless.
    3.  For each criterion, provide a concise, single-sentence improvement suggestion. This suggestion must be a direct critique of the paper's current state and offer a clear path for enhancement. Do NOT write generic praise. Be critical and specific.
    4.  The "PAGE COUNT" topic (Topic 28) must be evaluated based on the user's requested page count of ${pageCount}. A perfect score of 10 is achieved if the paper is exactly ${pageCount} pages long. The score should decrease linearly based on the deviation from this target. For example, if the paper is ${pageCount - 2} or ${pageCount + 2} pages, the score might be around 8.0.

    **Output Format:**
    -   You MUST return your analysis as a single, valid JSON object.
    -   Do NOT include any text, explanations, or markdown formatting (like \`\`\`json) outside of the JSON object.
    -   **Do NOT output LaTeX commands (like \\nobreak, \\newline) inside the JSON values.**
    -   The JSON object must have a single key "analysis" which is an array of objects.
    -   Each object in the array must have three keys:
        1.  "topicNum": The numeric identifier of the topic being analyzed (number).
        2.  "score": The numeric score from 0.0 to 10.0 (number).
        3.  "improvement": The single-sentence improvement suggestion (string).

    **Analysis Topics:**
    ${analysisTopicsList}

    **Example Output:**
    \`\`\`json
    {
      "analysis": [
        {
          "topicNum": 0,
          "score": 8.5,
          "improvement": "The discussion section slightly deviates into an unrelated sub-topic that should be removed to maintain focus."
        },
        {
          "topicNum": 1,
          "score": 7.8,
          "improvement": "Several paragraphs contain run-on sentences that should be split for better readability."
        }
      ]
    }
    \`\`\`
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

    // Retry logic for JSON parsing failures
    const MAX_PARSE_RETRIES = 3;
    
    for (let attempt = 1; attempt <= MAX_PARSE_RETRIES; attempt++) {
        try {
            const response = await callModel(model, systemInstruction, paperContent, {
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
            const result = JSON.parse(jsonText);
            return result as AnalysisResult;

        } catch (error) {
            console.warn(`Attempt ${attempt} to analyze paper failed (JSON Parse/Validation):`, error);
            
            // If it's the last attempt, fail loudly so the automation can handle it (or skip to next)
            if (attempt === MAX_PARSE_RETRIES) {
                throw new Error(`The analysis returned an invalid format after ${MAX_PARSE_RETRIES} attempts. Last error: ${error instanceof Error ? error.message : String(error)}`);
            }
            
            // Short delay before retry to let potential hiccups settle
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
            // FIX: Corrected property access from 'item.num' to 'item.topicNum'
            const topic = ANALYSIS_TOPICS.find(t => t.num === item.topicNum);
            const topicName = topic ? topic.name : `UNKNOWN TOPIC (${item.topicNum})`;
            return `- **${topicName} (Score: ${item.score})**: ${item.improvement}`;
        })
        .join('\n');

    const systemInstruction = `You are a world-class AI assistant specialized in editing and improving scientific papers written in LaTeX. Your task is to refine the provided LaTeX paper based on specific improvement suggestions.

    **Instructions for Improvement:**
    -   Critically analyze the provided "Current Paper Content" against the "Improvement Points".
    -   Apply the necessary changes directly to the LaTeX source code to address each improvement point.
    -   Ensure that the scientific content remains accurate and coherent.
    -   Maintain the exact LaTeX preamble, author information, title, and metadata structure as in the original. Do NOT change \\documentclass, \\usepackage, \\hypersetup, \\title, \\author, \\date. **CRITICAL: The author block, including \\author{} and related commands, is pre-filled by the application and should be preserved verbatim by the LLM. Do NOT change or overwrite it.**
    -   The entire output MUST be a single, valid, and complete LaTeX document. Do not include any explanatory text, markdown formatting, or code fences (like \`\`\`latex\`) before \`\\documentclass\` or after \`\\end{document}\`.
    -   The language of the entire paper must remain in **${languageName}**.
    -   **CRITICAL: Absolutely DO NOT use the \`\\begin{thebibliography}\`, \`\\end{thebibliography}\`, or \`\\bibitem\` commands anywhere in the document. The references MUST be formatted as a plain, unnumbered list directly following \`\\section{Referências}\`.**
    -   **CRITICAL RULE - AVOID AMPERSAND:** You **MUST NOT** use the ampersand character ('&'). Use the word 'and' instead, especially for separating author names.
    -   **CRITICAL RULE - NO CJK CHARACTERS:** Do NOT introduce any Chinese, Japanese, or Korean characters. Use transliteration (Pinyin) if needed.
    -   **Do NOT use the \`\\cite{}\` command anywhere in the text.**
    -   **Do NOT add or remove \`\\newpage\` commands. Let the LaTeX engine handle page breaks automatically.**
    -   **Crucially, do NOT include any images, figures, organograms, flowcharts, diagrams, or complex tables in the improved paper.**
    -   **CRITICAL: Ensure that no URLs or web links are present in the references section. All references must be formatted as academic citations only, without any \\url{} commands or direct links.**
    -   Focus on improving aspects directly related to the provided feedback. Do not introduce new content unless necessary to address a critique.
    `;

    const userPrompt = `Current Paper Content:\n\n${paperContent}\n\nImprovement Points:\n\n${improvementPoints}\n\nBased on the above improvement points, provide the complete, improved LaTeX source code for the paper.`;

    const response = await callModel(model, systemInstruction, userPrompt);
    
    if (!response.candidates || response.candidates.length === 0) {
        throw new Error("AI returned no candidates for improvement.");
    }
    
    // Safety check
    if (!response.text) {
        throw new Error("AI returned an empty response for the improvement step.");
    }

    let paper = response.text.trim().replace(/^```latex\s*|```\s*$/g, '');

    // Ensure the paper ends with \end{document}
    if (!paper.includes('\\end{document}')) {
        paper += '\n\\end{document}';
    }

    return postProcessLatex(paper);
}

export async function fixLatexPaper(paperContent: string, compilationError: string, model: string): Promise<string> {
    const systemInstruction = `You are an expert LaTeX editor AI. Your task is to fix a compilation error in a given LaTeX document. You must be extremely precise and surgical in your changes to avoid introducing new errors.

    **CRITICAL INSTRUCTIONS:**
    1.  You will receive the full LaTeX source code of a paper and the specific error message from the compiler.
    2.  Your task is to identify the root cause of the error and correct **ONLY** the necessary lines in the LaTeX code to resolve it.
    3.  **DO NOT** rewrite or refactor large sections of the document. Make the smallest change possible.
    4.  The entire output **MUST** be a single, valid, and complete LaTeX document. Do not include any explanatory text, markdown formatting, or code fences (like \`\`\`latex\`) before \`\\documentclass\` or after \`\\end{document}\`.
    5.  **HIGHEST PRIORITY:** If the error message is "Misplaced alignment tab character &", the problem is an unescaped ampersand ('&'). Your primary action MUST be to find every instance of '&' and replace it with the word 'and', especially in the reference list. Example Fix: Change "Bondal, A., & Orlov, D." to "Bondal, A. and Orlov, D.". This is the most common and critical error to fix.
    6.  **UNICODE ERROR PRIORITY:** If the error mentions "Unicode character" (e.g., Chinese, Japanese characters like 霸), you **MUST REMOVE** that character or replace it with its Pinyin/English equivalent. The compiler does not support CJK characters.
    7.  Generally maintain the preamble, BUT if the compilation error is directly related to the preamble (especially the \\hypersetup command or metadata), you MUST fix it by removing or simplifying the problematic fields. **CRITICAL: The author block, including \\author{} and related commands, is pre-filled by the application and should be preserved verbatim by the LLM. Do NOT change or overwrite it.**
    8.  **DO NOT** use commands like \`\\begin{thebibliography}\`, \`\\bibitem\`, or \`\\cite{}\`.
    9.  **DO NOT** add or remove \`\\newpage\` commands.
    10. **DO NOT** include any images, figures, or complex tables.
    11. **CRITICAL:** Ensure that no URLs are present in the references section.
    12. Return only the corrected LaTeX source code.
    `;

    const userPrompt = `The following LaTeX document failed to compile. Analyze the error message and the code, then provide the complete, corrected LaTeX source code.

**Compilation Error Message:**
\`\`\`
${compilationError}
\`\`\`

**Full LaTeX Document with Error:**
\`\`\`latex
${paperContent}
\`\`\`
`;

    const response = await callModel(model, systemInstruction, userPrompt);
    
    // Safety check
    if (!response.text) {
        throw new Error("AI returned an empty response for the fix step.");
    }
    
    let paper = response.text.trim().replace(/^```latex\s*|```\s*$/g, '');
    
    // Ensure the paper ends with \end{document}
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

    const systemInstruction = `You are an expert academic editor specializing in citation and reference formatting. Your task is to reformat the bibliography of a scientific paper according to a specific style guide.

    **CRITICAL INSTRUCTIONS:**
    1.  You will receive the full LaTeX source code of a paper.
    2.  Your task is to reformat **ONLY** the content within the \`\\section{Referências}\` or \`\\section{References}\` section.
    3.  You **MUST NOT** change any other part of the document. The preamble, abstract, body text, conclusion, etc., must remain absolutely identical to the original. **CRITICAL: The author block, including \\author{} and related commands, is pre-filled by the application and should be preserved verbatim by the LLM. Do NOT change or overwrite it.**
    4.  The new reference list must strictly adhere to the **${styleGuideInfo.name} (${styleGuideInfo.description})** formatting rules.
    5.  **CRITICAL RULE - AVOID AMPERSAND:** You **MUST NOT** use the ampersand character ('&'). Use the word 'and' to separate author names.
    6.  The number of references in the output must be the same as in the input.
    7.  The final output must be the **COMPLETE, FULL** LaTeX document, with only the reference section's content modified. Do not provide only the reference section or include any explanatory text or markdown formatting.
    8.  **CRITICAL: Ensure that no URLs or web links are present in the reformatted references. All references must be formatted as academic citations only, without any \\url{} commands or direct links.**
    `;

    const userPrompt = `Please reformat the references in the following LaTeX document to conform to the ${styleGuideInfo.name} style guide. Return the full, unchanged document with only the reference list updated.

    **LaTeX Document:**
    \`\`\`latex
    ${paperContent}
    \`\`\`
    `;

    const response = await callModel(model, systemInstruction, userPrompt);
    
    // Safety check
    if (!response.text) {
        throw new Error("AI returned an empty response for the reformat step.");
    }

    let paper = response.text.trim().replace(/^```latex\s*|```\s*$/g, '');

    // Ensure the paper ends with \end{document}
    if (!paper.includes('\\end{document}')) {
        paper += '\n\\end{document}';
    }

    return postProcessLatex(paper);
}