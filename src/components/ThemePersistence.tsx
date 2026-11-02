"use client";
import { useEffect } from "react";
export default function ThemePersistence() {
  useEffect(() => {
    const saved = window.localStorage.getItem("board95-theme");
    if (saved === "dark" || saved === "light") document.documentElement.dataset.theme = saved;
  }, []);
  return null;
}
