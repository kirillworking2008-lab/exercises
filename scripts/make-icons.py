"""Optional icon regeneration: python3 -m pip install pillow; python3 scripts/make-icons.py."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SCALE = 4


def make_icon(size, foreground=False, square=False):
    big = size * SCALE
    bg = (0, 0, 0, 0) if foreground else '#0d151b'
    image = Image.new('RGBA', (big, big), bg)
    draw = ImageDraw.Draw(image)
    # Keep every stroke in the maskable safe zone (central 80%).
    unit = big * (0.025 if square or foreground else 0.029)
    offset = (big - unit * 24) / 2
    width = max(1, round(unit * 1.8))
    color = '#73e3cf'
    lines = [(5, 15.5, 15.5, 5), (8.5, 19, 19, 8.5), (4, 12, 12, 20), (12, 4, 20, 12), (3, 17, 7, 21), (17, 3, 21, 7)]
    for x1, y1, x2, y2 in lines:
        pts = [(offset + x1 * unit, offset + y1 * unit), (offset + x2 * unit, offset + y2 * unit)]
        draw.line(pts, fill=color, width=width)
        radius = width / 2
        for x, y in pts:
            draw.ellipse((x-radius, y-radius, x+radius, y+radius), fill=color)
    return image.resize((size, size), Image.Resampling.LANCZOS)


icons = ROOT / 'icons'
icons.mkdir(exist_ok=True)
for size in (192, 512):
    make_icon(size).save(icons / f'icon-{size}.png')
make_icon(512, square=True).save(icons / 'icon-maskable.png')

android = ROOT / 'android/app/src/main/res'
if android.exists():
    for density, size in [('mdpi', 48), ('hdpi', 72), ('xhdpi', 96), ('xxhdpi', 144), ('xxxhdpi', 192)]:
        folder = android / f'mipmap-{density}'
        folder.mkdir(exist_ok=True)
        make_icon(size).save(folder / 'ic_launcher.png')
        make_icon(size).save(folder / 'ic_launcher_round.png')
        make_icon(round(size * 2.25), foreground=True).save(folder / 'ic_launcher_foreground.png')
print('Повтор: icons generated')
