import { readdirSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const toolkit = fileURLToPath(new URL('../', import.meta.url));
export const repository = resolve(toolkit, '..');
const slash = p => p.replaceAll('\\', '/');
function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const p = resolve(directory, entry.name);
    return entry.isDirectory() ? walk(p) : /\.test\.tsx?$/.test(p) ? [p] : [];
  });
}
export function categoryFor(project, file) {
  if (project === 'backend') {
    return /\.integration\.test\.ts$/.test(file)
      || /\/(redisRuntime|dashboard\.routes)\.test\.ts$/.test(file)
      ? 'integration' : 'unit';
  }
  return file.endsWith('.tsx') ? 'ui' : 'unit';
}
export function inventory() {
  return ['backend', 'web', 'mobile'].flatMap(project => walk(resolve(repository, project, 'src'))
    .map(p => {
      const file = slash(relative(repository, p));
      return { project, file, category: categoryFor(project, file) };
    })).sort((a, b) => a.file.localeCompare(b.file));
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const files = inventory();
  writeFileSync(resolve(toolkit, 'tests/manifest.json'), JSON.stringify({
    description: 'Generated source inventory. Integration includes HTTP-router and Redis integration. TSX tests are component/UI tests, not live browser E2E.',
    files,
  }, null, 2) + '\n');
  for (const category of ['unit', 'integration', 'ui']) {
    console.log(`${category}: ${files.filter(f => f.category === category).length} files`);
  }
}
