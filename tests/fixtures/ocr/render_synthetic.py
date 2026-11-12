"""Regenerate the committed synthetic fixtures. They are printed text, not a real student.

Requires Pillow and the WenQuanYi Micro Hei plus DejaVu fonts used on Ubuntu.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent
CJK = ImageFont.truetype("/usr/share/fonts/truetype/wqy/wqy-microhei.ttc", 72)
CJK_SMALL = ImageFont.truetype("/usr/share/fonts/truetype/wqy/wqy-microhei.ttc", 48)
LATIN = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 64)


def render(name: str, lines: list[str], face: ImageFont.ImageFont) -> None:
    pad = 48
    probe = ImageDraw.Draw(Image.new("RGB", (8, 8), "white"))
    sizes = []
    for line in lines:
        box = probe.textbbox((0, 0), line, font=face)
        sizes.append((box[2] - box[0], box[3] - box[1]))
    width = max(item[0] for item in sizes) + pad * 2
    height = sum(item[1] for item in sizes) + pad * 2 + 20 * (len(lines) - 1)
    image = Image.new("RGB", (width, height), "white")
    pen = ImageDraw.Draw(image)
    y = pad
    for line, (_, line_height) in zip(lines, sizes):
        pen.text((pad, y), line, fill=(0, 0, 0), font=face)
        y += line_height + 20
    image.save(OUT / name, dpi=(300, 300))


if __name__ == "__main__":
    render("synthetic-printed-zh.png", ["今天的作业是阅读短文并写出两个关键词。"], CJK)
    render("synthetic-printed-zh-small.png", ["今天的作业是阅读短文并写出两个关键词。"], CJK_SMALL)
    render("synthetic-printed-en.png", ["Read the paragraph and write two key words."], LATIN)
    render("synthetic-printed-math.png", ["y = 2x - 4", "12 + 7 = 19"], LATIN)
    Image.new("RGB", (480, 160), "white").save(OUT / "synthetic-blank.png", dpi=(300, 300))
