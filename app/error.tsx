"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        gap: "1rem",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "2.5rem" }}>Something went wrong</div>
      <p style={{ color: "var(--muted-foreground)", maxWidth: "28rem" }}>
        An unexpected error occurred. This has been logged automatically.
      </p>
      <button
        onClick={reset}
        className="btn-pill"
        style={{ marginTop: "0.5rem" }}
      >
        Try again
      </button>
    </div>
  );
}
