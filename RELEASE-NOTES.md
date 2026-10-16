Canvas Card Hook 0.2.0 adds more ways to create hooks and improves their native Canvas appearance.

- Right-click empty Canvas space and choose **Add hook** to create a hook at that position.
- Use the new link icon beside the native card, note, and media controls in the bottom Canvas toolbar. Click to create a hook at the center, or drag to place it with native snapping.
- Activate the toolbar icon with **Enter** or **Space** when focused.
- Jump with a smaller 28-pixel button and a 16-pixel arrow, centered on compact hooks.
- Standard and custom Canvas colors now paint the hook background in preview and editing, using the same content layer as native cards.

Existing same-Canvas and cross-Canvas links, native copy/paste, and temporary editor sizing continue to work. Cross-Canvas destinations must belong to the same vault.

**Compatibility:** Obsidian Desktop 1.14.4 or later. Mobile and compatibility with other Canvas plugins have not been verified.

**Privacy:** Offline operation, no telemetry, no external services, and no additional account required by the plugin.

**Validation:** 73 integration checks in Obsidian Desktop 1.14.4, four unit tests, and the official Obsidian lint rules. Includes light/dark color comparisons, real blank-canvas context-menu clicks, toolbar clicks and dragging, read-only guards, and cleanup on unload/reload.

Install or update from Obsidian's Community Plugins browser when the directory sync completes. For manual installation, place the three attached runtime files in your vault configuration directory under `plugins/canvas-card-hook/`, then reload and enable the plugin. The ID is unchanged, so an existing installation is updated in place.
