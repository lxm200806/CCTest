import "server-only";

import { mockGenerate } from "@/lib/ai/mock";
import type { ToolDef } from "@/lib/tools";
import type { SourceName, ToolResult } from "@/lib/types";

export class ProviderError extends Error {}

function resolveProvider(): { source: SourceName; key?: string; model?: string; url?: string } {
  const forced = (process.env.AI_PROVIDER ?? "").trim().toLowerCase();
  const openai = process.env.OPENAI_API_KEY?.trim();
  const deepseek = process.env.DEEPSEEK_API_KEY?.trim();
  if (forced === "mock") return { source: "mock" };
  if (forced === "openai") {
    if (!openai) throw new ProviderError("已指定 AI_PROVIDER=openai，但没有 OPENAI_API_KEY。点数未扣除。");
    return { source: "openai", key: openai, model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini", url: process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1/chat/completions" };
  }
  if (forced === "deepseek") {
    if (!deepseek) throw new ProviderError("已指定 AI_PROVIDER=deepseek，但没有 DEEPSEEK_API_KEY。点数未扣除。");
    return { source: "deepseek", key: deepseek, model: process.env.DEEPSEEK_MODEL?.trim() || "deepseek-chat", url: process.env.DEEPSEEK_BASE_URL?.trim() || "https://api.deepseek.com/chat/completions" };
  }
  if (forced && forced !== "auto") throw new ProviderError("AI_PROVIDER 只能是 mock、openai、deepseek，或留空自动选择。");
  if (openai) {
    return { source: "openai", key: openai, model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini", url: process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1/chat/completions" };
  }
  if (deepseek) {
    return { source: "deepseek", key: deepseek, model: process.env.DEEPSEEK_MODEL?.trim() || "deepseek-chat", url: process.env.DEEPSEEK_BASE_URL?.trim() || "https://api.deepseek.com/chat/completions" };
  }
  return { source: "mock" };
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function parseModel(text: string, toolName: string): ToolResult {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  let data: unknown;
  try {
    data = JSON.parse(fenced ? fenced[1] : trimmed);
  } catch {
    throw new ProviderError("模型没有返回可解析的 JSON。点数未扣除。");
  }
  if (!data || typeof data !== "object") throw new ProviderError("模型结果不是对象。点数未扣除。");
  const record = data as Record<string, unknown>;
  const sections = (Array.isArray(record.sections) ? record.sections : [])
    .map((item, index) => {
      const section = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const paragraphs = asStringArray(section.paragraphs);
      const bullets = asStringArray(section.bullets);
      let table: ToolResult["sections"][number]["table"];
      if (section.table && typeof section.table === "object") {
        const raw = section.table as Record<string, unknown>;
        const headers = asStringArray(raw.headers);
        const rows = Array.isArray(raw.rows)
          ? raw.rows.filter((row): row is unknown[] => Array.isArray(row)).map((row) => row.filter((cell): cell is string => typeof cell === "string"))
          : [];
        if (headers.length) table = { headers, rows };
      }
      return {
        heading: typeof section.heading === "string" && section.heading.trim() ? section.heading : `部分 ${index + 1}`,
        paragraphs,
        bullets: bullets.length ? bullets : undefined,
        table,
      };
    })
    .filter((section) => section.paragraphs?.length || section.bullets?.length || section.table);
  if (!sections.length) throw new ProviderError("模型结果里没有可用段落。点数未扣除。");
  return {
    title: typeof record.title === "string" && record.title.trim() ? record.title : toolName,
    subtitle: typeof record.subtitle === "string" ? record.subtitle : "",
    summary: typeof record.summary === "string" ? record.summary : "",
    sections,
  };
}

async function chat(url: string, key: string, model: string, system: string, user: string) {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: AbortSignal.timeout(45000),
    });
  } catch {
    throw new ProviderError("模型接口没有连上。点数未扣除。");
  }
  if (!response.ok) {
    const detail = (await response.text()).replaceAll(key, "[redacted]").slice(0, 160);
    throw new ProviderError(`模型接口返回 ${response.status}${detail ? `：${detail}` : ""}。点数未扣除。`);
  }
  const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content;
  if (!text?.trim()) throw new ProviderError("模型没有返回内容。点数未扣除。");
  return text;
}

export async function generateTool(tool: ToolDef, input: Record<string, string>) {
  const provider = resolveProvider();
  if (provider.source === "mock" || !provider.key || !provider.url || !provider.model) {
    return { result: mockGenerate(tool.id, input), source: "mock" as const };
  }
  const fieldLines = tool.fields.map((field) => `${field.label}：${input[field.name] || "（空）"}`).join("\n");
  const system = "你是学习工作台的教研编辑，服务于中国 K12 的家长和教师。只输出一个 JSON 对象。字段：title, subtitle, summary, sections。sections 元素含 heading、paragraphs、可选 bullets、可选 table。用简体中文，写到能打印。不要品牌名，不要联系方式。";
  const text = await chat(provider.url, provider.key, provider.model, system, `工具：${tool.name}\n用途：${tool.detail}\n${fieldLines}`);
  return { result: parseModel(text, tool.name), source: provider.source };
}
