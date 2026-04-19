/**
 * One-time script to seed player_rankings from a CSV file.
 *
 * Usage:
 *   npx ts-node --project tsconfig.json scripts/import-rankings.ts <path-to-csv>
 *   ADMIN_SECRET=<secret> BASE_URL=http://localhost:3000 npx tsx scripts/import-rankings.ts <path-to-csv>
 *
 * CSV format expected (first row = headers):
 *   Player Id,RANKING,NAME,First Name,Last Name
 */

import fs from "fs";
import path from "path";

const csvPath = process.argv[2];
if (!csvPath) {
  console.error("Usage: tsx scripts/import-rankings.ts <path-to-csv>");
  process.exit(1);
}

const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
const adminSecret = process.env.ADMIN_SECRET;
if (!adminSecret) {
  console.error("ADMIN_SECRET env var required");
  process.exit(1);
}

const raw = fs.readFileSync(path.resolve(csvPath), "utf-8");
const lines = raw.trim().split("\n");
const headers = lines[0].split(",").map((h) => h.trim());

const playerIdIdx = headers.findIndex((h) => h.toLowerCase() === "player id");
const rankingIdx  = headers.findIndex((h) => h.toUpperCase() === "RANKING");
const nameIdx     = headers.findIndex((h) => h.toUpperCase() === "NAME");
const firstIdx    = headers.findIndex((h) => h.toLowerCase() === "first name");
const lastIdx     = headers.findIndex((h) => h.toLowerCase() === "last name");

if ([playerIdIdx, rankingIdx, nameIdx].some((i) => i === -1)) {
  console.error("CSV missing required columns: Player Id, RANKING, NAME");
  process.exit(1);
}

const rows = lines.slice(1).map((line) => {
  const cols = line.split(",");
  return {
    player_id: cols[playerIdIdx]?.trim(),
    ranking:   Number(cols[rankingIdx]?.trim()),
    name:      cols[nameIdx]?.trim(),
    first_name: firstIdx >= 0 ? cols[firstIdx]?.trim() : undefined,
    last_name:  lastIdx  >= 0 ? cols[lastIdx]?.trim()  : undefined,
  };
}).filter((r) => r.player_id && !isNaN(r.ranking) && r.name);

console.log(`Importing ${rows.length} players…`);

async function main() {
  const res = await fetch(`${baseUrl}/api/admin/rankings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-secret": adminSecret!,
    },
    body: JSON.stringify(rows),
  });

  const json = await res.json();
  if (!res.ok) {
    console.error("Import failed:", json);
    process.exit(1);
  }

  console.log(`Done — imported ${json.imported} players.`);
}

main();
