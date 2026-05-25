# NFT Art Generator (Svelte edition)

A generative art engine for layered NFT collections, built with **SvelteKit 2** and **Svelte 5 runes**. Upload your trait folders, set rarities as honest percentages, define multi-layer incompatibility rules, and ship a ZIP.

![SvelteKit](https://img.shields.io/badge/SvelteKit-2-FF3E00?style=flat-square&logo=svelte)
![Svelte](https://img.shields.io/badge/Svelte-5-FF3E00?style=flat-square&logo=svelte)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Tailwind](https://img.shields.io/badge/Tailwind-v4-38BDF8?style=flat-square&logo=tailwindcss)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

This is a Svelte rewrite of [0xSylla/Generative-NFT-Art-Metadata-Generator](https://github.com/0xSylla/Generative-NFT-Art-Metadata-Generator). The Next.js original gave us the spec; we just fuck with Svelte more.

---

## What's in the box

- **Four-step flow** with a floating sticky navbar and bottom step nav.
- **Drag-and-drop folder upload** that skips the browser's batch-upload prompt; clicking still works as a fallback.
- **Percentage-based rarities** down to 0.001%, with live "actual share" feedback and a one-click Normalize per layer.
- **Image dimension validation** that blocks export if your traits don't share a canvas size, with a 5-second per-file timeout so one weird file can't hang the whole upload.
- **Drag-to-reorder layers** with a full-width live preview.
- **Multi-condition incompatibility rules**: IF (one or more layers, with OR semantics within a layer and AND across layers) THEN block a trait. Built in a stepped IF / THEN flow with an inline summary.
- **Pre-reveal placeholder** (image + optional animation) and a **soulbound** flag for non-transferable collections.
- **Configurable export resolution** (1 to 8192 px²) with a "Match source" shortcut. Free tier is hard-capped at 500×500.
- **ZIP export** with `images/` and `metadata/` folders, ERC-721/1155-shaped JSON.
- **Honor-system paywall** (optional, env-gated): NFT holder bypass via [Sign-In with Ethereum](https://login.xyz/), pay-once option on mainnet or Base with live USD pricing, or self-host for free. Dev mode bypasses everything.
- **Light + dark mode** with the abashoverse design tokens: charcoal/offwhite/ink on translucent surfaces, sage-muted borders in dark.

---

## Stack

- [SvelteKit 2](https://svelte.dev/docs/kit) + Svelte 5 (runes)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS v4](https://tailwindcss.com/) via `@tailwindcss/vite`
- [tailwind-variants](https://www.tailwind-variants.org/) + [tailwind-merge](https://github.com/dcastil/tailwind-merge) for UI primitives
- [lucide-svelte](https://lucide.dev/) for icons
- [JSZip](https://stuk.github.io/jszip/) for export
- [viem](https://viem.sh/) for wallet connect, SIWE, contract reads, payment txs
- Canvas API for rendering
- Static adapter (`@sveltejs/adapter-static`) - the whole thing is a prerendered SPA, no server

---

## Getting started

### Prerequisites

- Node.js 18+
- npm / pnpm / yarn

### Install

```bash
git clone https://github.com/abashoverse/nft-generator.git
cd nft-generator
npm install
```

### Run

```bash
npm run dev      # http://localhost:5173
npm run check    # svelte-check + TS
npm run build    # production build (static, lands in build/)
npm run preview  # serve the production build locally
```

In `npm run dev`, the paywall is bypassed (see [Paywall](#paywall) below).

---

## Usage

### 1. Collection setup

Give it a name, description, and target size (1 to 10000). Then either drag your layers folder onto the dropzone or click to browse. Dragging avoids the browser's "Are you sure you want to upload all files from..." prompt; clicking triggers it.

The folder should look like:

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

Each subfolder = one layer, each file in it = one trait. The top folder name is ignored. Each trait starts with an evenly distributed weight (every layer sums to 100% out of the gate).

After upload, the app reads each image's dimensions via an `Image` element with a 5-second per-file timeout. If anything doesn't match, you'll see exactly which layers are off and you can't move on until they do.

### 2. Layers & rarities

Drag layers to set the stack order (top of the list = top of the canvas, like Photoshop). Tune each trait's percentage with the +/- controls or by typing. The sum line at the bottom of each layer turns amber when it isn't exactly 100%; one click normalizes everything back to 100%.

The right side has a full-width live preview canvas and a Generate Random button. Previews render at 512px for speed; the export resolution is independent.

Below the main card, click the **Incompatible traits** accordion to define rules. The builder is two-stepped:

- **Step 1: IF**. Add one or more layer conditions. Each is a column with checkboxes; checking multiple traits in one layer means OR. Across columns is AND.
- **Step 2: THEN BLOCK**. Pick the layer and trait to forbid when all IFs match. The blocked layer must not be in the IF conditions.

Example: `If Background = (blue or red) AND Hat = crown then block Eyes = laser-eyes`. Saved rules appear in a list above the builder; you can delete individually or clear all.

### 3. Preview

The whole collection renders into a thumbnail grid. Hit Regenerate to roll new combinations. Thumbnails render at low resolution for speed; final exports use the resolution from step 4.

### 4. Export

Set the **export resolution** (1 to 8192 px²), or click "Match source" to use your traits' native size for a lossless render. If the paywall is on and you haven't unlocked, the resolution is fixed at 500×500 (see [Paywall](#paywall)).

Then click **Generate & download ZIP** to render every token at the chosen size and download a ZIP with `images/0.png`, `metadata/0.json`, etc. Metadata is ERC-721/1155-shaped, ready to upload to your preferred storage.

---

## Configuration

All config is via env vars. Copy `.env.example` to `.env` and fill in what you want; everything is optional.

### Analytics

```bash
PUBLIC_UMAMI_SCRIPT_URL=https://umami.example.com/script.js
PUBLIC_UMAMI_WEBSITE_ID=your-website-id-here
```

Both must be set for the Umami snippet to inject; otherwise no analytics.

### Paywall

```bash
# Mainnet ERC-721 addresses for the free-access NFT holder check.
# Set either or both. Enables the "hold an NFT" path in the unlock modal.
PUBLIC_ABASHO_NFT_ADDRESS=0x...
PUBLIC_ABASHOS_NFT_ADDRESS=0x...

# Receiver wallet for the one-time payment. Enables the "pay once" path.
PUBLIC_PAY_RECEIVER_ADDRESS=0x...

# Payment amount in USD. Converted to ETH at runtime via CoinGecko. Default 10.
PUBLIC_PAY_AMOUNT_USD=10

# GitHub repo link for the self-host option. Hidden if unset.
PUBLIC_SELF_HOST_URL=https://github.com/abashoverse/nft-generator
```

If **none** of the paywall vars are set, the paywall is OFF and the app is fully free (same as dev mode). The moment any of them is set, the paywall turns on and each option in the unlock modal renders only if its specific config is set.

---

## Paywall

The free tier is hard-capped at **500×500** exports. Custom resolution unlocks via one of three paths:

1. **Hold an abasho or abashos NFT** on Ethereum mainnet. Connect wallet, sign in with Ethereum, click "Check holder status". The check also picks up [delegate.xyz](https://delegate.xyz) delegations, so a hot wallet can verify against NFTs sitting in a delegating vault without moving them.
2. **Pay once** in ETH on mainnet or Base. Default $10, converted to ETH live via CoinGecko.
3. **Self-host** the app yourself by cloning the repo. The whole codebase is open source, no paywall when running locally.

State is cached in `localStorage`. `npm run dev` (and any build where no paywall env vars are set) bypasses the gate entirely.

This is **honor-system gating**: everything runs client-side, so a determined user with dev tools can flip the localStorage flag and bypass it. The self-host link is the deliberate pressure release valve. If you need real enforcement, you'd want to move the export pipeline to a backend that verifies payment on-chain before serving the ZIP, which is out of scope for this version.

---

## Project layout

```text
src/
├── app.css                       # Tailwind v4 theme + abashoverse design tokens
├── app.html                      # font links (Satoshi + JetBrains Mono), OCB favicon
├── lib/
│   ├── components/
│   │   ├── Step1Setup.svelte
│   │   ├── Step2Layers.svelte
│   │   ├── Step3Preview.svelte
│   │   ├── Step4Export.svelte
│   │   ├── PreviewItem.svelte    # single tile in step 3 grid
│   │   ├── PaywallModal.svelte
│   │   ├── StepIndicator.svelte  # floating nav step pills
│   │   ├── StepNav.svelte        # floating bottom nav
│   │   └── ui/                   # Button, Card, Input, Modal, Pill, Select, etc.
│   ├── stores/
│   │   ├── generator.svelte.ts   # core state (layers, rules, config, collection)
│   │   └── theme.svelte.ts       # light/dark theme store
│   ├── paywall.svelte.ts         # paywall state, env-driven gating, localStorage cache
│   ├── web3.ts                   # viem helpers: connect, SIWE, balanceOf, sendTx, CoinGecko
│   └── types.ts
└── routes/
    ├── +layout.svelte            # umami injection, theme init
    ├── +layout.ts                # prerender + ssr=false
    └── +page.svelte              # floating shell, mounts the 4 steps
```

---

## Differences from the upstream

| | Upstream (React/Next) | This (Svelte) |
|---|---|---|
| Framework | Next.js 15 | SvelteKit 2 + Svelte 5 runes |
| State | `useNFTGenerator` hook | Svelte rune-based stores |
| Styling | Vanilla CSS + glassmorphism | Tailwind v4 + abashoverse tokens |
| Rarities | Integer weights (0 to 100) | Percentages (0.001% to 100%) with normalize |
| Image checks | None | Auto dimension validation on upload |
| Folder upload | Click only | Click or drag (drag skips the browser prompt) |
| Incompatibility | Pairwise (trait A ↔ trait B) | Multi-condition (N layers IF, 1 trait THEN) |
| Export resolution | Fixed | Configurable 1 to 8192 px² (paywalled at 500 by default) |
| Distribution | IPFS via Pinata | ZIP download only |
| Monetization | None | Optional honor-system paywall: NFT holder, pay once, or self-host |
| Theme | Dark only | Light + dark toggle |

If you came here for IPFS upload, that path was removed in favor of users handling their own pinning. The ZIP layout is compatible with most pinning services.

---

## Credits

- Spec and original implementation: [0xSylla/Generative-NFT-Art-Metadata-Generator](https://github.com/0xSylla/Generative-NFT-Art-Metadata-Generator)
- Design language: [abashoverse](https://abashoverse.com)

---

## License

MIT.
