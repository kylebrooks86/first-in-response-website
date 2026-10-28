"use client";

import { useState } from "react";
import { Copy, ExternalLink, MessageSquareText, Phone } from "lucide-react";
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
  async function copyNumber() {
    try {
      await navigator.clipboard.writeText(phone);
      setCopyStatus("Number copied. Paste it into Google Voice.");
    } catch {
      setCopyStatus("Copy was unavailable. Enter the customer number shown above in Google Voice.");
    }
  }
  return (
    <Dialog onOpenChange={() => setCopyStatus("")}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className={className} aria-label={ariaLabel ?? "Text " + (customerName || "customer") + " using Google Voice"}>
          <MessageSquareText aria-hidden="true" className="h-4 w-4" /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[430px]">
        <DialogHeader><DialogTitle>Text using Google Voice</DialogTitle></DialogHeader>
        <p>To keep your personal number private, send from your signed-in FIRE business Google Voice account.</p>
        <p>Customer: <strong>{customerName || "Selected customer"}</strong></p>
        <p>Recipient number: <strong>{phone}</strong></p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void copyNumber()}><Copy className="h-4 w-4" /> Copy number</Button>
          {message && <Button type="button" variant="outline" onClick={() => {
            void navigator.clipboard.writeText(message).then(
              () => setCopyStatus("Prepared message copied. Paste into Google Voice."),
              () => setCopyStatus("Copy unavailable. Select and copy your prepared message manually."),
            );
          }}><Copy className="h-4 w-4" /> Copy message</Button>}
          <a className="inline-flex min-h-11 items-center gap-2 rounded-md border px-3 py-2" href={GOOGLE_VOICE_URL} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /> Open Google Voice</a>
        </div>
        {copyStatus && <p role="status">{copyStatus}</p>}
        <p className="text-sm">Google Voice's iPhone Shortcuts Send action failed on the owner's phone, even with a saved contact. Copy the recipient, open Google Voice and send from your FIRE account. Nothing is marked sent by FIRE unless you confirm it.</p>
      </DialogContent>
    </Dialog>
  );
}


/** The primary Call button stays in Google Voice so no personal cellular caller ID is accidentally used. */
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
  return (
    <Dialog onOpenChange={() => setCopyStatus("")}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className={className} aria-label={"Call " + (customerName || "customer") + " using Google Voice"}>
          <Phone aria-hidden="true" className="h-4 w-4" /> Call
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[430px]">
        <DialogHeader><DialogTitle>Call using Google Voice</DialogTitle></DialogHeader>
        <p>Use your signed-in FIRE Google Voice account for your business caller ID. Opening Voice does not place the call.</p>
        <p>Customer: <strong>{customerName || "Selected customer"}</strong></p>
        <p>Number: <strong>{phone}</strong></p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => {
            void navigator.clipboard.writeText(phone).then(
              () => setCopyStatus("Number copied. Paste into Google Voice to call."),
              () => setCopyStatus("Copy unavailable. Enter the number displayed above."),
            );
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
  const original = message.trim();
  return original ? PERSONAL_BACKUP_TEXT_INTRO + "\n\n" + original : PERSONAL_BACKUP_TEXT_INTRO;
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
  const isText = mode === "text";
  const label = isText ? "Text (Backup)" : "Call (Backup)";
  const openPersonalPhone = async () => {
    const warning = isText
      ? "BACKUP: Apple's Messages may send using your PERSONAL cellphone number, which the customer can see. FIRE will copy a business identification and your original prepared message for you to paste. Continue?"
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
    window.location.href = (isText ? "sms:" : "tel:") + phone;
  };
  return (
    <>
      <Button type="button" variant="outline" className={className} aria-label={label + " for " + (customerName || "customer") + " using your personal number"} onClick={openPersonalPhone}>
        {isText ? <MessageSquareText className="h-4 w-4" aria-hidden="true" /> : <Phone className="h-4 w-4" aria-hidden="true" />} {label}
      </Button>
      {copyStatus && <span className="sr-only" role="status">{copyStatus}</span>}
    </>
  );
}
