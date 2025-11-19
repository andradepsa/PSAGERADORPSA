# PROMPT MESTRE: RECRIAÇÃO DO GERADOR DE ARTIGOS CIENTÍFICOS

**Instrução para a IA:**
Você deve atuar como um Engenheiro de Software Sênior e recriar uma aplicação web completa baseada nas especificações e códigos abaixo. O objetivo é um sistema robusto de geração, análise e publicação de artigos científicos usando React, Google Gemini e LaTeX.

---

## 1. Estrutura do Projeto e Dependências

**Stack:**
- React 19
- TypeScript
- Vite
- TailwindCSS
- @google/genai (SDK v1.25.0+)
- Ace Editor (via CDN ou react-ace) para edição de LaTeX

**Dependências (package.json):**
```json
{
  "dependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "@google/genai": "^1.25.0"
  },
  "devDependencies": {
    "vite": "^6.2.0",
    "@vitejs/plugin-react": "^5.0.0",
    "typescript": "~5.8.2",
    "@types/node": "^22.14.0"
  }
}
```

---

## 2. Dados e Constantes (`constants.ts`)

Este arquivo contém a lista expandida de tópicos para garantir variedade e os critérios de análise.

```typescript
import type { LanguageOption, AnalysisTopic, StyleGuideOption } from './types';

export const TOTAL_ITERATIONS = 12;

export const LANGUAGES: LanguageOption[] = [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'pt', name: 'Português', flag: '🇧🇷' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
];

export const AVAILABLE_MODELS = [
    { name: 'gemini-2.5-flash', description: 'Fast and efficient (Recommended for Analysis)' },
    { name: 'gemini-2.5-pro', description: 'High intelligence (Recommended for Writing)' },
    { name: 'gemini-3-pro-preview', description: 'Next-gen reasoning (Experimental/Limited Quota)' },
];

export const STYLE_GUIDES: StyleGuideOption[] = [
    { key: 'abnt', name: 'ABNT', description: 'Associação Brasileira de Normas Técnicas' },
    { key: 'apa', name: 'APA', description: 'American Psychological Association 7th Ed.' },
    { key: 'mla', name: 'MLA', description: 'Modern Language Association 9th Ed.' },
    { key: 'ieee', name: 'IEEE', description: 'Institute of Electrical and Electronics Engineers' },
];

export const FIX_OPTIONS = [
    { key: 'escape_chars', label: 'Fix Character Escaping', description: 'Fixes unescaped %, $, _, &.' },
    { key: 'citation_mismatch', label: 'Fix Citation Mismatches', description: 'Matches \\cite{} with references.' },
    { key: 'preamble_check', label: 'Verify Preamble', description: 'Ensures required packages are loaded.' }
];

export const ANALYSIS_TOPICS: AnalysisTopic[] = [
    { num: 0, name: 'TOPIC FOCUS', desc: 'Mantém o foco central sem desviar.' },
    { num: 1, name: 'WRITING CLARITY', desc: 'Qualidade gramatical e legibilidade.' },
    { num: 2, name: 'METHODOLOGICAL RIGOR', desc: 'Validez científica da metodologia.' },
    { num: 3, name: 'ORIGINALITY', desc: 'Contribuição nova para a área.' },
    { num: 4, name: 'LITERATURE REVIEW', desc: 'Uso adequado de fontes e contexto.' },
    { num: 5, name: 'METHODOLOGY CLARITY', desc: 'Clareza e reprodutibilidade.' },
    { num: 6, name: 'RESULTS PRESENTATION', desc: 'Organização e objetividade dos resultados.' },
    { num: 7, name: 'DISCUSSION DEPTH', desc: 'Interpretação e link com teoria.' },
    { num: 8, name: 'ABSTRACT QUALITY', desc: 'Resumo conciso e completo.' },
    { num: 9, name: 'INTRODUCTION QUALITY', desc: 'Contexto e definição do problema.' },
    { num: 10, name: 'CONCLUSION QUALITY', desc: 'Resumo de achados e trabalhos futuros.' },
    { num: 11, name: 'ARGUMENTATION STRENGTH', desc: 'Lógica e evidências.' },
    { num: 12, name: 'COHERENCE AND FLOW', desc: 'Transições suaves entre seções.' },
    { num: 13, name: 'STRUCTURE', desc: 'Organização geral do LaTeX.' },
    { num: 14, name: 'REFERENCES', desc: 'Formatação e relevância.' },
    { num: 23, name: 'LATEX ACCURACY', desc: 'Compilabilidade técnica.' },
    { num: 28, name: 'PAGE COUNT', desc: 'Adesão ao tamanho solicitado.' }
];

export const MATH_TOPICS: string[] = [
    'Fundamentos da Matemática',
    'Lógica Matemática',
    'Proposições e conectivos lógicos',
    'Tabelas-verdade e equivalências',
    'Argumentos e deduções válidas',
    'Quantificadores (∀, ∃)',
    'Teoria dos Conjuntos',
    'Conjuntos e operações',
    'Relações e funções',
    'Cardinalidade e infinitos',
    'Paradoxo de Russell',
    'Axiomas de Zermelo–Fraenkel',
    'Teoria dos Números',
    'Axiomas de Peano',
    'Aritmética modular',
    'Álgebra',
    'Polinômios e fatoração',
    'Sistemas lineares',
    'Álgebra Linear',
    'Vetores e espaços vetoriais',
    'Autovalores e autovetores',
    'Diagonalização',
    'Álgebra Abstrata',
    'Grupos, anéis e corpos',
    'Geometria Euclidiana e Não-Euclidiana',
    'Geometria Diferencial',
    'Topologia',
    'Cálculo e Análise',
    'Limites, Derivadas e Integrais',
    'Equações Diferenciais',
    'Séries de Fourier',
    'Análise Complexa',
    'Probabilidade e Estatística',
    'Criptografia',
    'Otimização'
];
```

---

## 3. Serviços de IA (`geminiService.ts`)

Este arquivo contém a lógica crítica de retry (429 quota), geração e análise.

```typescript
import { GoogleGenAI, Type } from "@google/genai";
import { LANGUAGES, AVAILABLE_MODELS, ANALYSIS_TOPICS } from '../constants';
import { ARTICLE_TEMPLATE } from './articleTemplate';

const MAX_RETRIES = 5;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function getAiClient(): GoogleGenAI {
    const apiKey = localStorage.getItem('gemini_api_key') || (process.env.API_KEY as string);
    if (!apiKey) throw new Error("Gemini API key not found.");
    return new GoogleGenAI({ apiKey });
}

async function withRateLimitHandling<T>(apiCall: () => Promise<T>): Promise<T> {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            return await apiCall();
        } catch (error: any) {
            const msg = error.message?.toLowerCase() || '';
            if (attempt === MAX_RETRIES || (msg.includes('limit: 0') || msg.includes('quota'))) {
                // Se o limite for 0, não adianta tentar de novo.
                if (msg.includes('limit: 0')) throw new Error("Este modelo não está disponível na sua conta (Quota = 0). Troque o modelo nas configurações.");
                throw error;
            }
            // Backoff exponencial
            await delay(Math.pow(2, attempt) * 1000 + 1000);
        }
    }
    throw new Error("API call failed.");
}

async function callModel(model: string, sysParam: string, userParam: string, config: any = {}) {
    const ai = getAiClient();
    return withRateLimitHandling(() => ai.models.generateContent({
        model,
        contents: userParam,
        config: {
            systemInstruction: sysParam,
            ...(config.jsonOutput && { responseMimeType: "application/json" }),
            ...(config.responseSchema && { responseSchema: config.responseSchema }),
            ...(config.googleSearch && { tools: [{ googleSearch: {} }] })
        }
    }));
}

export async function generatePaperTitle(topic: string, language: string, model: string) {
    const sys = "You are an expert mathematician. Generate a single, high-impact, novel research title.";
    const user = `Topic: ${topic}. Language: ${language}. Return ONLY the title.`;
    const res = await callModel(model, sys, user);
    return res.text.trim().replace(/"/g, '');
}

export async function generateInitialPaper(title: string, language: string, pages: number, model: string) {
    const sys = "Write a complete LaTeX paper using the provided template.";
    const user = `Title: ${title}. Pages: ${pages}. Language: ${language}. Use Google Search for references.\n\nTemplate:\n${ARTICLE_TEMPLATE}`;
    const res = await callModel(model, sys, user, { googleSearch: true });
    return { paper: res.text, sources: res.groundingMetadata };
}

export async function analyzePaper(paper: string, pages: number, model: string) {
    const sys = "Analyze this LaTeX paper. Return JSON.";
    const prompt = `Criteria: ${ANALYSIS_TOPICS.map(t => t.name)}. Page target: ${pages}.`;
    const schema = {
        type: Type.OBJECT,
        properties: {
            analysis: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        topicName: { type: Type.STRING },
                        score: { type: Type.NUMBER },
                        improvement: { type: Type.STRING }
                    },
                    required: ["topicName", "score", "improvement"]
                }
            }
        }
    };
    const res = await callModel(model, sys, [paper, prompt], { jsonOutput: true, responseSchema: schema });
    return JSON.parse(res.text);
}

export async function improvePaper(paper: string, analysis: any, language: string, model: string) {
    const critiques = analysis.analysis.filter((i: any) => i.score < 8.5).map((i: any) => `- ${i.topicName}: ${i.improvement}`).join('\n');
    const user = `Improve this paper based on:\n${critiques}\n\nPaper:\n${paper}\n\nReturn complete LaTeX.`;
    const res = await callModel(model, "You are an expert editor.", user);
    return res.text;
}
```

---

## 4. Fluxo Principal (`App.tsx`)

Lógica de automação e integração com interface.

```tsx
const handleFullAutomation = async () => {
    // 1. Geração do Título
    const topic = MATH_TOPICS[Math.floor(Math.random() * MATH_TOPICS.length)];
    const title = await generatePaperTitle(topic, language, analysisModel);
    
    // 2. Escrita Inicial
    let currentPaper = (await generateInitialPaper(title, language, pageCount, generationModel)).paper;
    
    // 3. Loop de Iteração
    for (let i = 1; i <= 12; i++) {
        const analysis = await analyzePaper(currentPaper, pageCount, analysisModel);
        // Salva estado para UI...
        
        if (!analysis.analysis.some(a => a.score < 7.0)) break; // Early stop
        
        if (i < 12) {
            currentPaper = await improvePaper(currentPaper, analysis, language, generationModel);
        }
    }
    
    // 4. Compilação Robusta (Auto-Fix)
    try {
        await compile(currentPaper);
    } catch {
        const fixed = await fixLatexPaper(currentPaper, FIX_OPTIONS, analysisModel);
        await compile(fixed);
    }
};
```

## 5. Compilação (Proxy)

Função serverless para `functions/compile-latex.js` (Cloudflare/Netlify):

```javascript
export async function onRequestPost({ request }) {
    const { latex } = await request.json();
    const formData = new FormData();
    formData.append('filecontents[]', latex);
    formData.append('filename[]', 'document.tex');
    formData.append('engine', 'pdflatex');
    formData.append('return', 'pdf');
    
    const res = await fetch('https://texlive.net/cgi-bin/latexcgi', { method: 'POST', body: formData });
    if (!res.ok) return new Response(JSON.stringify({ error: "Compile failed" }), { status: 400 });
    return new Response(await res.arrayBuffer(), { status: 200 });
}
```
