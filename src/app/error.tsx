"use client";

// Shown when something throws while rendering a page, for example when the
// database can't be reached. Error boundaries must be Client Components.
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-xl border border-danger/40 p-6 text-center">
      <h1 className="text-xl font-bold text-danger">Something went wrong</h1>
      <p className="mt-2 text-muted">
        We couldn&apos;t load this page. Please try again.
      </p>
      <button
        onClick={reset}
        className="mt-4 rounded-lg bg-primary px-4 py-2 font-semibold text-white"
      >
        Try again
      </button>
    </div>
  );
}
