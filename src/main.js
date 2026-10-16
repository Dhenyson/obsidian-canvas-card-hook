"use strict";

const { Plugin: ObsidianPlugin, Notice, TFile, setIcon } = require("obsidian");
const { MIME, makeLink, parseTarget, readHook, writeHook, clipboardLink } = require("./core");
const EDIT_SIZE = { width: 380, height: 260 };

/** Canvas internals are isolated here because Obsidian exposes no public card renderer API. */
module.exports = class CanvasCardHook extends ObsidianPlugin {
  onload() {
    this.canvases = new Map();
    this.records = new Map();
    this.editing = null;
    this.arrivalTimers = new Set();
    this.active = true;
    this.registerEvent(this.app.workspace.on("canvas:node-menu", (menu, node) => this.nodeMenu(menu, node)));
    this.registerEvent(this.app.workspace.on("layout-change", () => this.scan()));
    this.registerEvent(this.app.workspace.on("file-open", () => this.scan()));
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
      this.rewriteTargets(file, oldPath).catch(error => this.report(error));
    }));
    this.registerObsidianProtocolHandler("canvas-card-hook", params => {
      const link = makeLink(params.vault || this.app.vault.getName(), params.canvas || "", params.node || "");
      this.follow(link, this.currentCanvas()).catch(error => this.report(error));
    });
    this.addCommand({ id: "copy-card-link", name: "Copy selected card link", checkCallback: checking => {
      const canvas = this.currentCanvas();
      const nodes = canvas ? [...canvas.selection].filter(node => canvas.nodes.get(node.id) === node) : [];
      if (nodes.length !== 1) return false;
      if (!checking) this.copyLink(nodes[0]);
      return true;
    }});
    this.addCommand({ id: "add-hook", name: "Add hook beside selected card", checkCallback: checking => {
      const canvas = this.currentCanvas();
      const node = canvas && [...canvas.selection].find(item => canvas.nodes.get(item.id) === item);
      if (!node || canvas.readonly) return false;
      if (!checking) this.addHook(node);
      return true;
    }});
    // New Canvas leaves can finish initializing after layout-change fires.
    this.registerInterval(window.setInterval(() => this.scan(), 500));
    this.app.workspace.onLayoutReady(() => { if (this.active) this.scan(); });
  }

  currentCanvas() { return this.app.workspace.activeLeaf?.view?.canvas; }
  context(canvas) { return { vault: this.app.vault.getName(), canvas: canvas?.view?.file?.path || "" }; }
  report(error) { console.error("Canvas Card Hook:", error); new Notice(`Canvas Card Hook: ${error.message || error}`); }

  wrap(object, name, factory, cleanups) {
    if (typeof object[name] !== "function") return;
    const own = Object.getOwnPropertyDescriptor(object, name);
    const original = object[name];
    const wrapped = factory(original);
    object[name] = wrapped;
    cleanups.push(() => {
      if (object[name] !== wrapped) return;
      if (own) Object.defineProperty(object, name, own);
      else delete object[name];
    });
  }

  scan() {
    if (!this.active) return;
    const visible = new Set();
    for (const leaf of this.app.workspace.getLeavesOfType("canvas")) {
      const canvas = leaf.view.canvas;
      if (!canvas?.nodes || typeof canvas.zoomToSelection !== "function") continue;
      visible.add(canvas);
      if (!this.canvases.has(canvas)) this.attachCanvas(canvas);
      for (const node of canvas.nodes.values()) this.attachNode(node);
    }
    for (const [canvas, cleanup] of this.canvases) if (!visible.has(canvas)) {
      cleanup.forEach(fn => fn());
      this.canvases.delete(canvas);
    }
    for (const [node, record] of this.records) if (!visible.has(node.canvas) || node.canvas.nodes.get(node.id) !== node) {
      this.detachNode(node, record);
    }
  }

  attachCanvas(canvas) {
    const cleanup = [];
    this.canvases.set(canvas, cleanup);
    const plugin = this;
    this.wrap(canvas, "addNode", original => function(node) {
      const result = original.apply(this, arguments);
      plugin.attachNode(node);
      return result;
    }, cleanup);
    // Append a reference AFTER the native handler writes its duplication payload.
    this.wrap(canvas, "handleCopy", original => function(event) {
      const result = original.apply(this, arguments);
      const native = event.clipboardData?.getData("obsidian/canvas");
      if (native && event.defaultPrevented) {
        try {
          const copied = JSON.parse(native).nodes;
          if (copied?.length === 1) {
            const context = plugin.context(canvas);
            const link = makeLink(context.vault, context.canvas, copied[0].id);
            event.clipboardData.setData(MIME, link);
            event.clipboardData.setData("text/plain", link);
          }
        } catch (error) { console.warn("Canvas Card Hook: clipboard reference unavailable", error); }
      }
      return result;
    }, cleanup);
    const doc = canvas.wrapperEl.ownerDocument;
    const outside = event => {
      const record = plugin.editing;
      if (record && !event.composedPath().includes(record.root)) plugin.finishEdit(record);
    };
    doc.addEventListener("pointerdown", outside, true);
    cleanup.push(() => doc.removeEventListener("pointerdown", outside, true));
  }

  attachNode(node) {
    if (this.records.has(node) || typeof node.setText !== "function") return;
    const plugin = this;
    const record = { node, cleanup: [], root: null, mode: "preview", value: null };
    this.records.set(node, record);
    // Editing dimensions are temporary: saves, history and clipboard retain the user's card size.
    this.wrap(node, "getData", original => function() {
      const data = original.apply(this, arguments);
      return record.previewSize ? { ...data, ...record.previewSize } : data;
    }, record.cleanup);
    this.wrap(node, "render", original => function() {
      const result = original.apply(this, arguments);
      plugin.sync(record);
      return result;
    }, record.cleanup);
    this.wrap(node, "setText", original => function() {
      const result = original.apply(this, arguments);
      plugin.sync(record);
      return result;
    }, record.cleanup);
    this.wrap(node, "startEditing", original => function() {
      if (!readHook(this.text)) return original.apply(this, arguments);
      if (!this.canvas.readonly) plugin.edit(record);
    }, record.cleanup);
    this.wrap(node, "isEditable", original => function() {
      return readHook(this.text) ? !this.canvas.readonly : original.apply(this, arguments);
    }, record.cleanup);
    this.wrap(node, "onClick", original => function(event) {
      if (!readHook(this.text)) return original.apply(this, arguments);
      if (record.mode === "edit") return;
      event.shiftKey ? this.canvas.toggleSelect(this) : this.canvas.selectOnly(this);
    }, record.cleanup);
    this.wrap(node, "blur", original => function() {
      if (record.mode === "edit") plugin.finishEdit(record);
      return original.apply(this, arguments);
    }, record.cleanup);
    this.sync(record);
  }

  sync(record) {
    const { node } = record;
    const data = readHook(node.text);
    if (!node.containerEl) return;
    node.nodeEl.classList.toggle("cch-node", !!data);
    if (!data) {
      this.restoreSize(record);
      node.setIsEditing(false);
      record.root?.remove(); record.root = null; record.value = null;
      if (this.editing === record) this.editing = null;
      record.mode = "preview";
      return;
    }
    if (!record.root) {
      const root = node.containerEl.ownerDocument.createElement("div");
      root.className = "cch-root";
      record.root = root;
      node.containerEl.appendChild(root);
      root.addEventListener("dblclick", event => {
        event.preventDefault(); event.stopPropagation();
        if (!node.canvas.readonly) this.edit(record);
      });
    }
    if (record.mode === "edit") return;
    if (record.value === node.text && record.root.childElementCount) return;
    record.value = node.text;
    const root = record.root;
    root.replaceChildren();
    const title = root.createDiv({ cls: "cch-title", text: data.title.trim() || "Untitled hook" });
    title.title = "Double-click to edit hook";
    const button = root.createEl("button", { cls: "cch-jump", attr: { "aria-label": `Jump to ${data.title.trim() || "card"}`, title: "Jump to destination card" } });
    setIcon(button, "arrow-up-right");
    button.addEventListener("pointerdown", event => event.stopPropagation());
    button.addEventListener("dblclick", event => { event.preventDefault(); event.stopPropagation(); });
    button.addEventListener("click", event => {
      event.preventDefault(); event.stopPropagation();
      this.follow(readHook(node.text)?.target || "", node.canvas).catch(error => this.report(error));
    });
  }

  edit(record) {
    const { node } = record;
    if (node.canvas.readonly) return;
    if (record.mode === "edit") { record.root?.querySelector("input")?.focus(); return; }
    if (this.editing && this.editing !== record) this.finishEdit(this.editing);
    node.canvas.selectOnly(node);
    node.render();
    const data = readHook(node.text);
    if (!data || !record.root) return;
    record.mode = "edit"; this.editing = record;
    record.previewSize = { width: node.width, height: node.height };
    node.moveAndResize({ x: node.x, y: node.y, ...EDIT_SIZE });
    node.render();
    node.canvas.panIntoView(node.getBBox());
    node.setIsEditing(true);
    if (node.canvas.zoom < node.canvas.zoomBreakpoint + .1) node.canvas.zoomToSelection();
    const root = record.root;
    root.replaceChildren(); root.classList.add("cch-editing");
    const heading = root.createDiv({ cls: "cch-editor-heading", text: "Edit hook" });
    setIcon(heading.createSpan(), "link");
    const titleLabel = root.createEl("label", { text: "Title", cls: "cch-field" });
    const title = titleLabel.createEl("input", { type: "text", value: data.title, attr: { placeholder: "Where does this hook lead?", "aria-label": "Hook title" } });
    const targetLabel = root.createEl("label", { text: "Card link or ID", cls: "cch-field" });
    const target = targetLabel.createEl("input", { type: "text", value: data.target, attr: { placeholder: "Paste a copied card or card link", "aria-label": "Card link or ID", spellcheck: "false" } });
    const errorEl = root.createDiv({ cls: "cch-error", attr: { "aria-live": "polite" } });
    const save = () => {
      const value = { title: title.value, target: target.value.trim() };
      node.setText(writeHook(value)); node.canvas.requestSave();
      errorEl.textContent = "";
      if (value.target) {
        try { const parsed = parseTarget(value.target, this.context(node.canvas)); if (parsed.vault !== this.app.vault.getName()) throw new Error("Choose a card in this vault."); }
        catch (error) { errorEl.textContent = error.message; }
      }
    };
    for (const input of [title, target]) input.addEventListener("input", save);
    target.addEventListener("paste", event => {
      const value = clipboardLink(event.clipboardData, this.context(node.canvas));
      if (!value) return;
      event.preventDefault(); event.stopPropagation(); target.value = value; save();
    });
    const footer = root.createDiv({ cls: "cch-editor-footer" });
    footer.createSpan({ text: "Enter or click outside to finish" });
    const done = footer.createEl("button", { text: "Done", cls: "mod-cta" });
    done.addEventListener("click", () => { this.finishEdit(record); node.canvas.wrapperEl.focus(); });
    for (const name of ["pointerdown", "mousedown", "click"]) root.addEventListener(name, this.stopFormEvent);
    root.onkeydown = event => {
      event.stopPropagation();
      if (event.key === "Enter" || event.key === "Escape") {
        event.preventDefault(); this.finishEdit(record); node.canvas.wrapperEl.focus();
      }
    };
    title.focus(); title.select();
  }

  stopFormEvent(event) { if (event.currentTarget.classList.contains("cch-editing")) event.stopPropagation(); }

  restoreSize(record) {
    if (!record.previewSize) return;
    const { node, previewSize } = record;
    node.moveAndResize({ x: node.x, y: node.y, ...previewSize });
    record.previewSize = null;
    node.render();
  }

  finishEdit(record) {
    if (record.mode !== "edit") return;
    record.mode = "preview"; record.value = null;
    record.root?.classList.remove("cch-editing");
    if (record.root) record.root.onkeydown = null;
    record.node.setIsEditing(false);
    if (this.editing === record) this.editing = null;
    this.restoreSize(record);
    this.sync(record);
    record.node.canvas.requestSave();
  }

  nodeMenu(menu, node) {
    if (!node?.canvas?.nodes) return;
    this.attachNode(node);
    menu.addItem(item => item.setSection("canvas").setTitle("Copy card link").setIcon("copy").onClick(() => this.copyLink(node)));
    if (!node.canvas.readonly) menu.addItem(item => item.setSection("canvas").setTitle("Add hook").setIcon("link").onClick(() => this.addHook(node)));
  }

  async copyLink(node) {
    try {
      const context = this.context(node.canvas);
      await navigator.clipboard.writeText(makeLink(context.vault, context.canvas, node.id));
      new Notice("Card link copied");
    } catch (error) { this.report(error); }
  }

  addHook(source) {
    const canvas = source.canvas;
    if (canvas.readonly || typeof canvas.createTextNode !== "function") return;
    const node = canvas.createTextNode({ pos: { x: source.x + source.width + 80, y: source.y }, size: { ...EDIT_SIZE }, text: writeHook({ title: "", target: "" }), focus: false });
    this.attachNode(node); node.render();
    canvas.selectOnly(node); canvas.panIntoView(node.getBBox());
    canvas.requestSave(); this.edit(this.records.get(node));
  }

  async follow(value, source) {
    const target = parseTarget(value, this.context(source));
    if (target.vault !== this.app.vault.getName()) throw new Error("This hook points to another vault. Open that vault to use its card link.");
    const file = this.app.vault.getAbstractFileByPath(target.canvas);
    if (!(file instanceof TFile) || file.extension !== "canvas") throw new Error(`Canvas not found: ${target.canvas}`);
    // Check the target before changing the user's view.
    let canvas = source?.view?.file?.path === target.canvas ? source : null;
    if (!canvas) canvas = this.app.workspace.getLeavesOfType("canvas").map(leaf => leaf.view.canvas).find(item => item?.view?.file?.path === target.canvas);
    if (!canvas?.nodes.has(target.node)) {
      const data = JSON.parse(await this.app.vault.read(file));
      if (!data.nodes?.some(node => node.id === target.node)) throw new Error("Destination card was deleted or its ID changed. Copy its new link and edit this hook.");
    }
    if (!canvas) {
      const leaf = this.app.workspace.getLeaf("tab");
      await leaf.openFile(file);
      canvas = leaf.view.canvas;
    }
    if (!canvas?.nodes?.has(target.node)) throw new Error("The destination Canvas is not ready. Try again.");
    await this.app.workspace.revealLeaf(canvas.view.leaf);
    this.app.workspace.setActiveLeaf(canvas.view.leaf, { focus: true });
    this.scan();
    const node = canvas.nodes.get(target.node);
    canvas.selectOnly(node);
    canvas.zoomToSelection();
    canvas.wrapperEl.focus();
    node.nodeEl?.classList.add("cch-arrival");
    const timer = window.setTimeout(() => {
      node.nodeEl?.classList.remove("cch-arrival"); this.arrivalTimers.delete(timer);
    }, 1400);
    this.arrivalTimers.add(timer);
  }

  async rewriteTargets(file, oldPath) {
    const folder = Array.isArray(file.children);
    if (!folder && file.extension !== "canvas") return;
    const vault = this.app.vault.getName();
    const rewrite = text => {
      const hook = readHook(text);
      if (!hook?.target) return text;
      try {
        const target = parseTarget(hook.target, { vault, canvas: "" });
        if (target.vault !== vault) return text;
        const next = target.canvas === oldPath ? file.path : folder && target.canvas.startsWith(oldPath + "/") ? file.path + target.canvas.slice(oldPath.length) : null;
        return next ? writeHook({ ...hook, target: makeLink(vault, next, target.node) }) : text;
      } catch { return text; }
    };
    const open = new Map(this.app.workspace.getLeavesOfType("canvas").map(leaf => [leaf.view.file?.path, leaf.view.canvas]));
    for (const canvasFile of this.app.vault.getFiles().filter(item => item.extension === "canvas")) {
      const canvas = open.get(canvasFile.path);
      if (canvas) {
        let changed = false;
        for (const node of canvas.nodes.values()) {
          if (typeof node.setText !== "function") continue;
          const next = rewrite(node.text);
          if (next !== node.text) { node.setText(next); changed = true; }
        }
        if (changed) canvas.requestSave();
      } else await this.app.vault.process(canvasFile, text => {
        let data; try { data = JSON.parse(text); } catch { return text; }
        let changed = false;
        for (const node of data.nodes || []) if (node.type === "text") {
          const next = rewrite(node.text);
          if (next !== node.text) { node.text = next; changed = true; }
        }
        return changed ? JSON.stringify(data, null, 2) : text;
      });
    }
  }

  detachNode(node, record) {
    if (this.editing === record) this.finishEdit(record);
    record.root?.remove(); node.nodeEl?.classList.remove("cch-node", "cch-arrival");
    record.cleanup.reverse().forEach(fn => fn());
    this.records.delete(node);
  }

  onunload() {
    this.active = false;
    for (const timer of this.arrivalTimers) window.clearTimeout(timer);
    this.arrivalTimers.clear();
    for (const [node, record] of this.records) this.detachNode(node, record);
    for (const cleanup of this.canvases.values()) cleanup.reverse().forEach(fn => fn());
    this.canvases.clear();
  }
};
