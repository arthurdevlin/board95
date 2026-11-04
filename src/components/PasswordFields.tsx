"use client";

import { useId, useRef, useState } from "react";

export default function PasswordFields({ label = "New password", required = true, disabled = false }: { label?: string; required?: boolean; disabled?: boolean }) {
  const id = useId();
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const [mismatch, setMismatch] = useState(false);

  function validate() {
    const password = passwordRef.current?.value ?? "";
    const confirmPassword = confirmRef.current?.value ?? "";
    const invalid = password !== confirmPassword;
    confirmRef.current?.setCustomValidity(invalid ? "The passwords do not match." : "");
    setMismatch(Boolean(confirmPassword) && invalid);
  }

  return <>
    <label className="field"><span>{label}</span><input ref={passwordRef} name="password" type="password" autoComplete="new-password" required={required} minLength={8} maxLength={128} disabled={disabled} onInput={validate} onChange={validate}/></label>
    <label className="field"><span>Re-enter password{!required && <em> (required when setting a password)</em>}</span><input ref={confirmRef} name="confirmPassword" type="password" autoComplete="new-password" required={required} minLength={8} maxLength={128} disabled={disabled} onInput={validate} onChange={validate} aria-invalid={mismatch} aria-describedby={mismatch ? id : undefined}/><span id={id} className="password-validation" aria-live="polite">{mismatch ? "The passwords do not match." : ""}</span></label>
  </>;
}
