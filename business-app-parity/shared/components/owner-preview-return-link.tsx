"use client";

import type {MouseEvent} from "react";
import {X} from "lucide-react";

/**
 * Owner preview Close keeps the previous history entry free of a closed
 * private-token preview. A native document return is intentional: the
 * pinned vinext App Router's client Link transition can throw and leave
 * the owner trapped in the estimate dialog. Only render after server-side
 * owner authorization; the URL query itself grants no owner access.
 */
export function OwnerPreviewReturnLink({href,label,className}:{href:string;label:string;className?:string}){
  const onClick=(event:MouseEvent<HTMLAnchorElement>)=>{
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const url=new URL(event.currentTarget.href);
    if(url.origin!==window.location.origin)return;
    event.preventDefault();
    window.location.replace(url.href);
  };
  return <a className={className} href={href} aria-label={label} title="Close" onClick={onClick}><X aria-hidden="true"/></a>;
}
