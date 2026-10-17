// Capture the real plugin in a disposable Obsidian vault, never a personal vault.
// Run images first, then animation. Supply PLAYWRIGHT_PATH as for integration.cjs.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const { writeHook, makeLink } = require('../dist/core.cjs');
const version = require('../manifest.json').version;
const output = path.join(__dirname, '../docs/images', version);
const frames = path.join(__dirname, '../artifacts/documentation-frames');
const text = (id, x, y, width, height, value, color) => ({ id, type: 'text', x, y, width, height, text: value, ...(color ? { color } : {}) });
const group = (id, x, y, width, height, label, color) => ({ id, type: 'group', x, y, width, height, label, color });
const id = n => n.toString(16).padStart(16, '0');
const link = (file, n) => makeLink('Canvas Card Hook Dev', file + '.canvas', id(n));
const hook = (n, x, y, title, file, destination, color) => text(id(n), x, y, 360, 70, writeHook({ title, target: link(file, destination) }), color);
const project = { nodes: [
  text(id(1), 0, 0, 1120, 120, '# Canvas Card Hook\n\nA small example workspace · Follow the arrows. Take a shortcut.'),
  group(id(2), 0, 180, 420, 480, '01 · SHORTCUTS', '6'),
  group(id(3), 490, 180, 630, 480, '02 · PROJECT FLOW', '5'),
  text(id(4), 30, 210, 360, 124, '## Find your next destination\n\nClick a hook arrow to focus a card.'),
  hook(5, 30, 366, 'Jump to roadmap', 'Project map', 20, '6'),
  hook(6, 30, 466, 'Read decisions', 'Project map', 21, '5'),
  hook(7, 30, 566, 'Explore design', 'Design', 31, '4'),
  text(id(8), 525, 220, 220, 160, '## Discover\n\nCollect ideas.\nUnderstand the problem.', '5'),
  text(id(9), 835, 220, 250, 160, '## Plan\n\nChoose a direction.\nSet the next milestone.', '5'),
  text(id(10), 525, 465, 250, 160, '## Less searching\n\nHooks connect distant cards without long lines across your board.'),
  text(id(11), 835, 465, 250, 160, '## Build\n\nMake it real.\nLearn and improve.', '4'),
  group(id(19), 2250, 30, 920, 650, '03 · ROADMAP', '6'),
  text(id(20), 2290, 80, 840, 340, '# Roadmap\n\n## The next step, clearly in view\n\n1. Explore the problem\n2. Sketch a focused solution\n3. Build, learn, and improve\n\nA hook brings you straight to the card you need.', '6'),
  hook(22, 2290, 490, 'Back to shortcuts', 'Project map', 4, '6'),
  text(id(21), 2300, 1100, 800, 360, '# Decisions\n\nKeep the context close.\n\n- One clear next step\n- Focused spaces for each project\n- Hooks connect the details', '5')
], edges: [
  { id: id(101), fromNode: id(8), fromSide: 'right', toNode: id(9), toSide: 'left' },
  { id: id(102), fromNode: id(9), fromSide: 'bottom', toNode: id(11), toSide: 'top', label: 'create' }
] };
const design = { nodes: [
  group(id(30), 0, 0, 1120, 520, 'DESIGN STUDIO · ANOTHER CANVAS', '4'),
  text(id(31), 40, 50, 540, 400, '# Design principles\n\nA different Canvas. The same vault.\n\n## Make the next step obvious\n\nUse clear titles and purposeful connections.\n\n## Keep the big picture readable\n\nCreate focused spaces and connect them with hooks.', '4'),
  text(id(32), 675, 50, 395, 175, '## Visual language\n\nCalm colors. Clear hierarchy.\nRoom for ideas to breathe.', '5'),
  text(id(33), 675, 310, 395, 145, '## Connected thinking\n\nJump to a precise card, even across Canvas files.', '6')
], edges: [
  { id: id(103), fromNode: id(31), fromSide: 'right', toNode: id(32), toSide: 'left' },
  { id: id(104), fromNode: id(32), fromSide: 'bottom', toNode: id(33), toSide: 'top' }
] };

(async () => {
  const browser = await chromium.connectOverCDP(process.env.OBSIDIAN_CDP || 'http://127.0.0.1:9239');
  try {
    const page = browser.contexts()[0].pages().find(p => p.url().startsWith('app://obsidian.md'));
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.waitForFunction(() => window.app?.plugins?.plugins['canvas-card-hook']);
    await page.evaluate(async ({ project, design }) => {
      if (app.vault.getName() !== 'Canvas Card Hook Dev') throw Error('Documentation requires the disposable development vault.');
      document.body.classList.remove('theme-light'); document.body.classList.add('theme-dark');
      app.workspace.leftSplit.collapse(); app.workspace.rightSplit.collapse();
      for (const [name, data] of [['Project map.canvas', project], ['Design.canvas', design]]) {
        const file = app.vault.getAbstractFileByPath(name);
        if (file) await app.vault.modify(file, JSON.stringify(data));
        else await app.vault.create(name, JSON.stringify(data));
      }
      const leaf = app.workspace.getLeaf(false);
      for (const other of [...app.workspace.getLeavesOfType('canvas'), ...app.workspace.getLeavesOfType('empty')]) if (other !== leaf) other.detach();
      await leaf.openFile(app.vault.getAbstractFileByPath('Project map.canvas'));
      await app.workspace.revealLeaf(leaf); app.workspace.setActiveLeaf(leaf, { focus: true });
      app.plugins.plugins['canvas-card-hook'].scan();
    }, { project, design });
    const overview = async () => {
      await page.evaluate(async () => {
        const leaf = app.workspace.getLeavesOfType('canvas').find(l => l.view.file?.path === 'Project map.canvas') || app.workspace.getLeaf('tab');
        await leaf.openFile(app.vault.getAbstractFileByPath('Project map.canvas'));
        await app.workspace.revealLeaf(leaf); app.workspace.setActiveLeaf(leaf, { focus: true });
        const c = leaf.view.canvas; c.setState({ x: 560, y: 330, zoom: -0.22 }); c.deselectAll();
        for (const n of c.nodes.values()) { n.attach(); n.render(); }
        app.plugins.plugins['canvas-card-hook'].scan();
      });
      await page.mouse.move(80, 90); await page.waitForTimeout(350);
    };
    await overview();
    fs.mkdirSync(output, { recursive: true });
    if (process.argv[2] !== 'animation') {
      await page.screenshot({ path: path.join(output, 'overview.jpg'), type: 'jpeg', quality: 94 });
      await page.evaluate(() => {
        const c = app.workspace.activeLeaf.view.canvas;
        for (const id of ['0000000000000006', '0000000000000007']) {
          const n = c.nodes.get(id); n.moveAndResize({ x: -2000, y: n.y, width: n.width, height: n.height });
        }
        const n = c.nodes.get('0000000000000005'); n.startEditing();
        c.setState({ x: 260, y: 500, zoom: 0.18 });
        const input = n.containerEl.querySelector('input'); input.setSelectionRange(input.value.length, input.value.length);
      });
      await page.waitForTimeout(350); await page.mouse.move(80, 90);
      await page.screenshot({ path: path.join(output, 'editor.jpg'), type: 'jpeg', quality: 94 });
      await page.getByRole('button', { name: 'Done', exact: true }).click();
      await page.evaluate(() => {
        const c = app.workspace.activeLeaf.view.canvas;
        for (const id of ['0000000000000006', '0000000000000007']) {
          const n = c.nodes.get(id); n.moveAndResize({ x: 30, y: n.y, width: n.width, height: n.height });
        }
      });
      await page.evaluate(async () => {
        const leaf = app.workspace.getLeaf('tab');
        await leaf.openFile(app.vault.getAbstractFileByPath('Design.canvas'));
        await app.workspace.revealLeaf(leaf); app.workspace.setActiveLeaf(leaf, { focus: true });
        leaf.view.canvas.setState({ x: 560, y: 255, zoom: -0.22 }); leaf.view.canvas.deselectAll();
      });
      await page.mouse.move(80, 90); await page.waitForTimeout(350);
      await page.screenshot({ path: path.join(output, 'another-canvas.jpg'), type: 'jpeg', quality: 94 });
      console.log('Captured overview, editor, and second Canvas screenshots in ' + output);
      return;
    }
    // Keep the cursor visible in screenshots while dispatching real mouse clicks.
    await page.evaluate(() => {
      document.querySelector('#cch-demo-pointer')?.remove();
      const pointer = document.createElement('div'); pointer.id = 'cch-demo-pointer';
      pointer.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;width:28px;height:34px;filter:drop-shadow(0 2px 2px #0008)';
      pointer.innerHTML = '<svg width="28" height="34" viewBox="0 0 28 34"><path d="M3 2 L3 26 L9 20 L14 31 L19 29 L14 18 L23 18 Z" fill="white" stroke="#171717" stroke-width="2" stroke-linejoin="round"/></svg>';
      document.body.append(pointer);
      const ring = document.createElement('div'); ring.id = 'cch-demo-click';
      ring.style.cssText = 'position:fixed;z-index:2147483646;pointer-events:none;width:44px;height:44px;border:3px solid #fff;border-radius:50%;background:#ffffff30;box-shadow:0 0 0 4px #0005;display:none;transform:translate(-50%,-50%)';
      document.body.append(ring);
    });
    fs.mkdirSync(frames, { recursive: true });
    let frame = 0; const timeline = [];
    const capture = async duration => {
      const file = `${String(frame++).padStart(4, '0')}.png`;
      await page.screenshot({ path: path.join(frames, file) }); timeline.push({ file, duration });
    };
    let point = { x: 360, y: 700 };
    const move = async (x, y, steps = 16) => {
      const from = point;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps, ease = t * t * (3 - 2 * t);
        point = { x: from.x + (x - from.x) * ease, y: from.y + (y - from.y) * ease };
        await page.mouse.move(point.x, point.y);
        await page.evaluate(({ x, y }) => { document.querySelector('#cch-demo-pointer').style.transform = `translate(${x}px,${y}px)`; }, point);
        await capture(60);
      }
    };
    const clickHook = async n => {
      // Obsidian does not expose data-node-id consistently; use the actual node.
      const rect = await page.evaluate(n => {
        const b = app.workspace.activeLeaf.view.canvas.nodes.get(n).containerEl.querySelector('.cch-jump').getBoundingClientRect();
        return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
      }, id(n));
      await move(rect.x, rect.y); await capture(450);
      await page.evaluate(({ x, y }) => { const r = document.querySelector('#cch-demo-click'); r.style.left = x + 'px'; r.style.top = y + 'px'; r.style.display = 'block'; }, rect);
      await capture(120);
      await page.mouse.click(rect.x, rect.y);
      for (let i = 0; i < 12; i++) {
        if (i === 2) await page.evaluate(() => { document.querySelector('#cch-demo-click').style.display = 'none'; });
        await capture(70);
      }
      await capture(1600);
    };
    await move(point.x, point.y, 1); await capture(1000);
    await clickHook(5);
    await page.waitForFunction(() => app.workspace.activeLeaf.view.canvas.selection.has(app.workspace.activeLeaf.view.canvas.nodes.get('0000000000000014')));
    await clickHook(22);
    await clickHook(7);
    await page.waitForFunction(() => app.workspace.activeLeaf.view.file?.path === 'Design.canvas');
    await move(1080, 695, 10); await capture(1800);
    await overview(); await capture(700);
    fs.writeFileSync(path.join(frames, 'timeline.json'), JSON.stringify({ width: 1200, height: 800, frames: timeline }, null, 2));
    console.log(`Captured ${frame} frames with actual same-Canvas, return, and cross-Canvas clicks.`);
    await page.evaluate(() => { document.querySelector('#cch-demo-pointer')?.remove(); document.querySelector('#cch-demo-click')?.remove(); });
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
