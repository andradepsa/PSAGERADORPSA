import { PRELOADED_SUCCESSFUL_EXAMPLES, PRELOADED_FAILED_EXAMPLES } from './preloadedExamples';

const MAX_SUCCESSFUL_EXAMPLES = 100;
const SUCCESSFUL_KEY = 'successful_latex_compilations';
const FAILED_KEY = 'failed_latex_compilations';

function getStoredExamples(key: string): string[] {
    let preloaded: string[] = [];
    if (key === SUCCESSFUL_KEY) {
        preloaded = PRELOADED_SUCCESSFUL_EXAMPLES;
    } else if (key === FAILED_KEY) {
        preloaded = PRELOADED_FAILED_EXAMPLES;
    }

    try {
        const stored = localStorage.getItem(key);
        const localExamples = stored ? JSON.parse(stored) : [];
        // Combine local examples with preloaded ones and remove duplicates.
        // new Set() keeps the first occurrence, so this prioritizes local examples if duplicates exist.
        const combined = [...localExamples, ...preloaded];
        return [...new Set(combined)];
    } catch (e) {
        console.error(`Error reading ${key} from localStorage`, e);
        return preloaded; // Fallback to preloaded examples if localStorage fails.
    }
}

/**
 * Adds a new example to localStorage.
 * @param key The localStorage key.
 * @param code The LaTeX code to store.
 * @param limit An optional limit on the number of examples. If null, no limit is applied.
 */
function addExample(key: string, code: string, limit: number | null) {
    try {
        const stored = localStorage.getItem(key);
        const localExamples = stored ? JSON.parse(stored) : [];

        // To avoid polluting localStorage with preloaded examples, we check against all known examples
        // before adding a new one only to the local list.
        const allKnownExamples = new Set(getStoredExamples(key));
        if (allKnownExamples.has(code)) {
            return;
        }

        localExamples.push(code);

        if (limit !== null) {
            while (localExamples.length > limit) {
                localExamples.shift(); // FIFO
            }
        }
        
        localStorage.setItem(key, JSON.stringify(localExamples));
    } catch (e)
        {
        console.error(`Error writing to ${key} in localStorage`, e);
    }
}

export function addSuccessfulCompilation(code: string) {
    // Enforce a limit for successful compilations
    addExample(SUCCESSFUL_KEY, code, MAX_SUCCESSFUL_EXAMPLES);
}

export function addFailedCompilation(code: string) {
    // No limit for failed compilations
    addExample(FAILED_KEY, code, null);
}

function getRandomSample<T>(arr: T[], count: number): T[] {
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

export function getCompilationExamplesForPrompt(count: number = 2): { successful: string[], failed: string[] } {
    const successful = getStoredExamples(SUCCESSFUL_KEY);
    const failed = getStoredExamples(FAILED_KEY);

    return {
        successful: getRandomSample(successful, count),
        failed: getRandomSample(failed, count)
    };
}
