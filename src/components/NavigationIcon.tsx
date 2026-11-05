import { BusFront, CalendarDays, CarFront, CircleUserRound, ClipboardList, History, House, LayoutDashboard, MapPin, Plus, Search, Settings, ShieldCheck, Ticket, Users } from "lucide-react";

export default function NavigationIcon({ href = "", label }: { href?: string; label: string }) {
  const name = label.toLowerCase();
  const Icon = /add|post|create/.test(name) ? Plus
    : /schedule|timetable/.test(name) ? CalendarDays
    : /old|history|archive/.test(name) ? History
    : /booking|ticket/.test(name) ? Ticket
    : /application|request/.test(name) ? ClipboardList
    : /staff|users|accounts|members/.test(name) ? Users
    : /bus|fleet/.test(name) ? BusFront
    : /car|vehicle/.test(name) ? CarFront
    : /station|stage|departure/.test(name) ? MapPin
    : /settings/.test(name) ? Settings
    : /profile|account/.test(name) ? CircleUserRound
    : /admin/.test(name) ? ShieldCheck
    : /transport|search/.test(name) ? Search
    : href === "/" || name === "home" ? House : LayoutDashboard;
  return <Icon className="navigation-icon" size={17} strokeWidth={1.8} aria-hidden="true"/>;
}
