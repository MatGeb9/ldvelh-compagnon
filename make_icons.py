"""
Génère les icônes PWA pour LDVELH.
Lance : python3 make_icons.py
Réutilisable : modifie BG, FG ou TEXT puis relance.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).parent
BG = "#37474F"
FG = "#FFFFFF"
TEXT = "20"

FONT_CANDIDATES = [
    "/System/Library/Fonts/Helvetica.ttc",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/Library/Fonts/Arial Bold.ttf",
]


def _font(size: int) -> ImageFont.ImageFont:
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def make_icon(size: int, out: Path) -> None:
    img = Image.new("RGB", (size, size), BG)
    d = ImageDraw.Draw(img)
    pad = int(size * 0.18)
    d.ellipse([pad, pad, size - pad, size - pad], fill=FG)
    font = _font(int(size * 0.42))
    bbox = d.textbbox((0, 0), TEXT, font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text(
        ((size - w) // 2 - bbox[0], (size - h) // 2 - bbox[1]),
        TEXT,
        fill=BG,
        font=font,
    )
    img.save(out, "PNG")
    print(f"  ✓ {out.name}")


if __name__ == "__main__":
    for s, name in [(180, "apple-touch-icon.png"), (192, "icon-192.png"), (512, "icon-512.png")]:
        make_icon(s, HERE / name)
    print("Done.")
