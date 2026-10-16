import { Plugin as ObsidianPlugin, Notice, TFile, TFolder, View, setIcon, setTooltip } from "obsidian";
import type { Menu, TAbstractFile } from "obsidian";
import { canvasFromView, isTextNode } from "./canvas";
import type { Canvas, CanvasNode, TextNode, HookRecord, Position } from "./canvas";
import { MIME, makeLink, parseTarget, readHook, writeHook, clipboardLink, copiedCardId, parseCanvasDocument, errorMessage } from "./core";
import type { CardContext, CanvasDocument } from "./core";
const EDIT_SIZE = { width: 380, height: 260 };

/** Canvas internals are isolated here because Obsidian exposes no public card renderer API. */
export default class CanvasCardHook extends ObsidianPlugin {
  canvases = new Map<Canvas, (() => void)[]>();
  records = new Map<TextNode, HookRecord>();
  editing: HookRecord | null = null;
  arrivalTimers = new Set<number>();
  active = false;
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
      if (!checking) void this.copyLink(nodes[0]);
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

  currentCanvas(): Canvas | undefined { return canvasFromView(this.app.workspace.getActiveViewOfType(View)); }
  context(canvas: Canvas | undefined): CardContext { return { vault: this.app.vault.getName(), canvas: canvas?.view?.file?.path || "" }; }
  report(error: unknown): void { console.error("Canvas Card Hook:", error); new Notice(`Canvas Card Hook: ${errorMessage(error)}`); }

  wrap<T extends object, K extends keyof T>(object: T, name: K, factory: (original: T[K]) => T[K], cleanups: (() => void)[]): void {
    if (typeof object[name] !== "function") return;
    const own = Object.getOwnPropertyDescriptor(object, name);
    const original = object[name];
    const wrapped = factory(original);
    object[name] = wrapped;
    cleanups.push(() => {
      if (object[name] !== wrapped) return;
      if (own) Object.defineProperty(object, name, own);
      else Reflect.deleteProperty(object, name);
    });
  }

  scan() {
    if (!this.active) return;
    const visible = new Set<Canvas>();
    for (const leaf of this.app.workspace.getLeavesOfType("canvas")) {
      const canvas = canvasFromView(leaf.view);
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

  attachCanvas(canvas: Canvas): void {
    const cleanup: (() => void)[] = [];
    this.canvases.set(canvas, cleanup);
    const afterAdd = (node: CanvasNode) => this.attachNode(node);
    this.wrap(canvas, "addNode", original => function(this: Canvas, ...args) {
      const result = original.apply(this, args); afterAdd(args[0]); return result;
    }, cleanup);
    const afterCreationMenu = (menu: Menu, pos: Position, receiver: Canvas) => {
      if (receiver.readonly) return;
      const destination = { x: pos.x, y: pos.y };
      menu.addItem(item => item.setSection("create").setTitle("Add hook").setIcon("link").onClick(() => { this.addHookAt(receiver, destination); }));
    };
    this.wrap(canvas, "showCreationMenu", original => function(this: Canvas, ...args) {
      const result = original.apply(this, args); afterCreationMenu(args[0], args[1], this); return result;
    }, cleanup);
    this.attachToolbar(canvas, cleanup);
    // Append a reference only after the native copy writes its duplication payload.
    const afterCopy = (event: ClipboardEvent) => {
      const data = event.clipboardData;
      const native = data?.getData("obsidian/canvas");
      if (!data || !native || !event.defaultPrevented) return;
      const id = copiedCardId(native);
      if (!id) return;
      const context = this.context(canvas);
      const link = makeLink(context.vault, context.canvas, id);
      data.setData(MIME, link); data.setData("text/plain", link);
    };
    this.wrap(canvas, "handleCopy", original => function(this: Canvas, ...args) {
      const result = original.apply(this, args); afterCopy(args[0]); return result;
    }, cleanup);
    const doc = canvas.wrapperEl.ownerDocument;
    const outside = (event: PointerEvent) => {
      const record = this.editing;
      if (record?.root && !event.composedPath().includes(record.root)) this.finishEdit(record);
    };
    doc.addEventListener("pointerdown", outside, true);
    cleanup.push(() => doc.removeEventListener("pointerdown", outside, true));
  }

  attachToolbar(canvas: Canvas, cleanup: (() => void)[]): void {
    if (!canvas.cardMenuEl) return;
    const button = canvas.cardMenuEl.createDiv({ cls: "canvas-card-menu-button mod-draggable cch-add-hook", attr: { role: "button", tabindex: "0" } });
    setIcon(button, "link");
    setTooltip(button, "Drag to add hook", { placement: "top" });
    const addAtCenter = () => this.addHookAt(canvas, canvas.posCenter(), "center");
    button.addEventListener("click", () => { if (!canvas.readonly) addAtCenter(); });
    button.addEventListener("pointerdown", event => {
      if (canvas.readonly || typeof canvas.dragTempNode !== "function") return;
      canvas.dragTempNode(event, { ...EDIT_SIZE }, pos => this.addHookAt(canvas, pos));
    });
    button.addEventListener("keydown", event => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault(); event.stopPropagation();
      if (!canvas.readonly) addAtCenter();
    });
    cleanup.push(() => button.remove());
  }

  attachNode(node: CanvasNode): void {
    if (!isTextNode(node) || this.records.has(node)) return;
    const record: HookRecord = { node, cleanup: [], root: null, mode: "preview", value: null };
    const sync = () => this.sync(record);
    const edit = () => this.edit(record);
    const finish = () => this.finishEdit(record);
    this.records.set(node, record);
    // Editing dimensions are temporary: saves, history and clipboard retain the user's card size.
    this.wrap(node, "getData", original => function(this: TextNode, ...args) {
      const data = original.apply(this, args);
      return record.previewSize ? { ...data, ...record.previewSize } : data;
    }, record.cleanup);
    this.wrap(node, "render", original => function(this: TextNode, ...args) {
      const result = original.apply(this, args);
      sync();
      return result;
    }, record.cleanup);
    this.wrap(node, "setText", original => function(this: TextNode, ...args) {
      const result = original.apply(this, args);
      sync();
      return result;
    }, record.cleanup);
    this.wrap(node, "startEditing", original => function(this: TextNode, ...args) {
      if (!readHook(this.text)) return original.apply(this, args);
      if (!this.canvas.readonly) edit();
    }, record.cleanup);
    this.wrap(node, "isEditable", original => function(this: TextNode, ...args) {
      return readHook(this.text) ? !this.canvas.readonly : original.apply(this, args);
    }, record.cleanup);
    this.wrap(node, "onClick", original => function(this: TextNode, event) {
      if (!readHook(this.text)) return original.call(this, event);
      if (record.mode === "edit") return;
      event.shiftKey ? this.canvas.toggleSelect(this) : this.canvas.selectOnly(this);
    }, record.cleanup);
    this.wrap(node, "blur", original => function(this: TextNode, ...args) {
      if (record.mode === "edit") finish();
      return original.apply(this, args);
    }, record.cleanup);
    this.sync(record);
  }

  sync(record: HookRecord): void {
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
      // Reuse the native content class so colors and themes paint the same background.
      const root = node.containerEl.createDiv({ cls: "canvas-node-content cch-root" });
      record.root = root;
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

  edit(record: HookRecord): void {
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
        catch (error) { errorEl.textContent = errorMessage(error); }
      }
    };
    for (const input of [title, target]) input.addEventListener("input", save);
    target.addEventListener("paste", event => {
      if (!event.clipboardData) return;
      const value = clipboardLink(event.clipboardData, this.context(node.canvas));
      if (!value) return;
      event.preventDefault(); event.stopPropagation(); target.value = value; save();
    });
    const footer = root.createDiv({ cls: "cch-editor-footer" });
    footer.createSpan({ text: "Enter or click outside to finish" });
    const done = footer.createEl("button", { text: "Done", cls: "mod-cta" });
    done.addEventListener("click", () => { this.finishEdit(record); node.canvas.wrapperEl.focus(); });
    for (const name of ["pointerdown", "mousedown", "click"]) root.addEventListener(name, event => {
      if (root.classList.contains("cch-editing")) event.stopPropagation();
    });
    root.onkeydown = event => {
      event.stopPropagation();
      if (event.key === "Enter" || event.key === "Escape") {
        event.preventDefault(); this.finishEdit(record); node.canvas.wrapperEl.focus();
      }
    };
    title.focus(); title.select();
  }

  restoreSize(record: HookRecord): void {
    if (!record.previewSize) return;
    const { node, previewSize } = record;
    node.moveAndResize({ x: node.x, y: node.y, ...previewSize });
    record.previewSize = null;
    node.render();
  }

  finishEdit(record: HookRecord): void {
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

  nodeMenu(menu: Menu, node: CanvasNode): void {
    if (!node?.canvas?.nodes) return;
    this.attachNode(node);
    menu.addItem(item => item.setSection("canvas").setTitle("Copy card link").setIcon("copy").onClick(() => this.copyLink(node)));
    if (!node.canvas.readonly) menu.addItem(item => item.setSection("canvas").setTitle("Add hook").setIcon("link").onClick(() => { this.addHook(node); }));
  }

  async copyLink(node: CanvasNode): Promise<void> {
    try {
      const context = this.context(node.canvas);
      await navigator.clipboard.writeText(makeLink(context.vault, context.canvas, node.id));
      new Notice("Card link copied");
    } catch (error) { this.report(error); }
  }

  addHook(source: CanvasNode): TextNode | undefined {
    return this.addHookAt(source.canvas, { x: source.x + source.width + 80, y: source.y });
  }

  addHookAt(canvas: Canvas, pos: Position, position?: "center"): TextNode | undefined {
    if (canvas.readonly || typeof canvas.createTextNode !== "function") return;
    const node = canvas.createTextNode({ pos, position, size: { ...EDIT_SIZE }, text: writeHook({ title: "", target: "" }), focus: false });
    this.attachNode(node); node.render();
    canvas.selectOnly(node); canvas.panIntoView(node.getBBox());
    canvas.requestSave();
    const record = this.records.get(node);
    if (record) this.edit(record);
    return node;
  }

  async follow(value: string, source?: Canvas): Promise<void> {
    const target = parseTarget(value, this.context(source));
    if (target.vault !== this.app.vault.getName()) throw new Error("This hook points to another vault. Open that vault to use its card link.");
    const file = this.app.vault.getAbstractFileByPath(target.canvas);
    if (!(file instanceof TFile) || file.extension !== "canvas") throw new Error(`Canvas not found: ${target.canvas}`);
    // Check the target before changing the user's view.
    let canvas = source?.view.file?.path === target.canvas ? source : undefined;
    if (!canvas) canvas = this.app.workspace.getLeavesOfType("canvas").map(leaf => canvasFromView(leaf.view)).find(item => item?.view?.file?.path === target.canvas);
    if (!canvas?.nodes.has(target.node)) {
      const data = parseCanvasDocument(await this.app.vault.read(file));
      if (!data.nodes?.some(node => node.id === target.node)) throw new Error("Destination card was deleted or its ID changed. Copy its new link and edit this hook.");
    }
    if (!canvas) {
      const leaf = this.app.workspace.getLeaf("tab");
      await leaf.openFile(file);
      canvas = canvasFromView(leaf.view);
    }
    if (!canvas?.nodes?.has(target.node)) throw new Error("The destination Canvas is not ready. Try again.");
    await this.app.workspace.revealLeaf(canvas.view.leaf);
    this.app.workspace.setActiveLeaf(canvas.view.leaf, { focus: true });
    this.scan();
    const node = canvas.nodes.get(target.node);
    if (!node) throw new Error("The destination card is not available.");
    canvas.selectOnly(node);
    canvas.zoomToSelection();
    canvas.wrapperEl.focus();
    node.nodeEl?.classList.add("cch-arrival");
    const timer = window.setTimeout(() => {
      node.nodeEl?.classList.remove("cch-arrival"); this.arrivalTimers.delete(timer);
    }, 1400);
    this.arrivalTimers.add(timer);
  }

  async rewriteTargets(file: TAbstractFile, oldPath: string): Promise<void> {
    const folder = file instanceof TFolder;
    if (!folder && (!(file instanceof TFile) || file.extension !== "canvas")) return;
    const vault = this.app.vault.getName();
    const rewrite = (text: string): string => {
      const hook = readHook(text);
      if (!hook?.target) return text;
      try {
        const target = parseTarget(hook.target, { vault, canvas: "" });
        if (target.vault !== vault) return text;
        const next = target.canvas === oldPath ? file.path : folder && target.canvas.startsWith(oldPath + "/") ? file.path + target.canvas.slice(oldPath.length) : null;
        return next ? writeHook({ ...hook, target: makeLink(vault, next, target.node) }) : text;
      } catch { return text; }
    };
    const open = new Map(this.app.workspace.getLeavesOfType("canvas").map(leaf => {
      const canvas = canvasFromView(leaf.view);
      return [canvas?.view.file?.path, canvas] as const;
    }));
    for (const canvasFile of this.app.vault.getFiles().filter(item => item.extension === "canvas")) {
      const canvas = open.get(canvasFile.path);
      if (canvas) {
        let changed = false;
        for (const node of canvas.nodes.values()) {
          if (!isTextNode(node)) continue;
          const next = rewrite(node.text);
          if (next !== node.text) { node.setText(next); changed = true; }
        }
        if (changed) canvas.requestSave();
      } else await this.app.vault.process(canvasFile, text => {
        let data: CanvasDocument; try { data = parseCanvasDocument(text); } catch { return text; }
        let changed = false;
        for (const node of data.nodes || []) if (node.type === "text" && typeof node.text === "string") {
          const next = rewrite(node.text);
          if (next !== node.text) { node.text = next; changed = true; }
        }
        return changed ? JSON.stringify(data, null, 2) : text;
      });
    }
  }

  detachNode(node: TextNode, record: HookRecord): void {
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
}
