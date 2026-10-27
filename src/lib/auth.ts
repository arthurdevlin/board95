import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/prisma";

// Central Better Auth configuration. Both the API route and any server
// code that needs auth.api.* import this same instance.
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
    // We don't have an email provider wired up yet (Milestone 3B keeps it
    // simple), so accounts are usable immediately after signing up.
    requireEmailVerification: false,
    minPasswordLength: 8,
  },

  // role and phone live on our own User table; this tells Better Auth to
  // read and write them instead of ignoring them.
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "CUSTOMER",
        input: false, // a user can never set their own role on sign-up
      },
      phone: {
        type: "string",
        required: false,
      },
    },
  },

  // Keeps a server action's cookie changes in Next.js's own response.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
