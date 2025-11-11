import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import type { Language, AnalysisResult, PaperSource, StyleGuide } from '../types';
import { ANALYSIS_TOPICS, LANGUAGES, FIX_OPTIONS, STYLE_GUIDES } from '../constants';
import { getCompilationExamplesForPrompt } from './compilationExamples';

// Removed the global 'ai' instance. It will now be created on-demand.

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

function formatExamplesForPrompt(examples: { successful: string[], failed: string[] }): string {
    let promptSection = '';

    if (examples.successful.length > 0) {
        promptSection += '\n\n**Compilation Guidance from Past Examples:**\nTo ensure the generated LaTeX is valid and compiles without errors, please learn from the following examples.\n';
        promptSection += '\n***Examples of LaTeX that COMPILED SUCCESSFULLY (DO THIS):***\n';
        examples.successful.forEach((code, index) => {
            promptSection += `--- SUCCESSFUL EXAMPLE ${index + 1} ---\n${code}\n--- END SUCCESSFUL EXAMPLE ${index + 1} ---\n`;
        });
    }

    if (examples.failed.length > 0) {
        if (promptSection === '') { // In case there are no successful examples
            promptSection += '\n\n**Compilation Guidance from Past Examples:**\nTo ensure the generated LaTeX is valid and compiles without errors, please learn from the following examples.\n';
        }
        promptSection += '\n***Examples of LaTeX that FAILED to compile (AVOID THIS):***\n';
        examples.failed.forEach((code, index) => {
            promptSection += `--- FAILED EXAMPLE ${index + 1} ---\n${code}\n--- END FAILED EXAMPLE ${index + 1} ---\n`;
        });
    }

    return promptSection;
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

    const systemInstruction = `You are an expert mathematician and academic researcher with deep knowledge across all fields of mathematics. Your task is to generate a single, compelling, and high-impact title for a scientific paper.`;
    
    const userPrompt = `Based on the broad mathematical topic of "${topic}", generate a single, novel, and specific title for a high-impact research paper. 
    
    **Requirements:**
    - The title must sound like a genuine, modern academic publication.
    - It must be concise and impactful.
    - It must be written in **${languageName}**.
    - Your entire response MUST be only the title itself. Do not include quotation marks, labels like "Title:", or any other explanatory text.`;

    const response = await callModel(model, systemInstruction, userPrompt);
    return response.text.trim().replace(/"/g, ''); // Clean up any accidental quotes
}


export async function generateInitialPaper(title: string, language: Language, pageCount: number, model: string): Promise<{ paper: string, sources: PaperSource[] }> {
    const languageName = LANGUAGES.find(l => l.code === language)?.name || 'English';
    const babelLanguage = BABEL_LANG_MAP[language];

    let referenceCount = 20;
    if (pageCount === 30) referenceCount = 40;
    else if (pageCount === 60) referenceCount = 60;
    else if (pageCount === 100) referenceCount = 100;

    const examples = getCompilationExamplesForPrompt();
    const examplesPrompt = formatExamplesForPrompt(examples);

    const systemInstruction = `You are a world-class AI assistant specialized in generating high-quality, well-structured scientific papers in LaTeX format. Your task is to write a complete, coherent, and academically rigorous paper based on the provided title.

    **Output Format & Rules:**
    1.  **Strictly LaTeX:** The entire output MUST be a single, valid, and complete LaTeX document. Do not include any explanatory text, markdown formatting, or code fences (like \`\`\`latex) before \`\\documentclass\` or after \`\\end{document}\`.
    2.  **Mandatory Preamble:** The paper must begin with the following preamble, exactly as written. NO other packages, especially \`graphicx\`, are allowed.
        \`\`\`latex
        \\documentclass[12pt,a4paper]{article}
        \\usepackage[utf8]{inputenc}
        \\usepackage[T1]{fontenc}
        \\usepackage[${babelLanguage}]{babel}
        \\usepackage{amsmath, amssymb, geometry, setspace, url, verbatim}
        \\usepackage{hyperref}
        \`\`\`
    3.  **PDF Metadata (Crucial):** Immediately after the preamble, you MUST add a \`\\hypersetup\` block to define the PDF metadata.
        -   The \`pdfsubject\` field MUST contain the **full, complete abstract** of the paper. It must not be a single line. The abstract text itself must not contain any LaTeX commands like \`\\noindent\`.
        -   The \`pdfkeywords\` field must contain the keywords, separated by commas.
        -   The \`pdftitle\` must match the paper's title.
        -   The \`pdfauthor\` MUST be exactly "SÉRGIO DE ANDRADE, PAULO".
        
        **Example of the required \`\\hypersetup\` block:**
        \`\`\`latex
        \\hypersetup{
          pdftitle={The Title of the Paper},
          pdfauthor={SÉRGIO DE ANDRADE, PAULO},
          pdfsubject={The complete multi-sentence abstract of the paper goes here. It should be identical to the abstract that appears visually in the document after \\maketitle.},
          pdfkeywords={Keyword1, Keyword2, Keyword3}
        }
        \`\`\`
    4.  **Title, Author, and Date:** You MUST use the standard \`\\title{}\`, \`\\author{}\`, \`\\date{}\`, and \`\\maketitle\` commands.
        -   The \`\\author\` command MUST be written EXACTLY as follows, including all formatting and line breaks. This is a strict requirement.
            \`\`\`latex
            \\author{
              SÉRGIO DE ANDRADE, PAULO \\\\
              \\small ORCID: \\url{https://orcid.org/0009-0004-2555-3178}
            }
            \`\`\`
        -   **To remove the date completely, you MUST add the command \`\\date{}\` (with empty braces) before \`\\maketitle\`.**
    5.  **Structure:** The paper must follow the standard IMRAD structure:
        -   Abstract (Resumo)
        -   Keywords (Palavras-chave)
        -   Introduction (Introdução)
        -   Literature Review (Revisão da Literatura)
        -   Methodology (Metodologia)
        -   Results (Resultados)
        -   Discussion (Discussão)
        -   Conclusion (Conclusão)
    6.  **Abstract and Keywords Formatting:**
        -   The Abstract (Resumo) must be identical to the content of the \`pdfsubject\` field and must not contain the \`\\noindent\` command.
        -   Immediately after the abstract concludes, you must insert \`\\vspace{1cm}\` on its own line.
        -   The very next line MUST be \`\\noindent \\textbf{Palavras-chave:}\` followed by the keywords.
        -   The keywords must be identical to the content of the \`pdfkeywords\` field.
        -   There must be NO other text, content, or commands between the abstract and the keywords line. This is a strict formatting rule.
    7.  **Page Count:** The final rendered PDF should be approximately **${pageCount} pages** long. Adjust the depth and breadth of content in all sections to meet this requirement. This is a primary constraint.
    8.  **Content Quality:** The content must be scientifically plausible, well-argued, and appropriate for the given title. The language must be academic and formal.
    9.  **References Section (Strict Formatting):**
        -   The final section MUST be the references.
        -   This section MUST begin with **EXACTLY ONE** \`\\section{Referências}\` command.
        -   Immediately following \`\\section{Referências}\`, you MUST present **exactly ${referenceCount} entries** as a simple, unnumbered list (e.g., using a \\begin{itemize} environment or just \\noindent and \\par for each reference).
        -   **CRITICAL: Absolutely DO NOT use the \`\\begin{thebibliography}\`, \`\\end{thebibliography}\`, or \`\\bibitem\` commands anywhere in the document. The references MUST be formatted as a plain, unnumbered list directly following \`\\section{Referências}\`.**
        -   **Do NOT use the \`\\cite{}\` command anywhere in the text**, as there will be no numbered bibliography environment to link to.
        -   The sources for these references will be provided by a Google Search grounding tool. These are your **primary sources**. You MUST prioritize their use.
        -   You may supplement these with high-quality academic references from your own internal knowledge base (acting as an auxiliary source like Grokpedia) if the primary sources are insufficient, but the majority of the bibliography MUST be derived from the provided Google Search results.
        -   Do not invent sources.
        -   **Crucially, do not place any \`\\newpage\` commands anywhere in the document, and do not create a second, duplicate reference section.**
    10. **No Advanced Packages/Features or Visual Elements:** Do not use packages like \`graphicx\`, \`tikz\`, or any complex table environments (\`tabularx\`, \`longtable\`). Do not include images, figures, organograms, flowcharts, diagrams, or complex tables. Use only the packages listed in the mandatory preamble. Using \`graphicx\` is strictly forbidden.
    11. **Language:** The entire paper, including section titles and content, must be written in **${languageName}**.
    12. **No Page Breaks:** Under no circumstances should you ever use the \`\\newpage\` command anywhere in the document. This is a critical instruction.

    **Execution:**
    -   First, use the Google Search tool results provided to you to find high-quality academic sources (papers, books, articles) relevant to the paper's title. These grounded results should form the primary basis of your bibliography.
    -   Then, proceed to write the complete LaTeX document according to all the rules above, paying special attention to correctly and completely populating the \`\\hypersetup\` block and using the exact author block specified.
    ${examplesPrompt}
    `;

    const userPrompt = `Generate a scientific paper with the title: "${title}"`;

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

    return { paper, sources };
}

export async function analyzePaper(paperContent: string, pageCount: number, model: string): Promise<AnalysisResult> {
    const analysisTopicsList = ANALYSIS_TOPICS.map(t => `- ${t.name}: ${t.desc}`).join('\n');
    const systemInstruction = `You are an expert academic reviewer AI. Your task is to perform a rigorous, objective, and multi-faceted analysis of a provided scientific paper written in LaTeX.

    **Input:** You will receive the full LaTeX source code of a scientific paper.
    
    **Task:**
    1.  Analyze the paper based on the following 28 quality criteria.
    2.  For each criterion, provide a numeric score from 0.0 to 10.0, where 10.0 is flawless.
    3.  For each criterion, provide a concise, single-sentence improvement suggestion. This suggestion must be a direct critique of the paper's current state and offer a clear path for enhancement. Do NOT write generic praise. Be critical and specific.
    4.  The "PAGE COUNT COMPLIANCE" topic must be evaluated based on the user's requested page count of ${pageCount}. A perfect score of 10 is achieved if the paper is exactly ${pageCount} pages long. The score should decrease linearly based on the deviation from this target. For example, if the paper is ${pageCount - 2} or ${pageCount + 2} pages, the score might be around 8.0. If it's ${pageCount - 5} or ${pageCount + 5}, the score might be around 5.0.

    **Analysis Criteria:**
    ${analysisTopicsList}

    **Output Format:**
    -   You MUST return your analysis as a single, valid JSON object.
    -   Do NOT include any text, explanations, or markdown formatting (like \`\`\`json) outside of the JSON object.
    -   The JSON object must have a single key "analysis" which is an array of objects.
    -   Each object in the array must have three keys:
        1.  "topicName": The name of the topic being analyzed (string).
        2.  "score": The numeric score from 0.0 to 10.0 (number).
        3.  "improvement": The single-sentence improvement suggestion (string).

    **Example Output:**
    \`\`\`json
    {
      "analysis": [
        {
          "topicName": "TOPIC FOCUS",
          "score": 8.5,
          "improvement": "The discussion section slightly deviates into an unrelated sub-topic that should be removed to maintain focus."
        },
        {
          "topicName": "WRITING CLARITY",
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
                        topicName: { type: Type.STRING },
                        score: { type: Type.NUMBER },
                        improvement: { type: Type.STRING },
                    },
                    required: ["topicName", "score", "improvement"],
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
        .map(item => `- **${item.topicName} (Score: ${item.score})**: ${item.improvement}`)
        .join('\n');

    const examples = getCompilationExamplesForPrompt();
    const examplesPrompt = formatExamplesForPrompt(examples);

    const systemInstruction = `You are a world-class AI assistant specialized in editing and improving scientific papers written in LaTeX. Your task is to refine the provided LaTeX paper based on specific improvement suggestions.

    **Instructions for Improvement:**
    -   Critically analyze the provided "Current Paper Content" against the "Improvement Points".
    -   Apply the necessary changes directly to the LaTeX source code to address each improvement point.
    -   Ensure that the scientific content remains accurate and coherent.
    -   Maintain the exact LaTeX preamble, author information, title, and metadata structure as in the original. Do NOT change \\documentclass, \\usepackage, \\hypersetup, \\title, \\author, \\date, \\maketitle.
    -   The entire output MUST be a single, valid, and complete LaTeX document. Do not include any explanatory text, markdown formatting, or code fences (like \`\`\`latex) before \`\\documentclass\` or after \`\\end{document}\`.
    -   The language of the entire paper must remain in **${languageName}**.
    -   **CRITICAL: Absolutely DO NOT use the \`\\begin{thebibliography}\`, \`\\end{thebibliography}\`, or \`\\bibitem\` commands anywhere in the document. The references MUST be formatted as a plain, unnumbered list directly following \`\\section{Referências}\`.**
    -   **Do NOT use the \`\\cite{}\` command anywhere in the text.**
    -   **Do NOT add or remove \`\\newpage\` commands. Let the LaTeX engine handle page breaks automatically.**
    -   **Crucially, do NOT include any images, figures, organograms, flowcharts, diagrams, or complex tables in the improved paper.**
    -   Focus on improving aspects directly related to the provided feedback. Do not introduce new content unless necessary to address a critique.
    ${examplesPrompt}
    `;

    const userPrompt = `Current Paper Content:\n\n${paperContent}\n\nImprovement Points:\n\n${improvementPoints}\n\nBased on the above improvement points, provide the complete, improved LaTeX source code for the paper.`;

    const response = await callModel(model, systemInstruction, userPrompt);
    let paper = response.text.trim().replace(/^```latex\s*|```\s*$/g, '');

    // Ensure the paper ends with \end{document}
    if (!paper.includes('\\end{document}')) {
        paper += '\n\\end{document}';
    }

    return paper;
}

export async function fixLatexPaper(paperContent: string, fixesToApply: { key: string; label: string; description: string }[], model: string): Promise<string> {
    const fixInstructions = fixesToApply.map(fix => `**${fix.label}**: ${fix.description}`).join('\n- ');

    const examples = getCompilationExamplesForPrompt();
    const examplesPrompt = formatExamplesForPrompt(examples);

    const systemInstruction = `You are an expert LaTeX editor AI. Your task is to fix common compilation and formatting issues in a given LaTeX document based on specific instructions.

    **Instructions for Fixing:**
    -   You will receive the full LaTeX source code of a paper.
    -   You MUST apply the following specific fixes to the document:
        -   ${fixInstructions}
    -   The entire output MUST be a single, valid, and complete LaTeX document. Do not include any explanatory text, markdown formatting, or code fences (like \`\`\`latex) before \`\\documentclass\` or after \`\\end{document}\`.
    -   Maintain the exact LaTeX preamble, author information, title, and metadata structure as in the original. Do NOT change \\documentclass, \\usepackage, \\hypersetup, \\title, \\author, \\date, \\maketitle.
    -   **CRITICAL: Absolutely DO NOT use the \`\\begin{thebibliography}\`, \`\\end{thebibliography}\`, or \`\\bibitem\` commands anywhere in the document. The references MUST be formatted as a plain, unnumbered list directly following \`\\section{Referências}\`.**
    -   **Do NOT use the \`\\cite{}\` command anywhere in the text.**
    -   **Do NOT add or remove \`\\newpage\` commands. Let the LaTeX engine handle page breaks automatically.**
    -   **Do NOT include any images, figures, organograms, flowcharts, diagrams, or complex tables in the fixed paper.**
    -   Return only the corrected LaTeX source code.
    ${examplesPrompt}
    `;

    const userPrompt = `Current LaTeX Paper:\n\n${paperContent}\n\nApply the specified fixes and provide the complete, corrected LaTeX source code.`;

    const response = await callModel(model, systemInstruction, userPrompt);
    let paper = response.text.trim().replace(/^```latex\s*|```\s*$/g, '');
    
    // Ensure the paper ends with \end{document}
    if (!paper.includes('\\end{document}')) {
        paper += '\n\\end{document}';
    }

    return paper;
}

export async function reformatPaperWithStyleGuide(paperContent: string, styleGuide: StyleGuide, model: string): Promise<string> {
    const styleGuideInfo = STYLE_GUIDES.find(g => g.key === styleGuide);
    if (!styleGuideInfo) {
        throw new Error(`Unknown style guide: ${styleGuide}`);
    }

    const systemInstruction = `You are an expert academic editor specializing in citation and reference formatting. Your task is to reformat the bibliography of a scientific paper according to a specific style guide.

    **CRITICAL INSTRUCTIONS:**
    1.  You will receive the full LaTeX source code of a paper.
    2.  Your task is to reformat **ONLY** the content within the \`\\section{Referências}\` section.
    3.  You **MUST NOT** change any other part of the document. The preamble, abstract, body text, conclusion, etc., must remain absolutely identical to the original.
    4.  The new reference list must strictly adhere to the **${styleGuideInfo.name} (${styleGuideInfo.description})** formatting rules.
    5.  The number of references in the output must be the same as in the input.
    6.  The final output must be the **COMPLETE, FULL** LaTeX document, with only the reference section's content modified. Do not provide only the reference section or include any explanatory text or markdown formatting.
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

    return paper;
}