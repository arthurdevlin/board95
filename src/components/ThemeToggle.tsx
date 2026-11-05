"use client";
import { Moon, Sun } from "lucide-react";

import { useSyncExternalStore } from "react";

// Subscribe to <html data-theme> changes so React reads the theme from the DOM
// (an external system) instead of copying it into state inside an effect.
function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

export default function ThemeToggle() {
  const dark = useSyncExternalStore(
    subscribe,
    () => document.documentElement.dataset.theme === "dark",
    () => false, // server snapshot
  );
  function toggle() {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("board95-theme", next);
  }
  return <button type="button" className="theme-toggle" role="switch" aria-checked={dark} onClick={toggle}><span className="theme-toggle-track"><span className="theme-toggle-thumb"/></span>{dark ? <Moon size={17} aria-hidden="true"/> : <Sun size={17} aria-hidden="true"/>}<span>{dark ? "Dark mode on" : "Dark mode off"}</span></button>;
}
