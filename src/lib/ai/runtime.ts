import "server-only";

import { DEEPSEEK_BASE_URL, DEEPSEEK_MODEL } from "@/lib/ai/notice";

export type RuntimeMode = {
  live: boolean;
  provider: "mock" | "deepseek" | "openai";
  model: string | null;
  url: string | null;
};

function clean(value: string | undefined) {
  const text = value?.trim();
  return text ? text : "";
}

export function completionsUrl(base: string) {
  const trimmed = base.replace(/\/$/, "");
  if (trimmed.endsWith("/chat/completions")) return trimmed;
  return `${trimmed}/chat/completions`;
}

export function describeRuntime(): RuntimeMode {
  const forced = clean(process.env.AI_PROVIDER).toLowerCase();
  const deepseekKey = clean(process.env.DEEPSEEK_API_KEY);
  const openaiKey = clean(process.env.OPENAI_API_KEY);
  if (forced === "mock") return { live: false, provider: "mock", model: null, url: null };
  if (forced === "openai") {
    if (!openaiKey) return { live: false, provider: "openai", model: null, url: null };
    return {
      live: true,
      provider: "openai",
      model: clean(process.env.OPENAI_MODEL) || "gpt-4o-mini",
      url: completionsUrl(clean(process.env.OPENAI_BASE_URL) || "https://api.openai.com/v1"),
    };
  }
  if (forced && forced !== "auto" && forced !== "deepseek") {
    return { live: false, provider: "mock", model: null, url: null };
  }
  if (deepseekKey || forced === "deepseek") {
    return {
      live: Boolean(deepseekKey),
      provider: "deepseek",
      model: clean(process.env.DEEPSEEK_MODEL) || DEEPSEEK_MODEL,
      url: completionsUrl(clean(process.env.DEEPSEEK_BASE_URL) || DEEPSEEK_BASE_URL),
    };
  }
  if (openaiKey) {
    return {
      live: true,
      provider: "openai",
      model: clean(process.env.OPENAI_MODEL) || "gpt-4o-mini",
      url: completionsUrl(clean(process.env.OPENAI_BASE_URL) || "https://api.openai.com/v1"),
    };
  }
  return { live: false, provider: "mock", model: null, url: null };
}
