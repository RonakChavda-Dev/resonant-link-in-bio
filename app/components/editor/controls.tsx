// Compact, accessible form controls used throughout the editor panels.
import { useId, type ReactNode } from "react";

export function TextControl({
  label,
  value,
  onChange,
  onBlur,
  max,
  placeholder,
  error,
  hint,
  type = "text",
  multiline = false,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  max: number;
  placeholder?: string;
  error?: string | null;
  hint?: ReactNode;
  type?: string;
  multiline?: boolean;
  rows?: number;
}) {
  const id = useId();
  const describedBy = [hint ? `${id}-h` : "", error ? `${id}-e` : ""].filter(Boolean).join(" ") || undefined;
  const common = {
    id,
    value,
    maxLength: max,
    placeholder,
    onBlur,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
    className: "input !min-h-[2.4rem] !py-2 text-[0.9rem]",
  } as const;
  return (
    <div className="field">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-[0.8rem] font-medium text-dim">
          {label}
        </label>
        {multiline || value.length > max * 0.8 ? (
          <span className={`font-mono text-[0.68rem] ${value.length > max ? "text-danger" : "text-faint"}`}>
            {value.length}/{max}
          </span>
        ) : null}
      </div>
      {multiline ? (
        <textarea {...common} rows={rows} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input {...common} type={type} onChange={(e) => onChange(e.target.value)} />
      )}
      {hint ? <p id={`${id}-h`} className="field-hint">{hint}</p> : null}
      {error ? <p id={`${id}-e`} className="field-error">{error}</p> : null}
    </div>
  );
}

export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const id = useId();
  return (
    <div className="field">
      <span id={id} className="text-[0.8rem] font-medium text-dim">{label}</span>
      <div role="radiogroup" aria-labelledby={id} className="grid grid-cols-[repeat(auto-fit,minmax(4.6rem,1fr))] gap-1 rounded-xl border border-line bg-ink-2 p-1">
        {options.map((o) => {
          const checked = o.value === value;
          return (
            <button
              key={String(o.value)}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => onChange(o.value)}
              className={`min-w-0 truncate rounded-lg px-2 py-1.5 text-[0.78rem] transition-colors ${
                checked ? "bg-white/[0.1] text-fg" : "text-dim hover:text-fg"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label htmlFor={id} className="text-[0.88rem] font-medium">{label}</label>
        {description ? <p className="field-hint mt-0.5 max-w-xs">{description}</p> : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-10 shrink-0 rounded-full border p-0 transition-colors ${
          checked ? "border-volt bg-volt" : "border-line-strong bg-ink-2"
        }`}
      >
        <span
          aria-hidden="true"
          className={`absolute left-[2px] top-1/2 size-[1.05rem] -translate-y-1/2 rounded-full transition-transform duration-200 ${
            checked ? "translate-x-[1rem] bg-ink" : "translate-x-0 bg-dim"
          }`}
        />
      </button>
    </div>
  );
}

export function IconButton({
  label,
  onClick,
  disabled,
  children,
  tone = "default",
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`grid size-8 place-items-center rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent ${
        tone === "danger" ? "text-dim hover:bg-danger/10 hover:text-danger" : "text-dim hover:bg-white/[0.06] hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}

export const Icons = {
  up: <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M8 13V3M4 7l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  down: <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M8 3v10M4 9l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  copy: <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><rect x="5" y="5" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M3 10.5V4a1 1 0 0 1 1-1h6.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>,
  trash: <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  grip: <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><g fill="currentColor"><circle cx="6" cy="4" r="1.2" /><circle cx="10" cy="4" r="1.2" /><circle cx="6" cy="8" r="1.2" /><circle cx="10" cy="8" r="1.2" /><circle cx="6" cy="12" r="1.2" /><circle cx="10" cy="12" r="1.2" /></g></svg>,
  undo: <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M5.5 3 2.5 6l3 3M3 6h6.5a4 4 0 0 1 0 8H7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  redo: <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="m10.5 3 3 3-3 3M13 6H6.5a4 4 0 0 0 0 8H9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  plus: <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>,
  x: <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>,
};

export function SelectControl<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id} className="text-[0.8rem] font-medium text-dim">{label}</label>
      <select id={id} className="input !min-h-[2.4rem] !py-1.5 text-[0.88rem]" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export function SliderControl({ label, value, min, max, step = 1, unit = "", onChange }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void }) {
  const id = useId();
  return (
    <div className="field">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-[0.8rem] font-medium text-dim">{label}</label>
        <span className="font-mono text-[0.72rem] text-faint">{value}{unit}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[var(--color-volt)]" />
    </div>
  );
}
