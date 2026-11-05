
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import PageIntro from "@/components/PageIntro";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { deleteOperatorProfileAction, updateOperatorProfileAction } from "@/lib/actions";

export const metadata = { title: "Manage operator profile | Board95" };
export const instant = false;

export default async function OperatorProfilePage({ params }: { params: Promise<{ operatorId: string }> }) {
  const { operatorId } = await params;
  const session = await getSession();
  if (!session) redirect("/sign-in?next=/operator");
  if (!["OWNER", "ADMIN"].includes(session.user.role)) redirect("/account");
  const operator = await prisma.operator.findFirst({ where: { id: operatorId, ...(session.user.role === "ADMIN" ? {} : { ownerId: session.user.id }) }, include: { _count: { select: { vehicles: true, trips: true } } } });
  if (!operator) notFound();
  const canDelete = operator._count.vehicles === 0 && operator._count.trips === 0;
  return <section className="dashboard-page">
    <PageIntro className="dashboard-intro"><p className="dashboard-eyebrow">OPERATOR PROFILE</p><h1 className="page-title page-title--plain">Manage {operator.name}</h1><p>{operator.kind.replace("_", " ")} · {operator.verified ? "Approved" : "Pending admin approval"}</p></PageIntro>
    <div className="panel dashboard-panel"><h2>Profile details</h2><form action={updateOperatorProfileAction} className="dashboard-form"><input type="hidden" name="operatorId" value={operator.id}/><label className="field"><span>Company / operator name</span><input name="name" defaultValue={operator.name} required minLength={2} maxLength={100}/></label><label className="field"><span>Contact mobile</span><input name="phone" defaultValue={operator.phone ?? ""} required type="tel" placeholder="0991 234 567" pattern="(?:[+]265[ ]?9[0-9]{2}[ ]?[0-9]{3}[ ]?[0-9]{3}|09[0-9]{2}[ ]?[0-9]{3}[ ]?[0-9]{3})"/></label><button className="btn btn-primary" type="submit"><Save size={16} aria-hidden="true"/>Save profile</button></form></div>
    <div className="panel dashboard-panel"><h2>Remove this profile</h2>{canDelete ? <><p className="dashboard-help">This profile has no vehicles or trips and can be safely deleted.</p><form action={deleteOperatorProfileAction}><input type="hidden" name="operatorId" value={operator.id}/><button className="btn btn-danger" type="submit"><Trash2 size={16} aria-hidden="true"/>Delete operator profile</button></form></> : <p className="dashboard-help">This profile has vehicle or trip history. It can’t be deleted without breaking records; ask an admin to block it instead.</p>}</div>
    <Link className="btn btn-secondary" href="/operator"><ArrowLeft size={16} aria-hidden="true"/>Back to operator dashboard</Link>
  </section>;
}
