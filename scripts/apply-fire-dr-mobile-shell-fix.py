from pathlib import Path

css_path = Path('app/globals.css')
if not css_path.exists():
    raise SystemExit('app/globals.css not found')

css = css_path.read_text()
marker = '/* FIRE_DR_MOBILE_SHELL_PARITY_V2 */'
if marker not in css:
    css += r'''

/* FIRE_DR_MOBILE_SHELL_PARITY_V2 */
.fire-dr-stable-header {
  position: sticky !important;
  top: 0 !important;
  z-index: 1000 !important;
}
.fire-dr-fixed-bottom-nav {
  position: fixed !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  width: 100% !important;
  z-index: 1100 !important;
  padding-bottom: env(safe-area-inset-bottom) !important;
  margin: 0 !important;
}
html.fire-dr-bottom-nav-active body {
  padding-bottom: calc(88px + env(safe-area-inset-bottom)) !important;
}
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
script_marker = 'FIRE_DR_MOBILE_SHELL_PARITY_SCRIPT_V2'
if script_marker not in text:
    script = r'''<script dangerouslySetInnerHTML={{__html: `(function(){
  /* FIRE_DR_MOBILE_SHELL_PARITY_SCRIPT_V2 */
  var queued=false;
  function norm(s){return (s||'').replace(/\\s+/g,' ').trim().toLowerCase();}
  function smallestWithLabels(labels){
    var all=[].slice.call(document.querySelectorAll('nav,footer,div'));
    var matches=all.filter(function(el){
      var t=norm(el.innerText);
      return labels.every(function(label){return t.indexOf(label)>=0;});
    });
    matches.sort(function(a,b){return a.querySelectorAll('*').length-b.querySelectorAll('*').length;});
    return matches[0]||null;
  }
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
  function apply(){
    queued=false;
    var header=document.querySelector('header');
    if(header && !header.classList.contains('fire-dr-stable-header')) header.classList.add('fire-dr-stable-header');
    var bottom=smallestWithLabels(['home','contracts','customers','estimates','schedule']);
    if(bottom && !bottom.classList.contains('fire-dr-fixed-bottom-nav')){
      bottom.classList.add('fire-dr-fixed-bottom-nav');
      document.documentElement.classList.add('fire-dr-bottom-nav-active');
    }
    applyStride();
  }
  function scheduleApply(){
    if(queued) return;
    queued=true;
    requestAnimationFrame(apply);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',scheduleApply,{once:true}); else scheduleApply();
  new MutationObserver(function(){scheduleApply();}).observe(document.documentElement,{childList:true,subtree:true});
})();`}} />'''
    if '</body>' not in text:
        raise SystemExit('Could not find </body> in app/layout.tsx')
    text = text.replace('</body>', script + '\n</body>', 1)
    layout.write_text(text)

print('DR_MOBILE_SHELL_PARITY_V2_APPLIED')
