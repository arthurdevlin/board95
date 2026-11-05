"use client";
import { Send } from "lucide-react";


import { useFormStatus } from "react-dom";

export default function SendBookingMessageButton() {
  const { pending } = useFormStatus();
  return <button className="btn btn-primary" type="submit" disabled={pending}><Send size={16} aria-hidden="true"/>
    {pending ? "Sending…" : "Send"}
  </button>;
}
