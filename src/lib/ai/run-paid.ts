import { ProviderError } from "@/lib/ai/errors";
import { getTool, normalizeInput, type ToolDef } from "@/lib/tools";
import type { GenerationRecord, PublicUser, SourceName, ToolResult } from "@/lib/types";
import type { Reservation } from "@/lib/db/accounts";

type Generated = { result: ToolResult; source: SourceName };

type SpendInput = {
  userId: string;
  cost: number;
  toolId: string;
  toolName: string;
  source: SourceName;
  fields: Record<string, string>;
  result: ToolResult;
  requestKey?: string;
};

const inflight = new Set<string>();

export function resetGenerationLock() {
  inflight.clear();
}

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export async function runPaidGeneration(options: {
  user: PublicUser | null;
  body: { toolId?: unknown; input?: unknown } | null;
  generate: (tool: ToolDef, input: Record<string, string>) => Promise<Generated>;
  reserve?: (input: { userId: string; cost: number; toolId: string; idempotencyKey: string }) => Promise<Reservation>;
  spend: (input: SpendInput) => Promise<{ balance: number; record: GenerationRecord } | null>;
  release?: (userId: string, requestKey: string) => Promise<void>;
  present: (record: GenerationRecord) => unknown;
  idempotencyKey?: string;
}) {
  const { user } = options;
  if (!user) return json({ error: "请先登录" }, 401);
  const toolId = typeof options.body?.toolId === "string" ? options.body.toolId : "";
  const tool = getTool(toolId);
  if (!tool) return json({ error: "没有这个工具" }, 404);
  const normalized = normalizeInput(tool, options.body?.input);
  if (!normalized.ok) return json({ error: normalized.error }, 400);
  if (user.credits < tool.cost) {
    return json({ error: `点数不够。这次需要 ${tool.cost} 点，当前 ${user.credits} 点。`, balance: user.credits }, 402);
  }
  if (inflight.has(user.id)) {
    return json({ error: "上一次生成还没结束。这次没有重复提交，点数未扣除。" }, 409);
  }
  let requestKey = "";
  if (options.reserve) {
    const reserved = await options.reserve({ userId: user.id, cost: tool.cost, toolId: tool.id, idempotencyKey: options.idempotencyKey || user.id });
    if (reserved.state === "replay") return json({ ...asRecord(options.present(reserved.record)), balance: reserved.balance });
    if (reserved.state === "busy") return json({ error: "上一次生成还没结束。这次没有重复提交，点数未扣除。" }, 409);
    if (reserved.state === "short") return json({ error: `点数不够。这次需要 ${tool.cost} 点，当前 ${reserved.balance} 点。`, balance: reserved.balance }, 402);
    requestKey = reserved.requestKey;
  }
  inflight.add(user.id);
  try {
    const generated = await options.generate(tool, normalized.input);
    const saved = await options.spend({
      userId: user.id,
      cost: tool.cost,
      toolId: tool.id,
      toolName: tool.name,
      source: generated.source,
      fields: normalized.input,
      result: generated.result,
      requestKey,
    });
    if (!saved) return json({ error: "点数刚好用完，这次没有保存。" }, 402);
    return json({ ...asRecord(options.present(saved.record)), balance: saved.balance });
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : "生成失败";
    const status = error instanceof ProviderError ? 502 : 500;
    if (requestKey) await options.release?.(user.id, requestKey);
    const errorText = message.includes("点数未扣除") ? message : `${message.replace(/。?$/, "。")}点数未扣除。`;
    return json({ error: errorText }, status);
  } finally {
    inflight.delete(user.id);
  }
}

function asRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}
