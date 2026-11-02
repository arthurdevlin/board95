"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import SignOutButton from "@/components/SignOutButton";
import SettingsIcon from "@/components/SettingsIcon";
import type { NavigationEntry } from "@/components/DashboardSectionNavigation";

type MenuLink = { href: string; label: string };
function containsActiveItem(item: NavigationEntry, activeLocation: string): boolean {
  return item.href === activeLocation || Boolean(item.children?.some((child) => containsActiveItem(child, activeLocation)));
}

function MenuItems({ items, activeLocation, onNavigate }: { items: NavigationEntry[]; activeLocation: string; onNavigate: (href: string) => void }) {
  return <ul>{items.map((item) => <li key={`${item.label}-${item.href ?? "group"}`}>
    {item.children?.length ? <details className={containsActiveItem(item, activeLocation) ? "has-active-child" : undefined}><summary>{item.label}</summary><MenuItems items={item.children} activeLocation={activeLocation} onNavigate={onNavigate}/></details> : <Link href={item.href ?? "#"} className={activeLocation === item.href ? "is-active" : undefined} aria-current={activeLocation === item.href ? "location" : undefined} onClick={() => item.href && onNavigate(item.href)}>{item.label}</Link>}
  </li>)}</ul>;
}

export default function RoleNavigation({ links, groups = [], signedIn, name, image }: { links: MenuLink[]; groups?: NavigationEntry[]; signedIn: boolean; name?: string; image?: string | null }) {
  const [open, setOpen] = useState(false);
  const [activeLocation, setActiveLocation] = useState("");
  const pathname = usePathname();
  useEffect(() => {
    const updateActiveLocation = () => setActiveLocation(window.location.pathname + window.location.hash);
    updateActiveLocation();
    window.addEventListener("hashchange", updateActiveLocation);
    window.addEventListener("popstate", updateActiveLocation);
    return () => {
      window.removeEventListener("hashchange", updateActiveLocation);
      window.removeEventListener("popstate", updateActiveLocation);
    };
  }, [pathname]);
  const navigateTo = (href: string) => {
    setActiveLocation(href);
    setOpen(false);
  };
  return (
    <div className="header-navigation">
      <button className="mobile-menu-toggle" type="button" aria-label={open ? "Close navigation menu" : "Open navigation menu"} aria-expanded={open} aria-controls="primary-navigation" onClick={() => setOpen((value) => !value)}>
        <span></span><span></span><span></span>
      </button>
      <nav id="primary-navigation" className={`primary-navigation${open ? " is-open" : ""}${groups.length ? " has-menu-groups" : ""}`} aria-label="Main navigation">
        {links.map((link) => <Link key={`${link.href}-${link.label}`} href={link.href} className={activeLocation === link.href ? "is-active" : undefined} aria-current={activeLocation === link.href ? "location" : undefined} onClick={() => navigateTo(link.href)}>{link.label}</Link>)}
        {groups.length > 0 && <div className="nav-menu-groups"><p className="nav-menu-heading">Workspace sections</p><MenuItems items={groups} activeLocation={activeLocation} onNavigate={navigateTo}/></div>}
        {signedIn ? <div className="nav-account-actions">
          <Link href="/settings" className="nav-profile-link" aria-label="Open settings" title="Profile and settings" onClick={() => setOpen(false)}>
            <span className="nav-profile-picture">{image ? <img src={image} alt=""/> : <span aria-hidden="true">{name?.slice(0, 1).toUpperCase()}</span>}</span>
            <span className="nav-user-name">{name}</span>
          </Link>
          <Link href="/settings" className="settings-icon-link" aria-label="Settings" title="Settings" onClick={() => setOpen(false)}><SettingsIcon/></Link>
          <SignOutButton />
        </div> : <Link href="/sign-in" className="chip">Sign in</Link>}
      </nav>
    </div>
  );
}
