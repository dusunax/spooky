"""src/sprites/ghost.ts의 idle 프레임으로 앱 아이콘과 트레이 아이콘을 만든다.

python3 scripts/make-icons.py  (Pillow, macOS iconutil 필요)
"""
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SOURCE = (ROOT / 'src/sprites/ghost.ts').read_text()


def frame(name: str) -> list[str]:
    head = re.search(r'const HEAD = \[(.*?)\]', SOURCE, re.S).group(1)
    tail = re.search(r'const TAIL = \[(.*?)\]', SOURCE, re.S).group(1)
    mouth = re.search(rf'{name}: \[(.*?)\]', SOURCE, re.S).group(1)
    rows = re.findall(r"'([.KWGHP]{16})'", head + mouth + tail)
    assert len(rows) == 16, rows
    return rows


# 아이콘은 어두운 배경 위라 유리 반투명 대신 불투명 색을 쓴다
ICON_COLORS = {'K': (31, 31, 38, 255), 'W': (255, 255, 255, 255), 'G': (210, 214, 230, 255),
               'H': (255, 255, 255, 255), 'P': (255, 111, 145, 255)}


def draw_pixels(rows: list[str], scale: int, colors: dict) -> Image.Image:
    img = Image.new('RGBA', (16 * scale, 16 * scale), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in colors:
                d.rectangle([x * scale, y * scale, (x + 1) * scale - 1, (y + 1) * scale - 1], fill=colors[ch])
    return img


def app_icon(rows: list[str]) -> Image.Image:
    size, inset = 1024, 100  # macOS 아이콘 격자: 824px 둥근 사각형
    icon = Image.new('RGBA', (size, size), (0, 0, 0, 0))

    # 은은한 그림자
    shadow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle([inset, inset + 16, size - inset, size - inset + 16], 185, fill=(0, 0, 0, 90))
    icon.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(18)))

    # 보라 밤하늘 그라데이션
    bg = Image.new('RGBA', (size, size))
    top, bottom = (74, 52, 128), (24, 17, 48)
    for y in range(size):
        t = y / size
        ImageDraw.Draw(bg).line([(0, y), (size, y)], fill=tuple(int(a + (b - a) * t) for a, b in zip(top, bottom)) + (255,))
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([inset, inset, size - inset, size - inset], 185, fill=255)
    icon.paste(bg, (0, 0), mask)

    # 별 몇 개 (픽셀 십자)
    d = ImageDraw.Draw(icon)
    for x, y, s in [(250, 240, 10), (760, 300, 8), (700, 210, 6), (300, 700, 6), (790, 690, 8)]:
        d.rectangle([x - s // 2, y - s * 2, x + s // 2, y + s * 2], fill=(255, 235, 170, 200))
        d.rectangle([x - s * 2, y - s // 2, x + s * 2, y + s // 2], fill=(255, 235, 170, 200))

    # 바닥 그림자 + 유령
    ghost = draw_pixels(rows, 34, ICON_COLORS)  # 544px
    gx, gy = (size - ghost.width) // 2, 200
    floor = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(floor).ellipse([size // 2 - 170, gy + ghost.height + 10, size // 2 + 170, gy + ghost.height + 56], fill=(0, 0, 0, 110))
    icon.alpha_composite(floor.filter(ImageFilter.GaussianBlur(6)))
    glow = Image.new('RGBA', ghost.size, (0, 0, 0, 0))
    glow.paste((255, 255, 255, 80), (0, 0), ghost.split()[3])
    icon.alpha_composite(glow.filter(ImageFilter.GaussianBlur(22)), (gx, gy))
    icon.alpha_composite(ghost, (gx, gy))
    return icon


def face_holes(rows: list[str]) -> list[str]:
    # 바깥(투명)에 닿지 않는 외곽선 픽셀 = 눈·입. 입 안쪽(P)과 함께 'X'로 바꿔 뚫는다
    def outside(x: int, y: int) -> bool:
        return not (0 <= x < 16 and 0 <= y < 16) or rows[y][x] == '.'

    out = []
    for y, row in enumerate(rows):
        chars = list(row)
        for x, ch in enumerate(row):
            near_outside = any(outside(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            if ch == 'P' or (ch == 'K' and not near_outside):
                chars[x] = 'X'
        out.append(''.join(chars))
    return out


def tray_template(rows: list[str], scale: int) -> Image.Image:
    # 메뉴바 템플릿: 검은 실루엣 + 눈·입은 뚫는다. macOS가 메뉴바 밝기에 맞춰 색을 바꾼다
    colors = {c: (0, 0, 0, 255) for c in 'KWGH'}
    pad = scale
    img = Image.new('RGBA', (16 * scale + 2 * pad, 16 * scale + 2 * pad), (0, 0, 0, 0))
    img.alpha_composite(draw_pixels(rows, scale, colors), (pad, pad))
    return img


def main() -> None:
    rows = frame('idle')
    face_rows = face_holes(rows)

    icon = app_icon(rows)
    icon.save(ROOT / 'build/icon.png')

    with tempfile.TemporaryDirectory() as tmp:
        iconset = Path(tmp) / 'icon.iconset'
        iconset.mkdir()
        for px in (16, 32, 128, 256, 512):
            icon.resize((px, px), Image.LANCZOS).save(iconset / f'icon_{px}x{px}.png')
            icon.resize((px * 2, px * 2), Image.LANCZOS).save(iconset / f'icon_{px}x{px}@2x.png')
        subprocess.run(['iconutil', '-c', 'icns', str(iconset), '-o', str(ROOT / 'build/icon.icns')], check=True)

    tray_template(face_rows, 1).save(ROOT / 'resources/trayTemplate.png')     # 18×18
    tray_template(face_rows, 2).save(ROOT / 'resources/trayTemplate@2x.png')  # 36×36
    print('icons written')


if __name__ == '__main__':
    main()
