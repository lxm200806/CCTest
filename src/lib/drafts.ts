import { isImagePayload } from "@/lib/ocr/image";

export function draftKey(toolId: string) {
  return `sw-draft:${toolId}`;
}

export function readDraft(storage: { getItem(key: string): string | null }, toolId: string) {
  try {
    const raw = storage.getItem(draftKey(toolId));
    if (!raw) return null;
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    const input: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === "string") input[key] = value;
    }
    return input;
  } catch {
    return null;
  }
}

export function writeDraft(storage: { setItem(key: string, value: string): void }, toolId: string, input: Record<string, string>) {
  const safe: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string") safe[key] = isImagePayload(value) ? "" : value.slice(0, 8000);
  }
  storage.setItem(draftKey(toolId), JSON.stringify(safe));
}
