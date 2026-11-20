"""Gera ícones e variações a partir EXCLUSIVAMENTE da logomarca original
(assets/brand/logo-original.jpg). Não redesenha: apenas recorta, enquadra,
redimensiona e mantém o fundo creme original (remover o fundo deforma a marca).
Uso: python3 scripts/brand.py"""
from PIL import Image, ImageFilter
import os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = os.path.join(ROOT, 'assets', 'brand')
src = Image.open(os.path.join(B, 'logo-original.jpg')).convert('RGB')
w, h = src.size
# cor de fundo: média dos cantos
cs = [src.getpixel(p) for p in [(2,2),(w-3,2),(2,h-3),(w-3,h-3)]]
bg = tuple(sum(c[i] for c in cs)//4 for i in range(3))

def square(scale):
    side = int(max(w, h) / scale)
    can = Image.new('RGB', (side, side), bg)
    can.paste(src, ((side-w)//2, (side-h)//2))
    return can

def save(img, name, size):
    img.resize((size, size), Image.LANCZOS).save(os.path.join(B, name), optimize=True)

full = square(0.94)       # ícone "any": logo ocupa ~94%
mask = square(0.72)       # maskable: logo dentro da zona segura (80% central)
save(full, 'icon-180.png', 180)   # apple-touch-icon
save(full, 'icon-192.png', 192)
save(full, 'icon-512.png', 512)
save(mask, 'icon-maskable-512.png', 512)
save(mask, 'icon-maskable-192.png', 192)
save(full, 'favicon-32.png', 32)
save(full, 'favicon-48.png', 48)

print('fundo', bg, 'ok')
