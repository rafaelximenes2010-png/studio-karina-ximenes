"""Garante que os ícones derivam da logomarca ORIGINAL (assets/brand/logo-original.jpg)
e não de um redesenho/substituto. Compara cada ícone com o enquadramento esperado do original."""
import os, sys
from PIL import Image, ImageChops, ImageStat
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = os.path.join(ROOT, 'assets', 'brand')
src = Image.open(os.path.join(B, 'logo-original.jpg')).convert('RGB')
w, h = src.size
cs = [src.getpixel(p) for p in [(2, 2), (w - 3, 2), (2, h - 3), (w - 3, h - 3)]]
bg = tuple(sum(c[i] for c in cs) // 4 for i in range(3))
def square(scale):
    side = int(max(w, h) / scale); can = Image.new('RGB', (side, side), bg); can.paste(src, ((side - w) // 2, (side - h) // 2)); return can
fails = 0
for name, scale in [('icon-180.png', .94), ('icon-192.png', .94), ('icon-512.png', .94), ('icon-maskable-192.png', .72), ('icon-maskable-512.png', .72), ('favicon-48.png', .94)]:
    ic = Image.open(os.path.join(B, name)).convert('RGB')
    exp = square(scale).resize(ic.size, Image.LANCZOS)
    diff = sum(ImageStat.Stat(ImageChops.difference(ic, exp)).mean) / 3
    ok = diff < 4.0
    fails += not ok
    print(('✔' if ok else '✘'), f'{name} {ic.size[0]}×{ic.size[1]} — diferença média para o original: {diff:.2f}')
if src.size[0] < 400: print('✘ logo-original.jpg muito pequena'); fails += 1
else: print(f'✔ logo-original.jpg {src.size[0]}×{src.size[1]}')
sys.exit(1 if fails else 0)
