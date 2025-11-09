
export type Language = 'en' | 'pt' | 'es' | 'fr';

export interface LanguageOption {
    code: Language;
    name: string;
    flag: string;
}

export interface AnalysisTopic {
    num: number;
    name: string;
    desc: string;
}

export interface TopicAnalysisResult {
    topic: AnalysisTopic;
    score: number;
    scoreClass: string;
    improvement: string;
}

export interface IterationAnalysis {
    iteration: number;
    results: TopicAnalysisResult[];
}

export interface AnalysisItem {
    topicName: string;
    score: number;
    improvement: string;
}

export interface AnalysisResult {
    analysis: AnalysisItem[];
}

export interface PaperSource {
    uri: string;
    title: string;
}

// Fix: Add ZenodoAuthor and ExtractedMetadata types to resolve import errors in ZenodoUploader.tsx.
export interface ZenodoAuthor {
    name: string;
    affiliation: string;
    orcid: string;
}

export interface ExtractedMetadata {
    title: string;
    abstract: string;
    authors: ZenodoAuthor[];
    keywords: string;
}

export type StyleGuide = 'abnt' | 'apa' | 'mla' | 'ieee';

export interface StyleGuideOption {
    key: StyleGuide;
    name: string;
    description: string;
}
