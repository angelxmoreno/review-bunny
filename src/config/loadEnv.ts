import { type ReviewBunnyConfigInput, ReviewBunnyConfigSchema } from '../schemas';
import { ReviewBunnyConfigError } from './error';

const ENV_STRING_OVERRIDES: Record<string, string> = {
    REVIEW_BUNNY_RUNNER: 'runner',
    REVIEW_BUNNY_PROVIDER: 'provider',
    REVIEW_BUNNY_MODEL: 'model',
    REVIEW_BUNNY_GIT_REF_TARGET: 'gitRefTarget',
    REVIEW_BUNNY_REPORT_PATH: 'reportPath',
    REVIEW_BUNNY_ISSUE_MARKER: 'issueMarker',
    REVIEW_BUNNY_PASS_MARKER: 'passMarker',
    REVIEW_BUNNY_STAGED: 'checkOnlyStaged',
    REVIEW_BUNNY_TIMEOUT: 'timeout',
};

export const loadEnv = (): Partial<ReviewBunnyConfigInput> => {
    const env = Bun.env;
    const partialConfig: Record<string, string> = {};

    for (const [envKey, configKey] of Object.entries(ENV_STRING_OVERRIDES)) {
        const value = env[envKey];
        if (value) partialConfig[configKey] = value;
    }

    try {
        ReviewBunnyConfigSchema.parse(partialConfig);
        return partialConfig;
    } catch (error) {
        throw new ReviewBunnyConfigError('environment variable', error);
    }
};
