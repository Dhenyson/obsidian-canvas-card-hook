Canvas Card Hook 0.2.3 makes hook cards match the native Canvas appearance.

- The jump button follows the card's chosen border color, including hover.
- The arrow uses the card body's color and tint instead of fixed white.
- Hook titles use the same font, size, normal weight, and line height as native card text.
- New screenshots and a real-click animation demonstrate navigation within and between canvases.

The plugin ID, hook storage format, existing links, same-Canvas and cross-Canvas navigation, clipboard behavior, editor size restoration, card colors, context menus, and draggable toolbar control remain compatible.

Clipboard and current-vault file enumeration are intentional capabilities used for copying references and maintaining links after renames. They remain documented rather than hidden from the scanner.

Validation: seven unit tests, 96 integration checks in Obsidian Desktop 1.14.4, strict type checking, and zero lint warnings. The release retains the full recommended Obsidian lint configuration, CSS without important overrides, and build-provenance attestations for all three installation files. Desktop only; minimum Obsidian version remains 1.14.4.
