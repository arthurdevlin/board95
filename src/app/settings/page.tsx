import Image from "next/image";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { saveProfileSettingsAction } from "@/lib/actions";
import PasswordSettings from "@/components/PasswordSettings";
import ThemeToggle from "@/components/ThemeToggle";

export const metadata = { title: "Settings | Board95" };
export const instant = false;
export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/sign-in?next=/settings");
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true, email: true, phone: true, image: true } });
  if (!user) redirect("/sign-in");
  const { saved } = await searchParams;
  return <section className="dashboard-page"><div className="dashboard-intro"><p className="dashboard-eyebrow">ACCOUNT PREFERENCES</p><h1 className="page-title page-title--plain">Settings</h1><p>Manage your profile, appearance and sign-in security.</p></div>
    {saved === "1" && <p className="alert" role="status">Your profile settings have been saved.</p>}
    <div className="panel dashboard-panel"><h2>Profile details</h2><p className="dashboard-help">Update how your name and profile photo appear on Board95.</p><form action={saveProfileSettingsAction} className="dashboard-form settings-profile-form"><div className="profile-photo-preview">{user.image ? <Image src={user.image} width={88} height={88} unoptimized alt="Your profile"/> : <span>{user.name.slice(0,1).toUpperCase()}</span>}</div><label className="field"><span>Profile picture (JPEG, PNG or WebP, up to 400 KB)</span><input name="photo" type="file" accept="image/jpeg,image/png,image/webp"/></label><label className="field"><span>Full name</span><input name="name" defaultValue={user.name} required minLength={2} maxLength={100} autoComplete="name"/></label><label className="field"><span>Email</span><input value={user.email} readOnly disabled/><small>Contact support to change the email on your account.</small></label><label className="field"><span>Mobile number</span><input name="phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={user.phone ?? ""} placeholder="0991 234 567" pattern="(?:[+]265[ ]?(?:8|9|2)[0-9]{2}[ ]?[0-9]{3}[ ]?[0-9]{3}|0(?:8|9|2)[0-9]{2}[ ]?[0-9]{3}[ ]?[0-9]{3})"/></label><button className="btn btn-primary" type="submit">Save profile</button></form></div>
    <div className="panel dashboard-panel"><h2>Appearance</h2><p className="dashboard-help">Choose a theme for this browser. Your choice is saved on this device.</p><ThemeToggle/></div>
    <PasswordSettings email={user.email}/>
  </section>;
}
