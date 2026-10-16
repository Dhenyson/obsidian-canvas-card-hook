// Exercises native Canvas creation controls in the isolated development vault.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

(async () => {
  const browser = await chromium.connectOverCDP(process.env.OBSIDIAN_CDP || 'http://127.0.0.1:9239');
  let page, originalLeafId;
  const testPath = 'QA Creation.canvas';
  const checks = [];
  const check = (condition, label) => { if (!condition) throw new Error(label); checks.push(label); };
  const canvasState = () => page.evaluate(() => {
    const c = app.workspace.activeLeaf.view.canvas;
    return { count: c.nodes.size, selected: [...c.selection].map(n => ({ id: n.id, x: n.x, y: n.y, width: n.width, height: n.height, text: n.text, editing: n.isEditing })) };
  });
  try {
    page = browser.contexts()[0].pages().find(p => p.url().startsWith('app://obsidian.md'));
    originalLeafId = await page.evaluate(async testPath => {
      if (app.vault.getName() !== 'Canvas Card Hook Dev') throw new Error('Tests require the isolated development vault.');
      if (app.vault.getAbstractFileByPath(testPath)) throw new Error('Previous QA Creation.canvas exists; inspect before rerunning.');
      const originalLeafId = app.workspace.activeLeaf.id;
      const file = await app.vault.create(testPath, JSON.stringify({ nodes: [
        { id: 'aaaaaaaaaaaaaaaa', type: 'text', x: 0, y: 0, width: 320, height: 200, text: 'Native color reference' }
      ], edges: [] }));
      const leaf = app.workspace.getLeaf('tab');
      await leaf.openFile(file);
      await app.workspace.revealLeaf(leaf);
      app.workspace.setActiveLeaf(leaf, { focus: true });
      app.plugins.plugins['canvas-card-hook'].scan();
      return originalLeafId;
    }, testPath);
    const appearance = await page.evaluate(async () => {
      const c = app.workspace.activeLeaf.view.canvas;
      const plugin = app.plugins.plugins['canvas-card-hook'];
      const native = c.nodes.get('aaaaaaaaaaaaaaaa');
      const hook = plugin.addHook(native);
      const record = plugin.records.get(hook);
      plugin.finishEdit(record);
      hook.moveAndResize({ x: 400, y: 0, width: 320, height: 60 });
      c.setState({ x: 360, y: 100, zoom: 0 });
      native.attach(); native.render(); hook.attach(); hook.render();
      await new Promise(resolve => setTimeout(resolve, 150));
      const root = hook.containerEl.querySelector('.cch-root');
      const button = root.querySelector('.cch-jump');
      const buttonSize = { width: getComputedStyle(button).width, height: getComputedStyle(button).height, icon: getComputedStyle(button.querySelector('svg')).width };
      const backgrounds = [];
      const originalTheme = [...document.body.classList].filter(s => s === 'theme-dark' || s === 'theme-light');
      try {
        for (const theme of ['theme-dark', 'theme-light']) {
          document.body.classList.remove('theme-dark', 'theme-light'); document.body.classList.add(theme);
          for (const color of ['', '1', '2', '3', '4', '5', '6', '#b57bd8']) {
            native.setColor(color); hook.setColor(color); native.render(); hook.render();
            backgrounds.push({ theme, color, native: getComputedStyle(native.contentEl).backgroundColor, hook: getComputedStyle(root).backgroundColor });
          }
        }
      } finally {
        document.body.classList.remove('theme-dark', 'theme-light'); document.body.classList.add(...originalTheme);
        native.setColor(''); hook.setColor(''); native.render(); hook.render();
      }
      hook.setColor('4'); hook.startEditing();
      const editingBackground = { native: getComputedStyle(native.contentEl).backgroundColor, hook: getComputedStyle(root).backgroundColor };
      native.setColor('4'); native.render(); editingBackground.native = getComputedStyle(native.contentEl).backgroundColor;
      plugin.finishEdit(record);
      return { buttonSize, backgrounds, editingBackground, toolbar: c.cardMenuEl.querySelectorAll('.cch-add-hook').length };
    });
    check(appearance.buttonSize.width === '28px' && appearance.buttonSize.height === '28px' && appearance.buttonSize.icon === '16px', 'Compact jump button uses a 28px circle and a 16px icon');
    for (const row of appearance.backgrounds) check(!!row.native && row.native === row.hook, `Hook background matches a native card: ${row.theme}, ${row.color || 'default'}`);
    check(appearance.editingBackground.native === appearance.editingBackground.hook, 'Editing retains the native colored background');
    check(appearance.toolbar === 1, 'Exactly one hook control is added to the native toolbar');

    // Inspect and invoke the real native menu items with a minimal menu collector.
    const menuResult = await page.evaluate(() => {
      const c = app.workspace.activeLeaf.view.canvas;
      const items = [];
      const menu = { addItem(fn) {
        const item = { setTitle(title) { this.title = title; return this; }, setSection() { return this; }, setIcon() { return this; }, onClick(callback) { this.callback = callback; return this; } };
        fn(item); items.push(item); return this;
      }};
      c.showCreationMenu(menu, { x: 920, y: 340 });
      const titles = items.map(i => i.title);
      items.find(i => i.title === 'Add hook').callback();
      const node = [...c.selection][0];
      return { titles, x: node.x, y: node.y, width: node.width, height: node.height, inputs: node.containerEl.querySelectorAll('.cch-root input').length };
    });
    check(menuResult.titles.includes('Add card') && menuResult.titles.includes('Add note from vault') && menuResult.titles.includes('Add media from vault'), 'Creation menu preserves the native card, note, and media actions');
    check(menuResult.titles.filter(t => t === 'Add hook').length === 1, 'Blank-canvas creation menu contains Add hook exactly once');
    check(menuResult.x === 920 && menuResult.y === 340 && menuResult.width === 380 && menuResult.height === 260 && menuResult.inputs === 2, 'Menu creates a hook at the chosen Canvas position and opens the inline editor');
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    const emptyPoint = await page.evaluate(() => {
      const c = app.workspace.activeLeaf.view.canvas;
      c.deselectAll(); c.setState({ x: -1000, y: -1000, zoom: 0 });
      const r = c.wrapperEl.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    const countBeforeMenuClick = (await canvasState()).count;
    await page.mouse.click(emptyPoint.x, emptyPoint.y, { button: 'right' });
    await page.getByText('Add hook', { exact: true }).click();
    const afterMenuClick = await canvasState();
    check(afterMenuClick.count === countBeforeMenuClick + 1 && afterMenuClick.selected[0]?.editing, 'Right-clicking actual empty Canvas space exposes a working Add hook action');
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    const toolbar = page.getByRole('button', { name: 'Drag to add hook', exact: true });
    let before = await canvasState();
    await toolbar.click();
    let after = await canvasState();
    check(after.count === before.count + 1 && after.selected[0]?.editing, 'Clicking the toolbar control creates exactly one editable hook');
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await toolbar.focus();
    before = await canvasState();
    await toolbar.press('Enter');
    after = await canvasState();
    check(after.count === before.count + 1 && after.selected[0]?.editing, 'Keyboard activation creates an editable hook');
    await page.getByRole('button', { name: 'Done', exact: true }).click();

    // Drive a real pointer gesture through the same drag helper used by native cards.
    const bounds = await toolbar.boundingBox();
    const drop = await page.evaluate(() => {
      const c = app.workspace.activeLeaf.view.canvas;
      const r = c.wrapperEl.getBoundingClientRect();
      const x = r.left + r.width * .45, y = r.top + r.height * .35;
      return { x, y, pos: c.posFromEvt({ clientX: x, clientY: y }) };
    });
    before = await canvasState();
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.down();
    await page.mouse.move(drop.x, drop.y, { steps: 12 });
    await page.mouse.up();
    after = await canvasState();
    check(after.count === before.count + 1 && after.selected[0]?.editing, 'Dragging the toolbar control creates exactly one editable hook');
    check(Math.abs(after.selected[0].x + 190 - drop.pos.x) <= 30 && Math.abs(after.selected[0].y + 130 - drop.pos.y) <= 30, 'Dragged hook is placed at the pointer drop position with native snapping');
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    const cleanup = await page.evaluate(async () => {
      const c = app.workspace.activeLeaf.view.canvas;
      c.setReadonly(true);
      const before = c.nodes.size;
      c.cardMenuEl.querySelector('.cch-add-hook').click();
      const blocked = c.nodes.size === before;
      const items = [];
      const menu = { addItem(fn) { const item = { setTitle(t) { this.title = t; return this; }, setSection() { return this; }, setIcon() { return this; }, onClick() { return this; } }; fn(item); items.push(item); return this; } };
      c.showCreationMenu(menu, { x: 0, y: 0 });
      const noReadOnlyAction = !items.some(i => i.title === 'Add hook');
      c.setReadonly(false);
      const old = app.plugins.plugins['canvas-card-hook'];
      await app.plugins.unloadPlugin('canvas-card-hook');
      const noToolbarAfterUnload = !document.querySelector('.cch-add-hook');
      const noRootsAfterUnload = !document.querySelector('.cch-root');
      items.length = 0;
      c.showCreationMenu(menu, { x: 0, y: 0 });
      const restoredCreationMenu = !items.some(i => i.title === 'Add hook');
      await app.plugins.loadPlugin('canvas-card-hook');
      app.plugins.plugins['canvas-card-hook'].scan();
      const toolbarAfterReload = c.cardMenuEl.querySelectorAll('.cch-add-hook').length;
      return { blocked, noReadOnlyAction, noToolbarAfterUnload, noRootsAfterUnload, restoredCreationMenu, released: old.canvases.size === 0, toolbarAfterReload };
    });
    check(cleanup.blocked && cleanup.noReadOnlyAction, 'Read-only Canvas blocks hook creation from both new controls');
    check(cleanup.noToolbarAfterUnload && cleanup.noRootsAfterUnload && cleanup.released, 'Unloading removes hook UI and releases Canvas patches');
    check(cleanup.restoredCreationMenu, 'Unloading restores the original native creation menu');
    check(cleanup.toolbarAfterReload === 1, 'Reloading restores exactly one hook toolbar control');
    const result = { passed: checks.length, checks, date: new Date().toISOString() };
    fs.writeFileSync(path.join(__dirname, '../CREATION-TEST-RESULTS.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result, null, 2));
  } finally {
    if (page && originalLeafId) await page.evaluate(async ({ testPath, originalLeafId }) => {
      for (const leaf of app.workspace.getLeavesOfType('canvas')) if (leaf.view.file?.path === testPath) {
        leaf.view.canvas.setReadonly(false); await leaf.view.save(); leaf.detach();
      }
      const file = app.vault.getAbstractFileByPath(testPath);
      if (file) await app.vault.delete(file);
      const original = app.workspace.getLeafById(originalLeafId);
      if (original) { await app.workspace.revealLeaf(original); app.workspace.setActiveLeaf(original, { focus: true }); }
    }, { testPath, originalLeafId });
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
