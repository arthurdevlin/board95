"use client";
import { Trash2 } from "lucide-react";


import { useState } from "react";

export default function AdminDeleteUserButton({ userId, name, action }: { userId: string; name: string; action: (formData: FormData) => void | Promise<void> }) {
  const [pending, setPending] = useState(false);
  return (
    <form action={action} onSubmit={(event) => {
      if (!window.confirm(`Permanently delete the account for ${name}? This cannot be undone.`)) { event.preventDefault(); return; }
      setPending(true);
    }}>
      <input type="hidden" name="userId" value={userId} />
      <button className="btn btn-danger" type="submit" disabled={pending}><Trash2 size={16} aria-hidden="true"/>{pending ? "Deleting..." : "Delete"}</button>
    </form>
  );
}
