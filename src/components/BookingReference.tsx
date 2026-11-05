export function ReferenceScreenshotNotice() {
  return <p className="reference-screenshot-note"><strong>Take a screenshot of this reference now.</strong> Keep it with the mobile number you used to book.</p>;
}

export default function BookingReference({ reference }: { reference: string }) {
  return <div className="booking-reference-receipt"><p className="booking-reference">Reference: <strong>{reference}</strong></p><ReferenceScreenshotNotice/></div>;
}
