#!/usr/bin/env python3
"""Build a single-file, account-free Find Hub history explorer."""
from pathlib import Path
import base64, hashlib
root=Path(__file__).resolve().parent.parent
app=root/'app'
css=(app/'style.css').read_text()
history=(app/'history.mjs').read_text().replace('export const ', 'const ').replace('export function ', 'function ')
main=(app/'app.mjs').read_text().split('\n',1)[1]
script=history+'\n'+main
assert '</script' not in script.lower() and '</style' not in css.lower()
def digest(text):return base64.b64encode(hashlib.sha256(text.encode()).digest()).decode()
page=(app/'index.html').read_text()
page=page.replace("style-src 'self'; script-src 'self'",f"style-src 'sha256-{digest(css)}'; script-src 'sha256-{digest(script)}'")
page=page.replace('<link rel="stylesheet" href="style.css">',f'<style>{css}</style>')
page=page.replace('<script type="module" src="app.mjs"></script>',f'<script type="module">{script}</script>')
(root/'findhub-offline.html').write_text(page)
print('Built findhub-offline.html')
