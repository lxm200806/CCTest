import { readFile } from "node:fs/promises";
import { importStore, validateStore } from "@/lib/db/import-json";
import { closePool } from "@/lib/db/pool";
import { migrate } from "@/lib/db/migrate";

const file = process.argv.find((arg) => arg.endsWith(".json"));
const apply = process.argv.includes("--apply");
if (!file) {
  console.error("Usage: import-json.ts [--apply] <synthetic.json>");
  process.exit(1);
}
const raw = JSON.parse(await readFile(file, "utf8"));
const report = validateStore(raw);
console.log(JSON.stringify({ dryRun: !apply, ...report }, null, 2));
if (!report.ok) process.exit(1);
if (!apply) process.exit(0);
await migrate();
await importStore(raw);
await closePool();
console.log("import applied");
