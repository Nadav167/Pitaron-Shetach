#!/usr/bin/env node
/**
 * applySiteFixes.js — applies scripts/data/siteFixes.json to the dataset:
 * renames OpenStreetMap night camps that had no name of their own, and
 * removes the empty ones (see the _comment in that file). Safe to re-run.
 *
 * Also drops the removed sites from app/backend/data/nearbyPlaces.json,
 * which is keyed by site id.
 *
 * USAGE  node scripts/applySiteFixes.js [--dry-run]
 */

const fs = require("fs");
const path = require("path");
const { ROOT, CAMPSITES, parseArgs } = require("./lib/importHelpers");

const FIXES = path.join(__dirname, "data/siteFixes.json");
const NEARBY = path.join(ROOT, "app/backend/data/nearbyPlaces.json");

const args = parseArgs();
const fixes = JSON.parse(fs.readFileSync(FIXES, "utf8"));
const dataset = JSON.parse(fs.readFileSync(CAMPSITES, "utf8"));
const removed = new Set(fixes.remove);

let renamed = 0;
for (const record of dataset.campsites) {
  const name = fixes.rename[record.id];
  if (name && (record.name.he !== name.he || record.name.en !== name.en)) {
    record.name = { he: name.he, en: name.en };
    renamed++;
  }
}
const before = dataset.campsites.length;
dataset.campsites = dataset.campsites.filter((record) => !removed.has(record.id));
console.log(`Renamed ${renamed}, removed ${before - dataset.campsites.length}; ${dataset.campsites.length} sites`);

if (args["dry-run"]) return;
fs.writeFileSync(CAMPSITES, JSON.stringify(dataset, null, 2) + "\n");

if (fs.existsSync(NEARBY)) {
  const nearby = JSON.parse(fs.readFileSync(NEARBY, "utf8"));
  const sites = nearby.byCampsite;
  let dropped = 0;
  for (const id of removed) {
    if (!(id in sites)) continue;
    delete sites[id];
    dropped++;
  }
  if (dropped) fs.writeFileSync(NEARBY, JSON.stringify(nearby));
  console.log(`nearbyPlaces: dropped ${dropped}`);
}
