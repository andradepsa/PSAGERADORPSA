import type { LanguageOption, AnalysisTopic, StyleGuideOption } from './types';

export const TOTAL_ITERATIONS = 12;

export const LANGUAGES: LanguageOption[] = [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'pt', name: 'Português', flag: '🇧🇷' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
];

export const AVAILABLE_MODELS: {name: string, description: string}[] = [
    { name: 'gemini-2.5-flash', description: 'Fast and efficient for most tasks.' },
    { name: 'gemini-2.5-pro', description: 'More powerful for complex generation and reasoning.' },
    { name: 'gemini-3-pro-preview', description: 'Next-gen model for advanced reasoning and STEM tasks.' },
    { name: 'grok-4-latest', description: 'Powerful model from x.ai.' },
];

export const STYLE_GUIDES: StyleGuideOption[] = [
    { key: 'abnt', name: 'ABNT', description: 'Associação Brasileira de Normas Técnicas NBR 6023' },
    { key: 'apa', name: 'APA', description: 'American Psychological Association 7th Edition' },
    { key: 'mla', name: 'MLA', description: 'Modern Language Association 9th Edition' },
    { key: 'ieee', name: 'IEEE', description: 'Institute of Electrical and Electronics Engineers' },
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
    { num: 15, name: 'SCOPE AND BOUNDARIES', desc: 'Definição clara do escopo.' },
    { num: 16, name: 'SCIENTIFIC HONESTY', desc: 'Transparência e evitar plágio.' },
    { num: 17, name: 'TITLE-CONTENT ALIGNMENT', desc: 'Alinhamento entre título e conteúdo.' },
    { num: 18, name: 'STATEMENT OF LIMITATIONS', desc: 'Reconhecimento de limitações.' },
    { num: 20, name: 'PRACTICAL IMPLICATIONS', desc: 'Relevância prática.' },
    { num: 21, name: 'TERMINOLOGY', desc: 'Uso correto de termos técnicos.' },
    { num: 22, name: 'ETHICAL CONSIDERATIONS', desc: 'Considerações éticas.' },
    { num: 23, name: 'LATEX ACCURACY', desc: 'Compilabilidade técnica.' },
    { num: 24, name: 'STRATEGIC REFINEMENT', desc: 'Melhorias cirúrgicas sem quebrar o texto.' },
    { num: 25, name: 'THEORETICAL FOUNDATION', desc: 'Base teórica sólida.' },
    { num: 26, name: 'SCIENTIFIC CONTENT ACCURACY', desc: 'Precisão das informações científicas.' },
    { num: 27, name: 'DEPTH OF CRITICAL ANALYSIS', desc: 'Profundidade da análise crítica.' },
    { num: 28, name: 'PAGE COUNT', desc: 'Adesão ao tamanho solicitado.' }
];

export const FIX_OPTIONS: { key: string; label: string; description: string }[] = [
    {
        key: 'escape_chars',
        label: 'Fix Character Escaping',
        description: 'Scans the document for special LaTeX characters (like %, $, _, &) that were not correctly escaped and fixes them.'
    },
    {
        key: 'citation_mismatch',
        label: 'Fix Citation Mismatches',
        description: 'Ensures that every \\cite{...} command in the text has a corresponding \\bibitem entry in the bibliography, and vice-versa.'
    },
    {
        key: 'preamble_check',
        label: 'Verify Preamble',
        description: 'Checks if the document preamble uses only the allowed packages in the correct order as specified by the generation rules.'
    }
];

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

export const SEMANTIC_SCHOLAR_API_BASE_URL = 'https://api.semanticscholar.org/graph/v1/paper/search';
