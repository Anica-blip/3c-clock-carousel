# 🎠 3C Clock Carousel

This project is part of the 3C Thread To Success™ ecosystem — a growing digital platform that combines creativity, structure, and real-world application.

The 3C Thread To Success™ brand, including its name, structure, characters (Aurion 3C Mascot), and overall system design, remains the intellectual property of the creator and is not included in this license.

Commercial use of the brand or replication of the ecosystem identity is not permitted without permission.

---

**A 3C Thread To Success™ Cooking Lab open-source tool.**

Animate uploaded card images in a vertical clock-rotation carousel sequence and export the result as a WebM video — ready for conversion to MP4 for social media and content production.

---

## ✨ Features

- **Drag & Drop Upload** — upload multiple card images at once
- **Drag-to-Reorder** — rearrange card sequence directly in the upload panel
- **Clock Carousel Animation** — 2 cards visible at a time; front card pops up on entry, shifts back as the next card rises
- **Timing Controls** — adjust card display duration, transition speed, and export loop count
- **Background Controls** — set custom background colour or enable transparent background for compositing
- **WebM Export** — records the animation via the browser's native `MediaRecorder` API and auto-downloads the file
- **Watermarked** — 3C branding embedded in every export
- **No Dependencies** — pure vanilla HTML, CSS, and JavaScript

---

## 🖥️ Usage

1. Open `index.html` in a supported browser (Chrome, Edge, or Firefox)
2. Upload 2 or more portrait card images using the upload panel
3. Drag thumbnails to reorder the card sequence
4. Adjust timing and background settings
5. Click **▶ Play** to preview the animation
6. Click **⬇ Export WebM** to record and download the video

### Converting WebM → MP4

The exported file is a `.webm` video. To convert:

- **[HandBrake](https://handbrake.fr/)** (free, GUI) — recommended for quick conversions
- **FFmpeg** (CLI): `ffmpeg -i 3c-clock-carousel.webm -c:v libx264 output.mp4`
- **[CloudConvert](https://cloudconvert.com/)** — browser-based, no install

---

## 🌐 Browser Compatibility

| Browser | Preview | Export (WebM) |
|---------|---------|---------------|
| Chrome  | ✅      | ✅            |
| Edge    | ✅      | ✅            |
| Firefox | ✅      | ✅            |
| Safari  | ✅      | ❌ Not supported |

> Safari does not support `canvas.captureStream()`. Export will show an error on Safari. Use Chrome or Edge for the full workflow.

---

## 🛠️ Tech Stack

- **Vanilla HTML5 / CSS3 / JavaScript** — no frameworks, no build tools
- **Canvas API** — frame-by-frame animation rendering
- **MediaRecorder API** — browser-native video recording
- **File API** — local image loading without a server

---

## 📁 File Structure

```
3c-clock-carousel/
├── index.html     Main application
├── style.css      Styles and layout
├── app.js         Animation, upload, and export logic
├── README.md
├── SETUP.md
└── LICENSE
```

---

## 📜 License

MIT License — see [LICENSE](./LICENSE)

---

## 🎨 Credits

*Designed and Built with ❤️ by Claude (Anthropic) × Chef Anica · 3C Thread To Success™ Cooking Lab*  🧪👨‍🍳

"Think Smarter, Not Harder - Zero Shortcuts"

---

## 👤 Creator

Anica-blip (“Chef”)
Founder of 3C Thread To Success™ ("Cooking Lab")
Independent Creator | Community Builder

---

🧠 Philosophy

“Think it. Do it. Own it.”

This project was built from vision, persistence, and a commitment to creating meaningful and structured experiences — even with minimal resources.

