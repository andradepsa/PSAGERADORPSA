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

/**
 * Returns a list of all available disciplines.
 * @returns {string[]} An array of discipline names.
 */
export function getAllDisciplines(): string[] {
    return Object.keys(ALL_TOPICS_BY_DISCIPLINE);
}

/**
 * Returns a random topic from a specified discipline.
 * @param {string} discipline - The discipline name to get a topic from.
 * @returns {string} A random topic string.
 */
export function getRandomTopic(discipline: string): string {
    const topics = ALL_TOPICS_BY_DISCIPLINE[discipline];
    if (!topics || topics.length === 0) {
        // Fallback in case a discipline is added without topics
        const allDisciplines = Object.keys(ALL_TOPICS_BY_DISCIPLINE);
        const randomDiscipline = allDisciplines[Math.floor(Math.random() * allDisciplines.length)];
        const fallbackTopics = ALL_TOPICS_BY_DISCIPLINE[randomDiscipline];
        return fallbackTopics[Math.floor(Math.random() * fallbackTopics.length)];
    }
    return topics[Math.floor(Math.random() * topics.length)];
}