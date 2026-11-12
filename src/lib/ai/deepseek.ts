import "server-only";

export class ProviderError extends Error {
  parseError = false;
  retryable = false;

  constructor(message: string, options?: { parseError?: boolean; retryable?: boolean }) {
    super(message);
    this.parseError = Boolean(options?.parseError);
    this.retryable = Boolean(options?.retryable);
  }
}

type ChatOptions = {
  url: string;
  key: string;
  model: string;
  system: string;
  user: string;
};

const ATTEMPTS = 3;
const TIMEOUT_MS = 60_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeDetail(detail: string, key: string) {
  return detail.replaceAll(key, "[redacted]").replace(/\s+/g, " ").trim().slice(0, 160);
}

async function once(options: ChatOptions, jsonMode: boolean) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(options.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: options.model,
        temperature: 0.4,
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
        messages: [
          { role: "system", content: options.system },
          { role: "user", content: options.user },
        ],
      }),
      signal: controller.signal,
    });
    const raw = await response.text();
    return { response, raw };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ProviderError("模型超时，未在 60 秒内返回。点数未扣除。", { retryable: true });
    }
    throw new ProviderError("模型接口没有连上。点数未扣除。", { retryable: true });
  } finally {
    clearTimeout(timer);
  }
}

export async function chatComplete(options: ChatOptions) {
  let jsonMode = true;
  let last: ProviderError | null = null;
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    try {
      const { response, raw } = await once(options, jsonMode);
      if (response.ok) {
        let data: { choices?: { message?: { content?: string } }[] };
        try {
          data = JSON.parse(raw) as { choices?: { message?: { content?: string } }[] };
        } catch {
          throw new ProviderError("模型接口返回的不是 JSON。点数未扣除。", { retryable: true });
        }
        const text = data.choices?.[0]?.message?.content;
        if (!text?.trim()) throw new ProviderError("模型没有返回内容。点数未扣除。", { retryable: true });
        return text;
      }
      const detail = safeDetail(raw, options.key);
      const formatRejected = response.status === 400 && /response_format|json_object/i.test(detail);
      if (formatRejected && jsonMode) {
        jsonMode = false;
        continue;
      }
      const retryable = response.status === 408 || response.status === 409 || response.status === 429 || response.status >= 500;
      const message =
        response.status === 401 || response.status === 403
          ? "模型拒绝了当前密钥。请检查 DEEPSEEK_API_KEY。点数未扣除。"
          : `模型接口返回 ${response.status}${detail ? `：${detail}` : ""}。点数未扣除。`;
      const error = new ProviderError(message, { retryable });
      if (!retryable) throw error;
      last = error;
    } catch (error) {
      if (error instanceof ProviderError && !error.retryable) throw error;
      last = error instanceof ProviderError ? error : new ProviderError("模型调用失败。点数未扣除。", { retryable: true });
    }
    if (attempt < ATTEMPTS - 1) await sleep(700 * 2 ** attempt);
  }
  throw last ?? new ProviderError("模型调用失败。点数未扣除。");
}
