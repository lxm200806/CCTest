import "server-only";

import { chatComplete, ProviderError } from "@/lib/ai/deepseek";
import { isRepairable } from "@/lib/ai/errors";
import { mockGenerate } from "@/lib/ai/mock";
import { presentModelResult } from "@/lib/ai/parse-result";
import { buildPrompt } from "@/lib/ai/prompts";
import { describeRuntime } from "@/lib/ai/runtime";
import type { ToolDef } from "@/lib/tools";
import type { SourceName } from "@/lib/types";

export { ProviderError };

function forcedProvider() {
  return (process.env.AI_PROVIDER ?? "").trim().toLowerCase();
}

export async function generateTool(tool: ToolDef, input: Record<string, string>) {
  const forced = forcedProvider();
  if (forced && !["mock", "auto", "openai", "deepseek"].includes(forced)) {
    throw new ProviderError("AI_PROVIDER 只能是 mock、openai、deepseek，或留空。点数未扣除。");
  }
  if (forced === "deepseek" && !process.env.DEEPSEEK_API_KEY?.trim()) {
    throw new ProviderError("已指定 DeepSeek，但没有 DEEPSEEK_API_KEY。点数未扣除。");
  }
  if (forced === "openai" && !process.env.OPENAI_API_KEY?.trim()) {
    throw new ProviderError("已指定 OpenAI，但没有 OPENAI_API_KEY。点数未扣除。");
  }
  const runtime = describeRuntime();
  if (!runtime.live || !runtime.url || !runtime.model || runtime.provider === "mock") {
    return { result: mockGenerate(tool.id, input), source: "mock" as const };
  }
  const key = (runtime.provider === "openai" ? process.env.OPENAI_API_KEY : process.env.DEEPSEEK_API_KEY)?.trim();
  if (!key) return { result: mockGenerate(tool.id, input), source: "mock" as const };
  const prompt = buildPrompt(tool, input);
  let repair = "";
  let last: ProviderError | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const text = await chatComplete({
        url: runtime.url,
        key,
        model: runtime.model,
        system: prompt.system,
        user: `${prompt.user}${repair}`,
      });
      return {
        result: presentModelResult(tool, input, text),
        source: runtime.provider as SourceName,
      };
    } catch (error) {
      if (!isRepairable(error)) throw error;
      last = error;
      repair = `\n\n上次输出不合格：${error.message}\n请只输出修正后的 JSON，不要解释。`;
    }
  }
  throw last ?? new ProviderError("模型结果无法使用。点数未扣除。", { parseError: true });
}
