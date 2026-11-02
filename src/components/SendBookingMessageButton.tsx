"use client";

import { useFormStatus } from "react-dom";

export default function SendBookingMessageButton() {
  const { pending } = useFormStatus();
  return <button className="btn btn-primary" type="submit" disabled={pending}>
    {pending ? "Sending…" : "Send"}
  </button>;
}
