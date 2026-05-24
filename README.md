# NFT Art Generator (Svelte edition)

A generative art engine for layered NFT collections, built with **SvelteKit 2** and **Svelte 5 runes**. Upload your trait folders, set rarities as honest percentages, sanity-check the output, and ship a ZIP or push straight to IPFS.

![SvelteKit](https://img.shields.io/badge/SvelteKit-2-FF3E00?style=flat-square&logo=svelte)
![Svelte](https://img.shields.io/badge/Svelte-5-FF3E00?style=flat-square&logo=svelte)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Tailwind](https://img.shields.io/badge/Tailwind-v4-38BDF8?style=flat-square&logo=tailwindcss)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

This is a Svelte rewrite of [0xSylla/Generative-NFT-Art-Metadata-Generator](https://github.com/0xSylla/Generative-NFT-Art-Metadata-Generator). The Next.js original gave us the spec; we just fuck with Svelte more.

---

## What's in the box

- **Four-step flow** with a sticky header, sticky bottom nav, and a per-step debug panel so you can see exactly why the next button is disabled.
- **Percentage-based rarities** down to 0.001%, with live "actual share" feedback and a one-click Normalize per layer.
- **Image dimension validation** that blocks export if your traits don't share a canvas size (because overlapping layers of mismatched sizes look terrible).
- **Drag-to-reorder layers** with a live preview canvas.
- **Incompatible trait rules** so two traits never appear on the same token.
- **Pre-reveal placeholder** (image + optional animation) and a **soulbound** flag for non-transferable collections.
- **ZIP export** with `images/` and `metadata/` folders, ERC-721/1155-shaped JSON.
- **One-click IPFS deployment** via Pinata; get back your images CID and metadata base URI.
- **Light + dark mode** with the abasho LCD palette (sage / ink in light, near-black / sage in dark).

---

## Stack

- [SvelteKit 2](https://svelte.dev/docs/kit) + Svelte 5 (runes)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS v4](https://tailwindcss.com/) via `@tailwindcss/vite`
- [tailwind-variants](https://www.tailwind-variants.org/) + [tailwind-merge](https://github.com/dcastil/tailwind-merge) for UI primitives
- [lucide-svelte](https://lucide.dev/) for icons
- [JSZip](https://stuk.github.io/jszip/) for export
- Canvas API for rendering

---

## Getting started

### Prerequisites

- Node.js 18+
- npm / pnpm / yarn

### Install

```bash
git clone <this repo>
cd nft-generator
npm install
```

### Run

```bash
npm run dev      # http://localhost:5173
npm run check    # svelte-check + TS
npm run build    # production build
```

---

## Usage

### 1. Collection setup

Give it a name, description, and target size (1–10000). Then pick the folder containing your layer subfolders, like:

```text
my-collection/
├── Background/
│   ├── blue.png
│   └── sunset.png
├── Body/
│   ├── frog.png
│   └── cat.png
└── Eyes/
    └── ...
```

The picker reads `webkitRelativePath`, so it grabs subfolders even though Files API doesn't natively support them. Each trait starts with an evenly distributed weight (so each layer sums to 100% out of the gate).

After you upload, the app reads each image's dimensions in the background. If anything doesn't match, you'll see exactly which layers are off and you can't move on until they do.

### 2. Layers & rarities

Drag layers to set the stack order (top of the list = rendered last = on top). Tune each trait's percentage with the +/- controls or by typing. The sum line at the bottom of each layer turns amber if it's not exactly 100%; one click normalizes everything to sum back to 100%.

Add incompatible-trait rules in the side panel to stop two traits from ever appearing together.

### 3. Preview

The whole collection renders into a grid on a single page. Hit Regenerate to roll new combinations. The debug panel tells you how many duplicates you got so you can decide whether to widen the rarity spread or add more traits.

### 4. Export

Either download a ZIP (`images/0.png`, `metadata/0.json`, …) or paste a Pinata JWT and push the whole thing to IPFS. You get back the Images CID and the Metadata base URI ready to drop into your contract.

---

## Project layout

```text
src/
├── app.css                       # Tailwind v4 theme + abasho design tokens
├── app.html                      # font links (Satoshi + JetBrains Mono)
├── lib/
│   ├── components/
│   │   ├── Step1Setup.svelte
│   │   ├── Step2Layers.svelte
│   │   ├── Step3Preview.svelte
│   │   ├── Step4Export.svelte
│   │   ├── DebugPanel.svelte     # per-step gating checks + event log
│   │   ├── StepIndicator.svelte  # sticky header indicator
│   │   ├── StepNav.svelte        # sticky bottom nav
│   │   └── ui/                   # Button, Card, Input, etc.
│   ├── stores/
│   │   ├── generator.svelte.ts   # core state (replaces useNFTGenerator)
│   │   ├── debug.svelte.ts       # debug event store
│   │   └── theme.svelte.ts       # light/dark theme store
│   ├── utils/ipfs.ts             # Pinata helpers
│   └── types.ts
└── routes/
    ├── +layout.svelte
    └── +page.svelte              # wires the 4 steps + sticky shell
```

---

## Differences from the upstream

| | Upstream (React/Next) | This (Svelte) |
|---|---|---|
| Framework | Next.js 15 | SvelteKit 2 + Svelte 5 runes |
| State | `useNFTGenerator` hook | Svelte store with runes |
| Styling | Vanilla CSS + glassmorphism | Tailwind v4 + abasho LCD theme |
| Rarities | Integer weights (0–100) | Percentages (0.001%–100%) with normalize |
| Image checks | None | Auto dimension validation on upload |
| Debug | None | Per-step debug panel + console mirror |
| Theme | Dark only | Light + dark toggle |

Behavior parity is intentional: layer parsing, trait picking, rule enforcement, metadata shape, and IPFS upload are all the same. If you find a behavior gap with upstream, that's a bug, please file an issue.

---

## Credits

- Spec and original implementation: [0xSylla/Generative-NFT-Art-Metadata-Generator](https://github.com/0xSylla/Generative-NFT-Art-Metadata-Generator)
- Design language: abasho LCD aesthetic

---

## License

MIT.
