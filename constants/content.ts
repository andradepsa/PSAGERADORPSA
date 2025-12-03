
import { TOPICS_HUMANITIES } from './content_humanities';
import { TOPICS_SCIENCES } from './content_sciences';

export const ALL_TOPICS_BY_DISCIPLINE: Record<string, string[]> = {
    ...TOPICS_HUMANITIES,
    ...TOPICS_SCIENCES
};
