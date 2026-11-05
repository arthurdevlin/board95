"use client";
import { RefreshCw } from "lucide-react";


// Shown when something throws while rendering a page, for example when the
// database can't be reached. Error boundaries must be Client Components.
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="error-panel">
      <h1 className="text-xl font-bold text-danger">Something went wrong</h1>
      <p className="mt-2 text-muted">
        We couldn&apos;t load this page. Please try again.
      </p>
      <button
        onClick={reset}
        className="btn btn-primary mt-4"
      ><RefreshCw size={16} aria-hidden="true"/>
        Try again
      </button>
    </div>
  );
}
