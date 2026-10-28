"use client";

import { useState } from "react";
import { Copy, ExternalLink, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// Google Voice does not provide FIRE with a supported direct SMS send API.
// Do not use sms: (the iPhone's personal Messages) or assume that opening
// Google Voice has sent a message. The owner completes the send in Voice.
export const GOOGLE_VOICE_URL = "https://voice.google.com/";

// The owner creates this Shortcut locally, as with the existing Stride bridge.
// Apple documents the run-shortcut URL and UTF-8 text input. The JSON payload
// stays in the local iOS handoff, not sent to FIRE or a remote texting API.
export const FIRE_GOOGLE_VOICE_SHORTCUT_NAME = "FIRE Google Voice Text";
export function googleVoiceShortcutHref(phone: string, message = "") {
  const input = JSON.stringify({ phone, message });
  return "shortcuts://run-shortcut?name=" + encodeURIComponent(FIRE_GOOGLE_VOICE_SHORTCUT_NAME) +
    "&input=text&text=" + encodeURIComponent(input);
}


export function GoogleVoiceTextAction({
  phone,
  customerName,
  label = "Text",
  ariaLabel,
  className,
}: {
  phone: string;
  customerName?: string;
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
          <a className="inline-flex min-h-11 items-center gap-2 rounded-md border px-3 py-2" href={googleVoiceShortcutHref(phone)}><MessageSquareText className="h-4 w-4" /> Use iPhone Shortcut</a>
          <a className="inline-flex min-h-11 items-center gap-2 rounded-md border px-3 py-2" href={GOOGLE_VOICE_URL} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /> Open Google Voice</a>
        </div>
        {copyStatus && <p role="status">{copyStatus}</p>}
        <p className="text-sm">The iPhone Shortcut requires one-time setup in Apple's Shortcuts app and should use the Google Voice 'Send a message' action with your explicit approval. If it is not configured, use Open Google Voice. Nothing is marked sent by FIRE unless you confirm it.</p>
      </DialogContent>
    </Dialog>
  );
}
