"""Static WOFF instances of the site fonts for Open Graph cards (satori cannot read WOFF2 or variable fonts).

Run from the repo root after changing the web fonts: pip install fonttools brotli && python3 scripts/og-fonts.py
"""
from pathlib import Path
from fontTools.merge import Merger
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
import tempfile

SRC = Path('packages/inkan/app/src/styles/fonts')
OUT = Path('packages/inkan/app/src/og/fonts')
FONTS = {
    'anybody-title': ('anybody-normal-100_900', {'wght': 800, 'wdth': 86}),
    'anybody-number': ('anybody-normal-100_900', {'wght': 900, 'wdth': 125}),
    'martian-mono': ('martian-mono-normal-100_800', {'wght': 600, 'wdth': 100}),
    'instrument-sans': ('instrument-sans-normal-400_700', {'wght': 500, 'wdth': 100}),
}

with tempfile.TemporaryDirectory() as tmp:
    for name, (stem, axes) in FONTS.items():
        parts = []
        for subset in ('latin', 'latin-ext'):
            font = instantiateVariableFont(TTFont(SRC / f'{stem}-{subset}.woff2'), axes, updateFontNames=False)
            font.flavor = None
            part = Path(tmp) / f'{name}-{subset}.ttf'
            font.save(part)
            parts.append(str(part))
        merged = Merger().merge(parts)
        merged.flavor = 'woff'
        merged.save(OUT / f'{name}.woff')
        print(name, (OUT / f'{name}.woff').stat().st_size)
