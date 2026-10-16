# Changelog

## 0.2.0

- Add **Add hook** to the native creation menu when right-clicking empty Canvas space.
- Add a hook control to the bottom Canvas toolbar: click to create at the viewport center, or drag to place a hook with native snapping.
- Support Enter and Space when the new toolbar control has keyboard focus.
- Reduce the jump button from 48 to 28 pixels, with a 16-pixel arrow and less horizontal padding.
- Reuse the native Canvas content background so default colors, custom colors, and themes apply to hooks during preview and editing.
- Remove the added toolbar control and restore the creation menu when the plugin unloads.
- Respect read-only canvases in both new creation controls.

## 0.1.1

Initial public release.

- Add hook cards from the native Canvas card context menu.
- Copy card links and jump using native zoom to selection.
- Navigate within a Canvas or between canvases in the same vault.
- Keep native card duplication when copying and pasting on the Canvas.
- Paste a copied card's reference directly into a hook's target input.
- Edit title and destination in two inline inputs.
- Center the arrow on short cards.
- Temporarily expand the editor to 380 × 260, then restore the chosen card size.
- Preserve compact dimensions in saves, history, and clipboard data during editing.
- Keep hooks readable as Markdown when the plugin is disabled.
- Update hook references after Canvas and folder renames inside Obsidian.

## 0.1.0

Local development prototype; not publicly released.
