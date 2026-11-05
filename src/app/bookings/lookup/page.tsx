
import { ArrowLeft } from "lucide-react";
import PageIntro from "@/components/PageIntro";
import Link from "next/link";
import GuestBookingLookupForm from "@/components/GuestBookingLookupForm";

export const metadata = { title: "Find a guest booking | Board95" };

export default function GuestBookingLookupPage() {
  return <section className="dashboard-page">
    <PageIntro className="dashboard-intro"><p className="dashboard-eyebrow">GUEST BOOKING</p>
    <h1 className="page-title page-title--plain">Find your booking</h1>
    <p>Enter the reference and Malawi mobile number used when you booked. We limit lookup attempts to protect passenger details.</p>
    </PageIntro>
    <div className="panel dashboard-panel"><GuestBookingLookupForm /></div>
    <Link className="btn btn-secondary chat-back" href="/"><ArrowLeft size={16} aria-hidden="true"/>Back to Board95</Link>
  </section>;
}
