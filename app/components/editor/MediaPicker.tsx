import { useRef, useState } from "react";
import { mediaUrl } from "~/components/profile/ProfileView";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

export interface MediaItem {
  id: string;
}

export async function uploadImage(file: File, csrf: string): Promise<{ id: string } | { error: string }> {
  if (file.size > MAX_UPLOAD_BYTES) return { error: "Images must be 5 MB or smaller." };
  if (!ACCEPT.split(",").includes(file.type)) return { error: "Use a PNG, JPEG, WebP or GIF image." };
  const body = new FormData();
  body.append("file", file);
  try {
    const res = await fetch("/api/media", { method: "POST", body, headers: { "X-CSRF-Token": csrf } });
    const json = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
    if (!res.ok || !json.id) return { error: json.error ?? "Upload failed. Try again." };
    return { id: json.id };
  } catch {
    return { error: "Upload failed. Check your connection and try again." };
  }
}

export function MediaPicker({
  label,
  value,
  onChange,
  library,
  onUploaded,
  csrf,
  allowClear = true,
}: {
  label: string;
  value: string | null;
  onChange: (id: string | null) => void;
  library: MediaItem[];
  onUploaded: (item: MediaItem) => void;
  csrf: string;
  allowClear?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [browsing, setBrowsing] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    const result = await uploadImage(file, csrf);
    setBusy(false);
    if ("error" in result) setError(result.error);
    else {
      onUploaded({ id: result.id });
      onChange(result.id);
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="field">
      <span className="text-[0.8rem] font-medium text-dim">{label}</span>
      <div className="flex items-center gap-3">
        <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-ink-2">
          {value ? <img src={mediaUrl(value)} alt="" className="size-full object-cover" /> : <span className="text-[0.7rem] text-faint">None</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? "Uploading…" : value ? "Replace" : "Upload"}
          </button>
          {library.length ? (
            <button type="button" className="btn btn-quiet btn-sm" aria-expanded={browsing} onClick={() => setBrowsing((v) => !v)}>
              From uploads
            </button>
          ) : null}
          {value && allowClear ? (
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => onChange(null)}>
              Remove
            </button>
          ) : null}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-label={`Upload ${label.toLowerCase()}`}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
      {browsing ? <MediaGrid library={library} onPick={(id) => { onChange(id); setBrowsing(false); }} /> : null}
      <p className="field-hint">PNG, JPEG, WebP or GIF, up to 5 MB.</p>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
    </div>
  );
}

export function MediaGrid({ library, onPick }: { library: MediaItem[]; onPick: (id: string) => void }) {
  return (
    <ul className="mt-1 grid max-h-48 grid-cols-5 gap-1.5 overflow-y-auto rounded-xl border border-line p-1.5">
      {library.map((m) => (
        <li key={m.id}>
          <button type="button" onClick={() => onPick(m.id)} className="block aspect-square w-full overflow-hidden rounded-lg border border-line hover:border-volt">
            <img src={mediaUrl(m.id)} alt="Uploaded image" className="size-full object-cover" loading="lazy" />
          </button>
        </li>
      ))}
    </ul>
  );
}
