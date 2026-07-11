# Streamwheel

[![Deploy](https://github.com/ZSleyer/streamwheel/actions/workflows/deploy.yml/badge.svg?branch=main)](https://github.com/ZSleyer/streamwheel/actions/workflows/deploy.yml)
[![License: AGPL-3.0](https://img.shields.io/github/license/ZSleyer/streamwheel)](LICENSE)

A wheel of fortune for streamers and content creators. Build a wheel with custom probabilities, spin it on stream via an OBS overlay, and control everything live from your browser. No backend, no accounts, no tracking.

**Live:** https://zsleyer.github.io/streamwheel/

## Features

- **Weighted entries**: give any entry a fixed percentage, the remainder is split evenly across the rest. Fair spins via `crypto.getRandomValues`.
- **Share links**: the whole wheel is encoded into the URL hash, so a wheel can be shared with a single link. All incoming data is strictly validated.
- **OBS overlay** (`?overlay`): transparent background, big wheel, spins on click or space (use OBS "Interact").
- **OBS remote control**: connect the editor page to the built-in obs-websocket server (OBS 28+, Tools -> WebSocket Server Settings). Spins and wheel edits then drive the overlay inside OBS live, with the same winner on both sides. Runs entirely on localhost.
- **Bookmark links**: store the OBS connection (port + password, obfuscated) in a local bookmark that reconnects automatically on open.
- **Overlay auto-hide**: fade the overlay out after a configurable idle time and back in on the next spin.
- **Customization**: per-entry colors, pointer position (top/right/bottom/left), confetti toggle.
- **Bilingual** (German/English) and follows the system dark/light mode.
- **Accessible**: built to WCAG 2.2 AA (labels, focus rings, live regions, reduced-motion support, contrast-safe palette).

## Persistence and privacy

Everything is stored client-side:

- Wheels live in `localStorage` and in share-link URLs (base64url JSON, length-limited, validated on decode).
- Passwords never appear in normal share links. Bookmark links contain the OBS password only obfuscated, keep them local.
- A strict Content-Security-Policy meta tag ships with every production build.

## OBS setup

1. Open the settings on the editor page and copy the overlay link (or click "OBS overlay").
2. In OBS, add a **browser source** with that URL. The background is transparent.
3. Spin directly in OBS via right click on the source -> **Interact** (click or space), or:
4. Enable the WebSocket server in OBS (**Tools -> WebSocket Server Settings**), then connect from the editor settings with port and password. "Spin" and all edits now control the overlay in OBS.

Overlay URL parameters: `hide=<seconds>` (auto-hide), `pointer=top|right|bottom|left`, `confetti=0`.

## Development

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # vitest
npm run build    # production build in dist/
```

Stack: Vite, React, TypeScript, Tailwind CSS v4, lucide-react. No server.

## Deployment

Pushes to `main` deploy to GitHub Pages via `.github/workflows/deploy.yml` (build with `BASE_PATH=/streamwheel/`, then `actions/deploy-pages`). In the repository settings, set **Pages -> Source** to **GitHub Actions** once.

## Contributing

Pull requests are welcome! Streamwheel was built with the help of LLM coding assistants, so PRs created with the help of LLM agents are explicitly welcome too.

## License Notice

This project is licensed under the [GNU Affero General Public License v3 (AGPLv3)](LICENSE).
