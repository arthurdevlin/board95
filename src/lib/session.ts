import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Call this from Server Components / Server Actions that need to know who
// is signed in. Returns null when no one is.
export async function getSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { active: true } });
  return user?.active ? session : null;
}
