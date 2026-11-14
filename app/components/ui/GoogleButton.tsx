export const OAUTH_ERRORS: Record<string, string> = {
  "google-unavailable": "Google sign-in isn't set up on this site.",
  "google-cancelled": "Google sign-in was cancelled.",
  "google-failed": "We couldn't sign you in with Google. Please try again.",
  "google-unverified": "Your Google account's email address isn't verified, so it can't be used here.",
  "google-exists": "An account with that email already exists. Log in with your password, then connect Google in Settings.",
  "google-in-use": "That Google account is already connected to a different Resonant account.",
  "rate-limited": "Too many attempts. Please wait a few minutes and try again.",
};

/** Plain link (GET) to start the flow; shown only when Google is configured. */
export function GoogleButton({ next, label = "Continue with Google" }: { next?: string | null; label?: string }) {
  const href = `/auth/google${next ? `?next=${encodeURIComponent(next)}` : ""}`;
  return (
    <a href={href} className="btn btn-ghost w-full gap-3">
      <span aria-hidden="true" className="grid size-5 place-items-center rounded-full bg-white text-[0.72rem] font-bold text-[#4285f4]">G</span>
      {label}
    </a>
  );
}

export function OrDivider() {
  return (
    <div className="flex items-center gap-3 text-xs text-faint" aria-hidden="true">
      <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
    </div>
  );
}

/** Shown where email-and-password features would be when the deployment has them switched off. */
export function PasswordsInDevelopment({ google, children }: { google: boolean; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line px-4 py-3" role="note">
      <p className="flex flex-wrap items-center gap-2 text-sm">
        Email and password
        <span className="rounded-full border border-line px-2 py-0.5 text-[0.7rem] text-faint">In development</span>
      </p>
      <p className="mt-1 text-sm text-dim">
        {children ??
          (google
            ? "Email-and-password accounts aren't available on this site yet. Continue with Google for now."
            : "Email-and-password accounts aren't available on this site yet, and no other sign-in method is configured.")}
      </p>
    </div>
  );
}
