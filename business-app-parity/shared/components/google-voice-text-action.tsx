"use client";

import { useState } from "react";
import { Copy, ExternalLink, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// Google Voice does not provide FIRE with a supported direct SMS send API.
// Do not use sms: (the iPhone's personal Messages) or assume that opening
// Google Voice has sent a message. The owner completes the send in Voice.
export const GOOGLE_VOICE_URL = "https://voice.google.com/";

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
          <a className="inline-flex min-h-11 items-center gap-2 rounded-md border px-3 py-2" href={GOOGLE_VOICE_URL} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /> Open Google Voice</a>
        </div>
        {copyStatus && <p role="status">{copyStatus}</p>}
        <p className="text-sm">Google Voice's iPhone Shortcuts Send action failed on the owner's phone, even with a saved contact. Copy the recipient, open Google Voice and send from your FIRE account. Nothing is marked sent by FIRE unless you confirm it.</p>
      </DialogContent>
    </Dialog>
  );
}
