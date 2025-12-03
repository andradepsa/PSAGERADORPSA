
import type { LanguageOption, AnalysisTopic, StyleGuideOption } from './types';

// Otimização de Cota: Mantido em 2.
// Artigos longos consomem muitos tokens. 2 iterações são o equilíbrio ideal para contas gratuitas.
export const TOTAL_ITERATIONS = 2;

export const LANGUAGES: LanguageOption[] = [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'pt', name: 'Português', flag: '🇧🇷' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
];

export const AVAILABLE_MODELS: {name: string, description: string}[] = [
    { name: 'gemini-2.5-flash', description: 'Google: Fast and efficient (Default)' },
    { name: 'grok-2-latest', description: 'x.ai: Advanced reasoning (Requires API Key)' },
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
    { num: 8, 'name': 'ABSTRACT QUALITY', desc: 'Resumo conciso e completo.' },
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

export const DISCIPLINE_AUTHORS: Record<string, string> = {
    "Mathematics": "MATH, 10",
    "History of Humanity": "HISTORY, 10",
    "Geography": "GEOGRAPHY, 10",
    "Biology": "BIOLOGY, 10",
    "Chemistry": "CHEMISTRY, 10",
    "Physics": "PHYSICS, 10",
    "Astronomy & Astrophysics": "ASTRO, 10",
    "Philosophy": "PHILOSOPHY, 10",
    "Literature": "LITERATURE, 10"
};

export const ALL_TOPICS_BY_DISCIPLINE: Record<string, string[]> = {
    "Mathematics": [
        "Riemann Hypothesis and Prime Distribution",
        "Navier-Stokes Existence and Smoothness",
        "P vs NP Problem",
        "Birch and Swinnerton-Dyer Conjecture",
        "Hodge Conjecture",
        "Yang-Mills Existence and Mass Gap",
        "Langlands Program",
        "Twin Prime Conjecture",
        "Collatz Conjecture",
        "Mirror Symmetry in Calabi-Yau Manifolds"
    ],
    "History of Humanity": [
        "The Collapse of the Late Bronze Age",
        "The Impact of the Black Death on European Society",
        "The Origins of Agriculture in the Fertile Crescent",
        "The Silk Road and Cultural Exchange",
        "The Fall of the Roman Empire: Internal vs External Factors",
        "The Industrial Revolution and Social Change",
        "The Maya Civilization: Rise and Collapse",
        "The Mongol Empire and Global Connectivity",
        "The French Revolution and the Birth of Modern Nationalism",
        "The Columbian Exchange and its Global Impact"
    ],
    "Geography": [
        "Climate Change and Coastal Erosion",
        "Urbanization and Heat Islands",
        "The Geopolitics of Water Resources",
        "Deforestation in the Amazon and Global Climate",
        "Migration Patterns in the 21st Century",
        "Sustainable Development in Megacities",
        "The Impact of Tourism on Island Ecosystems",
        "Glacial Retreat and Freshwater Availability",
        "Natural Hazards and Disaster Risk Reduction",
        "Desertification in the Sahel Region"
    ],
    "Biology": [
        "CRISPR-Cas9 and Gene Editing Ethics",
        "The Human Microbiome and Health",
        "Epigenetics and Inheritance",
        "Neuroplasticity and Learning",
        "Antibiotic Resistance Mechanisms",
        "The Origin of Life: RNA World Hypothesis",
        "Biodiversity Loss and Ecosystem Services",
        "Stem Cell Therapy and Regenerative Medicine",
        "The Role of Telomeres in Aging",
        "Evolutionary Psychology and Human Behavior"
    ],
    "Chemistry": [
        "Graphene and 2D Materials",
        "Green Chemistry and Sustainable Synthesis",
        "Metal-Organic Frameworks (MOFs) for Gas Storage",
        "Catalysis in Renewable Energy Conversion",
        "Supramolecular Chemistry and Self-Assembly",
        "Nanoparticles in Drug Delivery",
        "The Chemistry of Batteries and Energy Storage",
        "Computational Chemistry and Drug Design",
        "Photocatalysis for Water Splitting",
        "The Chemistry of Climate Change Mitigation"
    ],
    "Physics": [
        "Dark Matter and Dark Energy",
        "Quantum Computing and Information",
        "String Theory and M-Theory",
        "High-Temperature Superconductivity",
        "Gravitational Waves and Black Hole Mergers",
        "Neutrino Oscillations and Mass",
        "The Standard Model and Beyond",
        "Quantum Entanglement and Teleportation",
        "Fusion Energy: Challenges and Progress",
        "The Early Universe and Inflation"
    ],
    "Astronomy & Astrophysics": [
        "Exoplanet Atmospheres and Biosignatures",
        "The Formation of Galaxies and Large-Scale Structure",
        "Black Hole Accretion Disks and Jets",
        "The Search for Extraterrestrial Intelligence (SETI)",
        "Stellar Evolution and Supernovae",
        "The Hubble Tension and the Expansion of the Universe",
        "Gravitational Lensing and Dark Matter Mapping",
        "The Kuiper Belt and Trans-Neptunian Objects",
        "Pulsars and Neutron Stars",
        "The Interstellar Medium and Star Formation"
    ],
    "Philosophy": [
        "The Problem of Consciousness (Hard Problem)",
        "Ethics of Artificial Intelligence",
        "Free Will vs Determinism",
        "Epistemology in the Post-Truth Era",
        "The Meaning of Life in Existentialism",
        "Political Philosophy and Social Justice",
        "The Philosophy of Science and Falsifiability",
        "Metaphysics of Time and Space",
        "Utilitarianism vs Deontology",
        "The Philosophy of Language and Meaning"
    ],
    "Literature": [
        "Post-Colonialism in Modern Literature",
        "The Evolution of the Novel Form",
        "Symbolism in 19th Century Poetry",
        "Magic Realism in Latin American Literature",
        "The Hero's Journey in Comparative Mythology",
        "Feminist Perspectives in Classic Literature",
        "The Impact of Digital Media on Narrative Structure",
        "Shakespeare and the Human Condition",
        "Modernism and the Stream of Consciousness",
        "Dystopian Fiction and Social Commentary"
    ]
};

export const getAllDisciplines = (): string[] => {
    return Object.keys(ALL_TOPICS_BY_DISCIPLINE);
};

export const getRandomTopic = (discipline: string): string => {
    const topics = ALL_TOPICS_BY_DISCIPLINE[discipline];
    if (topics && topics.length > 0) {
        return topics[Math.floor(Math.random() * topics.length)];
    }
    return '';
};

export const SEMANTIC_SCHOLAR_API_BASE_URL = 'https://api.semanticscholar.org/graph/v1';
