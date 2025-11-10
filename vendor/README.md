# Vendor Assets

This directory hosts third-party bundles that are self-hosted to avoid third-party storage warnings in strict browsers.

## XLSX Stub

`xlsx.full.min.js` contains a lightweight CSV/TSV parser that exposes the `XLSX` global used by the dashboard. It is intended as a stopgap when the upstream SheetJS bundle cannot be fetched during development.

For production use, replace this file with the official [`xlsx.full.min.js`](https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js) build from SheetJS to enable full XLSX support.
