from pathlib import Path
p=Path('verify-site.mjs')
s=p.read_text()
old='''    const hasBottomEstimate = /href=["']#(?:estimate|personal)["']/i.test(bottom);'''
new='''    const hasBottomEstimate = /href=["'][^"']*#(?:estimate|personal)["']/i.test(bottom);'''
if old not in s:
    raise SystemExit('Expected estimate-link verifier line not found; refusing to patch.')
p.write_text(s.replace(old,new,1))
