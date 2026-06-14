from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


WIDTH = 1080
HEIGHT = 1920
SCENE_TOP = 300
NAVY = (5, 18, 49)
WHITE = (255, 255, 255)
YELLOW = (255, 211, 55)
CYAN = (63, 199, 255)

CARDS = [
    ("01-triple-combo.png", "ТРОЙНОЕ\nКОМБО!", YELLOW, "СМОЖЕШЬ ПОВТОРИТЬ?"),
    ("02-last-move.png", "ОДИН ХОД\nДО СПАСЕНИЯ", CYAN, "НАЙДИ ЕГО"),
    ("03-chain-reaction.png", "ЭТО ВЗОРВАЛО\nВСЁ ПОЛЕ", YELLOW, "ТВОЯ ОЧЕРЕДЬ"),
    ("04-before-after.png", "ДО / ПОСЛЕ\nОДНОГО ХОДА", CYAN, "КАК ЭТО ВОЗМОЖНО?"),
    ("05-high-score.png", "ПОБЕЙ\nМОЙ РЕКОРД", YELLOW, "СМОЖЕШЬ НАБРАТЬ БОЛЬШЕ?"),
    ("06-choose-a-move.png", "КАКОЙ ХОД\nВЫБЕРЕШЬ?", CYAN, "РЕШЕНИЕ ТОЛЬКО ОДНО"),
    ("07-last-second-save.png", "СПАСЕНИЕ\nВ ПОСЛЕДНИЙ МОМЕНТ", YELLOW, "НЕ МОРГАЙ"),
    ("08-secret-strategy.png", "СЕКРЕТНАЯ\nСТРАТЕГИЯ", CYAN, "ТЫ ЗНАЛ ОБ ЭТОМ?"),
    ("09-perfect-combo.png", "САМОЕ\nПРИЯТНОЕ КОМБО", YELLOW, "ВКЛЮЧИ ЗВУК"),
    ("10-versus.png", "КТО НАБЕРЁТ\nБОЛЬШЕ?", CYAN, "БРОСЬ ВЫЗОВ ДРУГУ"),
]


def fit_scene(source: Image.Image) -> Image.Image:
    scene_height = HEIGHT - SCENE_TOP
    scale = min(WIDTH / source.width, scene_height / source.height)
    size = (round(source.width * scale), round(source.height * scale))
    return source.resize(size, Image.Resampling.LANCZOS)


def text_bbox(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, stroke: int):
    return draw.multiline_textbbox((0, 0), text, font=font, spacing=0, stroke_width=stroke)


def fit_font(
    draw: ImageDraw.ImageDraw,
    text: str,
    font_path: Path,
    max_width: int,
    max_height: int,
    start_size: int,
    stroke: int,
) -> ImageFont.FreeTypeFont:
    for size in range(start_size, 30, -2):
        font = ImageFont.truetype(str(font_path), size)
        box = text_bbox(draw, text, font, stroke)
        if box[2] - box[0] <= max_width and box[3] - box[1] <= max_height:
            return font
    return ImageFont.truetype(str(font_path), 30)


def add_glow(canvas: Image.Image, text: str, xy: tuple[int, int], font: ImageFont.FreeTypeFont, color):
    glow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.multiline_text(
        xy,
        text,
        font=font,
        fill=(*color, 210),
        stroke_width=15,
        stroke_fill=(*color, 120),
        spacing=0,
        anchor="ma",
        align="center",
    )
    canvas.alpha_composite(glow.filter(ImageFilter.GaussianBlur(22)))


def render_card(source_path: Path, output_path: Path, headline: str, accent, cta: str):
    canvas = Image.new("RGBA", (WIDTH, HEIGHT), (*NAVY, 255))
    source = Image.open(source_path).convert("RGB")
    scene = fit_scene(source)

    x = (WIDTH - scene.width) // 2
    y = SCENE_TOP + (HEIGHT - SCENE_TOP - scene.height) // 2
    canvas.alpha_composite(scene.convert("RGBA"), (x, y))

    shade = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    pixels = shade.load()
    for shade_y in range(560):
        alpha = max(0, round(230 * (1 - shade_y / 560)))
        for shade_x in range(WIDTH):
            pixels[shade_x, shade_y] = (*NAVY, alpha)
    canvas.alpha_composite(shade)

    draw = ImageDraw.Draw(canvas)
    impact = Path(r"C:\Windows\Fonts\impact.ttf")
    bold = Path(r"C:\Windows\Fonts\arialbd.ttf")

    pill_box = (54, 44, 245, 108)
    draw.rounded_rectangle(pill_box, radius=28, fill=(*accent, 255))
    pill_font = ImageFont.truetype(str(bold), 33)
    draw.text((150, 76), "BLOXX", font=pill_font, fill=NAVY, anchor="mm")

    headline_font = fit_font(draw, headline, impact, WIDTH - 108, 260, 150, 5)
    headline_box = text_bbox(draw, headline, headline_font, 5)
    headline_h = headline_box[3] - headline_box[1]
    headline_y = 130 + headline_h // 2
    add_glow(canvas, headline, (WIDTH // 2, headline_y), headline_font, accent)

    draw = ImageDraw.Draw(canvas)
    draw.multiline_text(
        (WIDTH // 2, headline_y),
        headline,
        font=headline_font,
        fill=WHITE,
        stroke_width=5,
        stroke_fill=NAVY,
        spacing=0,
        anchor="ma",
        align="center",
    )

    cta_font = fit_font(draw, cta, bold, WIDTH - 160, 80, 42, 2)
    cta_box = text_bbox(draw, cta, cta_font, 2)
    cta_w = cta_box[2] - cta_box[0]
    cta_y = HEIGHT - 94
    draw.rounded_rectangle(
        (WIDTH // 2 - cta_w // 2 - 44, cta_y - 40, WIDTH // 2 + cta_w // 2 + 44, cta_y + 40),
        radius=40,
        fill=(*NAVY, 220),
        outline=(*accent, 255),
        width=4,
    )
    draw.text(
        (WIDTH // 2, cta_y),
        cta,
        font=cta_font,
        fill=WHITE,
        stroke_width=2,
        stroke_fill=NAVY,
        anchor="mm",
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(output_path, quality=96, optimize=True)


def create_contact_sheet(outputs: list[Path], output_path: Path):
    thumb_w = 216
    thumb_h = 384
    gap = 18
    sheet = Image.new("RGB", (thumb_w * 5 + gap * 6, thumb_h * 2 + gap * 3), NAVY)
    for index, output in enumerate(outputs):
        image = Image.open(output).convert("RGB").resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
        col = index % 5
        row = index // 5
        sheet.paste(image, (gap + col * (thumb_w + gap), gap + row * (thumb_h + gap)))
    sheet.save(output_path, quality=94, optimize=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source_dir", type=Path)
    parser.add_argument("output_dir", type=Path)
    args = parser.parse_args()

    sources = sorted(args.source_dir.glob("*.png"), key=lambda path: path.stat().st_mtime)
    if len(sources) < len(CARDS):
        raise SystemExit(f"Expected at least {len(CARDS)} PNG sources, found {len(sources)}")

    outputs = []
    for source, (filename, headline, accent, cta) in zip(sources[:10], CARDS):
        output = args.output_dir / filename
        render_card(source, output, headline, accent, cta)
        outputs.append(output)
        print(output)

    create_contact_sheet(outputs, args.output_dir / "contact-sheet.jpg")


if __name__ == "__main__":
    main()
