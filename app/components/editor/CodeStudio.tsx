// Full-screen code studio for the custom-code block: HTML / CSS / JS editors
// (CodeMirror, loaded on demand) beside a live, scrollable sandbox preview.
import { useEffect, useRef, useState } from "react";
import type { BlockOf } from "~/lib/blocks";
import { CODE_MAX } from "~/lib/blocks";
import { CODE_STARTERS, type CodeStarterId } from "~/lib/code-starters";
import { CodeFrame } from "~/components/profile/CodeFrame";
import { IconButton, Icons } from "./controls";

type Lang = "html" | "css" | "js";
type CodeBlock = BlockOf<"code">;

function CodeEditor({ value, lang, onChange, label }: { value: string; lang: Lang; onChange: (v: string) => void; label: string }) {
  const host = useRef<HTMLDivElement>(null);
  const viewRef = useRef<import("@codemirror/view").EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let destroyed = false;
    (async () => {
      const [{ basicSetup, EditorView }, { oneDark }, langMod] = await Promise.all([
        import("codemirror"),
        import("@codemirror/theme-one-dark"),
        lang === "html" ? import("@codemirror/lang-html").then((m) => m.html()) : lang === "css" ? import("@codemirror/lang-css").then((m) => m.css()) : import("@codemirror/lang-javascript").then((m) => m.javascript()),
      ]);
      if (destroyed || !host.current) return;
      const view = new EditorView({
        doc: value,
        parent: host.current,
        extensions: [
          basicSetup,
          langMod,
          oneDark,
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ "aria-label": label }),
          EditorView.theme({ "&": { height: "100%", fontSize: "13px" }, ".cm-scroller": { fontFamily: "'Geist Mono Variable', ui-monospace, monospace" } }),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) onChangeRef.current(u.state.doc.toString());
          }),
        ],
      });
      viewRef.current = view;
      setLoading(false);
    })();
    return () => {
      destroyed = true;
      viewRef.current?.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  // Keep in sync with outside changes (undo/redo, starters).
  useEffect(() => {
    const view = viewRef.current;
    if (view && view.state.doc.toString() !== value) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
    }
  }, [value]);

  return (
    <div className="relative h-full min-h-0">
      {loading ? <p className="absolute inset-0 grid place-items-center text-sm text-faint">Loading editor…</p> : null}
      <div ref={host} className="h-full" />
    </div>
  );
}

export function CodeStudio({ block, onChange, onClose }: { block: CodeBlock; onChange: (patch: Partial<CodeBlock>, key: string) => void; onClose: () => void }) {
  const [tab, setTab] = useState<Lang>("html");
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const sizes = { html: block.html.length, css: block.css.length, js: block.js.length };
  const loadStarter = (id: CodeStarterId) => {
    const s = CODE_STARTERS[id];
    if ((block.html || block.css || block.js) && !window.confirm("Replace the current code with this starter?")) return;
    onChange({ html: s.html, css: s.css, js: s.js }, "code.starter");
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={`Code studio — ${block.title}`} className="fixed inset-0 z-[60] flex flex-col bg-ink">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-4">
        <span aria-hidden="true" className="font-mono text-sm text-dim">&lt;/&gt;</span>
        <h2 className="min-w-0 truncate text-sm font-medium">Code studio · {block.title}</h2>
        <label className="ml-auto hidden items-center gap-2 text-xs text-dim sm:flex">
          Start from
          <select className="input !min-h-[2rem] !w-auto !py-1 text-xs" value="" onChange={(e) => e.target.value && loadStarter(e.target.value as CodeStarterId)}>
            <option value="">Choose a starter…</option>
            {(Object.keys(CODE_STARTERS) as CodeStarterId[]).map((id) => (
              <option key={id} value={id}>{CODE_STARTERS[id].label}</option>
            ))}
          </select>
        </label>
        <button ref={closeRef} type="button" className="btn btn-volt btn-sm" onClick={onClose}>Done</button>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
        <section aria-label="Code" className="flex min-h-0 flex-col border-b border-line lg:border-b-0 lg:border-r">
          <div role="tablist" aria-label="Language" className="flex shrink-0 items-center gap-1 border-b border-line px-3 py-2">
            {(["html", "css", "js"] as const).map((l) => (
              <button
                key={l} role="tab" type="button" aria-selected={tab === l} onClick={() => setTab(l)}
                className={`rounded-full px-3 py-1 font-mono text-xs uppercase ${tab === l ? "bg-white/[0.1] text-fg" : "text-dim hover:text-fg"}`}
              >
                {l === "js" ? "JavaScript" : l.toUpperCase()}
              </button>
            ))}
            <span className={`ml-auto font-mono text-[0.7rem] ${sizes[tab] > CODE_MAX ? "text-danger" : "text-faint"}`}>
              {sizes[tab].toLocaleString()} / {CODE_MAX.toLocaleString()}
            </span>
          </div>
          <div className="min-h-[16rem] flex-1 overflow-hidden">
            <CodeEditor key={tab} lang={tab} label={`${tab.toUpperCase()} code`} value={block[tab]} onChange={(v) => onChange({ [tab]: v } as Partial<CodeBlock>, `code.${tab}`)} />
          </div>
          <p className="shrink-0 border-t border-line px-4 py-2.5 text-[0.75rem] leading-relaxed text-faint">
            Add <code className="text-dim">data-reveal="up|blur|zoom|left|right"</code> to animate on scroll, or use{" "}
            <code className="text-dim">resonant.onViewport(cb)</code>. Code runs in a sandbox: it can't read cookies, call Resonant or
            send data anywhere, but it can load scripts from jsDelivr, cdnjs or unpkg and images over https.
          </p>
        </section>
        <section aria-label="Live preview" className="flex min-h-0 flex-col bg-ink-2">
          <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-2 text-xs text-faint">
            <span>Live preview · scroll to test on-scroll animations</span>
            <IconButton label="Close code studio" onClick={onClose}>{Icons.x}</IconButton>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="grid h-[70%] place-items-center text-sm text-faint" aria-hidden="true">↓ Scroll down</div>
            <div className="mx-auto w-full max-w-[40rem] px-4">
              <CodeFrame html={block.html} css={block.css} js={block.js} title={`${block.title} preview`} height={block.height} fixedHeight={block.fixedHeight} live />
            </div>
            <div className="h-[80%]" aria-hidden="true" />
          </div>
        </section>
      </div>
    </div>
  );
}
