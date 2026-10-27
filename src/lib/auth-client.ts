"use client";

import { createAuthClient } from "better-auth/react";

// Used from Client Components (the sign-in/sign-up forms, the header's
// sign-out button). Server Components use auth.api.* from "@/lib/auth"
// instead, never this file.
export const authClient = createAuthClient();
