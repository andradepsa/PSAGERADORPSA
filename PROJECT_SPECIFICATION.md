# PROMPT MESTRE PARA RECRIAÇÃO TOTAL DO PROJETO

**Instrução para a IA (Copie este conteúdo):**

Você deve agir como um Engenheiro de Software Sênior e recriar uma aplicação React completa chamada "Gerador de Artigos Científicos". Abaixo está a documentação completa, incluindo as listas de dados (tópicos), a lógica exata de geração de títulos e o funcionamento detalhado do loop de iterações de qualidade.

---

## 1. Stack Tecnológico

*   **Frontend:** React 19, TypeScript, Vite.
*   **Estilização:** TailwindCSS.
*   **IA:** Google GenAI SDK (`@google/genai` v1.25.0+).
*   **Compilação:** LaTeX (via API proxy para TeXLive.net).
*   **Armazenamento:** LocalStorage (para chaves de API e histórico).

---

## 2. "O Cérebro": Dados e Constantes (`constants.ts`)

Esta seção define os **Tópicos e Subtópicos** que alimentam a criação do título, e os **Critérios de Análise** para as iterações.

```typescript
// constants.ts

// 1. TÓPICOS MATEMÁTICOS (A base para a geração do título)
// Esta lista deve ser EXATAMENTE assim para garantir variedade:
export const MATH_TOPICS: string[] = [
    'Fundamentos da Matemática',
    'Lógica Matemática',
    'Proposições e conectivos lógicos',
    'Tabelas-verdade e equivalências',
    'Argumentos e deduções válidas',
    'Quantificadores (∀, ∃)',
    'Teoria dos Conjuntos',
    'Conjuntos e operações (união, interseção, complemento)',
    'Relações e funções',
    'Cardinalidade e infinitos (enumerável, não enumerável)',
    'Paradoxo de Russell',
    'Axiomas de Zermelo–Fraenkel (ZF e ZFC)',
    'Teoria dos Números Fundamentais',
    'Axiomas de Peano',
    'Aritmética modular',
    'Álgebra',
    'Polinômios e fatoração',
    'Sistemas lineares',
    'Álgebra Linear',
    'Vetores e espaços vetoriais',
    'Combinações lineares e dependência',
    'Matrizes e determinantes',
    'Transformações lineares',
    'Autovalores e autovetores',
    'Diagonalização e formas canônicas',
    'Álgebra Abstrata (Moderna)',
    'Grupos, anéis e corpos',
    'Homomorfismos e isomorfismos',
    'Teoremas de Lagrange, Cauchy e Sylow',
    'Geometria',
    'Geometria Euclidiana e Não-Euclidiana',
    'Geometria Diferencial (Curvas e Superfícies)',
    'Topologia',
    'Cálculo e Análise',
    'Limites, Derivadas e Integrais',
    'Equações Diferenciais Ordinárias e Parciais',
    'Séries de Fourier',
    'Análise Complexa',
    'Probabilidade e Estatística',
    'Processos Estocásticos',
    'Criptografia e Teoria da Informação',
    'Otimização e Pesquisa Operacional'
];

// 2. CRITÉRIOS DE ANÁLISE (Usados nas iterações)
export const ANALYSIS_TOPICS = [
    { num: 0, name: 'TOPIC FOCUS', desc: 'Mantém o foco central sem desviar.' },
    { num: 1, name: 'WRITING CLARITY', desc: 'Qualidade gramatical e legibilidade.' },
    { num: 2, name: 'METHODOLOGICAL RIGOR', desc: 'Validez científica da metodologia.' },
    { num: 3, name: 'ORIGINALITY', desc: 'Contribuição nova para a área.' },
    { num: 4, name: 'LITERATURE REVIEW', desc: 'Uso adequado de fontes e contexto.' },
    { num: 14, name: 'REFERENCES AND CITATIONS', desc: 'Formatação correta e relevância das fontes.' },
    { num: 23, name: 'LATEX TECHNICAL ACCURACY', desc: 'Compilabilidade do código LaTeX.' },
    { num: 28, name: 'PAGE COUNT COMPLIANCE', desc: 'Adesão ao número de páginas solicitado.' }
];

export const AVAILABLE_MODELS = [
    { name: 'gemini-2.5-flash', description: 'Rápido (Análise e Títulos)' },
    { name: 'gemini-2.5-pro', description: 'Poderoso (Escrita e Melhoria)' },
];

export const TOTAL_ITERATIONS = 12;
```

---

## 3. Lógica Detalhada dos Serviços (`geminiService.ts`)

### 3.1 Criação do Título

A função recebe um tópico sorteado e solicita um título acadêmico específico.

```typescript
export async function generatePaperTitle(topic: string, language: Language, model: string): Promise<string> {
    const systemInstruction = `You are an expert mathematician. Your task is to generate a single, compelling, and high-impact title for a scientific paper.`;
    
    const userPrompt = `Based on the broad mathematical topic of "${topic}", generate a single, novel, and specific title for a high-impact research paper. 
    
    Requirements:
    - Must sound like a genuine academic publication.
    - Concise and impactful.
    - Language: ${language}.
    - Response MUST be ONLY the title text.`;

    const response = await callModel(model, systemInstruction, userPrompt);
    return response.text.trim();
}
```

### 3.2 Geração Inicial

```typescript
export async function generateInitialPaper(title: string, language: Language, pageCount: number, model: string) {
    // Prompt utiliza um template LaTeX fixo para garantir estrutura
    const prompt = `Using the provided LaTeX template, write a complete paper titled "${title}". 
    Target approx ${pageCount} pages. 
    Use Google Search grounding to find real references.
    Return ONLY valid LaTeX code.`;
    
    const response = await callModel(model, systemInstruction, prompt, { googleSearch: true });
    return { paper: response.text, sources: response.groundingMetadata };
}
```

### 3.3 Análise (O Avaliador)

```typescript
export async function analyzePaper(paperContent: string, pageCount: number, model: string) {
    const prompt = `Analyze this LaTeX paper based on these criteria: ${ANALYSIS_TOPICS.map(t => t.name)}. 
    Return a JSON object: { "analysis": [{ "topicName": string, "score": number, "improvement": string }] }.`;
    
    // Usa responseSchema para garantir JSON válido
    const response = await callModel(model, systemInstruction, [paperContent, prompt], { 
        jsonOutput: true, 
        responseSchema: schema 
    });
    return JSON.parse(response.text);
}
```

### 3.4 Melhoria (O Refinador)

```typescript
export async function improvePaper(paperContent: string, analysisResult: AnalysisResult, language: string, model: string) {
    const critiques = analysisResult.analysis
        .filter(item => item.score < 8.5)
        .map(item => `- **${item.topicName}**: ${item.improvement}`)
        .join('\n');

    const prompt = `You are an expert editor. Improve the paper based strictly on these points:\n${critiques}\n\n
    Current Paper:\n${paperContent}\n\n
    Return the COMPLETE updated LaTeX code.`;

    const response = await callModel(model, systemInstruction, prompt);
    return response.text;
}
```

---

## 4. O Fluxo de Execução (`App.tsx`)

Este é o coração do programa, onde o loop de iterações acontece.

```tsx
const handleFullAutomation = async () => {
    // 1. Título
    // Sorteia um tópico da lista detalhada
    const randomTopic = MATH_TOPICS[Math.floor(Math.random() * MATH_TOPICS.length)];
    const title = await generatePaperTitle(randomTopic, language, analysisModel);
    
    // 2. Geração Inicial
    let currentPaper = (await generateInitialPaper(title, language, pageCount, generationModel)).paper;
    
    // 3. Loop de Iterações de Qualidade (Até 12 vezes)
    for (let iter = 1; iter <= 12; iter++) {
        // A. Analisa
        const analysis = await analyzePaper(currentPaper, pageCount, analysisModel);
        
        // B. Salva resultados para exibição
        setAnalysisResults(prev => [...prev, { iteration: iter, results: analysis.analysis }]);
        
        // C. Critério de Parada Antecipada
        // Se todas as notas forem >= 7.0, para imediatamente.
        const hasLowScores = analysis.analysis.some(res => res.score < 7.0);
        if (!hasLowScores) {
            console.log("Qualidade alvo atingida.");
            break;
        }
        
        // D. Melhora (se não for a última iteração)
        if (iter < 12) {
            currentPaper = await improvePaper(currentPaper, analysis, language, generationModel);
        }
    }
    
    // 4. Compilação Robusta (Tentativa e Erro com Auto-Fix)
    await robustCompile(currentPaper);
};
```

---

## 5. Template do Artigo (`articleTemplate.ts`)

```typescript
export const ARTICLE_TEMPLATE = `\\documentclass[12pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath, amssymb, geometry}
\\usepackage{hyperref}
% O pacote Babel é injetado dinamicamente

\\title{[INSERT NEW TITLE HERE]}
\\author{SÉRGIO DE ANDRADE, PAULO \\\\ ORCID: 0009-0004-2555-3178}
\\date{}

\\begin{document}
\\maketitle

\\begin{abstract}
[INSERT NEW COMPLETE ABSTRACT HERE]
\\end{abstract}

\\section{Introduction}
[INSERT NEW CONTENT...]

% ... Outras seções ...

\\section{Referências}
% Referências devem ser texto puro (\\noindent ... \\par), sem BibTeX complexo
[INSERT NEW REFERENCE LIST HERE]

\\end{document}`;
```