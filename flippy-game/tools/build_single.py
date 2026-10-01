"""Crea dist/flippy.html: tutto il gioco in un solo file (CSS, JS e immagini incorporati).
Uso:  python3 tools/build_single.py
"""
import base64, os, re, json
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rd = lambda p: open(os.path.join(ROOT, p), encoding='utf-8').read()
assets = {}
for f in sorted(os.listdir(os.path.join(ROOT, 'assets'))):
    if f.endswith('.png'):
        b = base64.b64encode(open(os.path.join(ROOT, 'assets', f), 'rb').read()).decode()
        assets[f[:-4]] = 'data:image/png;base64,' + b
css = rd('css/style.css')
css = re.sub(r"url\(\.\./assets/([\w-]+)\.png\)", lambda m: f"url({assets[m.group(1)]})", css)
html = rd('index.html')
html = html.replace('<link rel="stylesheet" href="css/style.css">', f'<style>\n{css}\n</style>')
js = 'window.ASSETS=' + json.dumps(assets) + ';\n' + rd('js/data.js') + '\n' + rd('js/game.js')
html = html.replace('<script src="js/data.js"></script>\n<script src="js/game.js"></script>', f'<script>\n{js}\n</script>')
os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
open(os.path.join(ROOT, 'dist', 'flippy.html'), 'w', encoding='utf-8').write(html)
print('dist/flippy.html', len(html)//1024, 'KB')
