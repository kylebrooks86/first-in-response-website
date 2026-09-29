from pathlib import Path

# Update homepage anchors used by Recent Work mobile navigation.
p = Path('index.html')
s = p.read_text()
s = s.replace('<section class="section cream"><div class="max"><div class="kicker red">MEET THE OWNER</div>', '<section id="meet-kyle" class="section cream"><div class="max"><div class="kicker red">MEET THE OWNER</div>', 1)
s = s.replace('<section class="section cream"><div class="max"><div class="kicker">GOOD TO KNOW</div><h2>Frequently asked questions</h2>', '<section id="faq" class="section cream"><div class="max"><div class="kicker">GOOD TO KNOW</div><h2>Frequently asked questions</h2>', 1)
p.write_text(s)

# Update verifier to treat calculator as a separate app and recent-work as a public page.
p = Path('verify-site.mjs')
s = p.read_text()
s = s.replace("const publicPages = htmlFiles.filter((file) => file !== '404.html' && file !== 'terms/index.html');", "const siteHtmlFiles = htmlFiles.filter((file) => !file.startsWith('calculator/'));\nconst publicPages = siteHtmlFiles.filter((file) => file !== '404.html' && file !== 'terms/index.html');")
s = s.replace("if (publicPages.length === 13) pass('Exactly 13 public-facing pages are represented.');\nelse fail(`Expected 13 public-facing pages; found ${publicPages.length}.`);", "if (publicPages.length === 14) pass('Exactly 14 public-facing pages are represented.');\nelse fail(`Expected 14 public-facing pages; found ${publicPages.length}.`);")
s = s.replace("if (sitemapCount === 13) pass('sitemap.xml contains 13 production URLs.');\nelse fail(`Expected 13 sitemap URLs; found ${sitemapCount}.`);", "if (sitemapCount === 14) pass('sitemap.xml contains 14 production URLs.');\nelse fail(`Expected 14 sitemap URLs; found ${sitemapCount}.`);")
s = s.replace('for (const page of htmlFiles) {', 'for (const page of siteHtmlFiles) {', 1)
s = s.replace('pass(`${htmlFiles.length} HTML files have one-H1, duplicate-ID, noindex, and script checks.`);', 'pass(`${siteHtmlFiles.length} website HTML files have one-H1, duplicate-ID, noindex, and script checks.`);')
s = s.replace("if (canonicalPages === 13) pass('All 13 public pages have the expected production canonical URL.');", "if (canonicalPages === 14) pass('All 14 public pages have the expected production canonical URL.');")
s = s.replace("if (contactPages === 13) pass('All 13 public pages contain the approved call and SMS destinations.');", "if (contactPages === 14) pass('All 14 public pages contain the approved call and SMS destinations.');")
s = s.replace("if (mobileControlPages === 13) pass('All 13 public pages have consistent mobile menu and sticky conversion controls.');", "if (mobileControlPages === 14) pass('All 14 public pages have consistent mobile menu and sticky conversion controls.');")
# Script src is runtime code, not homepage media. Keep media checks limited to actual image/video/audio/source/poster tags.
s = s.replace("  for (const match of html.matchAll(/\\s(?:src|poster)=[\"']([^\"']+)[\"']/gi)) {", "  for (const match of html.matchAll(/<(?:img|video|audio|source)\\b[^>]*\\s(?:src|poster)=[\"']([^\"']+)[\"']/gi)) {")
# The captured visual-match JS is intentionally a script, not part of the 23-file media inventory.
s = s.replace("const actualHomepageMedia = [...index.matchAll(/\\s(?:src|poster)=[\"']([^\"']+)[\"']/gi)]", "const actualHomepageMedia = [...index.matchAll(/<(?:img|video|audio|source)\\b[^>]*\\s(?:src|poster)=[\"']([^\"']+)[\"']/gi)]")
p.write_text(s)
