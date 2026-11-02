"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { applyForAccountTypeFromSignup } from "@/lib/actions";

type Mode = "sign-in" | "sign-up";
type SignupAccountType = "CUSTOMER" | "TAXI_OWNER" | "CAR_HIRER";

function getSafeRedirectPath(path: string) {
  try {
    const destination = new URL(path, window.location.origin);
    return destination.origin === window.location.origin
      ? `${destination.pathname}${destination.search}${destination.hash}`
      : "/account";
  } catch {
    return "/account";
  }
}

export default function AuthForm({
  mode,
  next = "/account",
  googleEnabled = false,
}: {
  mode: Mode;
  next?: string;
  googleEnabled?: boolean;
}) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [accountType, setAccountType] = useState<SignupAccountType>("CUSTOMER");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = formData.get("email")?.toString().trim() ?? "";
    const password = formData.get("password")?.toString() ?? "";
    const name = formData.get("name")?.toString().trim() ?? "";
    const businessName = formData.get("businessName")?.toString().trim() ?? name;
    const phone = formData.get("phone")?.toString().trim() ?? "";

    try {
      const { error: authError } = mode === "sign-up"
        ? await authClient.signUp.email({ name, email, password, ...(accountType !== "CUSTOMER" ? { phone } : {}) })
        : await authClient.signIn.email({ email, password });

      if (authError) {
        setError(authError.message ?? "Something went wrong. Please try again.");
        return;
      }

      form.reset();
      if (mode === "sign-up" && accountType !== "CUSTOMER") {
        try {
          const application = await applyForAccountTypeFromSignup(accountType, businessName, phone);
          if (application.error) {
            router.push("/account?application=retry");
          } else {
            router.push(accountType === "TAXI_OWNER" ? "/operator" : "/car-hire/dashboard");
          }
        } catch {
          // Account creation already succeeded; direct the user to the account page to retry the application.
          router.push("/account?application=retry");
        }
      } else {
        router.push(getSafeRedirectPath(next));
      }
      router.refresh();
    } catch {
      setError("We couldn’t connect. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  async function handleGoogleSignIn() {
    setError(null);
    setPending(true);
    try {
      const { error: authError } = await authClient.signIn.social({
        provider: "google",
        callbackURL: getSafeRedirectPath(next),
      });
      if (authError) setError(authError.message ?? "Google sign-in could not be started.");
    } catch {
      setError("Google sign-in could not be started. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-heading">
        <p className="auth-eyebrow">BOARD95 ACCOUNT</p>
        <h1>{mode === "sign-up" ? "Create your account" : "Welcome back"}</h1>
        <p>{mode === "sign-up" ? "Choose how you’ll use Board95." : "Sign in to continue to Board95."}</p>
      </div>

      <form onSubmit={handleSubmit} className="form-card" aria-busy={pending}>
        <div className="form-stack">
          {error && <p className="alert alert-error" role="alert" aria-live="polite">{error}</p>}

          {mode === "sign-up" && <>
            <div className="field">
              <label htmlFor="name">Full name</label>
              <input id="name" name="name" type="text" autoComplete="name" required disabled={pending} />
            </div>
            <div className="field">
              <label htmlFor="accountType">Create account as</label>
              <select id="accountType" name="accountType" value={accountType} onChange={(event) => setAccountType(event.target.value as SignupAccountType)} disabled={pending}>
                <option value="CUSTOMER">Passenger</option>
                <option value="TAXI_OWNER">Taxi driver</option>
                <option value="CAR_HIRER">Car hire provider</option>
              </select>
              <p className="field-hint">Passengers can book and track requests. Driver and car-hire accounts submit details for approval before managing listings.</p>
            </div>
            {accountType !== "CUSTOMER" && <>
              <div className="field">
                <label htmlFor="businessName">{accountType === "TAXI_OWNER" ? "Driver / taxi name" : "Car-hire business name"}</label>
                <input id="businessName" name="businessName" type="text" autoComplete="organization" required minLength={2} maxLength={100} disabled={pending} />
              </div>
              <div className="field">
                <label htmlFor="phone">Malawi mobile number</label>
                <input id="phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="0991 234 567" required pattern="(?:[+]265[ ]?(?:8|9|2)[0-9]{2}[ ]?[0-9]{3}[ ]?[0-9]{3}|0(?:8|9|2)[0-9]{2}[ ]?[0-9]{3}[ ]?[0-9]{3})" disabled={pending} />
              </div>
            </>}
          </>}

          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required disabled={pending} />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <div className="field-row">
              <input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete={mode === "sign-up" ? "new-password" : "current-password"} required minLength={8} disabled={pending} />
              <button type="button" className="field-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} disabled={pending}>
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {mode === "sign-up" && <p className="field-hint">At least 8 characters.</p>}
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
            {pending ? mode === "sign-up" ? "Creating account…" : "Signing in…" : mode === "sign-up" ? "Create account" : "Sign in"}
          </button>
          {mode === "sign-in" && <p className="field-hint"><Link href="/forgot-password">Forgot password?</Link></p>}
          {googleEnabled && (mode === "sign-in" || accountType === "CUSTOMER") && <>
            <div className="auth-divider"><span>or continue with</span></div>
            <button type="button" className="btn btn-secondary btn-block google-signin" onClick={handleGoogleSignIn} disabled={pending}>
              <span aria-hidden="true" className="google-mark">G</span>Continue with Google
            </button>
          </>}
        </div>
      </form>

      <p className="form-footer">
        {mode === "sign-up" ? <>Already have an account? <Link href="/sign-in">Sign in</Link></> : <>New to Board95? <Link href="/sign-up">Create an account</Link></>}
      </p>
    </div>
  );
}
