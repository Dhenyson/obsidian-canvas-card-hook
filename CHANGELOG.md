# Changelog

## 0.2.1

- Replace untyped runtime source with strict TypeScript and explicit Canvas interfaces, retaining the existing plugin ID, hook metadata format, UI, and navigation behavior.
- Enable the full recommended Obsidian ESLint configuration and TypeScript checking in development, CI, and release workflows; fail linting on warnings.
- Validate hook metadata, native copied-card references, and Canvas JSON before consuming their fields.
- Preserve native wrapper receivers and arguments without aliasing `this`.
- Replace the CSS important override with specific selectors; verify low, normal, and high zoom.
- Generate GitHub build-provenance attestations for all installation files before publishing.
- Keep clipboard and vault enumeration capabilities explicitly documented because they support copying references and updating destinations after renames.
- Validate seven unit tests and 76 real-app integration checks.

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
