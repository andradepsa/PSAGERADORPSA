
import { ALL_TOPICS_BY_DISCIPLINE } from './content';

export const DISCIPLINE_AUTHORS: Record<string, string> = {
    "Mathematics": "MATH, 10",
    "History of Humanity": "HISTORY, 10",
    "Geography": "GEOGRAPHY, 10",
    "Biology": "BIOLOGY, 10",
    "Chemistry": "CHEMISTRY, 10",
    "Physics": "PHYSICS, 10",
    "Astronomy & Astrophysics": "ASTRO, 10",
    "Philosophy": "PHILOSOPHY, 10",
    "Literature": "LITERATURE, 10",
    "Artificial Intelligence": "IA, 10"
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
