import { mkdir, copyFile, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'www');
const files = ['index.html', 'theme.css', 'styles.css', 'app.js', 'domain.js', 'views.js', 'icons.js', 'platform.js', 'manifest.webmanifest', 'service-worker.js'];
await rm(output, { recursive: true, force: true });
await mkdir(path.join(output, 'icons'), { recursive: true });
for (const icon of await readdir(path.join(root, 'icons'))) files.push(`icons/${icon}`);
const hash = createHash('sha256');
for (const file of files) {
  const content = await readFile(path.join(root, file));
  hash.update(content);
  await copyFile(path.join(root, file), path.join(output, file));
}
const version = hash.digest('hex').slice(0, 12);
const sw = (await readFile(path.join(output, 'service-worker.js'), 'utf8')).replace('povtor-v1-dev', `povtor-v1-${version}`);
await writeFile(path.join(output, 'service-worker.js'), sw);
console.log(`Built ${files.length} local assets → www/ (cache ${version})`);
