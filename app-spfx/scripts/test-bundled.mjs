// Bundles the setup tests (they import without file extensions) and runs them on Node.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'dr-test-'));
const out = join(dir, 'setup.test.cjs');
await build({ entryPoints: ['tests/setup.test.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: out, logLevel: 'warning' });
writeFileSync(join(dir, 'x'), '');
execFileSync(process.execPath, ['--test', out], { stdio: 'inherit' });
