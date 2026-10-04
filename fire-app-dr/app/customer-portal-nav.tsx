"use client";

import { ArrowLeft, House } from "lucide-react";

export function CustomerPortalNav(){
  return <nav className="portal-floating-nav" aria-label="Customer document navigation">
    <button type="button" className="portal-back" onClick={()=>window.history.back()}><ArrowLeft/> <span>Back</span></button>
    <a href="/"><House/> <span>Home</span></a>
  </nav>;
}
