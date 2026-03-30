# Infinite Canvas

<p align="center">
  A smooth, minimal infinite drawing surface for fast sketching and ideation.
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> •
  <a href="#deploy">Deploy</a> •
  <a href="#project-structure">Architecture</a> •
  <a href="#roadmap">Roadmap</a>
</p>

<p align="center">
  <img alt="Vite" src="https://img.shields.io/badge/Vite-7.x-646CFF?logo=vite&logoColor=white">
  <img alt="JavaScript" src="https://img.shields.io/badge/JavaScript-ESM-F7DF1E?logo=javascript&logoColor=111">
  <img alt="Node" src="https://img.shields.io/badge/Node-18%2B-339933?logo=node.js&logoColor=white">
  <img alt="License" src="https://img.shields.io/badge/License-MIT-blue">
</p>

---

## Why this project

Infinite Canvas is built to keep interaction fluid and predictable while staying easy to extend.
It focuses on responsive input, clean rendering, and a lightweight architecture.

## Highlights

- Infinite pan and zoom camera flow
- Fast stroke rendering pipeline
- Keyboard and pointer-first interaction model
- Text input support for mixed sketch + note workflows
- Vanilla JS codebase for easy customization

## Preview

Drop a GIF or screenshot into `docs/preview.gif` to showcase interactions:

`![Infinite Canvas preview](./docs/preview.gif)`

## Quick Start

### Prerequisites

- Node.js `18+` (latest LTS recommended)
- npm

### Run locally

```bash
npm install
npm run dev
```

Open the local URL shown in your terminal.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Runs local dev server |
| `npm run build` | Builds production output to `dist/` |
| `npm run preview` | Serves the production build locally |

## Deploy

### Vercel (recommended)

1. Import the GitHub repository in Vercel.
2. Use Vite defaults:
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. Deploy.

Production URL behavior:

- First deploy gives you one production link.
- Every push to the production branch redeploys updates to that same link.
- Extra preview links are created for branch/PR builds.

Tip: keep `main` as production and test features in separate branches.

## Project Structure

```text
src/
  main.js       App entry and global state flow
  input.js      Pointer + keyboard interactions
  renderer.js   Render loop and draw pipeline
  strokes.js    Stroke creation and state logic
  text.js       Text tool behavior
  camera.js     Pan/zoom transforms
  style.css     UI and canvas styling
```

## Roadmap

- [ ] Export canvas to PNG
- [ ] Add layer support
- [ ] Add undo/redo history timeline
- [ ] Add touch-specific gesture tuning

## Contributing

Small and focused pull requests are preferred.
If adding major behavior, open an issue first to align on direction.

## License

MIT

