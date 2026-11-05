import AuthForm from "@/components/AuthForm";

export const metadata = { title: "Create account | Board95" };

export const instant = false;

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ accountType?: string | string[] }> }) {
  const { accountType } = await searchParams;
  const initialAccountType = accountType === "CAR_HIRER" ? "CAR_HIRER" : accountType === "TAXI_OWNER" ? "TAXI_OWNER" : "CUSTOMER";
  return <AuthForm key={initialAccountType} mode="sign-up" initialAccountType={initialAccountType} providerSignup={initialAccountType === "CAR_HIRER"} googleEnabled={Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)} />;
}
