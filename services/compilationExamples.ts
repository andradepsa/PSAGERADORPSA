const MAX_SUCCESSFUL_EXAMPLES = 100;
const SUCCESSFUL_KEY = 'successful_latex_compilations';
const FAILED_KEY = 'failed_latex_compilations';

function getStoredExamples(key: string): string[] {
    try {
        const stored = localStorage.getItem(key);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.error(`Error reading ${key} from localStorage`, e);
    }
    return [];
}

/**
 * Adds a new example to localStorage.
 * @param key The localStorage key.
 * @param code The LaTeX code to store.
 * @param limit An optional limit on the number of examples. If null, no limit is applied.
 */
function addExample(key: string, code: string, limit: number | null) {
    try {
        const examples = getStoredExamples(key);
        // Avoid adding duplicates
        if (examples.includes(code)) return;

        examples.push(code);

        // Only enforce the limit if it's provided and not null
        if (limit !== null) {
            while (examples.length > limit) {
                examples.shift(); // FIFO
            }
        }
        
        localStorage.setItem(key, JSON.stringify(examples));
    } catch (e) {
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
