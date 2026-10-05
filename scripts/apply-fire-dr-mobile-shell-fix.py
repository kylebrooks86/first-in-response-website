from pathlib import Path

css_path = Path('app/globals.css')
if not css_path.exists():
    raise SystemExit('app/globals.css not found')

css = css_path.read_text()
marker = '/* FIRE_DR_STANDALONE_TOPBAR_PARITY_V12 */'
if marker not in css:
    css += r'''

/* FIRE_DR_STANDALONE_TOPBAR_PARITY_V12
   iPhone Home Screen header-only correction. Do not tune page scrolling here.
   Use a true fixed, fully opaque top shell so iOS does not rasterize a sticky
   translucent/composited header while page content moves underneath it. */
.fire-dr-stride-button {
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 0 !important;
  line-height: 1 !important;
  overflow: hidden !important;
}
.fire-dr-stride-button > * { flex: 0 0 auto !important; }
.fire-dr-stride-label {
  position: static !important;
  inset: auto !important;
  transform: translateY(-3px) !important;
  margin: 0 !important;
  line-height: 1 !important;
  white-space: nowrap !important;
}

@media (display-mode: standalone) and (max-width: 760px) {
  html,
  body {
    background: #fff !important;
  }
  [data-theme="dark"],
  [data-theme="dark"] body {
    background: #101d2d !important;
  }
  .main-area {
    padding-top: calc(68px + env(safe-area-inset-top)) !important;
  }
  .topbar {
    position: fixed !important;
    inset: 0 0 auto 0 !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    z-index: 60 !important;
    width: 100% !important;
    height: calc(68px + env(safe-area-inset-top)) !important;
    min-height: calc(68px + env(safe-area-inset-top)) !important;
    padding-top: calc(env(safe-area-inset-top) + 4px) !important;
    padding-left: max(16px, env(safe-area-inset-left)) !important;
    padding-right: max(16px, env(safe-area-inset-right)) !important;
    padding-bottom: 0 !important;
    background: #fff !important;
    background-color: #fff !important;
    background-image: none !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    filter: none !important;
    box-shadow: none !important;
    text-shadow: none !important;
    opacity: 1 !important;
    contain: none !important;
    isolation: isolate !important;
    transform: none !important;
    -webkit-transform: none !important;
    backface-visibility: visible !important;
    -webkit-backface-visibility: visible !important;
    will-change: auto !important;
  }
  [data-theme="dark"] .topbar {
    background: #101d2d !important;
    background-color: #101d2d !important;
    background-image: none !important;
  }
  .topbar::before,
  .topbar::after,
  .mobile-primary-actions::before,
  .mobile-primary-actions::after {
    content: none !important;
    display: none !important;
  }
  .mobile-primary-actions {
    background: #fff !important;
    background-color: #fff !important;
    background-image: none !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    filter: none !important;
    box-shadow: none !important;
    text-shadow: none !important;
    opacity: 1 !important;
    transform: none !important;
    -webkit-transform: none !important;
    will-change: auto !important;
  }
  [data-theme="dark"] .mobile-primary-actions {
    background: #132238 !important;
    background-color: #132238 !important;
    background-image: none !important;
  }
  .mobile-primary-actions > button,
  .top-stride-button,
  .notification-button,
  .mobile-brand,
  .mobile-brand .fire-logo {
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    filter: none !important;
    box-shadow: none !important;
    text-shadow: none !important;
    opacity: 1 !important;
    transform: none !important;
    -webkit-transform: none !important;
    backface-visibility: visible !important;
    -webkit-backface-visibility: visible !important;
    will-change: auto !important;
  }
}
'''
    css_path.write_text(css)

layout = Path('app/layout.tsx')
if not layout.exists():
    raise SystemExit('app/layout.tsx not found')

text = layout.read_text()
text = text.replace('statusBarStyle: "black-translucent"', 'statusBarStyle: "default"')

script_marker = 'FIRE_DR_STRIDE_PARITY_SCRIPT_V12'
if script_marker not in text:
    script = r'''<script dangerouslySetInnerHTML={{__html: `(function(){
  /* FIRE_DR_STRIDE_PARITY_SCRIPT_V12 */
  function norm(s){return (s||'').replace(/\\s+/g,' ').trim().toLowerCase();}
  function closestClickable(el){
    return el && el.closest ? (el.closest('a,button,[role="button"]') || el) : el;
  }
  function applyStride(){
    var nodes=[].slice.call(document.querySelectorAll('a,button,[role="button"],span,small,strong,div'));
    var exact=nodes.filter(function(el){return norm(el.textContent)==='stride';});
    if(!exact.length) return;
    var label=exact.sort(function(a,b){return a.querySelectorAll('*').length-b.querySelectorAll('*').length;})[0];
    var button=closestClickable(label);
    if(button) button.classList.add('fire-dr-stride-button');
    label.classList.add('fire-dr-stride-label');
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',applyStride,{once:true}); else applyStride();
  window.addEventListener('pageshow',applyStride,{once:true});
})();`}} />'''
    if '</body>' not in text:
        raise SystemExit('Could not find </body> in app/layout.tsx')
    text = text.replace('</body>', script + '\n</body>', 1)

layout.write_text(text)
print('DR_STANDALONE_TOPBAR_PARITY_V12_APPLIED')
