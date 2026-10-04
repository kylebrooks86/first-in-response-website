from pathlib import Path

css_path = Path('app/globals.css')
if not css_path.exists():
    raise SystemExit('app/globals.css not found')

css = css_path.read_text()
marker = '/* FIRE_DR_MOBILE_SHELL_PARITY */'
if marker not in css:
    css += r'''

/* FIRE_DR_MOBILE_SHELL_PARITY */
.fire-dr-stable-header {
  position: sticky !important;
  top: 0 !important;
  z-index: 1000 !important;
  transform: translateZ(0) !important;
  -webkit-transform: translateZ(0) !important;
  backface-visibility: hidden !important;
  -webkit-backface-visibility: hidden !important;
}
.fire-dr-fixed-bottom-nav {
  position: fixed !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  width: 100% !important;
  z-index: 1100 !important;
  transform: translateZ(0) !important;
  -webkit-transform: translateZ(0) !important;
  backface-visibility: hidden !important;
  -webkit-backface-visibility: hidden !important;
  padding-bottom: env(safe-area-inset-bottom) !important;
}
html.fire-dr-bottom-nav-active body {
  padding-bottom: calc(88px + env(safe-area-inset-bottom)) !important;
}
'''
    css_path.write_text(css)

layout = Path('app/layout.tsx')
if not layout.exists():
    raise SystemExit('app/layout.tsx not found')

text = layout.read_text()
script_marker = 'FIRE_DR_MOBILE_SHELL_PARITY_SCRIPT'
if script_marker not in text:
    script = r'''<script dangerouslySetInnerHTML={{__html: `(function(){
  /* FIRE_DR_MOBILE_SHELL_PARITY_SCRIPT */
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
  function apply(){
    var header=document.querySelector('header');
    if(header) header.classList.add('fire-dr-stable-header');
    var bottom=smallestWithLabels(['home','contracts','customers','estimates','schedule']);
    if(bottom){
      bottom.classList.add('fire-dr-fixed-bottom-nav');
      document.documentElement.classList.add('fire-dr-bottom-nav-active');
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply,{once:true}); else apply();
  new MutationObserver(apply).observe(document.documentElement,{childList:true,subtree:true});
})();`}} />'''
    if '</body>' not in text:
        raise SystemExit('Could not find </body> in app/layout.tsx')
    text = text.replace('</body>', script + '\n</body>', 1)
    layout.write_text(text)

print('DR_MOBILE_SHELL_PARITY_FIX_APPLIED')
