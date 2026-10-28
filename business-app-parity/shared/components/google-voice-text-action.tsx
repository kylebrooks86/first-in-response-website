"use client";

import { useRef, useState } from "react";
import { Copy, ExternalLink, MessageSquareText, Phone } from "lucide-react";
import { usableCustomerPhone } from "@/lib/customer-contact-links";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// Google Voice does not provide FIRE with a supported direct SMS send API.
// Do not use sms: (the iPhone's personal Messages) or assume that opening
// Google Voice has sent a message. The owner completes the send in Voice.
export const GOOGLE_VOICE_URL = "https://voice.google.com/";

export function GoogleVoiceTextAction({
  phone,
  customerName,
  message,
  label = "Text",
  ariaLabel,
  className,
}: {
  phone: string;
  customerName?: string;
  message?: string;
  label?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const [copyStatus, setCopyStatus] = useState("");
  const recipient = usableCustomerPhone(phone);
  async function copyNumber() {
    try {
      await navigator.clipboard.writeText(recipient!);
      setCopyStatus("Number copied. Paste it into Google Voice.");
    } catch {
      setCopyStatus("Copy was unavailable. Enter the customer number shown above in Google Voice.");
    }
  }
  return (
    <Dialog onOpenChange={() => setCopyStatus("")}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" disabled={!recipient} className={`${className ?? ""} min-h-11 whitespace-normal`} aria-label={ariaLabel ?? "Text " + (customerName || "customer") + " using Google Voice"}>
          <MessageSquareText aria-hidden="true" className="h-4 w-4" /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="voice-contact-dialog sm:max-w-[430px]">
        <DialogHeader><DialogTitle>Text using Google Voice</DialogTitle></DialogHeader>
        <p>Send from your FIRE business account.</p>
        <p>Customer: <strong>{customerName || "Selected customer"}</strong></p>
        <p>Recipient number: <strong>{phone}</strong></p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="min-h-11 whitespace-normal" onClick={() => void copyNumber()}><Copy className="h-4 w-4" /> Copy number</Button>
          {message && <Button type="button" variant="outline" className="min-h-11 whitespace-normal" onClick={async () => {
            try { await navigator.clipboard.writeText(message); setCopyStatus("Message copied. Paste into Google Voice."); }
            catch { setCopyStatus("Copy unavailable. Select and copy the message below."); }
          }}><Copy className="h-4 w-4" /> Copy message</Button>}
          <a className="inline-flex min-h-11 items-center gap-2 rounded-md border px-3 py-2" href={GOOGLE_VOICE_URL} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /> Open Google Voice</a>
        </div>
        {copyStatus && <p role="status">{copyStatus}</p>}
        {message && <textarea aria-label="Prepared message for Google Voice" className="w-full min-h-20 rounded-md border p-2 text-base" rows={3} value={message} readOnly onFocus={event => event.currentTarget.select()}/>}
        <p className="text-sm">Nothing is marked sent by FIRE unless you confirm it.</p>
      </DialogContent>
    </Dialog>
  );
}


/** Apple documents text input for a named Shortcut. Never use clipboard state or a personal-phone fallback. */
export function googleVoiceCallShortcutHref(phone: string): string | null {
  const recipient = usableCustomerPhone(phone);
  return recipient ? "shortcuts://run-shortcut?name=Call%204&input=text&text=" + encodeURIComponent(recipient) : null;
}

/** Keep the manual business-number path while the direct Call 4 handoff awaits iPhone acceptance. */
export function GoogleVoiceCallAction({
  phone,
  customerName,
  className,
}: {
  phone: string;
  customerName?: string;
  className?: string;
}) {
  const [copyStatus, setCopyStatus] = useState("");
  const recipient = usableCustomerPhone(phone);
  const shortcutHref = googleVoiceCallShortcutHref(phone);
  return (
    <Dialog onOpenChange={() => setCopyStatus("")}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" disabled={!recipient} className={`${className ?? ""} min-h-11 whitespace-normal`} aria-label={"Call " + (customerName || "customer") + " using Google Voice"}>
          <Phone aria-hidden="true" className="h-4 w-4" /> Call
        </Button>
      </DialogTrigger>
      <DialogContent className="voice-contact-dialog sm:max-w-[430px]">
        <DialogHeader><DialogTitle>Call using Google Voice</DialogTitle></DialogHeader>
        <p>Call 4 uses your existing Google Voice Shortcut. Check the recipient before calling.</p>
        <p>Customer: <strong>{customerName || "Selected customer"}</strong></p>
        <p>Number: <strong>{phone}</strong></p>
        {shortcutHref && <a className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-primary-foreground" href={shortcutHref}><Phone aria-hidden="true" className="h-4 w-4" /> Call via Call 4</a>}
        <p className="text-sm">Or call manually in Google Voice:</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="min-h-11 whitespace-normal" onClick={async () => {
            try { await navigator.clipboard.writeText(recipient!); setCopyStatus("Number copied. Paste into Google Voice to call."); }
            catch { setCopyStatus("Copy unavailable. Enter the number displayed above."); }
          }}><Copy className="h-4 w-4" /> Copy number</Button>
          <a className="inline-flex min-h-11 items-center gap-2 rounded-md border px-3 py-2" href={GOOGLE_VOICE_URL} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /> Open Google Voice</a>
        </div>
        {copyStatus && <p role="status">{copyStatus}</p>}
      </DialogContent>
    </Dialog>
  );
}

// Prepend only for explicitly selected PERSONAL-number backup texts. Never change saved templates.
export const PERSONAL_BACKUP_TEXT_INTRO = "Hi, this is First In Response Exteriors. We're using an alternate number today.";
export function personalBackupTextBody(message = ""): string {
  const original = message;
  return original.trim() ? PERSONAL_BACKUP_TEXT_INTRO + "\n\n" + original : PERSONAL_BACKUP_TEXT_INTRO;
}

/** Explicit manual fallback only. A native sms:/tel: link can expose the owner's personal number. */
export function PersonalPhoneBackupAction({
  phone,
  mode,
  customerName,
  message,
  className,
}: {
  phone: string;
  mode: "text" | "call";
  customerName?: string;
  message?: string;
  className?: string;
}) {
  const [copyStatus, setCopyStatus] = useState("");
  const recipient = usableCustomerPhone(phone);
  const inFlight = useRef(false);
  const [opening, setOpening] = useState(false);
  const isText = mode === "text";
  const label = isText ? "Text (Backup)" : "Call (Backup)";
  const openPersonalPhone = async () => {
    if (inFlight.current || !recipient) return;
    inFlight.current = true;
    setOpening(true);
    try {
    const warning = isText
      ? "BACKUP: Apple's Messages may send using your PERSONAL cellphone number, which the customer can see. Only use this if the message has NOT already been sent via Google Voice. FIRE copies the business introduction and your prepared message for you to paste and review. Continue?"
      : "BACKUP: Your iPhone's regular Phone app may reveal your PERSONAL cellphone number to the customer. Only continue if Google Voice is unavailable. Proceed?";
    if (!window.confirm(warning)) return;
    if (isText) {
      // Apple's documented sms: link supports only a recipient, not a prefilled body.
      // Copy the alternate-number intro plus the original prepared message FIRST.
      try {
        if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
        await navigator.clipboard.writeText(personalBackupTextBody(message));
        setCopyStatus("Backup message copied. Paste and verify in Messages before sending.");
      } catch {
        // Stay in FIRE if the text could not be copied; opening an empty compose window
        // would silently lose both the alternate-number disclosure and the prepared template.
        setCopyStatus("Could not copy the backup message. Do not send a blank or incomplete text.");
        window.alert("Unable to copy the backup text. Stay in FIRE and copy the original prepared message manually, adding the alternate-number introduction before sending.");
        return;
      }
    }
    await Promise.resolve();
    window.location.href = (isText ? "sms:" : "tel:") + recipient;
    } finally { inFlight.current = false; setOpening(false); }
  };
  return (
    <>
      <Button type="button" data-personal-backup variant="ghost" disabled={opening || !recipient} className={`${className ?? ""} min-h-11 whitespace-normal text-xs`} aria-label={label + " for " + (customerName || "customer") + " using your personal number"} onClick={openPersonalPhone}>
        {isText ? <MessageSquareText className="h-4 w-4" aria-hidden="true" /> : <Phone className="h-4 w-4" aria-hidden="true" />} {label}
      </Button>
      {copyStatus && <span className="text-xs" role="status">{copyStatus}</span>}
    </>
  );
}
