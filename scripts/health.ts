import { closePool, getPool } from "@/lib/db/pool";

const result = await getPool().query("SELECT 1 AS ok");
await closePool();
if (result.rows[0]?.ok !== 1) {
  console.error("database healthcheck failed");
  process.exit(1);
}
console.log("database ok");
