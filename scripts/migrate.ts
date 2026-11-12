import { migrate } from "@/lib/db/migrate";
import { closePool } from "@/lib/db/pool";

await migrate();
await closePool();
console.log("migrations applied");
