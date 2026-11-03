import Link from "next/link";
import { RequestPasswordResetForm } from "@/components/PasswordRecoveryForm";
export const metadata={title:"Forgot password | Board95"};
export default function ForgotPasswordPage(){return <section className="dashboard-page"><div className="dashboard-intro"><p className="dashboard-eyebrow">ACCOUNT RECOVERY</p><h1 className="page-title page-title--plain">Forgot your password?</h1><p>We&apos;ll send a secure reset link to your email address.</p></div><div className="panel dashboard-panel"><RequestPasswordResetForm/></div><Link className="btn btn-secondary" href="/sign-in">Back to sign in</Link></section>;}
