from pathlib import Path

css_path = Path('app/globals.css')
if not css_path.exists():
    raise SystemExit('app/globals.css not found')

css = css_path.read_text()
marker = '/* FIRE_DR_STRIDE_PARITY_V5 */'
if marker not in css:
    css += r'''

/* FIRE_DR_STRIDE_PARITY_V5 */
.fire-dr-stride-button {
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 0 !important;
  line-height: 1 !important;
  overflow: hidden !important;
}
.fire-dr-stride-button > * {
  flex: 0 0 auto !important;
}
.fire-dr-stride-label {
  position: static !important;
  inset: auto !important;
  transform: translateY(-3px) !important;
  margin: 0 !important;
  line-height: 1 !important;
  white-space: nowrap !important;
}
'''
    css_path.write_text(css)

layout = Path('app/layout.tsx')
if not layout.exists():
    raise SystemExit('app/layout.tsx not found')

text = layout.read_text()
script_marker = 'FIRE_DR_STRIDE_PARITY_SCRIPT_V5'
if script_marker not in text:
    script = r'''<script dangerouslySetInnerHTML={{__html: `(function(){
  /* FIRE_DR_STRIDE_PARITY_SCRIPT_V5 */
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

print('DR_STRIDE_PARITY_V5_APPLIED')
