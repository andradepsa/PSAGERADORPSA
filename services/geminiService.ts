import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import type { Language, AnalysisResult, PaperSource, StyleGuide, SemanticScholarPaper } from '../types';
import { ANALYSIS_TOPICS, LANGUAGES, FIX_OPTIONS, STYLE_GUIDES, SEMANTIC_SCHOLAR_API_BASE_URL } from '../constants';
import { ARTICLE_TEMPLATE } from './articleTemplate'; // Import the single article template

const BABEL_LANG_MAP: Record<Language, string> = {
    en: 'english',
    pt: 'brazilian',
    es: 'spanish',
    fr: 'french',
};

const MAX_RETRIES = 5;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Creates a new Gemini client instance, reading the API key from localStorage
// with a fallback to process.env for environments where it's set.
function getAiClient(): GoogleGenAI {
    const apiKey = localStorage.getItem('gemini_api_key') || (process.env.API_KEY as string);
    if (!apiKey) {
        throw new Error("Gemini API key not found. Please set it in the settings modal (gear icon).");
    }
    return new GoogleGenAI({ apiKey });
}

async function withRateLimitHandling<T>(apiCall: () => Promise<T>): Promise<T> {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            return await apiCall(); // Success!
        } catch (error) {
            console.warn(`API call failed on attempt ${attempt}.`, error);
            const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
            
            // Check for hard failure (Quota limit: 0)
            // This specifically handles the case where the user tries to use a model (like gemini-3)
            // that isn't enabled or has 0 quota on their plan.
            if (errorMessage.includes('limit: 0') || errorMessage.includes('quota exceeded for metric')) {
                 throw new Error("API Quota Exceeded (Limit: 0). This model appears to be unavailable for your API key/Tier. Please select a different model (e.g., Gemini 2.5 Pro) in the settings.");
            }

            if (attempt === MAX_RETRIES) {
                 if (errorMessage.includes('429') || errorMessage.includes('quota')) {
                    throw new Error("You exceeded your current quota. Please wait a minute before trying again. For higher limits, check your plan and billing details.");
                 }
                 if (errorMessage.includes('503') || errorMessage.includes('overloaded')) {
                    throw new Error("The AI model is temporarily overloaded. Please try again in a few moments.");
                 }
                throw new Error("Failed to call the API after multiple attempts. Please check your connection and try again later.");
            }

            let backoffTime;
            
            if (errorMessage.includes('429') || errorMessage.includes('quota')) {
                console.log("Rate limit exceeded. Waiting for 61 seconds before retrying...");
                backoffTime = 61000 + Math.random() * 1000;
            } else {
                console.log("Transient error detected. Using exponential backoff...");
                backoffTime = Math.pow(2, attempt) * 1000 + Math.random() * 250;
            }
            
            console.log(`Waiting for ${backoffTime.toFixed(0)}ms before retrying...`);
            await delay(backoffTime);
        }
    }
    // This should be unreachable
    throw new Error("API call failed after all retry attempts.");
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
    if (model.startsWith('gemini-')) {
        const ai = getAiClient();
        const apiCall = () => ai.models.generateContent({
            model: model,
            contents: userPrompt,
            config: {
                systemInstruction: systemInstruction,
                ...(config.jsonOutput && { responseMimeType: "application/json" }),
                ...(config.responseSchema && { responseSchema: config.responseSchema }),
                ...(config.googleSearch && { tools: [{ googleSearch: {} }] }),
            },
        });
        return withRateLimitHandling(apiCall);
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
            
            // Reconstruct a Gemini-like response object for compatibility
            const reconstructedResponse = {
                candidates: [{
                    content: { parts: [{ text: text }], role: 'model' },
                    finishReason: 'STOP',
                    index: 0,
                    safetyRatings: [],
                    groundingMetadata: { groundingChunks: [] } // Grok does not support grounding
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


export async function generatePaperTitle(topic: string, language: Language, model: string): Promise<string> {
    const languageName = LANGUAGES.find(l => l.code === language)?.name || 'English';

    const systemInstruction = `You are an expert mathematician and academic researcher. Your task is to generate a single, compelling, and high-impact title for a scientific paper.`;
    
    const userPrompt = `Based on the broad mathematical topic of "${topic}", generate a single, novel, and specific title for a high-impact research paper. 
    
    **Requirements:**
    - The title must sound like a genuine, modern academic publication.
    - It must be concise and impactful.
    - It must be written in **${languageName}**.
    - Your entire response MUST be only the title itself. Do not include quotation marks, labels like "Title:", or any other explanatory text.`;

    const response = await callModel(model, systemInstruction, userPrompt);
    return response.text.trim().replace(/"/g, ''); // Clean up any accidental quotes
}


// Programmatic post-processing to fix common LaTeX issues
function postProcessLatex(latexCode: string): string {
    // Robustly replace ampersands used for authors in bibliographies
    // This looks for "Name, A. & Name, B." and similar patterns.
    // It's safer than a global replace to avoid affecting tables or math environments.
    return latexCode.replace(/,?\s+&\s+/g, ' and ');
}

/**
 * Fetches papers from the Semantic Scholar API based on a query.
 * @param query The search query string (e.g., paper title).
 * @param limit The maximum number of papers to fetch.
 * @returns A promise that resolves to an array of SemanticScholarPaper objects.
 */
async function fetchSemanticScholarPapers(query: string, limit: number = 5): Promise<SemanticScholarPaper[]> {
    try {
        const fields = 'paperId,title,authors,abstract,url'; // Requesting specific fields
        const response = await fetch(`${SEMANTIC_SCHOLAR_API_BASE_URL}?query=${encodeURIComponent(query)}&limit=${limit}&fields=${fields}`);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Semantic Scholar API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        // Semantic Scholar API returns data.data for the list of papers
        return data.data || [];
    } catch (error) {
        console.error("Error fetching from Semantic Scholar:", error);
        return [];
    }
}


export async function generateInitialPaper(title: string, language: Language, pageCount: number, model: string, authorDetails: { name: string; affiliation: string; orcid: string }): Promise<{ paper: string, sources: PaperSource[] }> {
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

    const systemInstruction = `You are a world-class AI assistant specialized in generating high-quality, well-structured scientific papers in LaTeX format. Your task is to write a complete, coherent, and academically rigorous paper based on a provided title, strictly following a given LaTeX template.

**Execution Rules:**
1.  **Use the Provided Template:** You will be given a LaTeX template with placeholders like [INSERT ... HERE]. Your entire output MUST be the complete LaTeX document after filling in these placeholders with new, relevant content.
2.  **Fill All Placeholders:** You must replace all placeholders with content appropriate for the new paper's title.
    -   \`[INSERT NEW TITLE HERE]\`: Replace with the new title.
    -   \`[INSERT NEW COMPLETE ABSTRACT HERE]\`: Write a new abstract for the paper in the \`\\begin{abstract}\` environment. The abstract text itself must not contain any LaTeX commands.
    -   \`[INSERT COMMA-SEPARATED KEYWORDS HERE]\`: Provide new keywords relevant to the title.
    -   \`[INSERT NEW CONTENT FOR ... SECTION HERE]\`: Write substantial, high-quality academic content for each section (Introduction, Literature Review, etc.) to generate a paper of approximately **${pageCount} pages**.
    -   \`[INSERT REFERENCE 1 HERE]\` through \`[INSERT REFERENCE ${referenceCount} HERE]\`: For each of these placeholders, generate a single, unique academic reference relevant to the title. **Use Google Search grounding and the provided "Additional Academic Sources from Semantic Scholar" for this. Prioritize the quality and academic rigor of the Semantic Scholar sources first for references.** Each generated reference must be a plain paragraph, for example, starting with \`\\noindent\` and ending with \`\\par\`. Do NOT use \`\\bibitem\` or \`thebibliography\`.
3.  **Strictly Adhere to Structure:** Do NOT modify the LaTeX structure provided in the template. Do not add or remove packages, or alter the section commands. **CRITICAL: The \\author{} and \\date{} commands in the template, which already contain the author information, MUST NOT be changed or overwritten. Use them exactly as provided.** The only exception is adding the correct babel package for the language.
4.  **Language:** The entire paper must be written in **${languageName}**.
5.  **Output Format:** The entire output MUST be a single, valid, and complete LaTeX document. Do not include any explanatory text, markdown formatting, or code fences (like \`\`\`latex\`) around the LaTeX code.
6.  **CRITICAL RULE - AVOID AMPERSAND:** To prevent compilation errors, you **MUST NOT** use the ampersand character ('&').
    -   In the bibliography/reference section, you MUST use the word 'and' to separate author names.
    -   **Example (Incorrect):** "Smith, J. & Doe, J."
    -   **Example (Correct):** "Smith, J. and J. Doe."
7.  **CRITICAL RULE - OTHER CHARACTERS:** You must also properly escape other special LaTeX characters like '%', '$', '#', '_', '{', '}'. For example, an underscore must be written as \`\\_\`.
8.  **CRITICAL RULE - NO URLs:** References must **NOT** contain any URLs or web links. Format them as academic citations only, without any \`\\url{}\` commands.
9.  **CRITICAL RULE - METADATA:** Do NOT place complex content inside the \`\\hypersetup{...}\` command. Only the title and author should be there.
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

    // Replace dynamic author information
    templateWithBabelAndAuthor = templateWithBabelAndAuthor.replace(
        '[INSERT AUTHOR NAME]',
        authorDetails.name
    );
    templateWithBabelAndAuthor = templateWithBabelAndAuthor.replace(
        '[INSERT ORCID COMMAND]',
        authorDetails.orcid ? `\\small ORCID: \\url{https://orcid.org/${authorDetails.orcid}}` : ''
    );
    templateWithBabelAndAuthor = templateWithBabelAndAuthor.replace(
        'pdfauthor={[INSERT AUTHOR NAME]}',
        `pdfauthor={${authorDetails.name}}`
    );


    const userPrompt = `Using the following LaTeX template, generate a complete scientific paper with the title: "${title}".
${semanticScholarContext}
**Template:**
\`\`\`latex
${templateWithBabelAndAuthor}
\`\`\`
`;

    const response = await callModel(model, systemInstruction, userPrompt, { googleSearch: true });
    
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

    const response = await callModel(model, systemInstruction, paperContent, {
        jsonOutput: true,
        responseSchema: responseSchema
    });
    
    try {
        const jsonText = response.text.trim().replace(/^```json\s*|```\s*$/g, '');
        const result = JSON.parse(jsonText);
        return result as AnalysisResult;
    } catch (error) {
        console.error("Failed to parse analysis JSON:", response.text);
        throw new Error("The analysis returned an invalid format. Please try again.");
    }
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
    -   Maintain the exact LaTeX preamble, author information, title, and metadata structure as in the original. Do NOT change \\documentclass, \\usepackage, \\hypersetup, \\title, \\author, \\date, \\maketitle.
    -   The entire output MUST be a single, valid, and complete LaTeX document. Do not include any explanatory text, markdown formatting, or code fences (like \`\`\`latex\`) before \`\\documentclass\` or after \`\\end{document}\`.
    -   The language of the entire paper must remain in **${languageName}**.
    -   **CRITICAL: Absolutely DO NOT use the \`\\begin{thebibliography}\`, \`\\end{thebibliography}\`, or \`\\bibitem\` commands anywhere in the document. The references MUST be formatted as a plain, unnumbered list directly following \`\\section{Referências}\`.**
    -   **CRITICAL RULE - AVOID AMPERSAND:** You **MUST NOT** use the ampersand character ('&'). Use the word 'and' instead, especially for separating author names.
    -   **Do NOT use the \`\\cite{}\` command anywhere in the text.**
    -   **Do NOT add or remove \`\\newpage\` commands. Let the LaTeX engine handle page breaks automatically.**
    -   **Crucially, do NOT include any images, figures, organograms, flowcharts, diagrams, or complex tables in the improved paper.**
    -   **CRITICAL: Ensure that no URLs or web links are present in the references section. All references must be formatted as academic citations only, without any \\url{} commands or direct links.**
    -   Focus on improving aspects directly related to the provided feedback. Do not introduce new content unless necessary to address a critique.
    `;

    const userPrompt = `Current Paper Content:\n\n${paperContent}\n\nImprovement Points:\n\n${improvementPoints}\n\nBased on the above improvement points, provide the complete, improved LaTeX source code for the paper.`;

    const response = await callModel(model, systemInstruction, userPrompt);
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
    6.  Generally maintain the preamble, BUT if the compilation error is directly related to the preamble (especially the \\hypersetup command or metadata), you MUST fix it by removing or simplifying the problematic fields.
    7.  **DO NOT** use commands like \`\\begin{thebibliography}\`, \`\\bibitem\`, or \`\\cite{}\`.
    8.  **DO NOT** add or remove \`\\newpage\` commands.
    9.  **DO NOT** include any images, figures, or complex tables.
    10. **CRITICAL:** Ensure that no URLs are present in the references section.
    11. Return only the corrected LaTeX source code.
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
    3.  You **MUST NOT** change any other part of the document. The preamble, abstract, body text, conclusion, etc., must remain absolutely identical to the original.
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
    let paper = response.text.trim().replace(/^```latex\s*|```\s*$/g, '');

    // Ensure the paper ends with \end{document}
    if (!paper.includes('\\end{document}')) {
        paper += '\n\\end{document}';
    }

    return postProcessLatex(paper);
}