import { generateTool } from "@/lib/ai/provider";
import { runPaidGeneration } from "@/lib/ai/run-paid";
import { commitReserved, refundReserved, requestKey, reserveGeneration } from "@/lib/db/accounts";
import { crossOriginResponse } from "@/lib/origin";
import { presentGeneration } from "@/lib/present";
import { currentUser } from "@/lib/session";

export async function POST(request: Request) {
  const blocked = crossOriginResponse(request);
  if (blocked) return blocked;
  const user = await currentUser();
  const body = (await request.json().catch(() => null)) as { toolId?: unknown; input?: unknown } | null;
  const key = request.headers.get("idempotency-key");
  return runPaidGeneration({
    user,
    body,
    idempotencyKey: user ? requestKey(key, user.id, typeof body?.toolId === "string" ? body.toolId : "", inputRecord(body?.input)) : "",
    generate: generateTool,
    reserve: reserveGeneration,
    spend: async (input) => commitReserved({ ...input, requestKey: input.requestKey || "" }),
    release: refundReserved,
    present: presentGeneration,
  });
}

function inputRecord(value: unknown) {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}
