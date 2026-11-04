import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Call this from Server Components / Server Actions that need to know who
// is signed in. Returns null when no one is.
export const getSession = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      active: true, role: true, name: true, email: true, phone: true, image: true,
      operatorMemberships: { where: { operator: { kind: "BUS_COMPANY" } }, select: { id: true }, take: 1 },
    },
  });
  // Resolve permissions from the current database row, including after a role change.
  return user?.active ? { ...session, user: { ...session.user, ...user, isBusMember: user.operatorMemberships.length > 0 } } : null;
});
