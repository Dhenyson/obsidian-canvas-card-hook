import type { EventRef, FileView, Menu, View } from "obsidian";

export interface Position { x: number; y: number; }
export interface Size { width: number; height: number; }
export interface Bounds { minX: number; minY: number; maxX: number; maxY: number; }
export interface NodeData extends Position, Size {
  id: string;
  type: string;
  text?: string;
  [key: string]: unknown;
}
export interface CanvasNode extends Position, Size {
  id: string;
  canvas: Canvas;
  nodeEl: HTMLElement;
  containerEl: HTMLElement;
  text?: string;
  setText?: (text: string, ...args: unknown[]) => void;
  getData(...args: unknown[]): NodeData;
  render(...args: unknown[]): void;
  startEditing(...args: unknown[]): void;
  isEditable(...args: unknown[]): boolean;
  onClick(event: MouseEvent): void;
  blur(...args: unknown[]): void;
  setIsEditing(value: boolean): void;
  moveAndResize(bounds: Position & Size): void;
  getBBox(): Bounds;
}
export interface TextNode extends CanvasNode { text: string; setText(text: string, ...args: unknown[]): void; }
export interface CanvasView extends FileView { canvas: Canvas; }
export interface Canvas {
  nodes: Map<string, CanvasNode>;
  selection: Set<CanvasNode>;
  readonly: boolean;
  view: CanvasView;
  wrapperEl: HTMLElement;
  cardMenuEl?: HTMLElement;
  zoom: number;
  zoomBreakpoint: number;
  addNode(node: CanvasNode, ...args: unknown[]): void;
  showCreationMenu(menu: Menu, pos: Position, size?: Size): void;
  handleCopy(event: ClipboardEvent, ...args: unknown[]): void;
  posCenter(): Position;
  dragTempNode?(event: PointerEvent, size: Size, onDrop: (pos: Position) => void): void;
  createTextNode(options: { pos: Position; position?: "center"; size: Size; text: string; focus: boolean }): TextNode;
  selectOnly(node: CanvasNode): void;
  toggleSelect(node: CanvasNode): void;
  panIntoView(bounds: Bounds): void;
  zoomToSelection(): void;
  requestSave(): void;
}
export interface HookRecord {
  node: TextNode;
  cleanup: (() => void)[];
  root: HTMLDivElement | null;
  mode: "preview" | "edit";
  value: string | null;
  previewSize?: Size | null;
}

/** Narrow the undocumented boundary once; all consumers use explicit types. */
export function canvasFromView(view: View | null | undefined): Canvas | undefined {
  if (!view || view.getViewType() !== "canvas") return;
  const canvas = (view as Partial<CanvasView>).canvas;
  if (!canvas?.nodes || typeof canvas.nodes.get !== "function" ||
      typeof canvas.zoomToSelection !== "function" || !canvas.wrapperEl) return;
  return canvas;
}
export function isTextNode(node: CanvasNode): node is TextNode {
  return typeof node.setText === "function" && typeof node.text === "string";
}

// Canvas emits this native event but the public package omits its overload.
declare module "obsidian" {
  interface Workspace {
    on(name: "canvas:node-menu", callback: (menu: Menu, node: CanvasNode) => void, ctx?: unknown): EventRef;
  }
}
