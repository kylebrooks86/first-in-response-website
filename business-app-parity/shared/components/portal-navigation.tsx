"use client";

import { ArrowLeft, House } from "lucide-react";

export function PortalNavigation({ returnHref, returnLabel = "Back" }: { returnHref?: string; returnLabel?: string }) {
  const goBack = () => {
    if (window.history.length > 1) window.history.back();
    else window.location.href="/";
  };
  const goHome=()=>{window.location.href="/";};
  const goToReturn=()=>{window.location.href=returnHref||"/";};

  return <nav className="portal-navigation" aria-label="App navigation">
    {returnHref
      ? <button className="portal-return" type="button" onClick={goToReturn}><ArrowLeft/><span>{returnLabel}</span></button>
      : <button type="button" onClick={goBack}><ArrowLeft/><span>{returnLabel}</span></button>}
    <button className="portal-home" type="button" onClick={goHome}><House/><span>Home</span></button>
  </nav>;
}
