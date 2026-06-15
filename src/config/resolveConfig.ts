import {
    type ReviewBunnyConfig,
    type ReviewBunnyConfigInput,
    ReviewBunnyConfigSchemaWithRunnerCheck,
} from '../schemas';
import { ReviewBunnyConfigError } from './error';
import { loadEnv } from './loadEnv';
import { loadRcFile } from './loadRcFile';

export const resolveConfig = async (options?: {
    cwd?: string;
    cliOverrides?: Partial<ReviewBunnyConfigInput>;
}): Promise<ReviewBunnyConfig> => {
    const cwd = options?.cwd ?? process.cwd();
    const rc = await loadRcFile(cwd);
    const env = loadEnv();

    try {
        return ReviewBunnyConfigSchemaWithRunnerCheck.parse({
            ...rc,
            ...env,
            ...options?.cliOverrides,
        });
    } catch (error) {
        throw new ReviewBunnyConfigError('configuration', error);
    }
};
