"""Monta o vídeo tutorial do KXS (1080x1920, 30 fps) a partir das telas capturadas por capture_tutorial.mjs.
Cada cena: quadro desenhado (legenda + iPhone + seta) → mp4 próprio com fade; depois concat -c copy."""
import json, os, subprocess, sys, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

SH = os.environ.get('SHOTS', '/tmp/vid/shots'); OUT = os.environ.get('OUT', '/tmp/vid/out'); FN = '/tmp/vid/fonts/'
LOGO = os.path.join(os.path.dirname(__file__), '..', 'assets', 'brand', 'logo-original.jpg')
W, H = 1080, 1920; CREAM = (243, 237, 226); GREEN = (67, 91, 73); GOLD = (168, 131, 79); INK = (43, 49, 40)
os.makedirs(OUT, exist_ok=True); os.makedirs(OUT + '/frames', exist_ok=True); os.makedirs(OUT + '/scenes', exist_ok=True)
F = lambda n, s: ImageFont.truetype(FN + n + '.ttf', s)
serif = lambda s: F('cormorant-garamond-latin-600-normal', s); italic = lambda s: F('cormorant-garamond-latin-400-italic', s)
sans = lambda s: F('inter-latin-500-normal', s); bold = lambda s: F('inter-latin-700-normal', s)
meta = json.load(open(SH + '/meta.json')); VW, VH = meta['viewport']['width'], meta['viewport']['height']
M = {m['name']: m for m in meta['meta']}
logo = Image.open(LOGO).convert('RGB')

def bg():
    im = Image.new('RGB', (W, H), CREAM); d = ImageDraw.Draw(im)
    for y in range(H):  # degradê suave creme → sálvia
        t = y / H; d.line([(0, y), (W, y)], fill=(int(247 - 16 * t), int(242 - 6 * t), int(234 - 6 * t)))
    return im

def round_logo(size):
    l = logo.resize((int(logo.width * size / logo.height), size), Image.LANCZOS)
    sq = Image.new('RGB', (size, size), (243, 237, 226)); sq.paste(l, ((size - l.width) // 2, 0))
    m = Image.new('L', (size, size), 0); ImageDraw.Draw(m).ellipse([0, 0, size - 1, size - 1], fill=255)
    out = Image.new('RGBA', (size, size)); out.paste(sq, (0, 0), m); return out

def wrap(d, text, font, maxw):
    words, lines, cur = text.split(), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if d.textlength(t, font=font) > maxw and cur: lines.append(cur); cur = w
        else: cur = t
    lines.append(cur); return lines

def header(im, part, caption):
    d = ImageDraw.Draw(im)
    lg = round_logo(84); im.paste(lg, (60, 56), lg)
    d.text((164, 64), 'KXS · Studio Karina Ximenes', font=bold(30), fill=GREEN)
    d.text((164, 104), part.upper(), font=bold(24), fill=GOLD, spacing=4)
    y = 186
    for ln in wrap(d, caption, serif(68), W - 120):
        d.text((60, y), ln, font=serif(68), fill=INK); y += 76
    return y

def phone(im, shot, top, box=None):
    s = Image.open(f'{SH}/{shot}.jpg').convert('RGB')
    ph_h = H - top - 70; k = ph_h / s.height; ph_w = int(s.width * k)
    s = s.resize((ph_w, ph_h), Image.LANCZOS)
    x0 = (W - ph_w) // 2; y0 = top
    sh = Image.new('L', (W, H), 0); ImageDraw.Draw(sh).rounded_rectangle([x0 + 6, y0 + 22, x0 + ph_w + 6, y0 + ph_h + 22], 56, fill=110)
    im.paste((60, 70, 60), (0, 0), sh.filter(ImageFilter.GaussianBlur(26)))
    frame = Image.new('L', (ph_w, ph_h), 0); ImageDraw.Draw(frame).rounded_rectangle([0, 0, ph_w - 1, ph_h - 1], 52, fill=255)
    ImageDraw.Draw(im).rounded_rectangle([x0 - 10, y0 - 10, x0 + ph_w + 10, y0 + ph_h + 10], 62, fill=(34, 38, 33))
    im.paste(s, (x0, y0), frame)
    if box:
        sc = ph_w / VW
        bx, by, bw, bh = x0 + box['x'] * sc, y0 + box['y'] * sc, box['width'] * sc, box['height'] * sc
        d = ImageDraw.Draw(im)
        for r, a in ((16, 70), (10, 140)):
            glow = Image.new('L', (W, H), 0); ImageDraw.Draw(glow).rounded_rectangle([bx - r, by - r, bx + bw + r, by + bh + r], 22, outline=255, width=6)
            im.paste((241, 194, 125), (0, 0), glow.point(lambda v: v * a // 255))
        d.rounded_rectangle([bx - 8, by - 8, bx + bw + 8, by + bh + 8], 20, outline=GOLD, width=7)
        arrow(im, bx, by, bw, bh, x0, ph_w)

def arrow(im, bx, by, bw, bh, x0, ph_w):
    d = ImageDraw.Draw(im)
    cx = bx + bw / 2; tip_y = by - 14; above = True
    if by < 560: tip_y = by + bh + 14; above = False
    sx = cx + (170 if cx < W / 2 else -170); sy = tip_y - 190 if above else tip_y + 190
    sx = min(max(sx, 70), W - 70)
    ang = math.atan2(tip_y - sy, cx - sx)
    ex, ey = cx - 46 * math.cos(ang), tip_y - 46 * math.sin(ang)
    for wdt, col in ((26, (255, 255, 255)), (16, GOLD)):
        d.line([(sx, sy), (ex, ey)], fill=col, width=wdt)
        d.ellipse([sx - wdt / 2, sy - wdt / 2, sx + wdt / 2, sy + wdt / 2], fill=col)
    def head(sz, col):
        p1 = (cx, tip_y); p2 = (cx - sz * math.cos(ang - 0.5), tip_y - sz * math.sin(ang - 0.5)); p3 = (cx - sz * math.cos(ang + 0.5), tip_y - sz * math.sin(ang + 0.5))
        d.polygon([p1, p2, p3], fill=col)
    head(84, (255, 255, 255)); head(66, GOLD)

def card(title, sub, n=None):
    im = bg(); d = ImageDraw.Draw(im)
    lg = round_logo(240); im.paste(lg, ((W - 240) // 2, 430), lg)
    if n: d.text((W // 2, 760), n, font=serif(150), fill=GOLD, anchor='mm')
    y = 860 if n else 760
    for ln in wrap(d, title, serif(96), W - 140): d.text((W // 2, y), ln, font=serif(96), fill=GREEN, anchor='mm'); y += 104
    y += 20
    for part in sub.split('|'):
        for ln in wrap(d, part.strip(), sans(40), W - 180): d.text((W // 2, y), ln, font=sans(40), fill=(92, 106, 95), anchor='mm'); y += 56
    return im

def screen(part, shot):
    m = M[shot]; im = bg(); y = header(im, part, m['caption']); phone(im, shot, max(y + 34, 400), m['box']); return im

SCENES = [
    ('intro', lambda: card('Como criar no KXS', '4 jeitos de postar em menos de 1 minuto'), 3.0),
    ('c1', lambda: card('Em 3 passos', 'Formato → assunto → toque na arte', '1'), 2.2),
    ('s00', lambda: screen('1 · Em 3 passos', '00-inicio'), 3.0), ('s11', lambda: screen('1 · Em 3 passos', '11-formato'), 3.2),
    ('s12', lambda: screen('1 · Em 3 passos', '12-assunto'), 3.2), ('s13', lambda: screen('1 · Em 3 passos', '13-arte'), 3.2),
    ('s14', lambda: screen('1 · Em 3 passos', '14-postar'), 3.4),
    ('c2', lambda: card('Com a sua frase', 'Escreva o que está refletindo e escolha a arte', '2'), 2.2),
    ('s21', lambda: screen('2 · Com a sua frase', '21-frase'), 3.2), ('s22', lambda: screen('2 · Com a sua frase', '22-frase-artes'), 3.4),
    ('c3', lambda: card('Com a sua foto', 'Uma foto sua ou uma Foto do mês', '3'), 2.2),
    ('s31', lambda: screen('3 · Com a sua foto', '31-mais-foto'), 3.2), ('s32', lambda: screen('3 · Com a sua foto', '32-com-foto'), 3.2),
    ('s33', lambda: screen('3 · Com a sua foto', '33-postar-foto'), 3.2),
    ('c4', lambda: card('Criação livre', 'Toque em Ajustar e mude tudo com o dedo', '4'), 2.2),
    ('s41', lambda: screen('4 · Criação livre', '41-texto'), 3.2), ('s42', lambda: screen('4 · Criação livre', '42-cores'), 3.0),
    ('s43', lambda: screen('4 · Criação livre', '43-cores-aplicada'), 2.8), ('s44', lambda: screen('4 · Criação livre', '44-formato'), 3.0),
    ('s45', lambda: screen('4 · Criação livre', '45-postar'), 3.0),
    ('outro', lambda: card('Pronto para postar!', 'Instale o KXS pelo link: | rafaelximenes2010-png.github.io | /studio-karina-ximenes/instalar.html'), 3.6),
]

def render(only=None):
    for name, fn, dur in SCENES:
        if only and name not in only: continue
        fn().save(f'{OUT}/frames/{name}.png')
    if only: return
    lst = []
    for name, fn, dur in SCENES:
        tmp = f'{OUT}/scenes/{name}.tmp.mp4'; fin = f'{OUT}/scenes/{name}.mp4'
        vf = f"format=yuv420p,loop=-1:1,trim=duration={dur},fade=t=in:st=0:d=0.25:color=0xF3EDE2,fade=t=out:st={dur - 0.25}:d=0.25:color=0xF3EDE2,setpts=PTS-STARTPTS"
        cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-framerate', '30', '-i', f'{OUT}/frames/{name}.png', '-vf', vf, '-r', '30', '-c:v', 'libx264', '-crf', '20', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', tmp]
        subprocess.run(cmd, check=True); os.replace(tmp, fin); lst.append(f"file '{fin}'")
    open(f'{OUT}/list.txt', 'w').write('\n'.join(lst) + '\n')
    tmp = f'{OUT}/kxs-tutorial.tmp.mp4'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', f'{OUT}/list.txt', '-c', 'copy', '-movflags', '+faststart', tmp], check=True)
    os.replace(tmp, f'{OUT}/kxs-tutorial.mp4')
    Image.open(f'{OUT}/frames/intro.png').convert('RGB').resize((540, 960), Image.LANCZOS).save(f'{OUT}/kxs-tutorial-capa.jpg', quality=85)

if __name__ == '__main__':
    render(sys.argv[1:] or None)
