export const PREFIX = "<!-- canvas-card-hook:v1\n";
export const SCHEME = "obsidian://canvas-card-hook";
export const MIME = "application/x-canvas-card-hook";
export interface CardContext { vault: string; canvas: string; }
export interface CardTarget extends CardContext { node: string; }
export interface HookValue { title: string; target: string; }
export interface CanvasDocument extends Record<string, unknown> {
  nodes: (Record<string, unknown> & { id: string; type: string; text?: string })[];
}
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function makeLink(vault: string, canvas: string, node: string): string {
  const params = new URLSearchParams({ vault, canvas, node });
  return `${SCHEME}?${params}`;
}
export function parseTarget(value: string, context: CardContext): CardTarget {
  const input = value.trim();
  if (!input) throw new Error("Paste a card link or card ID.");
  if (/^[a-f0-9]{16}$/i.test(input)) return { ...context, node: input };
  let url: URL;
  try { url = new URL(input); } catch { throw new Error("Use Copy card link on the destination card."); }
  if (url.protocol !== "obsidian:" || url.hostname !== "canvas-card-hook")
    throw new Error("This is not a Canvas Card Hook link.");
  const vault = url.searchParams.get("vault"), canvas = url.searchParams.get("canvas"), node = url.searchParams.get("node");
  if (!vault || !canvas?.endsWith(".canvas") || !node || !/^[a-f0-9]{16}$/i.test(node))
    throw new Error("This card link is incomplete or invalid.");
  if (canvas.startsWith("/") || canvas.includes("\\") || canvas.split("/").includes(".."))
    throw new Error("The canvas path must be relative to the vault.");
  return { vault, canvas, node };
}
export function readHook(text: unknown): HookValue | null {
  if (typeof text !== "string" || !text.startsWith(PREFIX)) return null;
  const end = text.indexOf("\n-->", PREFIX.length);
  if (end === -1) return null;
  try {
    const data: unknown = JSON.parse(text.slice(PREFIX.length, end));
    return isRecord(data) && typeof data.title === "string" && typeof data.target === "string"
      ? { title: data.title, target: data.target } : null;
  } catch { return null; }
}
export function writeHook({ title, target }: HookValue): string {
  const json = JSON.stringify({ title, target }).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
  const label = (title.trim() || "Untitled hook").replace(/[\\[\]<>*_`#]/g, "\\$&").replace(/\r?\n/g, " ");
  const fallback = target ? `[Jump to card](${target.replace(/[\s()<>]/g, c => encodeURIComponent(c))})` : "No destination configured.";
  return `${PREFIX}${json}\n-->\n\n**${label}**\n\n${fallback}`;
}
export function copiedCardId(text: string): string | null {
  try {
    const selection: unknown = JSON.parse(text);
    if (!isRecord(selection) || !Array.isArray(selection.nodes) || selection.nodes.length !== 1) return null;
    const node: unknown = selection.nodes[0];
    return isRecord(node) && typeof node.id === "string" && /^[a-f0-9]{16}$/i.test(node.id) ? node.id : null;
  } catch { return null; }
}
export function clipboardLink(data: Pick<DataTransfer, "getData">, context: CardContext): string {
  const explicit = data.getData(MIME);
  if (explicit) return explicit;
  const plain = data.getData("text/plain");
  if (plain.trim()) return plain.trim();
  const id = copiedCardId(data.getData("obsidian/canvas"));
  return id ? makeLink(context.vault, context.canvas, id) : "";
}
export function parseCanvasDocument(text: string): CanvasDocument {
  const data: unknown = JSON.parse(text);
  if (!isRecord(data) || !Array.isArray(data.nodes)) throw new Error("Canvas contains invalid node data.");
  // Validate consumed fields and retain unrelated Canvas properties verbatim.
  for (const node of data.nodes as unknown[]) {
    if (!isRecord(node) || typeof node.id !== "string" || typeof node.type !== "string" ||
        (node.type === "text" && typeof node.text !== "string")) throw new Error("Canvas contains invalid node data.");
  }
  return data as CanvasDocument;
}
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
