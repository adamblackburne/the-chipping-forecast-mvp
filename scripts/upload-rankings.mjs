import { readFileSync } from "fs";
import { resolve } from "path";

const CSV_PATH = process.argv[2] || resolve(process.env.HOME, "Desktop/downloaded_rankings.csv");
const API_URL = process.argv[3] || "http://localhost:3000/api/admin/rankings";
const ADMIN_SECRET = process.env.ADMIN_SECRET;

if (!ADMIN_SECRET) {
  console.error("Set ADMIN_SECRET env var before running.");
  process.exit(1);
}

const csv = readFileSync(CSV_PATH, "utf-8");
const lines = csv.trim().split("\n");
const header = lines[0].split(",").map((h) => h.trim());

const col = (name) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
const iPlayer = col("Player Id");
const iRanking = col("RANKING");
const iName = col("NAME");
const iFirst = col("First Name");
const iLast = col("Last Name");

// CSV may have quoted fields — simple parser for this file's format
function parseRow(line) {
  const fields = [];
  let cur = "";
  let inQuote = false;
  for (const ch of line) {
    if (ch === '"') { inQuote = !inQuote; continue; }
    if (ch === "," && !inQuote) { fields.push(cur); cur = ""; continue; }
    cur += ch;
  }
  fields.push(cur);
  return fields;
}

const rows = lines.slice(1).map((line) => {
  const f = parseRow(line);
  return {
    player_id: f[iPlayer]?.trim(),
    ranking: Number(f[iRanking]?.trim()),
    name: f[iName]?.trim(),
    first_name: f[iFirst]?.trim() || null,
    last_name: f[iLast]?.trim() || null,
  };
}).filter((r) => r.player_id && !isNaN(r.ranking));

console.log(`Parsed ${rows.length} players. Uploading to ${API_URL}...`);

const res = await fetch(API_URL, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-admin-secret": ADMIN_SECRET,
  },
  body: JSON.stringify(rows),
});

const json = await res.json();
if (!res.ok) {
  console.error("Upload failed:", json);
  process.exit(1);
}
console.log(`Done! Imported ${json.imported} players.`);
