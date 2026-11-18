import { useState } from "react";
import { data, Form, Link, redirect, useNavigation, useSearchParams } from "react-router";
import type { Route } from "./+types/new-profile";
import { privateMeta } from "~/lib/seo";
import { CsrfInput, Field, FormError } from "~/components/ui/forms";
import { requireCsrf, requireUser } from "~/server/session.server";
import { checkHandle, countProfiles, createProfile, MAX_PROFILES_PER_USER } from "~/server/profiles.server";
import { checkRateLimit, tooManyRequests } from "~/server/rate-limit.server";
import { formString } from "~/server/request.server";
import { getTemplate, instantiateTemplate, TEMPLATE_BASES, TEMPLATE_COUNT } from "~/lib/templates";
import { TemplateCard } from "~/components/profile/TemplateCard";
import { blankDocument } from "~/lib/blocks";
import { handleProblem, normalizeHandle } from "~/lib/handles";
import { prefillDocument } from "~/lib/account";
import { getAccount } from "~/server/account.server";

export const meta: Route.MetaFunction = () => privateMeta("New page");

export async function loader({ context, request }: Route.LoaderArgs) {
  const { user } = requireUser(context, request);
  if ((await countProfiles(context, user.id)) >= MAX_PROFILES_PER_USER) throw redirect("/dashboard");
  const { preferences } = await getAccount(context, user.id);
  return { origin: new URL(request.url).origin, displayName: user.displayName, preferences };
}

export async function action({ context, request }: Route.ActionArgs) {
  const { user } = requireUser(context, request);
  const form = await request.formData();
  requireCsrf(context, form);

  const rawHandle = formString(form, "handle", 100);
  const templateId = formString(form, "template", 60);
  const values = { handle: rawHandle, template: templateId };

  const limit = await checkRateLimit(context, { key: `profile-create:user:${user.id}`, limit: 10, windowSeconds: 3600 });
  if (!limit.ok) return tooManyRequests(limit.retryAfter);
  if ((await countProfiles(context, user.id)) >= MAX_PROFILES_PER_USER) {
    return data({ formError: `You can have up to ${MAX_PROFILES_PER_USER} pages.`, handleError: null, values }, { status: 400 });
  }

  const handle = await checkHandle(context, rawHandle);
  if (!handle.ok) return data({ formError: null, handleError: handle.error, values }, { status: 400 });

  const template = getTemplate(templateId);
  const account = await getAccount(context, user.id);
  const base = template ? instantiateTemplate(template, user.displayName) : blankDocument(user.displayName);
  // Settings → Preferences: start from the account profile and the comments default.
  const doc = account.preferences.prefillPages ? prefillDocument(base, account.profile) : base;
  const id = await createProfile(context, user.id, handle.handle, doc, account.preferences.newPageComments);
  if (!id) return data({ formError: null, handleError: "That handle was just taken. Try another.", values }, { status: 409 });
  throw redirect(`/editor/${id}`);
}

export default function NewProfile({ loaderData, actionData }: Route.ComponentProps) {
  const [params] = useSearchParams();
  const busy = useNavigation().state === "submitting";
  const result = actionData && "values" in actionData ? actionData : undefined;
  const initialTemplate = result?.values.template ?? getTemplate(params.get("template"))?.id ?? "blank";
  const [selected, setSelected] = useState(initialTemplate);
  const [handle, setHandle] = useState(result?.values.handle ?? normalizeHandle(params.get("handle") ?? ""));
  const localProblem = handle ? handleProblem(normalizeHandle(handle)) : null;

  return (
    <>
      <Link to="/dashboard" className="text-sm text-dim hover:text-fg">← Dashboard</Link>
      <h1 className="display mt-4 text-4xl sm:text-5xl">New page</h1>
      <p className="mt-3 max-w-xl text-dim">
        Pick an address and a starting design. Your page stays a private draft until you publish it.
      </p>

      <Form method="post" className="mt-10 grid gap-10">
        <CsrfInput />
        <FormError message={actionData?.formError} />
        <div className="max-w-md">
          <Field
            label="Handle"
            name="handle"
            required
            autoComplete="off"
            spellCheck={false}
            maxLength={30}
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            error={result?.handleError ?? localProblem ?? undefined}
            hint={
              <>
                Your page will live at{" "}
                <span className="font-mono text-dim">{loaderData.origin}/@{normalizeHandle(handle) || "handle"}</span>
              </>
            }
          />
        </div>

        <fieldset>
          <legend className="field-label mb-4">Starting design</legend>
          <ul className="grid max-w-[11rem] grid-cols-1 gap-4">
            <li>
              <TemplateOption id="blank" name="Blank" selected={selected} onSelect={setSelected}>
                <div className="grid h-[150px] w-full place-items-center rounded-[1.1rem] border border-dashed border-line-strong text-sm text-faint">
                  Intro only
                </div>
              </TemplateOption>
            </li>
          </ul>
          <input type="hidden" name="template" value={selected} />
          <p className="mt-6 mb-3 text-sm text-dim">Or start from one of {TEMPLATE_COUNT} designs — pick a colourway with the swatches.</p>
          <ul className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            {TEMPLATE_BASES.map((b) => {
              const isSelected = b.variants.some((v) => v.id === selected);
              return (
                <li key={b.id} className={`min-w-0 rounded-[1.6rem] p-1.5 [content-visibility:auto] [contain-intrinsic-size:auto_380px] ${isSelected ? "bg-volt/[0.08] ring-2 ring-volt" : ""}`}>
                  <TemplateCard base={b} width={150} height={240} selectedId={isSelected ? selected : undefined} onPick={(t) => setSelected(t.id)} />
                </li>
              );
            })}
          </ul>
          <p className="field-hint mt-4">Sample text stays until you edit it.</p>
        </fieldset>

        <p className="max-w-xl text-sm text-dim">
          {loaderData.preferences.prefillPages
            ? "Your name, avatar, bio and social links from Settings fill the intro and social links. "
            : "Your display name replaces the sample name; your avatar, bio and links aren't added. "}
          Comments start {loaderData.preferences.newPageComments ? "on" : "off"}.{" "}
          <Link to="/settings#preferences" className="underline underline-offset-4 hover:text-fg">Change defaults</Link>
        </p>
        <div className="flex gap-3">
          <button type="submit" className="btn btn-volt" disabled={busy || !handle}>
            {busy ? "Creating…" : "Create page and open editor"}
          </button>
          <Link to="/dashboard" className="btn btn-ghost">Cancel</Link>
        </div>
      </Form>
    </>
  );
}

function TemplateOption({
  id,
  name,
  selected,
  onSelect,
  children,
}: {
  id: string;
  name: string;
  selected: string;
  onSelect: (id: string) => void;
  children: React.ReactNode;
}) {
  const checked = selected === id;
  return (
    <label
      className={`group block cursor-pointer rounded-[1.3rem] border p-2.5 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-volt ${
        checked ? "border-volt bg-volt/[0.06]" : "border-line hover:border-line-strong"
      }`}
    >
      <input type="radio" name="template-choice" value={id} checked={checked} onChange={() => onSelect(id)} className="sr-only" />
      <div className="flex justify-center">{children}</div>
      <span className="mt-2.5 flex items-center justify-between px-1 text-sm">
        {name}
        <span aria-hidden="true" className={`size-3.5 rounded-full border ${checked ? "border-volt bg-volt" : "border-line-strong"}`} />
      </span>
    </label>
  );
}
