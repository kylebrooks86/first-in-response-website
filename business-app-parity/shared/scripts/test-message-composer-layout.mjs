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
check(ui.includes('window.visualViewport?.addEventListener("resize",measure)')&&
 ui.includes('window.addEventListener("resize",measure)')&&
 ui.includes('Math.min(window.innerHeight,viewport?.height??window.innerHeight)')&&
 ui.includes('viewport?.offsetTop??0')&&
 ui.includes('setDialogBounds(current=>current?.height===height&&current.centerY===centerY?current:{height,centerY})')&&
 ui.includes('top:dialogBounds?`${dialogBounds.centerY}px`:undefined')&&
 ui.includes('"--fire-message-visible-height":dialogBounds?')&&
 css.includes('max-height:var(--fire-message-visible-height,calc(100dvh - 24px))!important;'),
 'Message height and centering follow the actual visual viewport despite app-wide !important CSS when a keyboard opens');
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
check(css.includes('/* App-wide CLOSE STANDARD:')&&
 css.includes('[data-slot="dialog-content"] > [data-slot="dialog-close"]{')&&
 css.includes('position:absolute;')&&
 css.includes('top:8px;')&&css.includes('right:8px;')&&
 css.includes('width:44px;')&&css.includes('height:44px;')&&
 css.includes('width:16px;')&&css.includes('height:16px;')&&
 !css.includes('position:sticky;\n  top:8px;\n  right:8px;\n  grid-row:1;')&&
 css.includes('.message-dialog[data-slot="dialog-content"] > [data-slot="dialog-close"]{')&&
 ui.includes('<DialogContent className="message-dialog sm:max-w-[620px]"')&&
 dialog.includes('aria-label="Close"')&&dialog.includes('DialogPrimitive.Close')&&
 dialog.includes('[&_svg]:size-4')&&dialog.includes('size-11 items-center'),
 'Shared and message modal X: small unboxed visual at top-right with 44px accessible hit area');
check(css.includes('.voice-contact-dialog[data-slot="dialog-content"]{')&&
 css.includes('max-height:calc(100dvh - 24px);')&&
 css.includes('overscroll-behavior:contain;'),
 'Google Voice contact dialogs are bounded and scrollable on short screens');
check(css.includes('.composer-template-category-label')&&css.includes('.message-template-category-icon.estimates')&&
 css.includes('.message-template-category-icon.invoices')&&
 css.includes('[data-theme="dark"] .message-template-category-icon.scheduling'),
 'Template groups have distinct theme-aware colors and meaningful icons');
console.log('PASS: Composer and Settings organization contract, read-only/no customer communications.');
