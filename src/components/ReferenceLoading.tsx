"use client";

import { useEffect, useId, useRef } from "react";

export default function ReferenceLoading({ pending }: { pending: boolean }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    if (pending && dialog && !dialog.open) dialog.showModal();
    if (!pending) dialog?.close();
    return () => { dialog?.close(); };
  }, [pending]);

  return <dialog ref={dialogRef} className="reference-loading-dialog" aria-labelledby={titleId} onCancel={(event) => event.preventDefault()}>
    <div role="status" aria-live="polite">
      <span className="route-loading-spinner" aria-hidden="true"/>
      <h2 id={titleId}>Generating reference…</h2>
      <p>Please wait while we save your request. Your reference will appear when it is ready.</p>
    </div>
  </dialog>;
}
