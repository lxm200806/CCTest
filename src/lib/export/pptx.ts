import PptxGenJS from "pptxgenjs";
import type { Slide, ToolResult } from "@/lib/types";
import { FORMULA_NOTE, cleanText, splitPreserving, visualUnits } from "@/lib/export/text";

const FONT = "Microsoft YaHei";
const MAX_SLIDES = 80;

type Piece = { title: string; kicker: string; bullets: string[]; notes: string; continued: boolean };

export async function buildPptx(result: ToolResult) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = cleanText(result.title) || "幻灯片";
  pptx.subject = FORMULA_NOTE;
  pptx.theme = { headFontFace: FONT, bodyFontFace: FONT };
  const pieces = paginate(result);
  const visible = pieces.slice(0, MAX_SLIDES);
  const overflow = pieces.slice(MAX_SLIDES);
  for (const piece of visible) addPiece(pptx, piece);
  if (overflow.length) {
    const rest = overflow.flatMap((piece) => [piece.title, ...piece.bullets, piece.notes]).filter(Boolean).join("\n");
    addPiece(pptx, {
      title: "未分页完的文字",
      kicker: "篇幅",
      bullets: ["后面的文字没有再拆成新页，全部写在这页备注里。"],
      notes: rest,
      continued: false,
    });
  }
  const output = await pptx.write({ outputType: "nodebuffer" });
  return Buffer.from(output as ArrayBuffer);
}

function paginate(result: ToolResult): Piece[] {
  const pieces: Piece[] = [];
  for (const slide of result.slides ?? []) pieces.push(...paginateSlide(slide));
  for (const section of result.sections) {
    const bullets = [...(section.paragraphs ?? []), ...(section.bullets ?? [])].flatMap((item) => splitPreserving(item, 180));
    const title = cleanText(section.heading) || result.title;
    if (section.table) {
      const rows = [section.table.headers, ...section.table.rows].map((row) => row.map((cell) => cleanText(cell)));
      for (let index = 0; index < rows.length; index += 7) {
        const chunk = rows.slice(index, index + 7);
        pieces.push({
          title,
          kicker: index === 0 ? "表格" : "表格续",
          bullets: chunk.map((row) => row.join(" ｜ ")),
          notes: "",
          continued: index > 0,
        });
      }
    }
    pack(pieces, title, section.heading, bullets, "");
  }
  return pieces.length ? pieces : [{ title: cleanText(result.title) || "幻灯片", kicker: "", bullets: splitPreserving(result.summary, 180), notes: "", continued: false }];
}

function paginateSlide(slide: Slide): Piece[] {
  const bullets = slide.bullets.flatMap((item) => splitPreserving(item, 180));
  const pieces: Piece[] = [];
  pack(pieces, cleanText(slide.title) || "未命名", cleanText(slide.kicker), bullets, cleanText(slide.notes));
  return pieces;
}

function pack(pieces: Piece[], title: string, kicker: string, bullets: string[], notes: string) {
  if (!bullets.length) {
    pieces.push({ title, kicker, bullets: [], notes, continued: false });
    return;
  }
  let bucket: string[] = [];
  let lines = 0;
  let first = true;
  const flush = () => {
    pieces.push({ title, kicker, bullets: bucket, notes: first ? notes : "", continued: !first });
    first = false;
    bucket = [];
    lines = 0;
  };
  for (const bullet of bullets) {
    const need = Math.max(1, Math.ceil(visualUnits(bullet) / 32));
    if (bucket.length && lines + need > 10) flush();
    bucket.push(bullet);
    lines += need;
  }
  if (bucket.length) flush();
}

function addPiece(pptx: PptxGenJS, piece: Piece) {
  const slide = pptx.addSlide();
  slide.background = { color: "FFFDF8" };
  if (piece.kicker || piece.continued) {
    slide.addText(`${piece.kicker}${piece.continued ? " · 续" : ""}`.trim(), {
      x: 0.5,
      y: 0.22,
      w: 12.3,
      h: 0.32,
      fontFace: FONT,
      fontSize: 14,
      color: "9A3E22",
    });
  }
  slide.addText(piece.title, {
    x: 0.5,
    y: 0.52,
    w: 12.3,
    h: 0.78,
    fontFace: FONT,
    fontSize: 28,
    bold: true,
    color: "1C1915",
    margin: 0,
  });
  if (piece.bullets.length) {
    slide.addText(
      piece.bullets.map((text) => ({ text, options: { breakLine: true, bullet: { code: "25A0" } } })),
      {
        x: 0.55,
        y: 1.5,
        w: 12.2,
        h: 5.45,
        fontFace: FONT,
        fontSize: 20,
        color: "1C1915",
        valign: "top",
        paraSpaceAfter: 10,
      },
    );
  }
  if (piece.notes) slide.addNotes(piece.notes);
}
