from pathlib import Path
import re

p = Path('index.html')
html = p.read_text()
changes = 0

# Match the live site's full owner heading.
new_html, n = re.subn(r'<h2>Meet Kyle</h2>', '<h2>Meet Kyle Brooks</h2>', html, count=1)
html = new_html; changes += n

# Match the live footer content and navigation, while preserving local staging routes.
footer_pattern = re.compile(r'<footer><img class="footer-logo"[\s\S]*?</footer>', re.I)
footer = '''<footer><img class="footer-logo" src="assets/logo.jpg" alt="First In Response Exteriors logo"><div class="footer-center"><strong>First In Response Exteriors</strong><p>Firefighter owned &amp; insured</p></div><div class="footer-cols"><div><h3>Tulsa &amp; surrounding areas</h3><p>Serving Tulsa and nearby communities<br>Estimates &amp; scheduling by appointment<br><a href="tel:+19189229366">(918) 922-9366</a><br><a href="mailto:kyle@firstinresponseexteriors.com">kyle@firstinresponseexteriors.com</a><br><a href="#areas-served">Areas we serve</a><br><a href="privacy/">Privacy Policy</a><br><a href="service-terms/">Service Terms</a></p></div><div><p><a href="#services">Services</a><br><a href="#results">Real results</a><br><a href="recent-work/">Recent Work</a><br><a href="review/">Share your experience</a><br><a href="#estimate">Free estimate</a></p><p class="footer-social"><a href="https://facebook.com/firstinresponseexteriors" target="_blank" rel="noopener">Facebook</a><br><a href="https://www.instagram.com/firstinresponseexteriors/" target="_blank" rel="noopener">Instagram</a><br><a href="https://maps.app.goo.gl/h2txD3zyS2h6LTYU8" target="_blank" rel="noopener">Google Business</a></p></div></div><p class="copyright">© 2026 First In Response Exteriors.</p></footer>'''
new_html, n = footer_pattern.subn(footer, html, count=1)
html = new_html; changes += n

# Add footer styling used on the live site without disturbing existing layout logic.
if '.footer-social' not in html:
    html = html.replace('</style>', '.footer-social{margin-top:18px}.footer-social a{display:inline-block;margin:4px 0;color:#fff;font-weight:700}.copyright{text-align:center;margin:34px 0 0;font-size:13px;color:#777d86}</style>', 1)
    changes += 1

# Ensure visible owner subtitle mirrors the live site's phrasing when the shorter version remains.
new_html, n = re.subn(r'Firefighter-paramedic\. Local business owner\. The person who shows up\.', 'Firefighter-paramedic. Local business owner. The person who shows up.', html, count=1)
html = new_html; changes += n

# Preserve the live mobile CTA wording.
new_html, n = re.subn(r'<a class="bottom-estimate" href="#personal">Request an estimate</a><a href="tel:\+19189229366">Call Kyle</a><a id="bottom-text-photos" href="sms:\+19189229366">Text Kyle</a>', '<a class="bottom-estimate" href="#personal">Request an estimate</a><a href="tel:+19189229366">Call Kyle</a><a id="bottom-text-photos" href="sms:+19189229366">Text Kyle</a>', html, count=1)
html = new_html; changes += n

if changes == 0:
    raise SystemExit('No expected live-parity targets were found; refusing to make an unrelated edit.')

p.write_text(html)
print(f'Applied {changes} live-parity update(s).')
