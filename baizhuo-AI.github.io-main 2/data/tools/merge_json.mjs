#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

function usage() {
  console.error('Usage: node data/tools/merge_json.mjs base.json updates.json [output.json]');
}

function loadJson(filePath) {
  const full = path.resolve(filePath);
  if (!fs.existsSync(full)) {
    console.error(`File not found: ${full}`);
    process.exit(1);
  }
  const content = fs.readFileSync(full, 'utf8');
  try {
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) throw new Error('JSON root must be an array');
    return parsed;
  } catch (error) {
    console.error(`Failed to parse ${full}: ${error.message}`);
    process.exit(1);
  }
}

function toMap(records) {
  const map = new Map();
  for (const record of records) {
    if (!record || typeof record !== 'object') continue;
    if (!record.id) continue;
    map.set(record.id, record);
  }
  return map;
}

function main() {
  const [, , baseFile, updatesFile, outputFile] = process.argv;
  if (!baseFile || !updatesFile) {
    usage();
    process.exit(1);
  }
  const base = loadJson(baseFile);
  const updates = loadJson(updatesFile);
  const mergedMap = toMap(base);
  for (const entry of updates) {
    if (!entry?.id) continue;
    mergedMap.set(entry.id, entry);
  }
  const merged = Array.from(mergedMap.values()).sort((a, b) => {
    const vendorCompare = String(a.vendor || '').localeCompare(String(b.vendor || ''));
    if (vendorCompare !== 0) return vendorCompare;
    return String(a.model || '').localeCompare(String(b.model || ''));
  });
  const outFile = outputFile ? path.resolve(outputFile) : path.resolve(baseFile);
  fs.writeFileSync(outFile, JSON.stringify(merged, null, 2), 'utf8');
  console.log(`Merged ${merged.length} records → ${outFile}`);
}

main();
