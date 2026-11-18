// Kept free of the profile renderer so the workspace layout chunk stays small.
const mediaUrl = (id: string) => `/media/${id}`;

/** Round account avatar; falls back to the name's first letter. Decorative (alt=""). */
export function Avatar({ mediaId, name, size = 32, className = "" }: { mediaId: string | null; name: string; size?: number; className?: string }) {
  const initial = Array.from(name.trim())[0]?.toUpperCase() ?? "?";
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-ink-2 font-semibold text-dim ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      {mediaId ? <img src={mediaUrl(mediaId)} alt="" width={size} height={size} className="size-full object-cover" /> : initial}
    </span>
  );
}
