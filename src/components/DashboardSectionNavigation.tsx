"use client";

import { useEffect, useState } from "react";

export type NavigationEntry = {
  label: string;
  href?: string;
  children?: NavigationEntry[];
};

function NavigationList({ entries, activeHref, onNavigate }: { entries: NavigationEntry[]; activeHref: string; onNavigate: (href: string) => void }) {
  return <ul>{entries.map((entry) => <li key={`${entry.label}-${entry.href ?? "group"}`}>
    {entry.children?.length ? <details open><summary>{entry.label}</summary><NavigationList entries={entry.children} activeHref={activeHref} onNavigate={onNavigate}/></details> : <a href={entry.href} className={activeHref === entry.href ? "is-active" : undefined} aria-current={activeHref === entry.href ? "location" : undefined} onClick={() => entry.href && onNavigate(entry.href)}>{entry.label}</a>}
  </li>)}</ul>;
}

export default function DashboardSectionNavigation({ entries, label = "Workspace sections" }: { entries: NavigationEntry[]; label?: string }) {
  const [activeHref, setActiveHref] = useState("");
  useEffect(() => {
    const updateActiveLink = () => {
      const hash = window.location.hash || "#overview";
      setActiveHref(hash);
      if (!window.location.hash) return;
      let target = document.getElementById(hash.slice(1));
      while (target) {
        if (target instanceof HTMLDetailsElement) target.open = true;
        target = target.parentElement;
      }
    };
    updateActiveLink();
    window.addEventListener("hashchange", updateActiveLink);
    return () => window.removeEventListener("hashchange", updateActiveLink);
  }, []);

  const navigateTo = (href: string) => {
    setActiveHref(href);
    let target = document.getElementById(href.slice(1));
    while (target) {
      if (target instanceof HTMLDetailsElement) target.open = true;
      target = target.parentElement;
    }
  };

  return <>
    <aside className="dashboard-section-sidebar" aria-label={label}>
      <p className="dashboard-sidebar-label">{label}</p>
      <nav aria-label={label}><NavigationList entries={entries} activeHref={activeHref} onNavigate={navigateTo}/></nav>
    </aside>
  </>;
}
