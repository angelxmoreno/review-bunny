import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveConfig } from '../src/config/resolveConfig';
import type { ReviewBunnyConfigInput } from '../src/schemas';

const ENV_KEYS = [
    'REVIEW_BUNNY_RUNNER',
    'REVIEW_BUNNY_PROVIDER',
    'REVIEW_BUNNY_MODEL',
    'REVIEW_BUNNY_GIT_REF_TARGET',
    'REVIEW_BUNNY_REPORT_PATH',
    'REVIEW_BUNNY_TIMEOUT',
    'REVIEW_BUNNY_STAGED',
    'REVIEW_BUNNY_ISSUE_MARKER',
    'REVIEW_BUNNY_PASS_MARKER',
];

describe('resolveConfig', () => {
    let tempDir: string;
    const savedEnv: Record<string, string | undefined> = {};

    beforeEach(() => {
        tempDir = mkdtempSync(join(tmpdir(), 'review-bunny-'));
        for (const key of ENV_KEYS) {
            savedEnv[key] = process.env[key];
            delete process.env[key];
        }
    });

    afterEach(() => {
        rmSync(tempDir, { recursive: true, force: true });
        for (const key of ENV_KEYS) {
            if (savedEnv[key] === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = savedEnv[key];
            }
        }
    });

    describe('defaults', () => {
        it('returns built-in defaults when no config sources exist', async () => {
            const config = await resolveConfig({ cwd: tempDir });

            expect(config).toEqual({
                runner: 'claude',
                provider: 'ollama',
                model: 'kimi-k2.6:cloud',
                checkOnlyStaged: false,
                gitRefTarget: undefined,
                reportPath: './.claude/last-review.md',
                timeout: 300,
                issueMarker: 'ISSUES FOUND',
                passMarker: 'LGTM',
            });
        });

        it('resolves reportPath relative to cwd by default', async () => {
            const config = await resolveConfig({ cwd: tempDir });

            expect(config.reportPath).toBe('./.claude/last-review.md');
        });
    });

    describe('precedence', () => {
        it('loads .rbunnyrc.json when present', async () => {
            writeFileSync(join(tempDir, '.rbunnyrc.json'), JSON.stringify({ model: 'custom-model', timeout: 600 }));

            const config = await resolveConfig({ cwd: tempDir });

            expect(config.model).toBe('custom-model');
            expect(config.timeout).toBe(600);
            expect(config.runner).toBe('claude');
            expect(config.provider).toBe('ollama');
        });

        it('applies environment variable overrides', async () => {
            process.env.REVIEW_BUNNY_MODEL = 'env-model';
            process.env.REVIEW_BUNNY_TIMEOUT = '120';

            const config = await resolveConfig({ cwd: tempDir });

            expect(config.model).toBe('env-model');
            expect(config.timeout).toBe(120);
        });

        it('prefers CLI overrides over env and rc file', async () => {
            writeFileSync(join(tempDir, '.rbunnyrc.json'), JSON.stringify({ model: 'rc-model' }));
            process.env.REVIEW_BUNNY_MODEL = 'env-model';

            const cliOverrides: ReviewBunnyConfigInput = { model: 'cli-model' };
            const config = await resolveConfig({ cwd: tempDir, cliOverrides });

            expect(config.model).toBe('cli-model');
        });
    });

    describe('runner and provider switching', () => {
        it('switches to codex runner via .rbunnyrc.json', async () => {
            writeFileSync(
                join(tempDir, '.rbunnyrc.json'),
                JSON.stringify({ runner: 'codex', provider: 'openai', model: 'gpt-codex' })
            );

            const config = await resolveConfig({ cwd: tempDir });

            expect(config.runner).toBe('codex');
            expect(config.provider).toBe('openai');
            expect(config.model).toBe('gpt-codex');
        });

        it('switches runner and provider via env vars', async () => {
            process.env.REVIEW_BUNNY_RUNNER = 'codex';
            process.env.REVIEW_BUNNY_PROVIDER = 'ollama';
            process.env.REVIEW_BUNNY_MODEL = 'kimi-k2.6:cloud';

            const config = await resolveConfig({ cwd: tempDir });

            expect(config.runner).toBe('codex');
            expect(config.provider).toBe('ollama');
            expect(config.model).toBe('kimi-k2.6:cloud');
        });
    });

    describe('validation errors', () => {
        it('throws a clear error when .rbunnyrc.json contains invalid JSON', async () => {
            writeFileSync(join(tempDir, '.rbunnyrc.json'), '{ not json');

            await expect(resolveConfig({ cwd: tempDir })).rejects.toThrow('.rbunnyrc.json:');
        });

        it('throws a clear error when timeout is invalid', async () => {
            process.env.REVIEW_BUNNY_TIMEOUT = '-5';

            await expect(resolveConfig({ cwd: tempDir })).rejects.toThrow('environment variable:');
        });

        it('throws a clear error when model is empty', async () => {
            writeFileSync(join(tempDir, '.rbunnyrc.json'), JSON.stringify({ model: '' }));

            await expect(resolveConfig({ cwd: tempDir })).rejects.toThrow('.rbunnyrc.json:');
        });

        it('throws a clear error for invalid runner/provider combination', async () => {
            writeFileSync(join(tempDir, '.rbunnyrc.json'), JSON.stringify({ runner: 'claude', provider: 'openai' }));

            await expect(resolveConfig({ cwd: tempDir })).rejects.toThrow(
                'runner "claude" does not support provider "openai"'
            );
        });
    });
});
