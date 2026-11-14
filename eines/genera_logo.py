"""Genera el logo i les icones de Xoriguer Compactador (falcó de la casa + tres barres ZIP/RAR/7z amb cremallera).

Ús:  python -I eines/genera_logo.py   (des de l'arrel del projecte)
Llenç de 512 com la resta d'apps: falcó a (36, 66) amb 440 d'ample, motiu del projecte a sota.
Fons: paleta «Blau pissarra» (#1E2A3B), MAI negre.
Rètol (logo complet): marca.py de LOGOS-XORIGUER (X original + Montserrat ExtraBold + Segoe UI).
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ARREL = Path(__file__).resolve().parent.parent
WWW = ARREL / 'www'
ICONS = WWW / 'icons'
ASSETS = ARREL / 'assets'
sys.path.insert(0, str(Path('C:/Users/Xorigu3r/Documents/LOGOS-XORIGUER/_eines')))
import marca  # noqa: E402

FONS_A = (36, 52, 74, 255)    # #24344A
FONS_B = (26, 37, 51, 255)    # #1A2533
FONS = (30, 42, 59, 255)      # #1E2A3B
CREMA = (246, 239, 226, 255)
TARONJA = (255, 168, 46, 255)
BARRES = [  # (clar, fosc, text)
    ((236, 72, 92, 255), (196, 30, 58, 255), '.ZIP'),
    ((64, 170, 230, 255), (28, 118, 190, 255), '.RAR'),
    ((92, 196, 96, 255), (46, 146, 62, 255), '.7z'),
]
PLATA = (214, 220, 228, 255)
PLATA_FOSCA = (120, 130, 145, 255)
S = 4
FONT = 'C:/Windows/Fonts/segoeuib.ttf'


def degradat(N, c1, c2, y0, y1):
    g = Image.new('RGBA', (1, N))
    for y in range(N):
        t = min(1, max(0, (y - y0) / max(1, y1 - y0)))
        g.putpixel((0, y), tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(4)))
    return g.resize((N, N))


def fons(N):
    return degradat(N, FONS_A, FONS_B, 0, N)


def dibuixa(mida, escala=1.0, amb_fons=True, rodo=False, amb_falco=True):
    N = 512 * S
    k = S
    capa = Image.new('RGBA', (N, N), (0, 0, 0, 0))

    # ombra suau de les barres
    o = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    ImageDraw.Draw(o).rounded_rectangle([92 * k, 236 * k, 452 * k, 478 * k], radius=26 * k, fill=(0, 0, 0, 110))
    capa.alpha_composite(o.filter(ImageFilter.GaussianBlur(14 * k)))

    # tres barres
    x0, x1, alt, gap, y = 86, 446, 70, 9, 228
    font = ImageFont.truetype(FONT, 46 * k)
    for clar, fosc, text in BARRES:
        m = Image.new('L', (N, N), 0)
        ImageDraw.Draw(m).rounded_rectangle([x0 * k, y * k, x1 * k, (y + alt) * k], radius=14 * k, fill=255)
        capa.paste(degradat(N, clar, fosc, y * k, (y + alt) * k), (0, 0), m)
        d = ImageDraw.Draw(capa)
        # brillantor a dalt
        d.rounded_rectangle([(x0 + 6) * k, (y + 4) * k, (x1 - 6) * k, (y + 12) * k], radius=4 * k, fill=(255, 255, 255, 46))
        d.text(((x1 - 16) * k, (y + alt / 2 + 1) * k), text, font=font, fill=CREMA, anchor='rm')
        y += alt + gap

    # cremallera: dents alternes a banda i banda d'una línia, amb el cursor al mig
    d = ImageDraw.Draw(capa)
    cx = 158
    y = 214
    i = 0
    while y < 470:
        # a dalt s'obre en V (com a la captura)
        obert = max(0, (262 - y)) * 0.55
        for costat in (-1, 1):
            dx = costat * (8 + obert)
            if (i + (costat > 0)) % 2 == 0:
                d.rounded_rectangle([(cx + dx - 9) * k, y * k, (cx + dx + 9) * k, (y + 7) * k], radius=2 * k,
                                    fill=PLATA, outline=PLATA_FOSCA, width=1 * k)
        y += 8
        i += 1
    # cursor (slider) i estirador
    sy = 300
    d.rounded_rectangle([(cx - 20) * k, sy * k, (cx + 20) * k, (sy + 44) * k], radius=10 * k, fill=PLATA,
                        outline=PLATA_FOSCA, width=2 * k)
    d.rounded_rectangle([(cx - 12) * k, (sy + 34) * k, (cx + 12) * k, (sy + 104) * k], radius=10 * k,
                        fill=(232, 236, 241, 255), outline=PLATA_FOSCA, width=2 * k)
    d.rounded_rectangle([(cx - 5) * k, (sy + 58) * k, (cx + 5) * k, (sy + 94) * k], radius=4 * k, fill=(60, 68, 80, 255))
    d.ellipse([(cx - 6) * k, (sy + 10) * k, (cx + 6) * k, (sy + 22) * k], fill=PLATA_FOSCA)

    if amb_falco:
        falco = Image.open(ICONS / 'falco.png').convert('RGBA')
        fw = 440 * k
        falco = falco.resize((fw, round(fw * falco.height / falco.width)), Image.LANCZOS)
        capa.alpha_composite(falco, (36 * k, 50 * k))

    if escala != 1.0:
        mm = round(N * escala)
        petita = capa.resize((mm, mm), Image.LANCZOS)
        capa = Image.new('RGBA', (N, N), (0, 0, 0, 0))
        capa.alpha_composite(petita, ((N - mm) // 2, (N - mm) // 2))
    im = fons(N) if amb_fons else Image.new('RGBA', (N, N), (0, 0, 0, 0))
    im.alpha_composite(capa)
    if rodo:
        mk = Image.new('L', (N, N), 0)
        ImageDraw.Draw(mk).rounded_rectangle([0, 0, N - 1, N - 1], radius=N // 5, fill=255)
        im.putalpha(mk)
    return im.resize((mida, mida), Image.LANCZOS)


def logo_complet(mida=1024):
    im = fons(mida)
    simbol = dibuixa(700, amb_fons=False)
    im.alpha_composite(simbol, ((mida - 700) // 2, 0))
    marca.enganxa(im, marca.rotul('XORIGUER', 'COMPACTADOR', amplada=int(mida * 0.74)), mida / 2, mida * 0.725)
    return im


if __name__ == '__main__':
    ASSETS.mkdir(exist_ok=True)
    dibuixa(512).save(ICONS / 'icon-512.png')
    dibuixa(192).save(ICONS / 'icon-192.png')
    dibuixa(512, escala=0.78).save(ICONS / 'maskable-512.png')
    dibuixa(180, escala=0.92).convert('RGB').save(ICONS / 'apple-touch-icon.png')
    dibuixa(64, rodo=True).save(ICONS / 'favicon.png')
    dibuixa(256, amb_fons=False).save(ICONS / 'simbol.png')
    logo_complet().convert('RGB').save(ICONS / 'logo-complet.png')
    # Android (@capacitor/assets)
    dibuixa(1024, escala=0.92).convert('RGB').save(ASSETS / 'icon-only.png')
    dibuixa(1024, escala=0.62, amb_fons=False).save(ASSETS / 'icon-foreground.png')
    fons(1024).convert('RGB').save(ASSETS / 'icon-background.png')
    sp = Image.new('RGBA', (2732, 2732), FONS)
    sp.alpha_composite(logo_complet(1000), (866, 866))
    sp.convert('RGB').save(ASSETS / 'splash.png')
    sp.convert('RGB').save(ASSETS / 'splash-dark.png')
    print('Icones generades a', ICONS)
