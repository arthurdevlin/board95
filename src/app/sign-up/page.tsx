import AuthForm from "@/components/AuthForm";

export const metadata = { title: "Create account | Board95" };

export default function SignUpPage() {
  return <AuthForm mode="sign-up" googleEnabled={Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)} />;
}
