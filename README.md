# Annotator

A modern, fully client-side web application for **annotating PDF documents**. Upload a PDF, draw bounding boxes, attach structured data, and export or migrate your annotations – all without a backend server.

---

## ✨ Features

- **PDF → Image pipeline** — Converts each page of an uploaded PDF into high-resolution images using `pdf.js` so you can annotate visually.
- **Bounding-box annotations** — Draw rectangles directly on the page preview. Coordinates are stored **relative** to the page, making annotations resolution-independent.
- **Object registry** — Define rich object schemas (including nested objects, arrays, enums) in the UI. Validation is powered by **Zod**.
- **OCR integration** — Run client-side text extraction with **Tesseract.js** to prefill annotation content.
- **Generative AI parsing** — Use OpenAI (GPT-4.1-mini, o3, o4-mini, etc.) to turn free-form text into structured objects via `openai/helpers/zod`.
- **Offline-ready data** — All images and annotations are cached in **IndexedDB** (`idb`). No external database or server is required.
- **Import / Export** — Export your entire annotation set as JSON or ZIP, import it later, and run automatic **migration utilities** when schemas evolve.
- **Next.js 15 App Router** UI — Lightning-fast React 19 interface styled with **Tailwind CSS v4**.
- **Cloudflare Pages / Workers** deployment — One-command shipping through **OpenNext**.
- **Comprehensive test suite** — 20+ Jest & React-Testing-Library tests ensure every core helper and component works.

---

## 🏗️ Tech Stack

| Layer          | Library / Tool                                            |
| -------------- | --------------------------------------------------------- |
| Framework      | Next.js 15 (App Router)                                   |
| Language       | React 19, JavaScript (ES2023)                             |
| Styling        | Tailwind CSS 4 + PostCSS                                  |
| PDF Rendering  | `pdfjs-dist`                                              |
| OCR            | `tesseract.js`                                            |
| Client Storage | `idb` (IndexedDB wrapper)                                 |
| Validation     | `zod`                                                     |
| AI Integration | `openai` SDK                                              |
| Testing        | Jest 29 · RTL · jsdom                                     |
| Linting        | ESLint 9 + `eslint-config-next`                           |
| Deployment     | Cloudflare Pages / Workers via **@opennextjs/cloudflare** |

---

## 📂 Folder Structure

```
annotator/
├─ public/                # Static assets (incl. pdf.worker.min.mjs)
├─ src/
│  ├─ app/                # Next.js 15 App Router routes
│  │   ├─ annotate/       # /annotate – main workspace
│  │   ├─ objects/        # /objects – object registry CRUD
│  │   └─ ...
│  ├─ components/         # Re-usable React components (UI & logic)
│  ├─ utils/              # Pure helpers (DB, migration, OpenAI, etc.)
│  └─ __tests__/          # Jest test suite
├─ open-next.config.ts    # Cloudflare deployment config
├─ wrangler.jsonc         # Wrangler (Cloudflare) settings
└─ ...
```

> **Note** Everything runs entirely in the browser – no server-side PDFs or annotation data are stored.

---

## 🚀 Getting Started

1. **Clone & install dependencies**

   ```bash
   git clone <your-fork-url>
   cd annotator
   npm install
   ```

2. **Run the dev server**

   ```bash
   npm run dev
   ```

   Open <http://localhost:3000> in your browser.

---

## 🧪 Testing

- Unit & component tests: `npm test`
- Jest configuration lives in `jest.config.js` and auto-mocks heavy dependencies (pdf.js worker, IndexedDB) for fast CI runs.

---

## 📝 Linting & Formatting

```bash
npm run lint   # ESLint (Next.js rules)
```

> The project uses ESLint 9 and the official `eslint-config-next` preset. Ensure your editor has ESLint integration enabled for the best DX.

---

## ☁️ Deployment to Cloudflare

This repo is pre-configured for **Cloudflare Pages** & **Workers** via [OpenNext](https://opennext.js.org/):

```bash
npm run deploy   # Build + upload to Cloudflare
npm run preview  # Build + preview locally with Cloudflare worker
```

Make sure you have [`wrangler`](https://developers.cloudflare.com/workers/wrangler/) installed and authenticated.

---

## ➕ Contributing

1. Fork the repo and create your feature branch (`git checkout -b feat/some-feature`).
2. Make changes and **add tests + docs** for any new behaviour.
3. Run `npm test` and `npm run lint` – everything must pass.
4. Submit a pull request, describing the problem and solution clearly.
