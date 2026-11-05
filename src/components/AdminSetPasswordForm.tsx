"use client";
import { KeyRound } from "lucide-react";


import { useActionState } from "react";
import { setUserPasswordAction, type SetPasswordState } from "@/lib/actions";
import PasswordFields from "@/components/PasswordFields";

const initialState: SetPasswordState = { status: "idle", message: "" };

export default function AdminSetPasswordForm({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState(setUserPasswordAction, initialState);
  return <form action={action} className="admin-password-form" aria-busy={pending}>
    <input type="hidden" name="userId" value={userId}/>
    <PasswordFields disabled={pending}/>
    <button className="btn btn-secondary" type="submit" disabled={pending}><KeyRound size={16} aria-hidden="true"/>{pending ? "Assigning password…" : "Assign password"}</button>
    {state.message && <p className={`alert ${state.status === "error" ? "alert-error" : "alert-info"}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</p>}
  </form>;
}
