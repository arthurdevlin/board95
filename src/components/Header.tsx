import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import RoleNavigation from "@/components/RoleNavigation";
import type { NavigationEntry } from "@/components/DashboardSectionNavigation";
import { operatorWorkspace } from "@/lib/operator-workspace";

export default function Header() {
  return <header className="site-header"><div className="site-header-inner"><Link href="/" className="brand-link"><Image src="/b95logo.png" alt="Board95" width={160} height={40} className="site-logo" loading="eager"/></Link><Suspense fallback={<span className="user-menu-placeholder"/>}><HeaderMenu/></Suspense></div></header>;
}

async function HeaderMenu() {
  await connection();
  const session = await getSession();
  if (!session) return <RoleNavigation signedIn={false} links={[{href:"/",label:"Home"},{href:"/transport",label:"Find transport"},{href:"/car-hire",label:"Car hire"}]}/>;
  let links: {href:string;label:string}[];
  let groups: NavigationEntry[] = [];
  if (session.user.role === "ADMIN") {
    links = [{href:"/admin",label:"Admin dashboard"}];
    groups = [
      { label: "Overview", href: "/admin#overview" },
      { label: "Accounts", children: [
        { label: "Account applications", href: "/admin#account-applications" },
        { label: "User accounts", href: "/admin#user-accounts" },
      ] },
      { label: "Transport", children: [
        { label: "Bus companies", href: "/admin#bus-companies" },
        { label: "Operator applications", href: "/admin#operator-applications" },
        { label: "Pending bookings", href: "/admin#pending-bookings" },
        { label: "Recent bookings", href: "/admin#recent-bookings" },
      ] },
      { label: "Car hire", children: [
        { label: "Rental requests", href: "/admin#car-hire-requests" },
        { label: "Vehicle listings", href: "/admin#car-hire-listings" },
      ] },
      { label: "System", children: [
        { label: "Email delivery queue", href: "/admin#email-queue" },
      ] },
    ];
  } else if (session.user.role === "OWNER") {
    const operators = await prisma.operator.findMany({where:{ownerId:session.user.id},select:{id:true,name:true,kind:true,active:true,verified:true}});
    const workspace = operatorWorkspace(operators.map((operator) => operator.kind));
    links = [{href:"/operator",label: workspace.title}];
    const workspaceSections: NavigationEntry[] = [
      { label: "Overview", href: "/operator#overview" },
      ...(operators.length ? [
      { label: `${workspace.name} workspaces`, children: operators.map((operator) => ({ label: operator.name, children: [
        { label: `${operator.kind === "BUS_COMPANY" ? "Bus" : "Taxi"} summary`, href: `/operator#operator-profile-${operator.id}` },
        { label: "Trip schedule", href: `/operator#operator-trips-${operator.id}` },
        { label: operator.kind === "BUS_COMPANY" ? "Buses" : "Taxis", href: `/operator#operator-vehicles-${operator.id}` },
        ...(operator.active && operator.verified ? [{ label: "Add a departure", href: `/operator#operator-add-trip-${operator.id}` }] : []),
      ] })) },
      { label: "Bookings", children: [
        { label: "Pending requests", href: "/operator#operator-bookings" },
        { label: "Booking history", href: "/operator#operator-booking-history" },
      ] },
      ] : []),
    ];
    groups = [{ label: workspace.workspace, children: workspaceSections }];
  } else if (session.user.role === "CAR_HIRER") {
    links = [{href:"/car-hire/dashboard",label:"My vehicles"}, {href:"/car-hire/dashboard#rental-requests",label:"Rental requests"}];
    groups = [{ label: "Car hire", children: [
      { label: "Overview", href: "/car-hire/dashboard#overview" },
      { label: "Fleet", children: [
        { label: "Add a vehicle", href: "/car-hire/dashboard#add-vehicle" },
        { label: "Your listings", href: "/car-hire/dashboard#my-vehicles" },
      ] },
      { label: "Bookings", children: [
        { label: "Rental requests", href: "/car-hire/dashboard#rental-requests" },
      ] },
    ] }];
  } else if (session.user.role === "CUSTOMER") {
    const memberships = await prisma.operatorMember.findMany({ where: { userId: session.user.id, operator: { kind: "BUS_COMPANY", active: true } }, select: { operatorId: true, role: true, operator: { select: { name: true, active: true, verified: true } } } });
    if (memberships.length) {
      links = [{href:"/operator",label:"Bus dashboard"}];
      groups = [{ label: "Bus workspace", children: [
        { label: "Overview", href: "/operator#overview" },
        { label: "Companies", children: memberships.map((membership) => ({ label: membership.operator.name, children: [
          { label: "Bus summary", href: `/operator#operator-profile-${membership.operatorId}` },
          { label: "Trip schedule", href: `/operator#operator-trips-${membership.operatorId}` },
          { label: "Buses", href: `/operator#operator-vehicles-${membership.operatorId}` },
          ...(membership.role === "ADMIN" && membership.operator.active && membership.operator.verified ? [{ label: "Add a departure", href: `/operator#operator-add-trip-${membership.operatorId}` }] : []),
        ] })) },
        { label: "Bookings", children: [
          { label: "Pending requests", href: "/operator#operator-bookings" },
          { label: "Booking history", href: "/operator#operator-booking-history" },
        ] },
      ] }];
    } else {
      links = [{href:"/transport",label:"Find transport"},{href:"/car-hire",label:"Car hire"},{href:"/account#my-bookings",label:"My bookings"}];
    }
  } else {
    links = [{href:"/transport",label:"Find transport"},{href:"/car-hire",label:"Car hire"},{href:"/account#my-bookings",label:"My bookings"}];
  }
  return <RoleNavigation signedIn name={session.user.name} image={session.user.image} links={[{href:"/account",label:"Home"}, ...links]} groups={groups.length ? [{label:"Home",href:"/account"}, ...groups] : groups}/>;
}
