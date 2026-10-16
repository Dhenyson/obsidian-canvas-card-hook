# Contributing

Bug reports and small, focused improvements are welcome. Open an issue before starting a large change.

## Development

Use Node.js 24 and pnpm. Install development dependencies with `pnpm install --frozen-lockfile`.

```sh
pnpm lint
pnpm test
pnpm build
```

The production build is deterministic and creates `main.js` in the repository root and the three runtime files in `dist/canvas-card-hook/`. Build dependencies are not bundled into the plugin.

Use a separate test vault with the built-in Canvas plugin enabled. Create it with:

```sh
node scripts/setup-dev.cjs "/absolute/path/to/Canvas Card Hook Dev"
node scripts/build.cjs "/absolute/path/to/Canvas Card Hook Dev"
```

The setup script creates example canvases and a short guide. It does not overwrite existing files. The optional build argument copies runtime files into the vault's default `.obsidian/plugins/canvas-card-hook` folder. For a custom configuration directory, copy the files into that directory manually.

Reload the plugin in Obsidian after rebuilding. Use a test vault rather than personal notes when changing Canvas integration.

## Integration tests

`scripts/integration.cjs` runs against a local desktop Obsidian instance launched with a disposable profile and `--remote-debugging-port=9239`. It requires Playwright, supplied through `PLAYWRIGHT_PATH` or installed in the development environment. Override the endpoint with `OBSIDIAN_CDP` if needed.

The script refuses to run outside a vault named `Canvas Card Hook Dev`. It creates its own QA Canvas and removes that file when finished. Close the debugging instance after testing; normal plugin usage does not need debugging enabled.

## Compatibility

Canvas node rendering and viewport APIs are internal. Keep wrappers scoped to Canvas and node instances, restore them on unload, and preserve the native clipboard payload. Prefer public Obsidian APIs wherever they provide the required behavior.

Before submitting a change, test compact-card editing, size restoration, save/reopen, copy/paste, undo/redo, same-canvas links, and cross-canvas links. The exact current integration checks are recorded in `TEST-RESULTS.json`.
