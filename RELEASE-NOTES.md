Canvas Card Hook 0.2.2 completes the code validation, CSS, and release-provenance cleanup while preserving the existing interface and hooks.

- Strict TypeScript, typed Canvas interfaces, and the complete recommended Obsidian lint configuration with zero warnings allowed.
- Validated hook metadata, copied-card payloads, and Canvas JSON before accessing their fields.
- Native method wrappers preserve receivers and arguments without `this` aliases.
- CSS uses specific selectors instead of important overrides; low, normal, and high zoom remain supported.
- GitHub build-provenance attestations cover all three installation files.

The plugin ID, hook storage format, existing links, same-Canvas and cross-Canvas navigation, clipboard behavior, editor size restoration, card colors, context menus, and draggable toolbar control remain compatible.

Clipboard and current-vault file enumeration are intentional capabilities used for copying references and maintaining links after renames. They remain documented rather than hidden from the scanner.

Validation: seven unit tests, 76 integration checks in Obsidian Desktop 1.14.4, strict type checking, and zero lint warnings. Desktop only; minimum Obsidian version remains 1.14.4.
