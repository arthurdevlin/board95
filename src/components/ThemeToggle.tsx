"use client";
import { useEffect, useState } from "react";
export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.dataset.theme === "dark"), []);
  function toggle() {
    const next = !dark ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("board95-theme", next);
    setDark(next === "dark");
  }
  return <button type="button" className="theme-toggle" role="switch" aria-checked={dark} onClick={toggle}><span className="theme-toggle-track"><span className="theme-toggle-thumb"/></span><span>{dark ? "Dark mode on" : "Dark mode off"}</span></button>;
}
