from pathlib import Path

# Small DR-only visual/content parity overlays backed by stored LIVE evidence.
# The sealed v138 archive remains immutable; these changes are applied after
# extraction by the independent staging preparation script.

accept_path = Path('app/estimate/[token]/accept-button.tsx')
if not accept_path.exists():
    raise SystemExit('app/estimate/[token]/accept-button.tsx not found')

text = accept_path.read_text()
old = 'if(done)return <div className="portal-approved"><Check/>Estimate approved and agreement signed. Kyle will contact you to schedule.</div>;'
new = 'if(done)return <div className="portal-approved"><Check/>Estimate approved and agreement signed{signedName?` by ${signedName}`:""}. Kyle will contact you to schedule.</div>;'

if new not in text:
    if old not in text:
        raise SystemExit('Expected approved-estimate confirmation source was not found; refusing to guess.')
    text = text.replace(old, new, 1)
    accept_path.write_text(text)

print('DR_LIVE_EVIDENCE_FIXES_APPLIED')
print('Approved estimate confirmation now retains the signer name when available, matching the stored LIVE approved/signed evidence.')
