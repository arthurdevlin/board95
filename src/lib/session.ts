import { headers } from "next/headers";
import { auth } from "@/lib/auth";

// Call this from Server Components / Server Actions that need to know who
// is signed in. Returns null when no one is.
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}
