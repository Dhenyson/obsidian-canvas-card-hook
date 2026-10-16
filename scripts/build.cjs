const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const ts = require('typescript');
const compile = name => ts.transpileModule(fs.readFileSync(path.join(root, `src/${name}.ts`), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, newLine: ts.NewLineKind.LineFeed }
}).outputText;
const core = compile('core');
const canvas = compile('canvas');
const main = compile('main');
const inline = code => `(() => { const exports = {};\n${code}\nreturn exports; })()`;
const bundle = 'module.exports = (() => {\nconst exports = {};\n' + main
  .replace('require("./core")', () => inline(core))
  .replace('require("./canvas")', () => inline(canvas)) + '\nreturn exports.default;\n})();\n';
const out = path.join(root, 'dist/canvas-card-hook');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(root, 'dist/core.cjs'), core);
fs.writeFileSync(path.join(out, 'main.js'), bundle);
fs.writeFileSync(path.join(root, 'main.js'), bundle);
for (const name of ['manifest.json', 'styles.css']) fs.copyFileSync(path.join(root, name), path.join(out, name));
console.log(`Built ${out}`);
if (process.argv[2]) {
  const vault = path.resolve(process.argv[2]);
  if (!fs.existsSync(path.join(vault, '.obsidian'))) throw new Error('Destination is not an initialized vault.');
  const destination = path.join(vault, '.obsidian/plugins/canvas-card-hook');
  fs.mkdirSync(destination, { recursive: true });
  for (const name of ['main.js', 'manifest.json', 'styles.css']) fs.copyFileSync(path.join(out, name), path.join(destination, name));
  console.log(`Installed ${destination}`);
}
