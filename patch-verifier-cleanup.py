from pathlib import Path

# Fix the homepage media inventory matcher so scripts are not treated as media.
p = Path('verify-site.mjs')
s = p.read_text()
old = "  [...index.matchAll(/(?:src|poster)=[\"'](assets\\/[^\"']+)[\"']/g)].map((match) => match[1])"
new = "  [...index.matchAll(/<(?:img|video|audio|source)\\b[^>]*(?:src|poster)=[\"'](assets\\/[^\"']+)[\"']/g)].map((match) => match[1])"
if old not in s:
    raise SystemExit('Homepage media matcher not found; refusing broad verifier edit.')
p.write_text(s.replace(old, new, 1))

# Remove only exact superseded house-wash price tokens from repository text files.
exts = {'.html','.md','.mjs','.txt','.xml','.yml','.yaml','.py','.js','.css'}
for f in Path('.').rglob('*'):
    if not f.is_file() or '.git' in f.parts or f.suffix.lower() not in exts:
        continue
    text = f.read_text(errors='ignore')
    updated = text.replace('$0.25', '$0.22').replace('rate:0.25', 'rate:0.22').replace('rate:.25', 'rate:.22')
    if updated != text:
        f.write_text(updated)
