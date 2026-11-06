"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function saveAdminEmailSettings(_state: { error?: string; saved?: boolean }, form: FormData): Promise<{ error?: string; saved?: boolean }> {
  const session = await getSession();
  if (!session?.user?.id || session.user.role !== "ADMIN") return { error: "Administrator access required." };
  const primaryEmail = String(form.get("primaryEmail") ?? "").trim().toLowerCase();
  const secondaryEmail = String(form.get("secondaryEmail") ?? "").trim().toLowerCase();
  const valid = (email: string) => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!valid(primaryEmail)) return { error: "Enter a valid primary email address." };
  if (secondaryEmail && !valid(secondaryEmail)) return { error: "Enter a valid second email address or leave it blank." };
  if (primaryEmail === secondaryEmail) return { error: "Use a different address for the second inbox." };
  const data = { primaryEmail, secondaryEmail: secondaryEmail || null };
  await prisma.board95EmailSettings.upsert({ where: { id: "board95" }, create: { id: "board95", ...data }, update: data });
  revalidatePath("/admin");
  return { saved: true };
}
