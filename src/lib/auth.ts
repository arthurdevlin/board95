import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/prisma";

// Central Better Auth configuration. Both the API route and any server
// code that needs auth.api.* import this same instance.
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  baseURL: process.env.BETTER_AUTH_URL,

  emailAndPassword: {
    enabled: true,
    // Accounts can sign in immediately; booking and application notifications
    // use the optional Resend integration without blocking account creation.
    requireEmailVerification: false,
    minPasswordLength: 8,
    sendResetPassword: async ({ user, url }) => {
      const { sendBoard95Email } = await import("@/lib/email");
      await sendBoard95Email({ to: user.email, subject: "Reset your Board95 password", lines: ["We received a request to reset your password. If you did not make this request, you can ignore this email."], action: { label: "Reset password", href: url } });
    },
  },

  ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? {
        socialProviders: {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            prompt: "select_account" as const,
          },
        },
      }
    : {}),

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
