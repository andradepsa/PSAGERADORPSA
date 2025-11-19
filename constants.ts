
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
    { num: 0, name: 'TOPIC FOCUS', desc: 'Evaluation of maintaining the central focus of the paper without deviation' },
    { num: 1, name: 'WRITING CLARITY', desc: 'Quality of scientific writing, including grammar, precision, and readability' },
    { num: 2, name: 'METHODOLOGICAL RIGOR', desc: 'Scientific and methodological rigor, ensuring the approach is sound, valid, and appropriate for the research question' },
    { num: 3, name: 'ORIGINALITY AND CONTRIBUTION', desc: 'Evaluation of the novelty and significance of the paper\'s contribution to the field' },
    { num: 4, name: 'LITERATURE REVIEW', desc: 'Quality of the literature review in establishing context, identifying the research gap, and engaging critically with existing work' },
    { num: 5, name: 'METHODOLOGY CLARITY', desc: 'Clarity, detail, and completeness of the methodology, ensuring the study is replicable' },
    { num: 6, name: 'RESULTS PRESENTATION', desc: 'Clarity, logical organization, and objectivity of the results section. Evaluates if the findings are presented in a coherent sequence that directly addresses the research questions, without premature interpretation.' },
    { num: 7, name: 'DISCUSSION AND INTERPRETATION', desc: 'Depth of the discussion in interpreting results, linking them to theory, and explaining their implications' },
    { num: 8, name: 'ABSTRACT QUALITY', desc: 'Effectiveness of the abstract as a concise, stand-alone summary of the paper\'s objective, methods, key findings, and conclusion' },
    { num: 9, name: 'INTRODUCTION QUALITY', desc: 'Effectiveness of the introduction in establishing context, stating the problem, presenting the research question, and outlining the paper\'s structure' },
    { num: 10, name: 'CONCLUSION QUALITY', desc: 'Effectiveness of the conclusion in summarizing key findings, reinforcing the paper\'s contribution, and suggesting meaningful future research' },
    { num: 11, name: 'ARGUMENTATION STRENGTH', desc: 'Logical soundness of the arguments and the strength of the evidence and data supporting them' },
    { num: 12, name: 'COHERENCE AND FLOW', desc: 'Logical flow and smooth transitions between sentences, paragraphs, and sections' },
    { num: 13, name: 'STRUCTURE AND ORGANIZATION', desc: 'Effectiveness of the overall organization and structure of the paper, including section order and headings' },
    { num: 14, name: 'REFERENCES AND CITATIONS', desc: 'Quality, relevance, and correct formatting of all references and in-text citations' },
    { num: 15, name: 'SCOPE AND BOUNDARIES', desc: 'Clear definition of and adherence to the stated scope of the research' },
    { num: 16, name: 'SCIENTIFIC HONESTY', desc: 'Transparency, and avoidance of plagiarism, data fabrication, or misrepresentation' },
    { num: 17, name: 'TITLE-CONTENT ALIGNMENT', desc: 'Verification that the paper\'s content accurately reflects the promise and scope of its title' },
    { num: 18, name: 'STATEMENT OF LIMITATIONS', desc: 'Clear and honest acknowledgment of the study\'s limitations and their potential impact' },
    { num: 20, name: 'PRACTICAL IMPLICATIONS AND REALISM', desc: 'Discussion of the practical applications, real-world relevance, and credibility of the findings' },
    { num: 21, name: 'TERMINOLOGY AND NOMENCLATURE', desc: 'Consistent, correct, and precise use of technical terms and nomenclature throughout the paper' },
    { num: 22, name: 'ETHICAL CONSIDERATIONS', desc: 'Appropriate discussion and handling of ethical aspects related to the research, such as data privacy or participant consent' },
    { num: 23, name: 'LATEX TECHNICAL ACCURACY', desc: 'Verification of LaTeX formatting, including page breaks, to prevent compilation issues' },
    { num: 24, name: 'STRATEGIC REFINEMENT', desc: 'Ensures that proposed improvements for low-scoring areas are targeted and do not negatively impact high-scoring, well-written sections of the paper.' },
    { num: 25, name: 'THEORETICAL FOUNDATION', desc: 'Strength and relevance of the theoretical framework underpinning the research' },
    { num: 26, name: 'SCIENTIFIC CONTENT ACCURACY', desc: 'Verification of the accuracy and correctness of scientific information, data, and claims presented' },
    { num: 27, name: 'DEPTH OF CRITICAL ANALYSIS', desc: 'Evaluation of the depth and insightfulness of the critical analysis, including questioning assumptions and exploring alternative interpretations' },
    { num: 28, name: 'PAGE COUNT COMPLIANCE', desc: 'Verifies that the generated paper\'s length meets the number of pages requested by the user.' }
];

// Fix: Add FIX_OPTIONS to be exported for use in FixModal.tsx
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
