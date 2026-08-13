# Chrome Web Store Listing Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce an English Chrome Web Store listing package containing copy, one icon, three screenshots, and one small promotional tile at exact upload dimensions.

**Architecture:** Use one generated, text-free marketing motif as optional artwork, then compose all exact text and product UI in deterministic local HTML/CSS. A dependency-free Node renderer invokes installed Chrome headlessly for exact-size PNG exports, and a validator parses each PNG header to enforce dimensions and 24-bit RGB output.

**Tech Stack:** HTML, CSS, Node.js ESM, local Google Chrome headless, built-in image generation, repository Markdown documentation.

---

## File structure

- `store-assets/source/listing-assets.html`: all five fixed-size asset canvases, selected with `?asset=<id>`.
- `store-assets/source/listing-assets.css`: Insight Signal tokens and exact icon, screenshot, options, and promo compositions.
- `store-assets/source/marketing-motif.png`: generated text-free abstract link/spark motif for the promotional tile.
- `store-assets/final/*.png`: upload-ready raster exports.
- `store-assets/README.md`: copy/paste dashboard fields, asset mapping, and truthful preview limitations.
- `scripts/render-store-assets.mjs`: discover Chrome and export all canvases at exact sizes.
- `scripts/validate-store-assets.mjs`: verify PNG dimensions, RGB color type, file presence, and forbidden secret-like text in source.
- `package.json`: reproducible asset render and validation scripts.

### Task 1: Generate the marketing motif

**Files:**

- Create: `store-assets/source/marketing-motif.png`

- [ ] **Step 1: Generate one text-free motif with the built-in image tool**

Use this exact production prompt:

```text
Use case: ads-marketing
Asset type: Chrome Web Store small promotional tile background element
Primary request: Create a polished abstract emblem combining two interlocking chain-link shapes with one small four-point insight sparkle.
Scene/backdrop: deep navy studio field fading from #080f24 to #111c3a.
Style/medium: crisp premium 3D vector-like illustration, simple geometry, no photorealism.
Composition/framing: subject isolated on the right half, generous empty negative space on the left for later copy, centered vertically, fully inside frame.
Lighting/mood: subtle cyan glow, focused and professional.
Color palette: cyan #67e8f9, blue #60a5fa, deep navy.
Text: none.
Constraints: no logos, no brand names, no UI, no letters, no watermark; do not imitate Google, Atlassian, Jira, or Gemini branding.
```

- [ ] **Step 2: Save and inspect the selected output**

Copy the selected built-in output into `store-assets/source/marketing-motif.png`, inspect it with the local image viewer, and reject it if it contains text, a third-party logo, or insufficient left-side negative space.

- [ ] **Step 3: Commit the selected source image**

```bash
git add store-assets/source/marketing-motif.png
git commit -m "design: add link insight marketing motif"
```

### Task 2: Build deterministic asset source canvases

**Files:**

- Create: `store-assets/source/listing-assets.html`
- Create: `store-assets/source/listing-assets.css`

- [ ] **Step 1: Create the five asset canvases**

The document must select exactly one canvas using the `asset` query parameter and expose these IDs and dimensions:

```js
const asset = new URLSearchParams(location.search).get('asset');
document.querySelectorAll('[data-asset]').forEach((element) => {
  element.hidden = element.dataset.asset !== asset;
});
```

```html
<main data-asset="icon" class="asset icon-asset" aria-label="Store icon"></main>
<main data-asset="screenshot-01" class="asset screenshot-asset"></main>
<main data-asset="screenshot-02" class="asset screenshot-asset"></main>
<main data-asset="screenshot-03" class="asset screenshot-asset"></main>
<main data-asset="promo-small" class="asset promo-small-asset"></main>
```

The visible copy and fictional data must match the approved design document exactly. Screenshot 1 must contain exactly three summary bullets. Screenshot 2 must show `Review transition`, not a one-click success state. Screenshot 3 must show only concealed key characters and the fictional host `acme.atlassian.net`.

- [ ] **Step 2: Implement fixed dimensions and the Insight Signal tokens**

```css
:root {
  --navy-950: #080f24;
  --navy-900: #111c3a;
  --cyan-300: #67e8f9;
  --blue-400: #60a5fa;
}

.icon-asset {
  width: 128px;
  height: 128px;
}
.screenshot-asset {
  width: 1280px;
  height: 800px;
}
.promo-small-asset {
  width: 440px;
  height: 280px;
}
```

All canvases must have an opaque background, system fonts, and no external network resources. The promotional tile may use `marketing-motif.png` as an optional right-side background element, but text remains HTML.

- [ ] **Step 3: Preview all five assets locally**

Open each `file:///.../listing-assets.html?asset=<id>` URL and verify no clipping, scrollbars, low-contrast text, or hidden overflow affecting intended content.

- [ ] **Step 4: Commit the deterministic source**

```bash
git add store-assets/source/listing-assets.html store-assets/source/listing-assets.css
git commit -m "design: compose web store listing canvases"
```

### Task 3: Add reproducible rendering and validation

**Files:**

- Create: `scripts/render-store-assets.mjs`
- Create: `scripts/validate-store-assets.mjs`
- Modify: `package.json`

- [ ] **Step 1: Add the renderer**

Implement this manifest and invoke Chrome once per entry with `--headless=new`, `--hide-scrollbars`, `--force-device-scale-factor=1`, `--window-size=<width>,<height>`, and `--screenshot=<absolute output>`:

```js
const assets = [
  ['icon', 128, 128, 'sdcorejs-link-insight-icon-128.png'],
  ['screenshot-01', 1280, 800, 'screenshot-01-hover-summary.png'],
  ['screenshot-02', 1280, 800, 'screenshot-02-jira-transition.png'],
  ['screenshot-03', 1280, 800, 'screenshot-03-settings-privacy.png'],
  ['promo-small', 440, 280, 'promo-small-440x280.png'],
];
```

Resolve `CHROME_PATH` first, then the installed Windows, macOS, and Linux stable-Chrome paths. Fail with an actionable message if no browser is found.

- [ ] **Step 2: Add the validator**

Parse the PNG signature and IHDR bytes directly. Require bit depth `8`, color type `2` (RGB, no alpha), exact width and height, and a non-trivial file size. Scan source text and fail if it contains credential-shaped sample values or third-party remote asset URLs.

- [ ] **Step 3: Add package scripts**

```json
{
  "store:assets": "node scripts/render-store-assets.mjs && node scripts/validate-store-assets.mjs",
  "store:assets:validate": "node scripts/validate-store-assets.mjs"
}
```

- [ ] **Step 4: Render and validate**

Run:

```bash
npm run store:assets
```

Expected: five PNG files are rendered and validation reports all five as valid RGB PNGs at their exact dimensions.

- [ ] **Step 5: Commit rendering support and exports**

```bash
git add package.json scripts/render-store-assets.mjs scripts/validate-store-assets.mjs store-assets/final
git commit -m "build: render chrome web store assets"
```

### Task 4: Package the listing copy and verify the final images

**Files:**

- Create: `store-assets/README.md`

- [ ] **Step 1: Add the dashboard copy and upload mapping**

Include the approved name, summary, long description, `Productivity` category, `English` language, and a table mapping every final filename to the corresponding Chrome Web Store upload field.

- [ ] **Step 2: Document truthful limitations**

State that Jira requires the configured companion service and approved Jira Cloud access, Confluence currently uses deterministic demo content, Gemini requires the user's key, AI summaries may be inaccurate, and the extension is not endorsed by Google or Atlassian.

- [ ] **Step 3: Inspect all final PNGs**

Open each final file with the local image viewer. Verify exact copy, three bullets in screenshot 1, a review-before-change flow in screenshot 2, concealed credentials in screenshot 3, and thumbnail legibility for icon and promo.

- [ ] **Step 4: Run repository checks affected by the new files**

Run:

```bash
npm run format:check
npm run store:assets:validate
git diff --check
```

Expected: all commands exit successfully.

- [ ] **Step 5: Commit the publisher handoff**

```bash
git add store-assets/README.md
git commit -m "docs: add chrome web store publisher handoff"
```

## Self-review

- Spec coverage: all approved fields and five assets map to implementation tasks.
- No placeholders: prompts, text, dimensions, filenames, commands, and validation rules are explicit.
- Type consistency: all renderer and validator asset IDs and filenames match across tasks.
