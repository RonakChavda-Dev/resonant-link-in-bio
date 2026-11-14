import { useEffect, useId, useRef, type InputHTMLAttributes, type ReactNode } from "react";
import { useRootData } from "~/root";

/** Hidden synchronizer token for authenticated forms. */
export function CsrfInput() {
  const root = useRootData();
  return <input type="hidden" name="_csrf" value={root?.csrf ?? ""} />;
}

export function useCsrfToken(): string {
  return useRootData()?.csrf ?? "";
}

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: string;
  error?: string;
  hint?: ReactNode;
}

export function Field({ label, name, error, hint, id, ...rest }: FieldProps) {
  const autoId = useId();
  const inputId = id ?? `${name}-${autoId}`;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  return (
    <div className="field">
      <label htmlFor={inputId} className="field-label">
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        className="input"
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        {...rest}
      />
      {hint ? (
        <p id={hintId} className="field-hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function FormError({ message }: { message?: string | null }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (message) ref.current?.focus();
  }, [message]);
  if (!message) return null;
  return (
    <div ref={ref} tabIndex={-1} role="alert" className="alert alert-error">
      {message}
    </div>
  );
}

declare global {
  interface Window {
    turnstile?: {
      render(el: HTMLElement, opts: { sitekey: string; theme?: string; action?: string }): string;
      remove(id: string): void;
    };
  }
}

/**
 * Cloudflare Turnstile widget, rendered only when the deployment has a site key.
 * The script is injected at runtime (allowed by the CSP's 'strict-dynamic').
 */
export function Turnstile({ siteKey, action }: { siteKey: string | null; action: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!siteKey || !ref.current) return;
    let widgetId: string | null = null;
    let cancelled = false;
    const mount = () => {
      if (cancelled || !ref.current || !window.turnstile) return;
      widgetId = window.turnstile.render(ref.current, { sitekey: siteKey, theme: "dark", action });
    };
    if (window.turnstile) mount();
    else {
      let script = document.querySelector<HTMLScriptElement>("script[data-turnstile]");
      if (!script) {
        script = document.createElement("script");
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.dataset.turnstile = "1";
        document.head.appendChild(script);
      }
      script.addEventListener("load", mount, { once: true });
    }
    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [siteKey, action]);
  if (!siteKey) return null;
  return (
    <div className="min-h-[65px]">
      <div ref={ref} />
      <noscript>
        <p className="field-hint">This form needs JavaScript for the bot check.</p>
      </noscript>
    </div>
  );
}
