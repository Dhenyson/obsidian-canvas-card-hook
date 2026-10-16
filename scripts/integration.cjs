// Runs against a disposable local Obsidian development profile, never a personal vault.
const fs = require('node:fs');
const path = require('node:path');
const playwrightPath = process.env.PLAYWRIGHT_PATH || 'playwright';
const { chromium } = require(playwrightPath);
(async () => {
  const browser = await chromium.connectOverCDP(process.env.OBSIDIAN_CDP || 'http://127.0.0.1:9239');
  try {
    const page = browser.contexts()[0].pages().find(page => page.url().startsWith('app://obsidian.md'));
    await page.waitForFunction(() => window.app?.plugins?.plugins['canvas-card-hook']);
    const result = await page.evaluate(async () => {
      if (app.vault.getName() !== 'Canvas Card Hook Dev') throw new Error('Tests require the isolated development vault.');
      const results = [];
      const check = (condition, label) => { if (!condition) throw new Error(label); results.push(label); };
      const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
      const id = 'aaaaaaaaaaaaaaaa', targetID = 'bbbbbbbbbbbbbbbb';
      const testPath = 'QA Integration.canvas';
      const existing = app.vault.getAbstractFileByPath(testPath);
      if (existing) throw new Error('Remove the previous QA Integration.canvas before rerunning.');
      const file = await app.vault.create(testPath, JSON.stringify({ nodes: [
        { id, type: 'text', x: 0, y: 0, width: 400, height: 280, text: 'Source card' },
        { id: targetID, type: 'text', x: 2400, y: 300, width: 400, height: 280, text: 'Destination card' }
      ], edges: [] }));
      let leaf = app.workspace.getLeaf('tab');
      try {
        await leaf.openFile(file);
        const c = leaf.view.canvas;
        const plugin = app.plugins.plugins['canvas-card-hook'];
        plugin.scan();
        c.selectOnly(c.nodes.get(targetID)); c.wrapperEl.focus();
        const clipboard = new DataTransfer();
        const copy = new ClipboardEvent('copy', { bubbles: true, cancelable: true, clipboardData: clipboard });
        copy.isRelayed = true;
        c.wrapperEl.dispatchEvent(copy);
        check(!!clipboard.getData('obsidian/canvas'), 'Copy preserves the native Canvas duplication payload');
        check(clipboard.getData('text/plain').includes(`node=${targetID}`), 'Copy appends the original card reference');
        const paste = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: clipboard });
        c.handlePaste(paste);
        check(c.nodes.size === 3, 'Native paste duplicates the selected card');
        const duplicate = [...c.selection][0];
        check(duplicate.id !== targetID && duplicate.text === 'Destination card', 'Duplicate has a fresh ID and retains its native text');
        c.removeNode(duplicate); c.requestSave();
        plugin.addHook(c.nodes.get(id));
        const hook = [...c.selection][0];
        let root = hook.containerEl.querySelector('.cch-root');
        check(root?.querySelectorAll('input').length === 2, 'Add hook opens exactly two inline inputs');
        const [title, target] = root.querySelectorAll('input');
        title.value = 'Test destination'; title.dispatchEvent(new Event('input', { bubbles: true }));
        target.focus();
        target.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: clipboard }));
        check(target.value.includes(`node=${targetID}`), 'Pasting a copied card into the hook stores its original reference');
        check(c.nodes.size === 3, 'Pasting into the hook field does not create another Canvas card');
        root.querySelector('button').click();
        check(!root.querySelector('input') && root.textContent === 'Test destination', 'Finishing editing leaves only the title and icon');
        check(!hook.child?.editMode && !hook.isEditing, 'Hook preview leaves the native Markdown editor closed');
        const nativeZoom = c.zoomToSelection;
        let zoomCalls = 0;
        c.zoomToSelection = function() { zoomCalls++; return nativeZoom.apply(this, arguments); };
        try { await plugin.follow(target.value, c); } finally { c.zoomToSelection = nativeZoom; }
        check(zoomCalls === 1 && c.selection.has(c.nodes.get(targetID)), 'Following a hook calls native zoom to selection on the target');
        check(c.tx > 2000, 'Native zoom centers the distant destination');
        hook.startEditing();
        check(hook.isEditing && hook.containerEl.querySelectorAll('input').length === 2, 'Native Edit reopens the inline hook form');
        const record = plugin.records.get(hook); plugin.finishEdit(record);
        hook.moveAndResize({ x: hook.x, y: hook.y, width: 320, height: 60 });
        hook.attach(); hook.render(); c.setState({ x: hook.x + 160, y: hook.y + 30, zoom: 0 });
        await wait(100);
        const cardRect = hook.containerEl.getBoundingClientRect();
        const buttonRect = hook.containerEl.querySelector('.cch-jump').getBoundingClientRect();
        const iconRect = hook.containerEl.querySelector('.cch-jump svg').getBoundingClientRect();
        check(cardRect.height > 0 && Math.abs((buttonRect.top + buttonRect.height / 2) - (cardRect.top + cardRect.height / 2)) < 1, 'The jump button stays vertically centered in a 60px-high card');
        check(Math.abs((iconRect.top + iconRect.height / 2) - (buttonRect.top + buttonRect.height / 2)) < 1, 'The arrow icon is centered inside its button');
        hook.startEditing();
        check(hook.width === 380 && hook.height === 260, 'Editing expands a compact hook to the original comfortable editor size');
        check(hook.getData().width === 320 && hook.getData().height === 60, 'Serialized data retains the compact preview size during editing');
        check(record.root.scrollHeight <= record.root.clientHeight + 1, 'The default editor shows the two inputs without vertical scrolling');
        hook.startEditing();
        check(record.previewSize.width === 320 && record.previewSize.height === 60, 'Repeated Edit does not overwrite the saved preview dimensions');
        c.requestSave(); await leaf.view.save();
        const duringEdit = JSON.parse(await app.vault.read(file)).nodes.find(node => node.id === hook.id);
        check(duringEdit.width === 320 && duringEdit.height === 60, 'Saving during editing never persists the temporary expansion');
        record.root.querySelector('button').click();
        check(hook.width === 320 && hook.height === 60, 'Done restores the exact user-defined preview size');
        for (const key of ['Enter', 'Escape']) {
          hook.startEditing();
          record.root.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
          check(hook.width === 320 && hook.height === 60 && !hook.isEditing, `${key} restores the compact card size`);
        }
        hook.startEditing();
        c.wrapperEl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        check(hook.width === 320 && hook.height === 60 && !hook.isEditing, 'Clicking outside restores the compact card size');
        c.selectOnly(hook); c.wrapperEl.focus();
        const hookClipboard = new DataTransfer();
        c.handleCopy(new ClipboardEvent('copy', { cancelable: true, clipboardData: hookClipboard }));
        c.handlePaste(new ClipboardEvent('paste', { cancelable: true, clipboardData: hookClipboard }));
        const hookClone = [...c.selection][0];
        check(hookClone.text === hook.text && hookClone.id !== hook.id, 'Native duplication preserves hook settings');
        hookClone.render();
        check(!!hookClone.containerEl.querySelector('.cch-jump'), 'A duplicated hook renders its jump button');
        c.removeNode(hookClone);
        c.requestPushHistory.run();
        c.pushHistory(c.getData());
        const beforeMove = hook.x;
        hook.moveTo({ x: beforeMove + 180, y: hook.y }); c.requestSave(); c.requestPushHistory.run();
        c.undo();
        check(c.nodes.get(hook.id).x === beforeMove, 'Native undo restores hook movement');
        c.redo();
        check(c.nodes.get(hook.id).x === beforeMove + 180, 'Native redo reapplies hook movement');
        c.setReadonly(true); hook.startEditing();
        check(!hook.isEditing, 'Read-only Canvas prevents hook editing');
        await plugin.follow(target.value, c);
        check(c.selection.has(c.nodes.get(targetID)), 'Read-only Canvas still permits hook navigation');
        c.setReadonly(false);
        let missing = false;
        try { await plugin.follow(target.value.replace(targetID, 'ffffffffffffffff'), c); } catch { missing = true; }
        check(missing, 'Deleted or missing destinations produce an explicit error');
        let external = false;
        try { await plugin.follow(target.value.replace('vault=Canvas+Card+Hook+Dev', 'vault=Other'), c); } catch { external = true; }
        check(external, 'Cross-vault references are rejected clearly');
        c.requestSave(); await leaf.view.save();
        const persisted = JSON.parse(await app.vault.read(file));
        check(persisted.nodes.find(node => node.id === hook.id).text.includes('Test destination'), 'Hook configuration is saved in the Canvas file');
        const hookId = hook.id;
        await leaf.setViewState({ type: 'empty' }); await leaf.openFile(file); plugin.scan();
        const reopened = leaf.view.canvas.nodes.get(hookId); reopened.render();
        check(reopened.containerEl.querySelector('.cch-title')?.textContent === 'Test destination', 'Closing and reopening restores the hook presentation');
        check(reopened.width === 320 && reopened.height === 60, 'Closing and reopening preserves the compact preview dimensions');
        const moved = 'QA Integration Renamed.canvas';
        await app.fileManager.renameFile(file, moved); await wait(500);
        check(reopened.text.includes('QA+Integration+Renamed.canvas'), 'Renaming a Canvas updates its hook references');
        const otherLink = 'obsidian://canvas-card-hook?vault=Canvas+Card+Hook+Dev&canvas=Another+Canvas.canvas&node=5555555555555555';
        await plugin.follow(otherLink, leaf.view.canvas);
        check(app.workspace.activeLeaf.view.file.path === 'Another Canvas.canvas', 'Cross-canvas navigation opens the destination Canvas');
        check(app.workspace.activeLeaf.view.canvas.selection.has(app.workspace.activeLeaf.view.canvas.nodes.get('5555555555555555')), 'Cross-canvas navigation selects the correct destination card');
        const otherLeaf = app.workspace.activeLeaf;
        await plugin.follow(otherLink, leaf.view.canvas);
        check(app.workspace.activeLeaf === otherLeaf, 'An already-open destination Canvas is reused');
        const oldPlugin = app.plugins.plugins['canvas-card-hook'];
        reopened.startEditing();
        await app.plugins.unloadPlugin('canvas-card-hook');
        check(reopened.width === 320 && reopened.height === 60, 'Unloading while editing restores the user-defined preview size');
        check(oldPlugin.records.size === 0 && oldPlugin.canvases.size === 0, 'Unloading releases node patches and Canvas listeners');
        check(!document.querySelector('.cch-root'), 'Unloading removes custom hook UI');
        await app.plugins.loadPlugin('canvas-card-hook');
        await leaf.openFile(file); app.plugins.plugins['canvas-card-hook'].scan();
        const afterReload = leaf.view.canvas.nodes.get(hookId); afterReload.render();
        check(!!afterReload.containerEl.querySelector('.cch-jump'), 'Reloading the plugin restores saved hooks');
        return { passed: results.length, checks: results, appVersion: document.title.match(/Obsidian (.+)$/)?.[1], date: new Date().toISOString() };
      } finally {
        await leaf.setViewState({ type: 'empty' });
        await app.vault.delete(file);
        await leaf.openFile(app.vault.getAbstractFileByPath('Hook Playground.canvas'));
        await app.workspace.revealLeaf(leaf);
        app.workspace.setActiveLeaf(leaf, { focus: true });
        const c = leaf.view.canvas;
        c.setState({ x: 460, y: 130, zoom: -.8 }); c.deselectAll();
      }
    });
    fs.writeFileSync(path.join(__dirname, '../TEST-RESULTS.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
