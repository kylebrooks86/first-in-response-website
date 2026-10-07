from pathlib import Path

# Keep the sealed v138 package untouched. This overlay only changes the extracted DR build.
dashboard = Path('app/dashboard.tsx')
css_path = Path('app/globals.css')
if not dashboard.exists():
    raise SystemExit('app/dashboard.tsx not found')
if not css_path.exists():
    raise SystemExit('app/globals.css not found')

text = dashboard.read_text()

old_state = 'function SettingsView(){\n  const [templates,setTemplates]=useState<FireTemplate[]>(FIRE_TEMPLATES);'
new_state = 'function SettingsView(){\n  const editorRef=useRef<HTMLElement|null>(null);\n  const [templates,setTemplates]=useState<FireTemplate[]>(FIRE_TEMPLATES);'
if new_state in text:
    pass
elif old_state in text:
    text = text.replace(old_state, new_state, 1)
else:
    raise SystemExit('SettingsView state anchor not found')

old_choose = '  const choose=(item:FireTemplate)=>{if(hasUnsavedTemplateChanges&&!window.confirm("Discard your unsaved template changes?"))return;setSelectedKey(item.key);setDraft(item);setMessage("");};'
new_choose = '  const choose=(item:FireTemplate)=>{if(hasUnsavedTemplateChanges&&!window.confirm("Discard your unsaved template changes?"))return;setSelectedKey(item.key);setDraft(item);setMessage("");if(window.matchMedia("(max-width: 820px)").matches){window.requestAnimationFrame(()=>editorRef.current?.scrollIntoView({behavior:"smooth",block:"start"}));}};'
if new_choose in text:
    pass
elif old_choose in text:
    text = text.replace(old_choose, new_choose, 1)
else:
    raise SystemExit('Template choose handler anchor not found')

old_editor = '      <section className="template-editor"><header>'
new_editor = '      <section ref={editorRef} className="template-editor"><header>'
if new_editor in text:
    pass
elif old_editor in text:
    text = text.replace(old_editor, new_editor, 1)
else:
    raise SystemExit('Template editor anchor not found')

dashboard.write_text(text)

css = css_path.read_text()
marker = '/* FIRE_DR_TEMPLATE_MOBILE_PARITY */'
if marker not in css:
    css += r'''

/* FIRE_DR_TEMPLATE_MOBILE_PARITY */
@media(max-width:820px){
  .settings-view .template-list{
    max-height:none !important;
    overflow:visible !important;
  }
  .settings-view .template-editor{
    scroll-margin-top:78px;
  }
}
'''
    css_path.write_text(css)

print('DR_TEMPLATE_MOBILE_PARITY_APPLIED')
