# Contributing

Bug reports and small, focused improvements are welcome. Open an issue before starting a large change.

## Development

Use Node.js 24 and pnpm. Install development dependencies with `pnpm install --frozen-lockfile`.

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Source files in `src/` use strict TypeScript and explicit Canvas interfaces. Do not introduce unchecked `any` types or suppress review rules. The complete recommended Obsidian ESLint configuration runs with zero warnings allowed, alongside `tsc --noEmit` in CI and releases.

The production build uses the pinned TypeScript compiler and deterministically inlines the two internal modules into a CommonJS plugin. It creates `main.js` in the repository root, the three runtime files in `dist/canvas-card-hook/`, and `dist/core.cjs` for unit tests and playground setup. Build dependencies are not bundled into the plugin. `pnpm test` builds before testing the emitted core module.

Use a separate test vault with the built-in Canvas plugin enabled. Create it with:

```sh
pnpm build
node scripts/setup-dev.cjs "/absolute/path/to/Canvas Card Hook Dev"
node scripts/build.cjs "/absolute/path/to/Canvas Card Hook Dev"
```

The setup script creates example canvases and a short guide. It does not overwrite existing files. The optional build argument copies runtime files into the vault's default `.obsidian/plugins/canvas-card-hook` folder. For a custom configuration directory, copy the files into that directory manually.

Reload the plugin in Obsidian after rebuilding. Use a test vault rather than personal notes when changing Canvas integration.

## Integration tests

`scripts/integration.cjs` runs against a local desktop Obsidian instance launched with a disposable profile and `--remote-debugging-port=9239`. It requires Playwright, supplied through `PLAYWRIGHT_PATH` or installed in the development environment. Override the endpoint with `OBSIDIAN_CDP` if needed.

The script refuses to run outside a vault named `Canvas Card Hook Dev`. It creates its own QA Canvas and removes that file when finished. Close the debugging instance after testing; normal plugin usage does not need debugging enabled.

Run `scripts/creation-integration.cjs` against the same isolated profile to check native color backgrounds, the compact jump button, the blank-canvas creation menu, and the bottom toolbar. It exercises real pointer dragging and keyboard activation, plus read-only guards and cleanup. It creates and removes its own QA Canvas and writes `CREATION-TEST-RESULTS.json`.

## Documentation captures

With the same disposable vault and desktop debugging endpoint, run `node scripts/capture-docs.cjs images` first, then `node scripts/capture-docs.cjs animation`. These create a fictional project workspace and capture the actual plugin in `docs/images/<manifest-version>/`. The animation moves a visible pointer and sends real mouse clicks to jump to a distant card, return, and navigate to another Canvas. Both commands refuse to run against a vault other than `Canvas Card Hook Dev`.

Run `python scripts/encode-docs.py` with Pillow installed to encode the captured animation frames as a looping GIF. Frames and their timing are kept in ignored `artifacts/documentation-frames/`; no personal vault content is included. Playwright is supplied through `PLAYWRIGHT_PATH`, as for the integration scripts.

## Compatibility

Canvas node rendering and viewport APIs are internal. Keep wrappers scoped to Canvas and node instances, restore them on unload, and preserve the native clipboard payload. Prefer public Obsidian APIs wherever they provide the required behavior.

Before submitting a change, test compact-card editing, size restoration, save/reopen, copy/paste, undo/redo, same-canvas links, and cross-canvas links. The exact current integration checks are recorded in `TEST-RESULTS.json`.
