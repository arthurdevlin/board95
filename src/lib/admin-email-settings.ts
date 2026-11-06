import { prisma } from "@/lib/prisma";

export async function getAdminEmailSettings() {
  const settings = await prisma.board95EmailSettings.findUnique({ where: { id: "board95" } });
  return {
    primaryEmail: settings?.primaryEmail ?? process.env.BOARD95_ADMIN_EMAIL?.trim().toLowerCase() ?? "",
    secondaryEmail: settings?.secondaryEmail ?? "",
  };
}

export async function getBoard95AdminEmails() {
  const { primaryEmail, secondaryEmail } = await getAdminEmailSettings();
  return [...new Set([primaryEmail, secondaryEmail].map(email => email.trim().toLowerCase()).filter(Boolean))];
}
