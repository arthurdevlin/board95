
import { ArrowLeft } from "lucide-react";
import PageIntro from "@/components/PageIntro";

import { transportLocationName } from "@/lib/cities";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import BusScheduleForm from "@/components/BusScheduleForm";

export const metadata = { title: "Manage bus timetable | Board95" };
export const instant = false;

export default async function BusSchedulePage({ params }: { params: Promise<{ scheduleId: string }> }) {
  const session = await getSession();
  if (!session) redirect("/sign-in?next=/operator");
  if (!["ADMIN", "OWNER", "CUSTOMER"].includes(session.user.role)) redirect("/account");
  const { scheduleId } = await params;
  const schedule = await prisma.busSchedule.findFirst({ where: {
    id: scheduleId,
    operator: { kind: "BUS_COMPANY", ...(session.user.role === "ADMIN" ? {} : session.user.role === "OWNER" ? { ownerId: session.user.id } : { members: { some: { userId: session.user.id, role: "ADMIN" } } }) },
  }, include: { operator: { select: { name: true, active: true, verified: true } }, vehicle: true, departurePoint: true } });
  if (!schedule) notFound();
  const vehicles = await prisma.vehicle.findMany({ where: { operatorId: schedule.operatorId, OR: [{ active: true }, { id: schedule.vehicleId }] }, orderBy: [{ model: "asc" }, { plate: "asc" }] });
  return <section className="dashboard-page">
    <PageIntro className="dashboard-intro"><p className="dashboard-eyebrow">BUS TIMETABLE</p><h1 className="page-title page-title--plain">{transportLocationName(schedule.origin)} to {transportLocationName(schedule.destination)}</h1><p>{schedule.operator.name} · {schedule.vehicle.model} · {schedule.vehicle.plate}</p></PageIntro>
    <div className="panel dashboard-panel"><h2>Daily Bus Schedule details</h2><p className="dashboard-help">Save this service once. Departures appear automatically on its operating days. Booked departures keep their agreed details; day-specific changes are preserved. Updates apply to other unbooked future departures. Uncheck “Service is running” to pause regular departures.</p>
      {schedule.operator.active && schedule.operator.verified ? <BusScheduleForm operatorId={schedule.operatorId} schedule={schedule} vehicles={vehicles}/> : <p className="alert alert-info">This company must be active and approved before its timetable can be changed.</p>}
    </div>
    <Link href="/operator" className="btn btn-secondary"><ArrowLeft size={16} aria-hidden="true"/>Back to bus dashboard</Link>
  </section>;
}
