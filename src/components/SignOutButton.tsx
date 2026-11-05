"use client";
import { LogOut } from "lucide-react";


import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function SignOutButton() {
  const router = useRouter();

  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function handleSignOut() {
    setPending(true);
    setError(false);

    try {
      const { error: signOutError } = await authClient.signOut();
      if (signOutError) {
        setError(true);
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="sign-out-control">
      <button
        type="button"
        className="link-button"
        onClick={handleSignOut}
        disabled={pending}
      >
        <LogOut size={16} aria-hidden="true"/>{pending ? "Signing out…" : "Sign out"}
      </button>
      {error && (
        <span className="sign-out-error" role="alert">
          Couldn’t sign out. Try again.
        </span>
      )}
    </span>
  );
}
