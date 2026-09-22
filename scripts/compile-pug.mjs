import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pug from 'pug';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'src', 'index.pug');
const generated = path.join(root, 'gen');
const output = path.join(generated, 'index.html');
const viewsSource = path.join(root, 'src', 'views.pug');
const viewsOutput = path.join(generated, 'generated-templates.ts');

await mkdir(generated, { recursive: true });
await writeFile(output, pug.renderFile(source, { pretty: true }), 'utf8');

const compiledViews = pug.compileFileClient(viewsSource, {
	name: 'renderView',
	inlineRuntimeFunctions: true,
	compileDebug: false,
});
await writeFile(viewsOutput, `// @ts-nocheck\n${compiledViews}\nexport default renderView;\n`, 'utf8');