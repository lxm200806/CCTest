export const FORMULA_NOTE = "公式按普通文字保存，不是 Office 公式对象。";

export function cleanText(value: string) {
  return value.replace(/\u0000/g, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function visualUnits(value: string) {
  let units = 0;
  for (const char of value) units += char.charCodeAt(0) > 255 ? 1 : 0.55;
  return units;
}

export function splitPreserving(value: string, unitsPerPiece: number) {
  const text = cleanText(value);
  if (!text) return [];
  if (visualUnits(text) <= unitsPerPiece) return [text];
  const parts: string[] = [];
  let index = 0;
  while (index < text.length) {
    let end = index;
    let used = 0;
    while (end < text.length && used < unitsPerPiece) {
      used += text.charCodeAt(end) > 255 ? 1 : 0.55;
      end += 1;
    }
    if (end < text.length) {
      const window = text.slice(index, end);
      const marks = ["\n", "。", "！", "？", "；", "，", " "];
      let relative = -1;
      for (const mark of marks) {
        const found = window.lastIndexOf(mark);
        if (found >= Math.floor(window.length * 0.45)) {
          relative = found;
          break;
        }
      }
      if (relative >= 0) end = index + relative + 1;
    }
    if (end <= index) end = Math.min(text.length, index + 1);
    parts.push(text.slice(index, end));
    index = end;
  }
  return parts;
}

export function contentDisposition(extension: "pptx" | "docx", title: string) {
  const stripped = cleanText(title).replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  const base = stripped || (extension === "pptx" ? "slides" : "document");
  const ascii = base.replace(/[^\x20-\x7E]/g, "").replace(/"/g, "").trim() || (extension === "pptx" ? "slides" : "document");
  const encoded = encodeURIComponent(`${base}.${extension}`).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}.${extension}"; filename*=UTF-8''${encoded}`;
}
