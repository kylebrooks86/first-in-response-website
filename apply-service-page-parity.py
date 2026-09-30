from pathlib import Path

ROOT = Path(__file__).resolve().parent
SERVICE_DIR = ROOT / 'services'

for path in sorted(SERVICE_DIR.glob('*/index.html')):
    text = path.read_text(encoding='utf-8')
    original = text

    # Load the shared live-style parity layer after each page's inline CSS.
    marker = '</style></head>'
    link = '<link rel="stylesheet" href="../../assets/service-live-match.css"></head>'
    if 'service-live-match.css' not in text and marker in text:
        text = text.replace(marker, '</style>' + link, 1)

    # Use the exact local FIRE crest already captured from the live site.
    text = text.replace('../../assets/logo.jpg', '../../assets/recent-work/fire-logo-direct.png')
    text = text.replace('alt="FIRE logo"', 'alt="First In Response Exteriors logo"')

    if text != original:
        path.write_text(text, encoding='utf-8')
        print(f'updated {path.relative_to(ROOT)}')
    else:
        print(f'no change {path.relative_to(ROOT)}')
