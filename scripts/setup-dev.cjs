const fs = require('node:fs');
const path = require('node:path');
const { makeLink, writeHook } = require('../src/core');
const vault = path.resolve(process.argv[2]);
const config = path.join(vault, '.obsidian');
fs.mkdirSync(config, { recursive: true });
const write = (name, data) => { const file = path.join(vault, name); if (!fs.existsSync(file)) fs.writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data, null, 2)); };
write('.obsidian/community-plugins.json', ['canvas-card-hook']);
write('.obsidian/core-plugins.json', ['file-explorer', 'global-search', 'switcher', 'backlink', 'outgoing-link', 'canvas', 'command-palette']);
write('.obsidian/app.json', { alwaysUpdateLinks: true, showUnsupportedFiles: true });
write('.obsidian/appearance.json', { theme: 'obsidian' });
const name = path.basename(vault);
const start = '1111111111111111', destination = '2222222222222222', hook = '3333333333333333';
write('Hook Playground.canvas', { nodes: [
  { id: start, type: 'text', x: 0, y: 0, width: 420, height: 260, color: '4', text: '# Start here\n\nThe hook on the right leads to a distant destination.\n\nClick its arrow to try the native zoom.\n\nRight-click any card for **Copy card link** and **Add hook**.' },
  { id: hook, type: 'text', x: 540, y: 0, width: 380, height: 260, color: '5', text: writeHook({ title: 'Go to destination', target: makeLink(name, 'Hook Playground.canvas', destination) }) },
  { id: destination, type: 'text', x: 2600, y: 300, width: 460, height: 300, color: '6', text: '# You arrived!\n\nThis is a regular Canvas card.\n\nCopy this card with **Ctrl+C**.\n\nPaste on the Canvas to duplicate it, or paste into a hook\'s **Card link or ID** input to link to it.' },
  { id: '4444444444444444', type: 'text', x: 3180, y: 320, width: 380, height: 260, color: '4', text: writeHook({ title: 'Back to start', target: makeLink(name, 'Hook Playground.canvas', start) }) }
], edges: [] });
write('Another Canvas.canvas', { nodes: [{ id: '5555555555555555', type: 'text', x: 0, y: 0, width: 440, height: 260, text: '# Cross-canvas destination\n\nCopy this card link and use it in a hook in Hook Playground. The hook opens this Canvas and focuses this card.' }], edges: [] });
write('START HERE.md', '# Canvas Card Hook — local playground\n\nOpen [[Hook Playground.canvas]] and click the arrow in **Go to destination**.\n\n## Create your own hook\n1. Right-click the destination card and choose **Copy card link**, or select it and press **Ctrl+C**.\n2. Right-click another card and choose **Add hook**.\n3. Enter a title and paste into **Card link or ID**.\n4. Press **Enter**, click **Done**, or click outside the card.\n5. Click the arrow to jump. Double-click the hook body or use **Edit** to change it.\n\n## Verify native behavior\n- Ctrl+C / Ctrl+V on the Canvas duplicates a selected card.\n- Ctrl+V inside the hook target field pastes the reference instead.\n- Move, resize, recolor, connect, undo and redo hooks as ordinary cards.\n- Close and reopen the Canvas; hooks keep their destinations.\n- Link to a card in [[Another Canvas.canvas]] to test navigation between canvases.\n\nThis vault is separate from Brain and contains no personal notes.\n');
console.log(vault);
