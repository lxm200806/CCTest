export const OCR_MAX_BYTES = 4 * 1024 * 1024;
export const OCR_MAX_EDGE = 4096;
export const OCR_MAX_PIXELS = 8_000_000;

export const OCR_SETUP =
  "需要本机安装 Tesseract，并带上中文和英文语言包。Debian 或 Ubuntu 可执行：apt-get install tesseract-ocr tesseract-ocr-chi-sim tesseract-ocr-eng。没有可用的识别程序时不会编造文字，也不会扣点。";

export class OcrError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "OcrError";
    this.status = status;
  }
}

export type ImageKind = "png" | "jpeg" | "webp";

export type InspectedImage = {
  kind: ImageKind;
  width: number;
  height: number;
  mime: string;
};

const MIME: Record<ImageKind, string[]> = {
  png: ["image/png"],
  jpeg: ["image/jpeg", "image/jpg"],
  webp: ["image/webp"],
};

export function isImagePayload(value: string) {
  const text = value.trim();
  return /^data:/i.test(text) || /;base64,/i.test(text.slice(0, 200));
}

export function inspectImage(bytes: Buffer, declaredType: string, maxBytes = OCR_MAX_BYTES): InspectedImage {
  if (bytes.length > maxBytes) {
    throw new OcrError(`图片超过 ${Math.round(maxBytes / (1024 * 1024))}MB，已停止。这次不扣点。`, 413);
  }
  if (looksLikeSvg(bytes, declaredType)) {
    throw new OcrError("不接受 SVG。请上传 PNG、JPEG 或 WebP 的印刷体图片。这次不扣点。");
  }
  const kind = sniff(bytes);
  if (!kind) {
    throw new OcrError("文件内容不是 PNG、JPEG 或 WebP。这次不扣点。");
  }
  const declared = declaredType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!declared || !MIME[kind].includes(declared)) {
    throw new OcrError("文件类型和实际内容不一致。这次不扣点。");
  }
  const size = kind === "png" ? pngSize(bytes) : kind === "jpeg" ? jpegSize(bytes) : webpSize(bytes);
  if (!size) throw new OcrError("无法确认图片尺寸，已停止。这次不扣点。");
  if (size.width > OCR_MAX_EDGE || size.height > OCR_MAX_EDGE || size.width * size.height > OCR_MAX_PIXELS) {
    throw new OcrError("图片尺寸太大，已停止。这次不扣点。", 413);
  }
  if (size.width < 1 || size.height < 1) throw new OcrError("图片尺寸无效。这次不扣点。");
  return { kind, width: size.width, height: size.height, mime: MIME[kind][0] };
}

function looksLikeSvg(bytes: Buffer, declaredType: string) {
  if (declaredType.toLowerCase().includes("svg")) return true;
  const head = bytes.subarray(0, 256).toString("utf8").trimStart().toLowerCase();
  return head.startsWith("<svg") || head.startsWith("<?xml") || head.startsWith("<!doctype svg");
}

function sniff(bytes: Buffer): ImageKind | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

function pngSize(bytes: Buffer) {
  if (bytes.length < 24 || bytes.toString("ascii", 12, 16) !== "IHDR") return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function jpegSize(bytes: Buffer) {
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    while (bytes[offset] === 0xff && offset < bytes.length) offset += 1;
    if (offset >= bytes.length) return null;
    const marker = bytes[offset];
    offset += 1;
    if (marker === 0xd9 || marker === 0xda) return null;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) return null;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) return null;
    const isStart = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isStart) {
      if (length < 7) return null;
      return { width: bytes.readUInt16BE(offset + 5), height: bytes.readUInt16BE(offset + 3) };
    }
    offset += length;
  }
  return null;
}

function webpSize(bytes: Buffer) {
  if (bytes.length < 30) return null;
  const chunk = bytes.toString("ascii", 12, 16);
  if (chunk === "VP8X") {
    return { width: 1 + bytes.readUIntLE(24, 3), height: 1 + bytes.readUIntLE(27, 3) };
  }
  if (chunk === "VP8 ") {
    const start = bytes.indexOf(Buffer.from([0x9d, 0x01, 0x2a]), 20);
    if (start < 0 || start + 7 > bytes.length) return null;
    return { width: bytes.readUInt16LE(start + 3) & 0x3fff, height: bytes.readUInt16LE(start + 5) & 0x3fff };
  }
  if (chunk === "VP8L") {
    if (bytes[20] !== 0x2f) return null;
    const b1 = bytes[21] ?? 0;
    const b2 = bytes[22] ?? 0;
    const b3 = bytes[23] ?? 0;
    const b4 = bytes[24] ?? 0;
    return {
      width: 1 + (((b2 & 0x3f) << 8) | b1),
      height: 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6)),
    };
  }
  return null;
}

export function placeConfirmedText(current: string, recognized: string) {
  const addition = recognized.trim();
  if (!addition) return { ok: false as const, error: "没有可写入的文字。这次不扣点。" };
  if (isImagePayload(addition)) return { ok: false as const, error: "识别结果里不能写入图片数据。这次不扣点。" };
  const base = current.trim();
  const value = base ? `${base}\n${addition}` : addition;
  if (value.length > 8000) return { ok: false as const, error: "写入后会超过 8000 字。这次不扣点。" };
  return { ok: true as const, value };
}
