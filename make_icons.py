"""
Génère les icônes PWA pour LDVELH.
Lance : python3 make_icons.py
Design : fond rouge, disque blanc, épée diagonale + dé à 5 points en noir.
"""
from pathlib import Path
from PIL import Image, ImageDraw

HERE = Path(__file__).parent
RED = "#C62828"
WHITE = "#FFFFFF"
BLACK = "#000000"


def make_icon(size: int, out: Path) -> None:
    # Fond rouge
    img = Image.new("RGB", (size, size), RED)
    d = ImageDraw.Draw(img)

    # Disque blanc (padding 10% pour laisser une couronne rouge visible)
    pad = int(size * 0.10)
    d.ellipse([pad, pad, size - pad, size - pad], fill=WHITE)

    cx, cy = size // 2, size // 2

    # ── Épée (dessinée verticale, pointe en haut, puis tournée -30°) ──
    sword_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sword_layer)

    blade_w = max(8, int(size * 0.058))   # lame plus épaisse
    blade_len = int(size * 0.40)
    tip_y = cy - int(size * 0.30)
    blade_bottom = tip_y + blade_len
    # Lame
    sd.rectangle([cx - blade_w // 2, tip_y + int(size * 0.025), cx + blade_w // 2, blade_bottom], fill=BLACK)
    # Pointe (triangle)
    sd.polygon([
        (cx - blade_w // 2, tip_y + int(size * 0.04)),
        (cx + blade_w // 2, tip_y + int(size * 0.04)),
        (cx, tip_y),
    ], fill=BLACK)
    # Garde transversale (cross-guard) — bien plus large et visible
    cross_w = int(size * 0.24)
    cross_h = max(6, int(size * 0.04))
    sd.rounded_rectangle(
        [cx - cross_w // 2, blade_bottom, cx + cross_w // 2, blade_bottom + cross_h],
        radius=cross_h // 2, fill=BLACK,
    )
    # Poignée
    handle_w = max(6, int(size * 0.04))
    handle_h = int(size * 0.085)
    handle_top = blade_bottom + cross_h
    sd.rectangle([cx - handle_w // 2, handle_top, cx + handle_w // 2, handle_top + handle_h], fill=BLACK)
    # Pommeau (disque)
    pommel_r = int(size * 0.038)
    pommel_cy = handle_top + handle_h + pommel_r
    sd.ellipse([cx - pommel_r, pommel_cy - pommel_r, cx + pommel_r, pommel_cy + pommel_r], fill=BLACK)

    # Rotation -30° (tip vers haut-droite, pommeau vers bas-gauche)
    rot = sword_layer.rotate(-30, resample=Image.BICUBIC, center=(cx, cy))
    img.paste(rot, (0, 0), rot)

    # ── Dé en bas-droite (n'interfère pas avec la poignée qui descend vers le bas-gauche) ──
    die_size = int(size * 0.22)
    die_x = cx + int(size * 0.05)
    die_y = cy + int(size * 0.14)
    radius = int(die_size * 0.18)

    # Dé : rectangle noir avec coins arrondis (compatibilité PIL : on simule avec un masque)
    die_mask = Image.new("L", (die_size, die_size), 0)
    dm = ImageDraw.Draw(die_mask)
    dm.rounded_rectangle([0, 0, die_size, die_size], radius=radius, fill=255)
    die_fill = Image.new("RGB", (die_size, die_size), BLACK)
    img.paste(die_fill, (die_x, die_y), die_mask)

    # Points blancs (face "5" = 4 coins + centre)
    final = ImageDraw.Draw(img)
    dot_r = max(3, int(die_size * 0.085))
    coords = [
        (die_x + die_size * 0.27, die_y + die_size * 0.27),
        (die_x + die_size * 0.73, die_y + die_size * 0.27),
        (die_x + die_size * 0.50, die_y + die_size * 0.50),
        (die_x + die_size * 0.27, die_y + die_size * 0.73),
        (die_x + die_size * 0.73, die_y + die_size * 0.73),
    ]
    for px, py in coords:
        final.ellipse([px - dot_r, py - dot_r, px + dot_r, py + dot_r], fill=WHITE)

    img.save(out, "PNG")
    print(f"  ✓ {out.name}")


if __name__ == "__main__":
    for s, name in [(180, "apple-touch-icon.png"), (192, "icon-192.png"), (512, "icon-512.png")]:
        make_icon(s, HERE / name)
    print("Done.")
