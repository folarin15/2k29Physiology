import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const files = [
  "content/PHY 102/flashcards.json",
  "content/CHM 102/organic-flashcards.json",
  "content/CHM 102/inorganic-flashcards.json",
  "content/ZOO 101/flashcards.json",
  "content/ZOO 102/flashcards.json",
  "content/PHY 104/flashcards.json",
  "content/GST 111/flashcards.json"
];

files.forEach(file => {
  const fullPath = resolve(root, file);
  try {
    let content = readFileSync(fullPath, 'utf-8');
    // Remove BOM
    content = content.replace(/^\uFEFF/, '');
    // Ensure it's a valid JSON and wrap in flashcards if it's just an array
    let data = JSON.parse(content);
    if (Array.isArray(data)) {
      data = { flashcards: data };
    }
    writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`Fixed: ${file}`);
  } catch (e) {
    console.error(`Failed to fix ${file}:`, e.message);
  }
});
