import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { signOutAction } from "@/lib/actions";

export const metadata = { title: "My account | Board95" };

// This page reads the signed-in user's session on every visit, so it can
// never be prerendered as static HTML. "instant = false" tells Next.js
// that's expected, instead of treating it as a mistake to flag at build time.
export const instant = false;

// proxy.ts already redirects anyone with no session cookie away from here.
// This second check reads the real session from the database, which is the
// one to trust: a stale or forged cookie fails here even if it fooled proxy.ts.
export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in?next=/account");

  return (
    <section>
      <h1 className="page-title page-title--plain">My account</h1>

      <div className="panel">
        <h2>Your details</h2>
        <dl className="kv">
          <div>
            <dt>Name</dt>
            <dd>{session.user.name}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{session.user.email}</dd>
          </div>
        </dl>
      </div>

      <div className="panel">
        <h2>Bookings</h2>
        <p className="field-hint">
          Booking requests and history arrive later in Milestone 3B.
        </p>
      </div>

      <form action={signOutAction} className="trip-cta">
        <button type="submit" className="btn btn-secondary">
          Sign out
        </button>
      </form>
    </section>
  );
}
