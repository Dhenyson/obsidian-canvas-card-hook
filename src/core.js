"use strict";

const PREFIX = "<!-- canvas-card-hook:v1\n";
const SCHEME = "obsidian://canvas-card-hook";
const MIME = "application/x-canvas-card-hook";

function makeLink(vault, canvas, node) {
  const params = new URLSearchParams({ vault, canvas, node });
  return `${SCHEME}?${params}`;
}

function parseTarget(value, context) {
  const input = value.trim();
  if (!input) throw new Error("Paste a card link or card ID.");
  if (/^[a-f0-9]{16}$/i.test(input)) return { ...context, node: input };
  let url;
  try { url = new URL(input); } catch { throw new Error("Use Copy card link on the destination card."); }
  if (url.protocol !== "obsidian:" || url.hostname !== "canvas-card-hook")
    throw new Error("This is not a Canvas Card Hook link.");
  const vault = url.searchParams.get("vault");
  const canvas = url.searchParams.get("canvas");
  const node = url.searchParams.get("node");
  if (!vault || !canvas?.endsWith(".canvas") || !/^[a-f0-9]{16}$/i.test(node || ""))
    throw new Error("This card link is incomplete or invalid.");
  if (canvas.startsWith("/") || canvas.includes("\\") || canvas.split("/").includes(".."))
    throw new Error("The canvas path must be relative to the vault.");
  return { vault, canvas, node };
}

function readHook(text) {
  if (typeof text !== "string" || !text.startsWith(PREFIX)) return null;
  const end = text.indexOf("\n-->", PREFIX.length);
  if (end === -1) return null;
  try {
    const data = JSON.parse(text.slice(PREFIX.length, end));
    return typeof data.title === "string" && typeof data.target === "string" ? data : null;
  } catch { return null; }
}

function writeHook({ title, target }) {
  const data = { title, target };
  // Escape HTML comment terminators while preserving the original JSON values.
  const json = JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
  const label = (title.trim() || "Untitled hook").replace(/[\\[\]<>*_`#]/g, "\\$&").replace(/\r?\n/g, " ");
  const fallback = target ? `[Jump to card](${target.replace(/[\s()<>]/g, c => encodeURIComponent(c))})` : "No destination configured.";
  return `${PREFIX}${json}\n-->\n\n**${label}**\n\n${fallback}`;
}

function clipboardLink(data, context) {
  const explicit = data.getData(MIME);
  if (explicit) return explicit;
  const plain = data.getData("text/plain");
  if (plain.trim()) return plain.trim();
  try {
    const selection = JSON.parse(data.getData("obsidian/canvas"));
    if (selection.nodes?.length === 1) return makeLink(context.vault, context.canvas, selection.nodes[0].id);
  } catch { /* An unrelated clipboard format is ordinary input. */ }
  return "";
}

module.exports = { PREFIX, SCHEME, MIME, makeLink, parseTarget, readHook, writeHook, clipboardLink };
