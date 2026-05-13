# ⚙️ Setup Guide — 3C Clock Carousel

---

## Requirements

| Requirement | Notes |
|-------------|-------|
| Modern browser | Chrome 79+, Edge 79+, or Firefox 71+ |
| No Node.js | Not required for basic use |
| No server | Not required for basic use |
| No API keys | None required |

---

## Option 1 — Open Directly (Quickest)

1. Clone or download this repository
2. Open `index.html` in Chrome, Edge, or Firefox

```bash
git clone https://github.com/YOUR_USERNAME/3c-clock-carousel.git
cd 3c-clock-carousel
# open index.html in your browser
```

> ⚠️ Some browsers restrict local file access (`file://` protocol). If images fail to load, use a local server (Option 2).

---

## Option 2 — Local Development Server

If you have **Node.js** installed:

```bash
npx serve .
# Visit http://localhost:3000
```

Or with **Python**:

```bash
# Python 3
python -m http.server 8080
# Visit http://localhost:8080
```

Or install the [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) extension in VS Code and click **Go Live**.

---

## Option 3 — GitHub Pages (Recommended for Sharing)

1. Push the repository to GitHub
2. Go to **Settings → Pages**
3. Set source branch to `main`, folder to `/ (root)`
4. Save — your tool will be live at:

```
https://Anica-blip.github.io/3c-clock-carousel/
```

No build step required. The site deploys as-is.

---

## Option 4 — Vercel / Netlify (One-Click Deploy)

Both platforms support static sites with zero configuration.

**Vercel:**
```bash
npm i -g vercel
vercel
```

**Netlify:** Drag and drop the project folder at [netlify.com/drop](https://app.netlify.com/drop)

---

## Export Notes

- Exported files are saved as `.webm` (VP9 codec)
- Transparent background exports require VP9 codec support (Chrome/Edge)
- To convert to MP4: use HandBrake, FFmpeg, or CloudConvert (see README)

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Images don't load locally | Use a local server (Option 2) |
| Export button does nothing | Check browser is Chrome/Edge/Firefox |
| Export fails on Safari | Not supported — use Chrome or Edge |
| Animation is choppy | Close other browser tabs; reduce transition speed |
| Blank canvas on open | Upload at least 2 card images to start |

---

*Built with ❤️ by Claude (Anthropic) × Chef Anica · 3C Thread To Success™ Cooking Lab 🧪👨‍🍳*
