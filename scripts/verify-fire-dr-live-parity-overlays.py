from pathlib import Path

# Guard only evidence-backed or user-confirmed LIVE parity. Scrolling/smoothness is
# intentionally NOT asserted here; the user froze that area as good enough.
checks = {
    Path('app/layout.tsx'): [
        'statusBarStyle: "default"',
    ],
    Path('app/dashboard.tsx'): [
        # User-confirmed Templates mobile behavior.
        'const editorRef=useRef<HTMLElement|null>(null);',
        'editorRef.current?.scrollIntoView({behavior:"smooth",block:"start"})',
        '<section ref={editorRef} className="template-editor"><header>',

        # LIVE-captured customer profile empty states.
        'No payments recorded',
        'Open an estimate and choose Record payment after receiving money through Wave, Cash App, Venmo, cash, check, card, or bank transfer.',
        'No invoices yet',
        'Open an estimate and tap Create invoice.',

        # LIVE-captured Photos controls.
        '<Label>Photo type</Label>',
        '<SelectItem value="before">Before</SelectItem>',
        '<SelectItem value="after">After</SelectItem>',
        '<SelectItem value="property">Property / damage</SelectItem>',
        'Optional note',
        'Photo library',

        # LIVE-captured scheduling behavior: approval can proceed to scheduling
        # without making the reservation deposit a hard gate.
        'estimate.status==="approved"?"Next: choose the job date and save it."',
        'estimate.status==="scheduled"?"Next: capture before photos, complete the job report, then create the invoice."',
    ],
    Path('app/invoice/[token]/page.tsx'): [
        # LIVE-captured customer invoice structure/content.
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
        # Keep the working Templates mobile-flow correction. Do not pin a
        # particular scrolling/performance experiment marker.
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
            missing.append(f'{path}: missing expected LIVE parity content: {needle}')

if missing:
    print('DR_LIVE_PARITY_OVERLAY_GUARD=FAIL')
    for item in missing:
        print(f'- {item}')
    raise SystemExit(1)

print('DR_LIVE_PARITY_OVERLAY_GUARD=PASS')
print('Protected: user-confirmed Templates behavior; LIVE-captured customer Payments/Invoices/Photos states; scheduling flow; customer invoice structure/navigation; accepted top-shell status-bar treatment.')
print('Scroll/smoothness behavior is intentionally not modified or pinned by this guard.')
