import { GuestRentalLookup } from "@/components/RentalForms";

import { ArrowLeft } from "lucide-react";
import PageIntro from "@/components/PageIntro";
import Link from "next/link";
import GuestBookingLookupForm from "@/components/GuestBookingLookupForm";

export const metadata = { title: "Find a guest booking | Board95" };

export default function GuestBookingLookupPage() {
  return <section className="dashboard-page">
    <PageIntro className="dashboard-intro"><p className="dashboard-eyebrow">GUEST BOOKING</p>
    <h1 className="page-title page-title--plain">Find your booking or rental</h1>
    <p>Enter the reference and Malawi mobile number used when you booked. We limit lookup attempts to protect passenger details.</p>
    </PageIntro>
    <div className="panel dashboard-panel"><h2>Bus, taxi or lift booking</h2><GuestBookingLookupForm /></div><div className="panel dashboard-panel"><h2>Car-hire rental</h2><GuestRentalLookup/></div>
    <Link className="btn btn-secondary chat-back" href="/"><ArrowLeft size={16} aria-hidden="true"/>Back to Board95</Link>
  </section>;
}
