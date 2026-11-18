import { useCallback, useEffect, useId, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { data, Form, Link, redirect, useBlocker, useFetcher, type ShouldRevalidateFunctionArgs } from "react-router";
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Route } from "./+types/editor";
import { privateMeta } from "~/lib/seo";
import { BLOCK_REGISTRY, documentSchema, describeIssues, newBlockId, upgradeTrusted, type Block, type ProfileDocument } from "~/lib/blocks";
import { findComponent, type ComponentPreset } from "~/lib/components";
import type { ThemeSettings } from "~/lib/themes";
import { profilePath } from "~/lib/handles";
import { PhoneFrame } from "~/components/profile/Frames";
import { Layers } from "~/components/editor/BlockList";
import { Library } from "~/components/editor/Library";
import { Canvas } from "~/components/editor/Canvas";
import { DesignPanel } from "~/components/editor/DesignPanel";
import { AccountProfileContext, BlockForm, blockErrors, type MediaContext } from "~/components/editor/BlockForms";
import { historyReducer, initHistory, insertBlock, moveBlock, removeBlock, updateBlock } from "~/components/editor/state";
import { IconButton, Icons, TextControl, Toggle } from "~/components/editor/controls";
import { MusicSection, PageStrip, PagesSection, newPage } from "~/components/editor/SitePanel";
import type { MediaItem } from "~/components/editor/MediaPicker";
import { CsrfInput, useCsrfToken } from "~/components/ui/forms";
import { CopyButton } from "~/components/ui/CopyButton";
import { Logo, LogoMark } from "~/components/ui/Logo";
import { requireCsrf, requireUser } from "~/server/session.server";
import {
  checkHandle, deleteProfile, getOwnedProfile, publishProfile, saveDraft, unpublishProfile, updateProfileSettings,
} from "~/server/profiles.server";
import { deleteComment, isUuid, listCommentsForOwner, setCommentStatus } from "~/server/comments.server";
import { checkRateLimit, tooManyRequests } from "~/server/rate-limit.server";
import { db } from "~/server/db.server";
import { formString } from "~/server/request.server";
import { getAccount } from "~/server/account.server";

export const meta: Route.MetaFunction = ({ loaderData }) =>
  privateMeta(loaderData ? `Editing @${loaderData.profile.handle}` : "Editor");

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { user } = requireUser(context, request);
  const profile = await getOwnedProfile(context, user.id, params.profileId);
  const media = await db(context)<{ id: string; content_type: string }[]>`
    SELECT id, content_type FROM media WHERE owner_id = ${user.id} ORDER BY created_at DESC LIMIT 80`;
  const comments = await listCommentsForOwner(context, profile.id);
  const account = await getAccount(context, user.id);
  return {
    origin: new URL(request.url).origin,
    // Settings → Profile; offered as "Use my account profile" in the intro and social forms.
    account: account.profile,
    profile: {
      id: profile.id,
      handle: profile.handle,
      status: profile.status,
      draft: upgradeTrusted(profile.draft),
      draftVersion: profile.draft_version,
      publishedVersion: profile.published_version,
      publishedAt: profile.published_at?.toISOString() ?? null,
      unpublishedChanges: profile.has_unpublished_changes,
      commentsEnabled: profile.comments_enabled,
      indexable: profile.indexable,
    },
    media: media.map((m) => ({ id: m.id, kind: m.content_type.startsWith("audio/") ? ("audio" as const) : ("image" as const) })),
    comments: comments.map((c) => ({
      id: c.id, body: c.body, author: c.author_name, createdAt: c.created_at.toISOString(), status: c.status, reports: c.reports,
    })),
  };
}

export function shouldRevalidate({ formData, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  // Autosaves don't change anything the loader returns that the editor uses.
  if (formData?.get("intent") === "save") return false;
  return defaultShouldRevalidate;
}

export async function action({ context, request, params }: Route.ActionArgs) {
  const { user } = requireUser(context, request);
  const form = await request.formData();
  requireCsrf(context, form);
  const intent = formString(form, "intent", 40);
  const profileId = params.profileId;
  // Every intent below re-checks ownership in SQL via owner_id.

  switch (intent) {
    case "save": {
      const limit = await checkRateLimit(context, { key: `save:user:${user.id}`, limit: 120, windowSeconds: 60 });
      if (!limit.ok) return tooManyRequests(limit.retryAfter, "Saving too quickly. Your changes will retry shortly.");
      const raw = formString(form, "document", 400_000);
      const baseVersion = Number(formString(form, "baseVersion", 12));
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return data({ intent, ok: false as const, errors: ["The draft could not be read."] }, { status: 400 });
      }
      if (!Number.isInteger(baseVersion)) return data({ intent, ok: false as const, errors: ["Missing version."] }, { status: 400 });
      const result = await saveDraft(context, user.id, profileId, parsed, baseVersion);
      if (result.ok) return { intent, ok: true as const, version: result.version };
      if ("conflict" in result) return data({ intent, ok: false as const, conflict: true }, { status: 409 });
      return data({ intent, ok: false as const, errors: result.errors }, { status: 400 });
    }
    case "publish": {
      const limit = await checkRateLimit(context, { key: `publish:user:${user.id}`, limit: 30, windowSeconds: 3600 });
      if (!limit.ok) return tooManyRequests(limit.retryAfter, "You've published a lot recently. Try again later.");
      const result = await publishProfile(context, user.id, profileId);
      if (!result.ok) return data({ intent, ok: false as const, errors: result.errors }, { status: 400 });
      return { intent, ok: true as const, message: `Published version ${result.version}.` };
    }
    case "unpublish": {
      await unpublishProfile(context, user.id, profileId);
      return { intent, ok: true as const, message: "Your page is offline. Its address now answers “gone”." };
    }
    case "settings": {
      const settings: Parameters<typeof updateProfileSettings>[3] = {};
      if (form.has("handle")) {
        const check = await checkHandle(context, formString(form, "handle", 100), profileId);
        if (!check.ok) return data({ intent, ok: false as const, errors: [check.error] }, { status: 400 });
        settings.handle = check.handle;
      }
      if (form.has("commentsEnabled")) settings.commentsEnabled = form.get("commentsEnabled") === "true";
      if (form.has("indexable")) settings.indexable = form.get("indexable") === "true";
      try {
        await updateProfileSettings(context, user.id, profileId, settings);
      } catch (e) {
        if (e instanceof Error && /profiles_handle_key/.test(e.message)) {
          return data({ intent, ok: false as const, errors: ["That handle was just taken."] }, { status: 409 });
        }
        throw e;
      }
      return { intent, ok: true as const, message: "Settings saved." };
    }
    case "delete": {
      const profile = await getOwnedProfile(context, user.id, profileId);
      if (formString(form, "confirm", 100).trim().replace(/^@/, "") !== profile.handle) {
        return data({ intent, ok: false as const, errors: ["Type the handle exactly to confirm."] }, { status: 400 });
      }
      await deleteProfile(context, user.id, profileId);
      throw redirect("/dashboard");
    }
    case "comment-hide":
    case "comment-show":
    case "comment-delete": {
      const commentId = form.get("commentId");
      if (!isUuid(commentId)) throw data("Bad request", { status: 400 });
      await getOwnedProfile(context, user.id, profileId);
      const [belongs] = await db(context)`SELECT 1 FROM comments WHERE id = ${commentId} AND profile_id = ${profileId}`;
      if (!belongs) throw data("Not found", { status: 404 });
      if (intent === "comment-delete") await deleteComment(context, commentId, user.id);
      else await setCommentStatus(context, commentId, user.id, intent === "comment-hide" ? "hidden" : "visible");
      return { intent, ok: true as const, message: "Comment updated." };
    }
    default:
      throw data("Unknown action", { status: 400 });
  }
}

type SaveStatus = "saved" | "pending" | "saving" | "invalid" | "error" | "conflict";
type LeftTab = "add" | "layers" | "design" | "page" | "comments";
type Device = "mobile" | "desktop";

function useMediaQuery(query: string) {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    setMatch(mq.matches);
    const on = () => setMatch(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return match;
}

export default function Editor({ loaderData }: Route.ComponentProps) {
  const { profile, origin } = loaderData;
  const csrf = useCsrfToken();
  const [history, dispatch] = useReducer(historyReducer, profile.draft, initHistory);
  const doc = history.present;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<LeftTab>("add");
  const [device, setDevice] = useState<Device>("mobile");
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");
  const [library, setLibrary] = useState<MediaItem[]>(loaderData.media);
  // Which page of the site is being edited (null = home).
  const [pageId, setPageId] = useState<string | null>(null);
  const isWide = useMediaQuery("(min-width: 1280px)");

  // Preview defaults to the kind of device you're editing on.
  useEffect(() => {
    setDevice(window.matchMedia("(min-width: 1024px)").matches ? "desktop" : "mobile");
  }, []);

  // --- Autosave -----------------------------------------------------------------
  const saver = useFetcher<typeof action>({ key: `save-${profile.id}` });
  const versionRef = useRef(profile.draftVersion);
  const savedJsonRef = useRef(JSON.stringify(profile.draft));
  const sentJsonRef = useRef<string | null>(null);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const json = useMemo(() => JSON.stringify(doc), [doc]);
  const validation = useMemo(() => documentSchema.safeParse(doc), [doc]);
  const clientErrors = validation.success ? [] : describeIssues(validation.error, doc);
  const dirty = json !== savedJsonRef.current;

  const saveNow = useCallback(() => {
    if (saver.state !== "idle" || status === "conflict") return;
    if (json === savedJsonRef.current) return;
    if (!validation.success) {
      setStatus("invalid");
      return;
    }
    sentJsonRef.current = json;
    setStatus("saving");
    saver.submit({ intent: "save", document: json, baseVersion: String(versionRef.current), _csrf: csrf }, { method: "post" });
  }, [saver, status, json, validation.success, csrf]);

  useEffect(() => {
    if (!dirty || status === "conflict") return;
    if (!validation.success) {
      setStatus("invalid");
      return;
    }
    if (saver.state !== "idle") return;
    setStatus("pending");
    const t = setTimeout(saveNow, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [json, saver.state, validation.success]);

  useEffect(() => {
    if (saver.state !== "idle" || !saver.data || sentJsonRef.current === null) return;
    const result = saver.data;
    if (!("intent" in result) || result.intent !== "save") return;
    if (result.ok && "version" in result && typeof result.version === "number") {
      versionRef.current = result.version;
      savedJsonRef.current = sentJsonRef.current;
      setServerErrors([]);
      setStatus(json === savedJsonRef.current ? "saved" : "pending");
    } else if ("conflict" in result) {
      setStatus("conflict");
    } else if ("errors" in result) {
      setServerErrors(result.errors as string[]);
      setStatus("error");
    } else {
      setStatus("error");
    }
    sentJsonRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saver.state, saver.data]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    if (window.confirm("You have changes that haven't saved yet. Leave anyway?")) blocker.proceed();
    else blocker.reset();
  }, [blocker]);

  // --- Editing operations ---------------------------------------------------------
  const change = useCallback((next: ProfileDocument, key?: string) => dispatch({ type: "change", doc: next, key }), []);

  // Block operations work on a "view" of the page being edited: the document with
  // that page's blocks in doc.blocks. changeView writes them back to the right page.
  const activePage = pageId ? doc.pages.find((p) => p.id === pageId) ?? null : null;
  useEffect(() => {
    if (pageId && !activePage) setPageId(null); // page deleted (or undone away)
  }, [pageId, activePage]);
  const view: ProfileDocument = useMemo(() => (activePage ? { ...doc, blocks: activePage.blocks } : doc), [doc, activePage]);
  const changeView = (next: ProfileDocument, key?: string) =>
    change(activePage ? { ...doc, pages: doc.pages.map((p) => (p.id === activePage.id ? { ...p, blocks: next.blocks } : p)) } : next, key);
  const selectPage = (id: string | null) => {
    setPageId(id);
    setSelectedId(null);
  };
  const addPage = () => {
    const page = newPage(doc);
    change({ ...doc, pages: [...doc.pages, page] }, "pages.add");
    selectPage(page.id);
  };

  const selectedIndex = view.blocks.findIndex((b) => b.id === selectedId);
  const selected = selectedIndex >= 0 ? view.blocks[selectedIndex] : null;

  const insertPreset = (preset: ComponentPreset, index?: number) => {
    const block = preset.create();
    const at = index ?? (selectedIndex >= 0 ? selectedIndex + 1 : view.blocks.length);
    changeView(insertBlock(view, block, at));
    setSelectedId(block.id);
    if (!isWide) setTab("layers");
  };
  const onBlockChange = (id: string, patch: Partial<Block>, key: string) => changeView(updateBlock(view, id, patch), key);
  const onDuplicate = (id: string) => {
    const index = view.blocks.findIndex((b) => b.id === id);
    if (index < 0) return;
    const copy = { ...structuredClone(view.blocks[index]), id: newBlockId() } as Block;
    changeView(insertBlock(view, copy, index + 1));
    setSelectedId(copy.id);
  };
  const onRemove = (id: string) => {
    changeView(removeBlock(view, id));
    setSelectedId(null);
  };
  const onMove = (from: number, to: number) => changeView(moveBlock(view, from, to));
  const onTheme = (patch: Partial<ThemeSettings>, key: string) => change({ ...doc, theme: { ...doc.theme, ...patch } }, `theme.${key}`);

  // Keyboard: undo/redo/save, Delete removes the selected block when focus isn't in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const inField = (e.target as HTMLElement)?.closest?.("input, textarea, select, [contenteditable]");
      if (mod) {
        const k = e.key.toLowerCase();
        if (k === "z" && !e.shiftKey) { e.preventDefault(); dispatch({ type: "undo" }); }
        else if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); dispatch({ type: "redo" }); }
        else if (k === "s") { e.preventDefault(); saveNow(); }
      } else if (e.key === "Escape" && !inField) setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saveNow]);

  // --- Drag and drop (library → page, reorder on canvas or in layers) ----------------
  // dnd-kit numbers its aria ids with a global counter; a stable id keeps SSR and hydration in sync.
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates, keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] } }),
  );
  const [dragLabel, setDragLabel] = useState<string | null>(null);
  const indexOfDropTarget = (overId: string | null) => {
    if (!overId) return -1;
    if (overId === "canvas-end" || overId === "layers-end") return view.blocks.length;
    const id = overId.slice(2);
    return view.blocks.findIndex((b) => b.id === id);
  };
  function onDragStart(e: DragStartEvent) {
    const id = String(e.active.id);
    if (id.startsWith("lib:")) setDragLabel(findComponent(id.slice(4))?.label ?? "Component");
    else {
      const b = view.blocks.find((x) => x.id === id.slice(2));
      setDragLabel(b ? BLOCK_REGISTRY[b.type].label : null);
    }
  }
  function onDragEnd(e: DragEndEvent) {
    setDragLabel(null);
    const activeId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    const to = indexOfDropTarget(overId);
    if (to < 0) return;
    if (activeId.startsWith("lib:")) {
      const preset = findComponent(activeId.slice(4));
      if (preset) insertPreset(preset, to);
      return;
    }
    const from = view.blocks.findIndex((b) => b.id === activeId.slice(2));
    if (from >= 0 && from !== to) onMove(from, Math.min(to, view.blocks.length - 1));
  }

  // --- Other actions (publish, settings, moderation) ---------------------------------
  const actions = useFetcher<typeof action>({ key: `actions-${profile.id}` });
  const actionResult = actions.state === "idle" ? actions.data : undefined;
  const busyIntent = actions.state !== "idle" ? actions.formData?.get("intent") : null;
  const submitAction = (fields: Record<string, string>) => actions.submit({ ...fields, _csrf: csrf }, { method: "post" });

  const canPublish = status === "saved" && !dirty && validation.success;
  const liveUrl = origin + profilePath(profile.handle);
  const onUploaded = (item: MediaItem) => setLibrary((l) => [item, ...l.filter((x) => x.id !== item.id)]);
  const media: MediaContext = { library: library.filter((m) => m.kind !== "audio"), csrf, onUploaded };
  const audioLibrary = library.filter((m) => m.kind === "audio");
  const full = view.blocks.length >= 80;

  const inspector = selected ? (
    <Inspector
      block={selected}
      media={media}
      onClose={() => setSelectedId(null)}
      onChange={(patch, key) => onBlockChange(selected.id, patch, key)}
      onDuplicate={() => onDuplicate(selected.id)}
      onRemove={() => onRemove(selected.id)}
    />
  ) : null;

  const leftPanel: Record<LeftTab, ReactNode> = {
    add: <Library onInsert={(p) => insertPreset(p)} disabled={full} theme={doc.theme} />,
    layers: !isWide && inspector ? inspector : <Layers blocks={view.blocks} selectedId={selectedId} onSelect={(id) => { setSelectedId(id); }} onMove={onMove} />,
    design: <DesignPanel theme={doc.theme} media={media} onChange={onTheme} />,
    page: (
      <PagePanel
        profile={profile} liveUrl={liveUrl} origin={origin} doc={doc}
        onSeo={(seo, key) => change({ ...doc, seo: { ...doc.seo, ...seo } }, key)}
        submitAction={submitAction} busyIntent={typeof busyIntent === "string" ? busyIntent : null}
        site={
          <>
            <PagesSection doc={doc} liveUrl={liveUrl} onChange={(patch, key) => change({ ...doc, ...patch }, key)} onSelectPage={selectPage} />
            <MusicSection
              music={doc.music}
              onChange={(patch, key) => change({ ...doc, music: { ...doc.music, ...patch } }, key)}
              audioLibrary={audioLibrary}
              csrf={csrf}
              onUploaded={onUploaded}
            />
          </>
        }
      />
    ),
    comments: <CommentsPanel comments={loaderData.comments} enabled={profile.commentsEnabled} submitAction={submitAction} />,
  };

  // When a block gets selected on a narrower screen, show its settings in the side panel.
  useEffect(() => {
    if (selectedId && !isWide) setTab("layers");
  }, [selectedId, isWide]);

  return (
    <AccountProfileContext.Provider value={loaderData.account}>
    <div className="flex h-dvh flex-col bg-ink">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-3 sm:gap-3 sm:px-4">
        <Link to="/dashboard" className="flex shrink-0 items-center gap-2 rounded-lg pr-1 text-sm text-dim hover:text-fg" aria-label="Back to dashboard">
          <span className="sm:hidden"><LogoMark size={22} /></span>
          <span className="hidden sm:inline-flex"><Logo /></span>
        </Link>
        <div className="flex min-w-0 items-center gap-2 border-l border-line pl-3">
          <span className="truncate text-sm font-medium">@{profile.handle}</span>
          <StatusPill status={profile.status} />
        </div>
        <SaveIndicator status={status} />
        <div role="group" aria-label="Preview device" className="mx-auto hidden items-center gap-0.5 rounded-full border border-line p-0.5 lg:flex">
          {(["mobile", "desktop"] as const).map((d) => (
            <button key={d} type="button" aria-pressed={device === d} onClick={() => setDevice(d)}
              className={`rounded-full px-3 py-1 text-xs capitalize ${device === d ? "bg-white/[0.1] text-fg" : "text-dim hover:text-fg"}`}>
              {d}
            </button>
          ))}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1 lg:ml-0">
          <IconButton label="Undo (Ctrl+Z)" onClick={() => dispatch({ type: "undo" })} disabled={!history.past.length}>{Icons.undo}</IconButton>
          <IconButton label="Redo (Ctrl+Shift+Z)" onClick={() => dispatch({ type: "redo" })} disabled={!history.future.length}>{Icons.redo}</IconButton>
          {profile.status === "published" ? (
            <a href={profilePath(profile.handle)} target="_blank" rel="noopener" className="btn btn-quiet btn-sm hidden md:inline-flex">View live ↗</a>
          ) : null}
          <button
            type="button" className="btn btn-volt btn-sm"
            disabled={!canPublish || busyIntent === "publish"}
            onClick={() => submitAction({ intent: "publish" })}
            title={canPublish ? undefined : "Wait for the draft to save and fix any problems first"}
          >
            {busyIntent === "publish" ? "Publishing…" : profile.status === "published" && !profile.unpublishedChanges ? "Republish" : "Publish"}
          </button>
        </div>
      </header>

      <Notices status={status} clientErrors={clientErrors} serverErrors={serverErrors} actionResult={actionResult} />

      <div className="flex border-b border-line lg:hidden" role="tablist" aria-label="Editor view">
        {(["edit", "preview"] as const).map((v) => (
          <button key={v} role="tab" aria-selected={mobileView === v} type="button" onClick={() => setMobileView(v)}
            className={`flex-1 py-2.5 text-sm capitalize ${mobileView === v ? "border-b-2 border-volt text-fg" : "text-dim"}`}>
            {v}
          </button>
        ))}
      </div>

      <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragLabel(null)}>
        <div className="flex min-h-0 flex-1">
          {/* Left: library, layers, design, page, comments */}
          <section aria-label="Edit page" className={`${mobileView === "edit" ? "flex" : "hidden"} min-h-0 w-full min-w-0 flex-col border-r border-line lg:flex lg:w-[21rem] lg:shrink-0`}>
            <div role="tablist" aria-label="Editor sections" className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-line px-2 py-2 [scrollbar-width:none]">
              {(
                [
                  ["add", "Add"],
                  ["layers", !isWide && selected ? "Edit" : "Layers"],
                  ["design", "Design"],
                  ["page", "Page"],
                  ["comments", `Comments${loaderData.comments.some((c) => c.reports > 0) ? " •" : ""}`],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id} id={`tab-${id}`} role="tab" type="button" aria-selected={tab === id} aria-controls="editor-tabpanel"
                  onClick={() => setTab(id)}
                  className={`flex-1 shrink-0 whitespace-nowrap rounded-full px-2 py-1.5 text-[0.82rem] sm:flex-none sm:px-3 ${tab === id ? "bg-white/[0.08] text-fg" : "text-dim hover:text-fg"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div id="editor-tabpanel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-3">
              <SortableContext items={view.blocks.map((b) => `l:${b.id}`)} strategy={verticalListSortingStrategy}>
                {leftPanel[tab]}
              </SortableContext>
            </div>
          </section>

          {/* Centre: live canvas */}
          <section aria-label="Page canvas" className={`${mobileView === "preview" ? "flex" : "hidden"} min-w-0 flex-1 flex-col bg-ink-2 lg:flex`}>
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-4 py-2">
              <PageStrip doc={doc} pageId={pageId} onSelect={selectPage} onAdd={addPage} />
              <p className="hidden shrink truncate text-xs text-faint xl:block">
                Draft preview{dirty ? " · unsaved changes" : ""} · click a block to edit, drag to reorder
              </p>
              <div role="group" aria-label="Preview device" className="flex gap-1 lg:hidden">
                {(["mobile", "desktop"] as const).map((d) => (
                  <button key={d} type="button" aria-pressed={device === d} onClick={() => setDevice(d)}
                    className={`rounded-full px-3 py-1 text-xs capitalize ${device === d ? "bg-white/[0.08] text-fg" : "text-dim hover:text-fg"}`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-6" onClick={(e) => { if (e.target === e.currentTarget) setSelectedId(null); }}>
              {device === "mobile" ? (
                <div className="mx-auto w-full max-w-[24.5rem]">
                  <PhoneFrame>
                    <div className="h-[min(48rem,calc(100dvh-12rem))] overflow-y-auto">
                      <Canvas doc={view} pageId={pageId} onNavigate={selectPage} selectedId={selectedId} onSelect={setSelectedId} onMove={onMove} onDuplicate={onDuplicate} onRemove={onRemove} />
                    </div>
                  </PhoneFrame>
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-line-strong">
                  <div className="h-[calc(100dvh-10rem)] min-h-[28rem] overflow-y-auto">
                    <Canvas doc={view} pageId={pageId} onNavigate={selectPage} selectedId={selectedId} onSelect={setSelectedId} onMove={onMove} onDuplicate={onDuplicate} onRemove={onRemove} />
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Right: inspector (wide screens) */}
          {isWide ? (
            <aside aria-label="Block settings" className="flex min-h-0 w-[22rem] shrink-0 flex-col border-l border-line">
              <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4">
                {inspector ?? (
                  <div className="grid gap-4 pt-6 text-center">
                    <p className="text-sm font-medium">Nothing selected</p>
                    <p className="text-[0.82rem] leading-relaxed text-dim">
                      Click a block on the page to edit it here. Drag components in from <strong className="text-fg">Add</strong>, or reorder them in <strong className="text-fg">Layers</strong>.
                    </p>
                    <p className="text-[0.75rem] text-faint">Shortcuts: Ctrl/⌘+Z undo · Shift+Ctrl/⌘+Z redo · Ctrl/⌘+S save · Esc deselect</p>
                  </div>
                )}
              </div>
            </aside>
          ) : null}
        </div>
        <DragOverlay dropAnimation={null}>
          {dragLabel ? <div className="rounded-xl border border-volt bg-panel px-3 py-2 text-sm shadow-2xl shadow-black/60">{dragLabel}</div> : null}
        </DragOverlay>
      </DndContext>
    </div>
    </AccountProfileContext.Provider>
  );
}

function Inspector({
  block, media, onChange, onDuplicate, onRemove, onClose,
}: {
  block: Block; media: MediaContext; onChange: (patch: Partial<Block>, key: string) => void; onDuplicate: () => void; onRemove: () => void; onClose: () => void;
}) {
  const meta = BLOCK_REGISTRY[block.type];
  const errors = blockErrors(block);
  return (
    <div className="grid min-w-0 grid-cols-1 gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">{meta.category}</p>
          <h2 className="mt-1 text-base font-semibold">{meta.label}</h2>
          <p className="mt-0.5 text-[0.8rem] text-faint">{meta.description}</p>
        </div>
        <IconButton label="Close block settings" onClick={onClose}>{Icons.x}</IconButton>
      </div>
      <BlockForm block={block} onChange={onChange as never} errors={errors} media={media} />
      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        <button type="button" className="btn btn-quiet btn-sm" onClick={onDuplicate}>{Icons.copy} Duplicate</button>
        <button type="button" className="btn btn-quiet btn-sm hover:!text-danger" onClick={onRemove}>{Icons.trash} Delete block</button>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: "draft" | "published" | "unpublished" }) {
  const map = {
    draft: ["Draft", "border-line-strong text-dim"],
    published: ["Live", "border-volt/50 text-volt"],
    unpublished: ["Unpublished", "border-warn/40 text-warn"],
  } as const;
  const [label, cls] = map[status];
  return <span className={`hidden shrink-0 rounded-full border px-2 py-0.5 text-[0.7rem] min-[400px]:inline ${cls}`}>{label}</span>;
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  const text: Record<SaveStatus, string> = {
    saved: "Saved", pending: "Unsaved changes", saving: "Saving…", invalid: "Fix problems to save", error: "Couldn't save", conflict: "Changed elsewhere",
  };
  const tone = status === "saved" ? "text-faint" : status === "invalid" || status === "error" || status === "conflict" ? "text-danger" : "text-dim";
  return <span role="status" aria-live="polite" className={`hidden shrink-0 text-xs sm:inline ${tone}`}>{text[status]}</span>;
}

function Notices({ status, clientErrors, serverErrors, actionResult }: { status: SaveStatus; clientErrors: string[]; serverErrors: string[]; actionResult: unknown }) {
  const result = actionResult as { ok?: boolean; message?: string; errors?: string[]; formError?: string } | undefined;
  const errors = status === "invalid" ? clientErrors : status === "error" ? serverErrors : [];
  if (status === "conflict") {
    return (
      <div className="alert alert-error m-3 mb-0" role="alert">
        This page was saved from another tab or device. To avoid overwriting it, editing here is paused.{" "}
        <a href="" className="underline">Reload the latest draft</a>.
      </div>
    );
  }
  return (
    <>
      {errors.length ? (
        <div className="alert alert-error m-3 mb-0" role="alert">
          <p className="font-medium">Your draft can't be saved until these are fixed:</p>
          <ul className="mt-1 list-disc pl-5">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      ) : null}
      {result?.formError ? <div className="alert alert-error m-3 mb-0" role="alert">{result.formError}</div> : null}
      {result && result.ok === false && result.errors?.length ? <div className="alert alert-error m-3 mb-0" role="alert">{result.errors.join(" ")}</div> : null}
      {result?.ok && result.message ? <div className="alert alert-ok m-3 mb-0" role="status">{result.message}</div> : null}
    </>
  );
}

type LoaderProfile = Route.ComponentProps["loaderData"]["profile"];

function PagePanel({
  profile, liveUrl, origin, doc, onSeo, submitAction, busyIntent, site,
}: {
  profile: LoaderProfile; liveUrl: string; origin: string; doc: ProfileDocument;
  onSeo: (seo: Partial<ProfileDocument["seo"]>, key: string) => void;
  submitAction: (fields: Record<string, string>) => void; busyIntent: string | null;
  /** Pages and music settings. */
  site: ReactNode;
}) {
  const [handle, setHandle] = useState(profile.handle);
  const [confirm, setConfirm] = useState("");
  return (
    <div className="grid min-w-0 grid-cols-1 gap-8">
      <section className="grid min-w-0 gap-3">
        <h2 className="text-sm font-semibold">Address</h2>
        <div className="flex min-w-0 items-center gap-2 rounded-xl border border-line bg-ink-2 px-3 py-2">
          <span className="min-w-0 flex-1 truncate font-mono text-[0.78rem] text-dim">{liveUrl}</span>
          <CopyButton value={liveUrl} />
        </div>
        <p className="field-hint">
          {profile.status === "published"
            ? `Live since ${new Date(profile.publishedAt!).toLocaleString()} · version ${profile.publishedVersion}.`
            : profile.status === "unpublished" ? "Unpublished. Visitors see a “gone” page." : "Not published yet. Visitors see “not found”."}
        </p>
        <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); submitAction({ intent: "settings", handle }); }}>
          <TextControl
            label="Handle" value={handle} max={30} onChange={setHandle}
            hint={profile.status !== "draft" ? "Changing it breaks links to the old address, which will answer “gone” for 30 days." : `${origin}/@${handle || "handle"}`}
          />
          <button type="submit" className="btn btn-ghost btn-sm justify-self-start" disabled={handle === profile.handle || busyIntent === "settings"}>Change handle</button>
        </form>
      </section>

      {site}

      <section className="grid min-w-0 gap-4">
        <h2 className="text-sm font-semibold">Visibility</h2>
        <Toggle label="Allow search engines" description="When off, the page asks search engines not to index it and it's left out of the sitemap." checked={profile.indexable} onChange={(v) => submitAction({ intent: "settings", indexable: String(v) })} />
        <Toggle label="Comments" description="Signed-in Resonant users can comment. You can hide or delete any comment." checked={profile.commentsEnabled} onChange={(v) => submitAction({ intent: "settings", commentsEnabled: String(v) })} />
        {profile.status === "published" ? (
          <button type="button" className="btn btn-ghost btn-sm justify-self-start" disabled={busyIntent === "unpublish"} onClick={() => submitAction({ intent: "unpublish" })}>Unpublish page</button>
        ) : null}
      </section>

      <section className="grid min-w-0 gap-3">
        <h2 className="text-sm font-semibold">Search & sharing</h2>
        <TextControl label="Page title" value={doc.seo.title} max={70} placeholder="Defaults to your intro name" onChange={(title) => onSeo({ title }, "seo.title")} />
        <TextControl label="Description" value={doc.seo.description} max={160} multiline rows={2} placeholder="Defaults to your tagline" onChange={(description) => onSeo({ description }, "seo.description")} />
        <p className="field-hint">These are part of your draft and go live when you publish.</p>
      </section>

      <section className="grid min-w-0 gap-3 rounded-xl border border-danger/25 p-4">
        <h2 className="text-sm font-semibold text-danger">Delete page</h2>
        <p className="field-hint">Removes the page, its history, comments and analytics. This can't be undone.</p>
        <Form method="post" className="grid gap-2">
          <CsrfInput />
          <input type="hidden" name="intent" value="delete" />
          <label className="text-[0.8rem] text-dim" htmlFor="confirm-delete">Type <span className="font-mono text-fg">{profile.handle}</span> to confirm</label>
          <input id="confirm-delete" name="confirm" className="input !min-h-[2.4rem]" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
          <button type="submit" className="btn btn-danger btn-sm justify-self-start" disabled={confirm !== profile.handle}>Delete permanently</button>
        </Form>
      </section>
    </div>
  );
}

type LoaderComment = Route.ComponentProps["loaderData"]["comments"][number];

function CommentsPanel({ comments, enabled, submitAction }: { comments: LoaderComment[]; enabled: boolean; submitAction: (f: Record<string, string>) => void }) {
  return (
    <div className="grid min-w-0 gap-4">
      <p className="text-sm text-dim">
        Comments are <strong className="text-fg">{enabled ? "on" : "off"}</strong> for this page. Change this in the Page tab. Reported comments are listed first.
      </p>
      {comments.length === 0 ? (
        <p className="py-8 text-center text-sm text-faint">No comments yet.</p>
      ) : (
        <ul className="grid gap-2">
          {comments.map((c) => (
            <li key={c.id} className={`rounded-xl border p-3 ${c.status === "hidden" ? "border-line opacity-60" : c.reports ? "border-warn/40" : "border-line"}`}>
              <div className="flex flex-wrap items-center gap-2 text-xs text-faint">
                <span className="text-dim">{c.author}</span>
                <span>·</span>
                <time dateTime={c.createdAt}>{new Date(c.createdAt).toLocaleDateString()}</time>
                {c.status === "hidden" ? <span className="rounded-full border border-line-strong px-1.5">Hidden</span> : null}
                {c.reports ? <span className="text-warn">{c.reports} report{c.reports > 1 ? "s" : ""}</span> : null}
              </div>
              <p className="mt-1.5 whitespace-pre-line break-words text-sm">{c.body}</p>
              <div className="mt-2 flex gap-1">
                {c.status === "visible" ? (
                  <button type="button" className="btn btn-quiet btn-sm" onClick={() => submitAction({ intent: "comment-hide", commentId: c.id })}>Hide</button>
                ) : (
                  <button type="button" className="btn btn-quiet btn-sm" onClick={() => submitAction({ intent: "comment-show", commentId: c.id })}>Show</button>
                )}
                <button type="button" className="btn btn-quiet btn-sm hover:!text-danger" onClick={() => { if (window.confirm("Delete this comment permanently?")) submitAction({ intent: "comment-delete", commentId: c.id }); }}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
