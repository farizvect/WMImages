# MW Images

A privacy-focused image watermark editor that runs entirely in your browser. No backend, analytics, CDN, or network requests.

## Run locally

```sh
cd /home/fariz/codes/mw-images
npm start
```

Open `http://localhost:4173`. The server can also bind to `0.0.0.0` for access over Tailscale, for example `http://100.107.247.13:4173`.

## Features

### Text watermarks

- Multiline textarea input — each line can become its own watermark row
- Font family, size, weight, and color controls
- Opacity and rotation controls

### Logo watermarks

- Local PNG, JPG, or WebP logo files
- Editable logo scale
- Transparent PNG recommended

### Five watermark styles

| Style | Position | Rotation | Special control |
|---|---|---|---|
| **Single** | 9 presets + drag | Fully adjustable | — |
| **Tiled** | Fixed layout | Locked | — |
| **Text rows** | Fixed layout | Locked | **Row gap** |
| **Diagonal bands** | Fixed layout | Adjustable from -30° | **Pattern gap** |
| **Dense grid** | Fixed layout | Locked | — |

Notes:

- Only **Single** supports manual positioning and dragging.
- Rotation is available only for **Single** and **Diagonal bands**.
- Diagonal bands use a base angle of -30°; the rotation slider adds an offset to it.
- **Row gap** controls spacing between text rows.
- **Pattern gap** controls spacing between diagonal bands.
- Layout generation is capped at 2,000 instances per render to prevent browser freezes.

### Export

- Exports at the original image resolution, not the preview resolution
- PNG, JPG, and WebP output
- Adjustable export quality
- Preview and export use the same rendering function for consistent results

### Onboarding

A four-step onboarding guide explains the workflow on the first visit. It is stored in browser `localStorage` and appears only once per browser profile.

## Privacy

- Image decoding, rendering, and export happen locally through the Canvas API
- No `fetch`, `XMLHttpRequest`, remote assets, analytics, or backend
- Image files never leave your device
- No project dependencies are required

## Tests

```sh
npm test
```

The test suite covers:

- `tests/editor.test.mjs` — multiline parsing, style layout generators, coverage, 2,000-instance cap, dispatcher, and utility behavior
- `tests/ui.test.mjs` — five style buttons, multiline textarea, contextual controls, onboarding, and privacy UI contract

## Project structure

```text
index.html              Application shell and UI
src/app.mjs             Browser state, Canvas rendering, and interactions
src/editor-core.mjs     Pure layout and watermark helpers
src/styles.css          Responsive terminal-style UI
 tests/                  Node built-in test suite
docs/plans/             Feature implementation plans
```

## License

No license has been declared yet.

## Repository

[github.com/farizvect/WMImages](https://github.com/farizvect/WMImages)

## Disclaimer

This tool is provided as-is. Always verify exported files before publishing or distributing them.

