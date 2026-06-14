import { z } from 'zod';
import { ANTHROPIC, CLAUDE, CODEX, GOOGLE, OLLAMA, OPENAI } from './constants';

const RunnersSchema = z.enum([CLAUDE, CODEX]);
const ProvidersSchema = z.enum([OLLAMA, ANTHROPIC, OPENAI, GOOGLE]);

// fallow-ignore-next-line unused-type
export type Runner = z.infer<typeof RunnersSchema>;
// fallow-ignore-next-line unused-type
export type Provider = z.infer<typeof ProvidersSchema>;

const VALID_RUNNER_PROVIDERS: Record<Runner, Provider[]> = {
    [CLAUDE]: [OLLAMA, ANTHROPIC],
    [CODEX]: [OLLAMA, OPENAI],
};

const isValidRunnerProvider = (runner: Runner, provider: Provider): boolean =>
    VALID_RUNNER_PROVIDERS[runner].includes(provider);

export const ReviewBunnyConfigSchema = z.object({
    runner: RunnersSchema.default(CLAUDE),
    provider: ProvidersSchema.default(OLLAMA),
    model: z.string().min(1).default('kimi-k2.6:cloud'),
    checkOnlyStaged: z.coerce.boolean().default(false),
    gitRefTarget: z.string().optional(),
    reportPath: z.string().min(1).default('./.claude/last-review.md'),
    timeout: z.coerce.number().int().positive().default(300),
    issueMarker: z.string().min(1).default('ISSUES FOUND'),
    passMarker: z.string().min(1).default('LGTM'),
});

export const ReviewBunnyConfigSchemaWithRunnerCheck = ReviewBunnyConfigSchema.superRefine((config, ctx) => {
    if (!isValidRunnerProvider(config.runner, config.provider)) {
        ctx.addIssue({
            code: 'custom',
            message: `runner "${config.runner}" does not support provider "${config.provider}". Valid providers: ${VALID_RUNNER_PROVIDERS[config.runner].join(', ')}`,
            path: ['provider'],
        });
    }
});

export type ReviewBunnyConfigInput = z.input<typeof ReviewBunnyConfigSchema>;
export type ReviewBunnyConfig = z.infer<typeof ReviewBunnyConfigSchema>;
