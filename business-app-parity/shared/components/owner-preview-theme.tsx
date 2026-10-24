"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function OwnerPreviewTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    let saved: string | null = null;
    try { saved = window.localStorage.getItem("fire-theme"); } catch { /* Theme still works for this page. */ }
    const next = saved === "light" || saved === "dark" ? saved
      : document.documentElement.dataset.theme === "dark" || window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    setTheme(next);
    document.documentElement.dataset.theme = next;
  }, []);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try { window.localStorage.setItem("fire-theme", next); } catch { /* Keep the current page usable. */ }
  };
  const label = `Switch to ${theme === "dark" ? "light" : "dark"} mode`;
  return <button type="button" className="owner-preview-theme-toggle" onClick={toggle} aria-label={label} title={label}>
    {theme === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
  </button>;
}
