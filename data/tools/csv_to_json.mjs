#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const columnMap = new Map([
  ['厂商', 'vendor'],
  ['模型名称', 'model'],
  ['官方输入价格/M token', 'input_per_million'],
  ['官方输出价格/M token', 'output_per_million'],
  ['模型说明', 'desc'],
  ['温度范围', 'temp_range'],
  ['默认温度', 'temp_default'],
  ['模型地区', 'region'],
  ['是否常用模型', 'is_common'],
  ['是否收藏', 'is_favorite'],
  ['vendor', 'vendor'],
  ['model', 'model'],
  ['input_per_million', 'input_per_million'],
  ['output_per_million', 'output_per_million'],
  ['desc', 'desc'],
  ['temp_range', 'temp_range'],
  ['temp_default', 'temp_default'],
  ['region', 'region'],
  ['is_common', 'is_common'],
  ['is_favorite', 'is_favorite']
]);

const incomingDir = new URL('../incoming/', import.meta.url);
const outputFile = new URL('../official_pricing.json', import.meta.url);
const incomingPath = fileURLToPath(incomingDir);
const outputPath = fileURLToPath(outputFile);

function usage() {
  console.error('Usage: node data/tools/csv_to_json.mjs [path/to/file.csv]');
}

function detectLatestFile(dirPath) {
  const entries = fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.toLowerCase().match(/\.(csv|tsv)$/));
  if (!entries.length) return null;
  entries.sort((a, b) => fs.statSync(path.join(dirPath, b.name)).mtimeMs - fs.statSync(path.join(dirPath, a.name)).mtimeMs);
  return path.join(dirPath, entries[0].name);
}

function parseDelimited(text, delimiter) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"') {
      if (quoted && next === '"') {
        cell += '"';
        i++;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (!quoted && char === delimiter) {
      row.push(cell);
      cell = '';
      continue;
    }
    if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') {
        i++;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    cell += char;
  }
  row.push(cell);
  rows.push(row);
  return rows
    .map(cells => cells.map(c => c.replace(/\u0000/g, '').trim()))
    .filter(rowCells => rowCells.some(c => c !== ''));
}

function parsePrice(value) {
  if (!value) return null;
  const cleaned = String(value).replace(/[^0-9.\-]/g, '');
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function parseTempRange(value) {
  if (!value) return [];
  const text = String(value).replace(/[\[\]()（）]/g, '');
  const parts = text
    .split(/[-–~]/)
    .map(part => Number(part.trim()))
    .filter(num => !Number.isNaN(num));
  if (!parts.length) return [];
  if (parts.length === 1) return [parts[0], parts[0]];
  return parts.slice(0, 2);
}

function parseNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(String(value).trim());
  return Number.isFinite(num) ? num : null;
}

function parseBoolean(value) {
  if (value === undefined || value === null) return false;
  const text = String(value).trim().toLowerCase();
  return ['是', 'yes', 'true', 'y', '1'].includes(text);
}

function normalizeRow(record) {
  const vendor = (record.vendor || '').trim();
  const model = (record.model || '').trim();
  if (!vendor || !model) return null;
  return {
    id: `${vendor}::${model}`,
    vendor,
    model,
    currency: 'CNY',
    input_per_million: parsePrice(record.input_per_million),
    output_per_million: parsePrice(record.output_per_million),
    desc: (record.desc || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n'),
    temp_range: parseTempRange(record.temp_range || ''),
    temp_default: parseNumber(record.temp_default || ''),
    region: (record.region || '').trim(),
    is_common: parseBoolean(record.is_common || ''),
    is_favorite: parseBoolean(record.is_favorite || '')
  };
}

function mapHeaders(headers) {
  return headers.map(header => columnMap.get(header.trim()) || header.trim());
}

function main() {
  let filePath = process.argv[2];
  if (!filePath) {
    filePath = detectLatestFile(incomingPath);
    if (!filePath) {
      usage();
      console.error('No CSV/TSV files found in data/incoming/.');
      process.exit(1);
    }
  }
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`File not found: ${resolvedPath}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(resolvedPath, 'utf8');
  const delimiter = raw.includes('	') ? '	' : ',';
  const rows = parseDelimited(raw, delimiter);
  if (!rows.length) {
    console.error('Input file is empty.');
    process.exit(1);
  }
  const headers = mapHeaders(rows[0]);
  const records = rows.slice(1).map(cells => {
    const record = {};
    headers.forEach((header, idx) => {
      if (columnMap.has(header) || columnMap.has(rows[0][idx])) {
        record[header] = cells[idx] ?? '';
      }
    });
    return record;
  });
  const cleaned = records.map(normalizeRow).filter(Boolean);
  cleaned.sort((a, b) => a.vendor.localeCompare(b.vendor) || a.model.localeCompare(b.model));
  fs.writeFileSync(outputPath, JSON.stringify(cleaned, null, 2), 'utf8');
  console.log(`Wrote ${cleaned.length} rows → ${outputPath}`);
}

main();
