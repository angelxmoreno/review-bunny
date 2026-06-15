import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { type ReviewBunnyConfigInput, ReviewBunnyConfigSchema } from '../schemas';
import { ReviewBunnyConfigError } from './error';

export const loadRcFile = async (cwd: string): Promise<Partial<ReviewBunnyConfigInput>> => {
    const path = resolve(cwd, '.rbunnyrc.json');
    try {
        const content = await readFile(path, 'utf-8');
        const jsonObj = JSON.parse(content);
        ReviewBunnyConfigSchema.parse(jsonObj);
        return jsonObj;
    } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
            return {};
        }
        throw new ReviewBunnyConfigError('.rbunnyrc.json', error);
    }
};
