/** Read-only source contract: message template clarity and viewport-safe dialogs.
 * No HTTP requests, provider credentials, customer records or sends.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ui=readFileSync(new URL('../app/dashboard.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../app/globals.css',import.meta.url),'utf8');
const dialog=readFileSync(new URL('../components/ui/dialog.tsx',import.meta.url),'utf8');
const sheet=readFileSync(new URL('../components/ui/sheet.tsx',import.meta.url),'utf8');
const preview=readFileSync(new URL('../components/owner-preview-return-link.tsx',import.meta.url),'utf8');
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
 ui.includes('Did you send it?')&&
 ui.includes('Yes, mark sent')&&
 ui.includes('Not yet · edit')&&
 ui.includes('Discard unsent draft')&&ui.includes('message-secondary-options'),
 'Preparing a draft reveals confirmation controls without auto-confirming delivery');
check(ui.includes('<details className="message-pending-drafts"')&&
 ui.includes('Messages to check ({pendingMessages.length})')&&
 ui.includes('Check whether these were sent before trying again.')&&
 ui.includes('<details className="composer-template-search-disclosure">')&&
 ui.includes('Find another template')&&
 css.includes('.message-dialog .message-confirm-primary{display:grid;grid-template-columns:1fr 1fr;')&&
 css.includes('.message-dialog .message-pending-inner{display:grid;')&&
 ui.includes('Message opened · sending unconfirmed.'),
 'Collapsed draft recovery, template search, and compact send confirmation preserve uncertain status');
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
 dialog.includes('[&_svg]:size-4')&&dialog.includes('size-11 items-center')&&
 sheet.includes('data-slot="sheet-close"')&&sheet.includes('aria-label="Close"')&&
 sheet.includes('absolute top-2 right-2')&&sheet.includes('border-0 bg-transparent')&&
 sheet.includes('size-11 items-center')&&sheet.includes('<XIcon className="size-4" />'),
 'Dialog and sheet X: small unboxed top-right visual with 44px accessible hit area');
const cornerClose=css.slice(css.lastIndexOf('/* FIRE unified close affordance'));
check(cornerClose.includes('width:44px;')&&cornerClose.includes('height:44px;')&&
 cornerClose.includes('width:16px;')&&cornerClose.includes('height:16px;')&&
 cornerClose.includes('top:max(8px,env(safe-area-inset-top));')&&
 cornerClose.includes('right:max(8px,env(safe-area-inset-right));')&&
 cornerClose.includes('outline:3px solid var(--ring);')&&
 cornerClose.includes('.owner-estimate-preview-close{')&&
 cornerClose.includes('.notification-popover > header .notification-header-close{')&&
 cornerClose.includes('.sidebar .mobile-close svg{')&&
 preview.includes('aria-label={label}')&&preview.includes('window.location.replace(url.href)'),
 'Owner preview, notifications and mobile-menu corner X match modal sizing without losing keyboard/owner exit guards');
check(css.lastIndexOf('/* Print/PDF exports must contain agreement content only')>
 css.lastIndexOf('/* FIRE unified close affordance')&&
 css.includes('.owner-estimate-preview-close{display:none!important}'),
 'Owner-only corner X stays hidden from printed/PDF customer agreements after all responsive rules');
check(css.includes('.voice-contact-dialog[data-slot="dialog-content"]{')&&
 css.includes('max-height:calc(100dvh - 24px);')&&
 css.includes('overscroll-behavior:contain;'),
 'Google Voice contact dialogs are bounded and scrollable on short screens');
check(css.includes('.composer-template-category-label')&&css.includes('.message-template-category-icon.estimates')&&
 css.includes('.message-template-category-icon.invoices')&&
 css.includes('[data-theme="dark"] .message-template-category-icon.scheduling'),
 'Template groups have distinct theme-aware colors and meaningful icons');
console.log('PASS: Composer and Settings organization contract, read-only/no customer communications.');
