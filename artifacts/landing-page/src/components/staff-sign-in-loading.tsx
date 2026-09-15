import { useEffect, useState } from "react";
import { basePath } from "@/lib/clerk";

/** Clerk may still be downloading its UI after the application has mounted. */
export function StaffSignInLoading() {
  const [delayed, setDelayed] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDelayed(true), 12000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <section
      className="w-full max-w-[440px] rounded-2xl border border-border bg-background p-6 text-center text-foreground shadow-lg"
      aria-label="Staff sign-in loading"
    >
      <h1 className="font-serif text-2xl">Staff sign in</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Access the LAWYes command center
      </p>
      <p role="status" aria-live="polite" className="mt-6 text-sm">
        {delayed
          ? "Secure sign-in is taking longer than expected. Check your connection and try again."
          : "Loading secure staff sign-in…"}
      </p>
      {delayed && (
        <button
          type="button"
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-primary-foreground"
          onClick={() => window.location.reload()}
        >
          Retry sign-in
        </button>
      )}
      <a
        className="mt-6 block text-sm underline"
        href={`${basePath}/sign-in`}
      >
        Looking for practitioner sign-in?
      </a>
    </section>
  );
}