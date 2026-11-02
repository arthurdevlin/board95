"use client";

import { useRef, type ReactNode } from "react";

export default function HomeTripSearchDialog({ children }: { children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button className="btn btn-primary home-search-trigger" type="button" onClick={() => dialogRef.current?.showModal()}>
        Search trips
      </button>
      <dialog ref={dialogRef} className="home-search-dialog" aria-labelledby="home-search-title">
        <div className="home-search-dialog-card">
          <div className="home-search-dialog-heading">
            <div>
              <p className="dashboard-eyebrow">PLAN YOUR JOURNEY</p>
              <h2 id="home-search-title">Find a trip</h2>
            </div>
            <button className="booking-dialog-close" type="button" aria-label="Close search" onClick={() => dialogRef.current?.close()}>
              ×
            </button>
          </div>
          {children}
        </div>
      </dialog>
    </>
  );
}
