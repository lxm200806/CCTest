import { connection } from "next/server";
import { describeRuntime } from "@/lib/ai/runtime";

export async function GET() {
  await connection();
  const runtime = describeRuntime();
  return Response.json({
    live: runtime.live,
    provider: runtime.live ? runtime.provider : "mock",
    model: runtime.live ? runtime.model : null,
  });
}
