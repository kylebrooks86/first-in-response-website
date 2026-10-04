from pathlib import Path

checks = {
    Path('app/layout.tsx'): [
        'statusBarStyle: "default"',
        'FIRE_DR_STRIDE_PARITY_SCRIPT_V10',
    ],
    Path('app/dashboard.tsx'): [
        'const editorRef=useRef<HTMLElement|null>(null);',
        'editorRef.current?.scrollIntoView({behavior:"smooth",block:"start"})',
        '<section ref={editorRef} className="template-editor"><header>',
        'No payments recorded',
        'Open an estimate and choose Record payment after receiving money through Wave, Cash App, Venmo, cash, check, card, or bank transfer.',
        'No invoices yet',
        'Open an estimate and tap Create invoice.',
        '<Label>Photo type</Label>',
        '<SelectItem value="before">Before</SelectItem>',
        '<SelectItem value="after">After</SelectItem>',
        '<SelectItem value="property">Property / damage</SelectItem>',
        'Optional note',
        'Photo library',
    ],
    Path('app/invoice/[token]/page.tsx'): [
        '<p>INVOICE FOR</p>',
        '<small>Invoice total</small>',
        '<small>Balance due</small>',
        'Cash App:',
        'Venmo:',
        '<CustomerPortalNav/>',
    ],
    Path('app/customer-portal-nav.tsx'): [
        'className="portal-floating-nav"',
        'window.history.back()',
        '<span>Back</span>',
        '<span>Home</span>',
    ],
    Path('app/globals.css'): [
        'FIRE_DR_STANDALONE_SCROLL_PARITY_V10',
        'FIRE_DR_TEMPLATE_MOBILE_PARITY',
    ],
}

missing = []
for path, needles in checks.items():
    if not path.exists():
        missing.append(f'{path}: missing file')
        continue
    text = path.read_text()
    for needle in needles:
        if needle not in text:
            missing.append(f'{path}: missing expected parity marker/content: {needle}')

if missing:
    print('DR_LIVE_PARITY_OVERLAY_GUARD=FAIL')
    for item in missing:
        print(f'- {item}')
    raise SystemExit(1)

print('DR_LIVE_PARITY_OVERLAY_GUARD=PASS')
print('Protected: user-confirmed Templates mobile behavior, current top shell/Stride treatment, LIVE-captured customer empty-state wording, photo controls, and customer invoice structure/navigation.')
