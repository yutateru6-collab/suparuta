import { writeFileSync, readFileSync } from 'node:fs';
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
writeFileSync('dist/build-info.json', JSON.stringify({ version, commit: process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA || 'local', builtAt: new Date().toISOString() }, null, 2) + '\n');
