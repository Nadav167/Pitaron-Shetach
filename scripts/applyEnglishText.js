#!/usr/bin/env node
/**
 * applyEnglishText.js — gives every site's free text an English version for
 * the English site: description.en, directions.en, pricing.noteEn and
 * openingHours.noteEn.
 *
 * The sources publish this text in Hebrew. The translations live in
 * scripts/data/englishText.json, keyed by Hebrew line (the text is split
 * on newlines, and most lines repeat across sites: INPA's standard lines,
 * the Kinneret tariff, KKL's coordination notes), so re-running
 * enrichCampsites.js doesn't lose them: run this after it.
 *
 * A text is translated only when every one of its lines is; otherwise the
 * English field is left as it was and the missing lines are listed in
 * scripts/data/untranslatedText.json, to translate and add to the
 * dictionary. The app falls back to the Hebrew until then.
 *
 * A short English note a mapper wrote on OpenStreetMap ("Nice place with
 * river you can swim") is kept after the translation: it's firsthand, and
 * often says something the official text doesn't.
 *
 * USAGE  node scripts/applyEnglishText.js [--dry-run]
 */

const fs = require("fs");
const path = require("path");
const { CAMPSITES, parseArgs } = require("./lib/importHelpers");

const DICTIONARY = path.join(__dirname, "data/englishText.json");
const UNTRANSLATED = path.join(__dirname, "data/untranslatedText.json");
const MAPPER_NOTE_MAX = 200;

const args = parseArgs();
const dictionary = JSON.parse(fs.readFileSync(DICTIONARY, "utf8"));
const missing = new Set();

/** The whole text in English, or null if any line has no translation. */
function translate(hebrew) {
  if (!hebrew) return null;
  const lines = hebrew.split("\n").map((line) => line.trim()).filter(Boolean);
  const english = lines.map((line) => (/[֐-׿]/.test(line) ? dictionary[line] : line));
  english.forEach((line, i) => line === undefined && missing.add(lines[i]));
  return english.every((line) => line !== undefined) ? english.join("\n") : null;
}

const dataset = JSON.parse(fs.readFileSync(CAMPSITES, "utf8"));
const tally = { description: 0, directions: 0, priceNote: 0, hoursNote: 0 };

for (const record of dataset.campsites) {
  const description = translate(record.description?.he);
  if (description) {
    const current = record.description.en || "";
    const mapperNote = current && !current.startsWith(description) && current.length < MAPPER_NOTE_MAX ? current : "";
    const en = mapperNote ? `${description}\n${mapperNote}` : description;
    if (en !== current && !current.startsWith(description)) {
      record.description.en = en;
      tally.description++;
    }
  }
  const directions = translate(record.directions?.he);
  if (directions && record.directions.en !== directions) {
    record.directions.en = directions;
    tally.directions++;
  }
  const price = translate(record.pricing.note);
  if (price && record.pricing.noteEn !== price) {
    record.pricing.noteEn = price;
    tally.priceNote++;
  }
  const hours = translate(record.openingHours.note);
  if (hours && record.openingHours.noteEn !== hours) {
    record.openingHours.noteEn = hours;
    tally.hoursNote++;
  }
}

console.log("Translated:", tally);
console.log(`Lines with no translation: ${missing.size}${missing.size ? ` (listed in ${path.relative(process.cwd(), UNTRANSLATED)})` : ""}`);

if (args["dry-run"]) return;
if (missing.size) fs.writeFileSync(UNTRANSLATED, JSON.stringify([...missing], null, 1) + "\n");
else if (fs.existsSync(UNTRANSLATED)) fs.unlinkSync(UNTRANSLATED);
fs.writeFileSync(CAMPSITES, JSON.stringify(dataset, null, 2) + "\n");
console.log(`Wrote ${path.relative(process.cwd(), CAMPSITES)}`);
