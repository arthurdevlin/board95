
import AuthForm from "@/components/AuthForm";

export const metadata = { title: "Sign in | Board95" };

// Reads searchParams (where to send the user after sign-in), so it can't
// be prerendered as static HTML.
export const instant = false;

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; passwordReset?: string }>;
}) {
  const { next, passwordReset } = await searchParams;
  return <AuthForm mode="sign-in" next={next || "/account"} passwordReset={passwordReset === "1"} googleEnabled={Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)} />;
}
