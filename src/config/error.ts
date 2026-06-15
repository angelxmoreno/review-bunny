import { ZodError } from 'zod';

export class ReviewBunnyConfigError extends Error {
    constructor(
        public readonly source: string,
        public readonly rawError: unknown
    ) {
        let message: string = `${source}: ${rawError instanceof Error ? rawError.message : String(rawError)}`;
        if (rawError instanceof ZodError) {
            const issues = rawError.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
            message = `${source}: ${issues}`;
        }
        super(message);
        this.name = 'ReviewBunnyConfigError';
    }
}
