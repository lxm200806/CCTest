import { ProviderError, generateTool } from "@/lib/ai/provider";
import { presentGeneration } from "@/lib/present";
import { currentUser } from "@/lib/session";
import { spendAndSave } from "@/lib/store";
import { getTool, normalizeInput } from "@/lib/tools";

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { toolId?: unknown; input?: unknown } | null;
  const toolId = typeof body?.toolId === "string" ? body.toolId : "";
  const tool = getTool(toolId);
  if (!tool) return Response.json({ error: "没有这个工具" }, { status: 404 });
  const normalized = normalizeInput(tool, body?.input);
  if (!normalized.ok) return Response.json({ error: normalized.error }, { status: 400 });
  if (user.credits < tool.cost) {
    return Response.json({ error: `点数不够。这次需要 ${tool.cost} 点，当前 ${user.credits} 点。`, balance: user.credits }, { status: 402 });
  }
  try {
    const generated = await generateTool(tool, normalized.input);
    const saved = await spendAndSave({
      userId: user.id,
      cost: tool.cost,
      toolId: tool.id,
      toolName: tool.name,
      source: generated.source,
      fields: normalized.input,
      result: generated.result,
    });
    if (!saved) return Response.json({ error: "点数刚好用完，这次没有保存。" }, { status: 402 });
    return Response.json({ ...presentGeneration(saved.record), balance: saved.balance });
  } catch (error) {
    const message = error instanceof Error ? error.message : "生成失败";
    const status = error instanceof ProviderError ? 502 : 500;
    return Response.json({ error: message }, { status });
  }
}
