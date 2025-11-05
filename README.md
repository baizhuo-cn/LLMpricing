# baizhuo-AI.github.io

AI 价格看板

## LLM Pricing Dashboard

This repository hosts a static HTML/CSS/JavaScript application for browsing Large Language Model pricing data. The app consumes the canonical dataset in [`data/official_pricing.json`](data/official_pricing.json) and persists user preferences locally via `localStorage`.

## Features

- Multi-language interface (Simplified Chinese and English) loaded from `/i18n` JSON files.
- Pricing filters: vendor multi-select, search, favorites only, common models only.
- Currency and unit switches (CNY/USD and per-million/per-thousand tokens) using locally stored exchange rates.
- Per-model comment drawer with local persistence and JSON export.
- Temporary CSV/XLSX “test import” for previewing unpublished price sheets in the browser.
- Preferences, favorites, and comments stored locally; official data is immutable in the repository.
- Responsive layout with keyboard friendly controls.

## Getting started

Open [`index.html`](index.html) directly in a browser or serve the project with any static web server (e.g. `python -m http.server`). No build step is required.

## Project structure

```
/ (root)
├─ index.html                # Application shell
├─ styles.css                # Tailored styling
├─ app.js                    # Front-end logic (ES modules)
├─ /data
│  ├─ official_pricing.json  # Canonical pricing dataset
│  ├─ incoming/              # Drop-zone for CSV updates (maintainers only)
│  └─ tools/                 # Normalization scripts used by GitHub Actions
├─ /i18n                     # Language packs
├─ /docs/admin_guide.md      # Maintainer workflow documentation
└─ .github/workflows         # Automation for dataset updates
```

## Local data import

The “导入测试 / Import test file” action lets operators load CSV or XLSX files in the browser for preview. These files are never uploaded or committed. To promote data into production, follow the maintainer workflow documented in [`docs/admin_guide.md`](docs/admin_guide.md).

## Automation

GitHub Actions workflow `update-data.yml` normalizes CSV uploads in `data/incoming/` into `official_pricing.json` using the Node scripts in `data/tools`. See the admin guide for details.
