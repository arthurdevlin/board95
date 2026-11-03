import { ResetPasswordForm } from "@/components/PasswordRecoveryForm";
export const metadata={title:"Reset password | Board95",referrer:"no-referrer" as const,robots:{index:false,follow:false}};
export default function ResetPasswordPage(){return <section className="dashboard-page"><div className="dashboard-intro"><p className="dashboard-eyebrow">ACCOUNT RECOVERY</p><h1 className="page-title page-title--plain">Set a new password</h1></div><div className="panel dashboard-panel"><ResetPasswordForm/></div></section>;}
