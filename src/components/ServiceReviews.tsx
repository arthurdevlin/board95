import { prisma } from "@/lib/prisma";
import { Star } from "lucide-react";
import { cache } from "react";

const readReviews = cache(async (kind: "operatorId" | "vehicleId" | "carListingId" | "providerUserId", id: string) => {
  const where = { [kind]: id };
  return Promise.all([prisma.serviceReview.aggregate({ where, _avg: { score: true }, _count: { score: true } }), prisma.serviceReview.findMany({ where, orderBy: { createdAt: "desc" }, take: 3, select: { id: true, score: true, note: true } })]);
});
export default async function ServiceReviews({ kind, id, label }: { kind: "operatorId" | "vehicleId" | "carListingId" | "providerUserId"; id: string; label: string }) {
  const [summary, reviews] = await readReviews(kind, id);
  return <details className="service-reviews"><summary><Star size={14} aria-hidden="true"/>{label}: {summary._count.score ? `${summary._avg.score!.toFixed(1)} / 5 · ${summary._count.score} verified reviews` : "No reviews yet"}</summary>{reviews.map(review => <p key={review.id}><strong>{review.score}/5 · Verified passenger</strong>{review.note && <span>{review.note}</span>}</p>)}</details>;
}
