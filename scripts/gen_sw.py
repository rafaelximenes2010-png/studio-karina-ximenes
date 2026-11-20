"""Atualiza a lista de arquivos do cache offline (sw.js) e a VERSION. Uso: python3 scripts/gen_sw.py [versão]"""
import os, re, json, sys
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
files = ['./', './index.html', './manifest.webmanifest']
for d in ['css', 'js', 'assets']:
    for dp, _, fs in os.walk(os.path.join(root, d)):
        for f in sorted(fs):
            if not f.endswith('.txt'): files.append('./' + os.path.relpath(os.path.join(dp, f), root))
p = os.path.join(root, 'sw.js'); s = open(p).read()
s = re.sub(r'const CORE = \[[\s\S]*?\];', 'const CORE = ' + json.dumps(sorted(set(files)), indent=1) + ';', s)
if len(sys.argv) > 1: s = re.sub(r"const VERSION = '[^']+'", f"const VERSION = '{sys.argv[1]}'", s)
open(p, 'w').write(s); print(len(set(files)), 'arquivos no cache offline')
