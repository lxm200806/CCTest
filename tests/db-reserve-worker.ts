import { reserveGeneration } from "@/lib/db/accounts";
import { closePool } from "@/lib/db/pool";

const userId = process.argv[2] ?? "";
const key = process.argv[3] ?? "";
const result = await reserveGeneration({ userId, cost: 1, toolId: "ai-preview", idempotencyKey: key });
console.log(JSON.stringify({ state: result.state }));
await closePool();
