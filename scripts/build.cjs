const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const core = fs.readFileSync(path.join(root, 'src/core.js'), 'utf8');
const main = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8');
const bundle = main.replace('require("./core")', () => `(() => { const module = { exports: {} };\n${core}\nreturn module.exports; })()`);
const out = path.join(root, 'dist/canvas-card-hook');
fs.mkdirSync(out, { recursive: true });
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
