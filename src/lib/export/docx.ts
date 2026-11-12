import { Document, HeadingLevel, Packer, PageBreak, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import type { ToolResult } from "@/lib/types";
import { documentBlocks, type TextBlock } from "@/lib/export/blocks";
import { FORMULA_NOTE } from "@/lib/export/text";

const FONT = { ascii: "Calibri", hAnsi: "Calibri", eastAsia: "Microsoft YaHei" };

export async function buildDocx(result: ToolResult) {
  const children = documentBlocks(result).map(blockToParagraph).flat();
  const doc = new Document({
    title: result.title,
    description: FORMULA_NOTE,
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 },
          },
        },
        children: children.length ? children : [paragraph(result.title || "文稿")],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

function blockToParagraph(block: TextBlock) {
  if (block.kind === "break") return [new Paragraph({ children: [new PageBreak()] })];
  if (block.kind === "heading") {
    return [new Paragraph({ heading: block.level === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 }, children: [run(block.text, block.level === 1 ? 36 : 28)] })];
  }
  if (block.kind === "bullet") return [new Paragraph({ bullet: { level: 0 }, spacing: { after: 80 }, children: [run(block.text, 24)] })];
  if (block.kind === "table") return [table(block.headers, block.rows)];
  return [paragraph(block.text)];
}

function paragraph(text: string) {
  return new Paragraph({ spacing: { after: 160, line: 360 }, children: [run(text, 24)] });
}

function run(text: string, size: number) {
  return new TextRun({ text, font: FONT, size });
}

function table(headers: string[], rows: string[][]) {
  const all = [headers, ...rows];
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: all.map((row, index) => new TableRow({
      tableHeader: index === 0,
      children: row.map((cell) => new TableCell({
        width: { size: Math.floor(100 / Math.max(1, row.length)), type: WidthType.PERCENTAGE },
        margins: { top: 60, bottom: 60, left: 80, right: 80 },
        children: [new Paragraph({ children: [new TextRun({ text: cell, bold: index === 0, font: FONT, size: 21 })] })],
      })),
    })),
  });
}
