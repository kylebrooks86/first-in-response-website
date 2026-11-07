/** Read-only source contract: message template clarity and viewport-safe dialogs.
 * No HTTP requests, provider credentials, customer records or sends.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ui=readFileSync(new URL('../app/dashboard.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../app/globals.css',import.meta.url),'utf8');
const dialog=readFileSync(new URL('../components/ui/dialog.tsx',import.meta.url),'utf8');
const template=readFileSync(new URL('../lib/fire-templates.ts',import.meta.url),'utf8');
const check=(ok,label)=>{assert.ok(ok,label);console.log('PASS: '+label);};

check(dialog.includes('className={cn(')&&dialog.includes('DialogPrimitive.Close'), 'Existing dialog close and modal accessibility remain intact');
check(ui.includes('role="region" aria-label="Message editor and confirmation controls" tabIndex={0}')&&
 ui.includes('ref={messageBuilderRef} className="message-builder"')&&
 css.includes('.message-dialog[data-slot="dialog-content"]{')&&
 css.includes('max-height:calc(100dvh - 24px)')&&
 css.includes('.message-dialog .message-builder{')&&
 css.includes('overflow-y:auto;')&&
 css.includes('overscroll-behavior-y:contain;'),
 'Message confirmation content scrolls inside bounded viewport while header and close remain reachable');
check(ui.includes('if(open&&preparedMessage)messageBuilderRef.current?.scrollTo({top:0,behavior:"auto"})')&&
 ui.includes('Confirm here only after you send the prepared')&&
 ui.includes('I sent the prepared message')&&
 ui.includes('Not sent — keep editing')&&
 ui.includes('Discard unsent draft'),
 'Preparing a draft reveals confirmation controls without auto-confirming delivery');
for(const category of ['Estimates','Invoices','Scheduling','After service','Documents'])
 check(ui.includes('name:"'+category+'"')&&template.includes('category:"'+category+'"'),
  'Saved template category '+category+' gets icon/color organization, without renaming saved keys');
check(ui.includes('Find a message template')&&ui.includes('composerMatchCount')&&
 ui.includes('visibleComposerTemplates')&&ui.includes('SelectGroup')&&ui.includes('SelectLabel')&&
 ui.includes('messageTemplateCategories.map(group=>')&&ui.includes('SelectItem className={"composer-template-option "+group.tone}'),
 'Composer has searchable category groups with visible selection controls');
check(ui.includes('templateStatus!=="ready"')&&ui.includes('chooseTemplate=(value:string)')&&
 ui.includes('window.confirm("Replace your edited message with another template?")')&&
 ui.includes('channel!=="document"')&&
 ui.includes('triggerLabel==="Text"?(item.channel==="both"||item.channel==="sms")'),
 'Search neither bypasses saved-template validation nor offers email-only/document items in Text');
check(ui.includes('Find a template')&&ui.includes('settingsSearch')&&
 ui.includes('if(hasUnsavedTemplateChanges&&!window.confirm("Discard your unsaved template changes?"))return;'),
 'Settings template organization preserves confirmation before unsaved edits are replaced');
check(css.includes('.composer-template-category-label')&&css.includes('.message-template-category-icon.estimates')&&
 css.includes('.message-template-category-icon.invoices')&&
 css.includes('[data-theme="dark"] .message-template-category-icon.scheduling'),
 'Template groups have distinct theme-aware colors and meaningful icons');
console.log('PASS: Composer and Settings organization contract, read-only/no customer communications.');
