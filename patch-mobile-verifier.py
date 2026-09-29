from pathlib import Path
p=Path('verify-site.mjs')
s=p.read_text()
old='''    if (/\\bCall\\b/i.test(bottom) && /Text\\s+photos/i.test(bottom) && /\\bEstimate\\b/i.test(bottom) &&\n        html.includes('id="menu-toggle"') && html.includes('aria-controls="site-menu"')) {\n      mobileControlPages += 1;\n    } else fail(`${page}: mobile menu or Call / Text photos / Estimate controls are inconsistent.`);'''
new='''    const hasBottomCall = /href=["']tel:\\+19189229366["']/i.test(bottom);\n    const hasBottomText = /href=["']sms:\\+19189229366(?:[^"']*)?["']/i.test(bottom);\n    const hasBottomEstimate = /href=["']#(?:estimate|personal)["']/i.test(bottom);\n    if (hasBottomCall && hasBottomText && hasBottomEstimate &&\n        html.includes('id="menu-toggle"') && html.includes('aria-controls="site-menu"')) {\n      mobileControlPages += 1;\n    } else fail(`${page}: mobile menu or sticky call / text / estimate controls are inconsistent.`);'''
if old not in s:
    raise SystemExit('Expected verifier block not found; refusing to patch.')
p.write_text(s.replace(old,new,1))
