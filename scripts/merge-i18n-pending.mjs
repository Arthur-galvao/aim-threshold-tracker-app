// Merge docs/plans/i18n-pending/*.json into src/lib/i18n.tsx (pt and en blocks), then delete the pending files.
// Usage: node scripts/merge-i18n-pending.mjs
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const pendingDir = path.join(root, "docs/plans/i18n-pending");
const i18nPath = path.join(root, "src/lib/i18n.tsx");
let src = fs.readFileSync(i18nPath, "utf8");

const files = fs.readdirSync(pendingDir).filter((f) => f.endsWith(".json")).sort();
if (files.length === 0) { console.log("nothing to merge"); process.exit(0); }

const esc = (s) => JSON.stringify(s);
const enStart = src.indexOf("\n  en: {");
const end = src.indexOf("\n} as const;");
if (enStart < 0 || end < 0) throw new Error("i18n.tsx layout changed: cannot find 'en: {' or '} as const;'");
let pt = src.slice(0, enStart), en = src.slice(enStart, end), tail = src.slice(end);
const has = (block, key) => block.includes(`    ${esc(key)}:`);

let added = 0;
for (const f of files) {
  const data = JSON.parse(fs.readFileSync(path.join(pendingDir, f), "utf8"));
  for (const lang of ["pt", "en"]) {
    if (!data[lang]) throw new Error(`${f}: missing "${lang}"`);
  }
  const ptKeys = Object.keys(data.pt), enKeys = Object.keys(data.en);
  const missing = ptKeys.filter((k) => !enKeys.includes(k)).concat(enKeys.filter((k) => !ptKeys.includes(k)));
  if (missing.length) throw new Error(`${f}: keys not in both languages: ${missing.join(", ")}`);
  for (const k of ptKeys) {
    const insert = (block, value) => {
      const close = block.lastIndexOf("\n  },");
      return block.slice(0, close) + `\n    ${esc(k)}: ${esc(value)},` + block.slice(close);
    };
    if (!has(pt, k)) { pt = insert(pt, data.pt[k]); added++; }
    if (!has(en, k)) { en = insert(en, data.en[k]); }
  }
}
fs.writeFileSync(i18nPath, pt + en + tail);
for (const f of files) fs.unlinkSync(path.join(pendingDir, f));
console.log(`merged ${files.length} file(s), ${added} new key(s)`);
