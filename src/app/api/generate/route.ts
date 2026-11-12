import { generateTool } from "@/lib/ai/provider";
import { runPaidGeneration } from "@/lib/ai/run-paid";
import { presentGeneration } from "@/lib/present";
import { currentUser } from "@/lib/session";
import { spendAndSave } from "@/lib/store";

export async function POST(request: Request) {
  const user = await currentUser();
  const body = (await request.json().catch(() => null)) as { toolId?: unknown; input?: unknown } | null;
  return runPaidGeneration({
    user,
    body,
    generate: generateTool,
    spend: spendAndSave,
    present: presentGeneration,
  });
}
