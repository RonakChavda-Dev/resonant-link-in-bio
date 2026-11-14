import { Link } from "react-router";
import type { Route } from "./+types/how-it-works";
import { seo } from "~/lib/seo";
import { PageHeader } from "~/components/ui/PageHeader";

export const meta: Route.MetaFunction = ({ matches }) =>
  seo(matches, {
    title: "How it works · Resonant",
    description: "Create an account, choose a starting design, add and reorder blocks, preview, publish and share your /@handle address.",
    path: "/how-it-works",
  });

const STEPS = [
  {
    title: "Create an account",
    body: (
      <>
        Go to <Link to="/signup">Sign up</Link> and choose <strong>Sign up with Google</strong>, or enter a display
        name, your email and a password of at least 10 characters. You're signed in straight away and taken to your{" "}
        <strong>Dashboard</strong>. Some deployments show email and password as <em>In development</em>; there, Google
        is the way in.
      </>
    ),
  },
  {
    title: "Choose a starting design",
    body: (
      <>
        On the Dashboard select <strong>New page</strong>. Pick your handle — the part after <code>/@</code> in your
        address — and either a template or <strong>Blank</strong>. You can also start from any template's preview page
        with <strong>Use this template</strong>.
      </>
    ),
  },
  {
    title: "Add and reorder content",
    body: (
      <>
        The editor opens with your blocks on the left. Use <strong>Add block</strong> to insert links, text, images,
        a gallery, a video, an FAQ, a callout, headings or dividers. Drag the handle to reorder, or focus a block and
        use the <strong>Move up</strong> / <strong>Move down</strong> buttons. Select a block to edit its fields. The{" "}
        <strong>Design</strong> tab changes palette, accent, type, corners, buttons, backdrop and the resonance pulse.
      </>
    ),
  },
  {
    title: "Preview",
    body: (
      <>
        The preview on the right updates as you type. Switch between <strong>Mobile</strong> and{" "}
        <strong>Desktop</strong> to check both widths. Changes save to your private draft automatically; the status
        next to the page name shows <strong>Saving…</strong>, <strong>Saved</strong> or any problems to fix.
      </>
    ),
  },
  {
    title: "Publish",
    body: (
      <>
        Select <strong>Publish</strong>. The draft is checked once more, then becomes your live page. Later edits stay
        in the draft until you publish again. <strong>Unpublish</strong> takes the page offline at any time.
      </>
    ),
  },
  {
    title: "Share your address",
    body: (
      <>
        Your page is at <code>/@yourhandle</code> on this site. Copy it from the editor's <strong>Page</strong> tab or
        the Dashboard and add it to your bios, email signature or business card. Check{" "}
        <strong>Analytics</strong> from the Dashboard to see daily views and clicks.
      </>
    ),
  },
];

export default function HowItWorks() {
  return (
    <>
      <PageHeader eyebrow="How it works" title={<>From sign-up to <span className="serif-accent">shared link.</span></>}>
        Six steps, using the same names you'll see in the app.
      </PageHeader>
      <ol className="wrap-narrow py-16 grid gap-0">
        {STEPS.map((step, i) => (
          <li key={step.title} className="relative grid grid-cols-[3.5rem_1fr] gap-4 pb-12 last:pb-0">
            {i < STEPS.length - 1 ? (
              <span aria-hidden="true" className="absolute left-[1.15rem] top-11 bottom-1 w-px bg-line-strong" />
            ) : null}
            <span className="grid size-[2.35rem] place-items-center rounded-full border border-volt/50 font-mono text-sm text-volt">
              {i + 1}
            </span>
            <div className="prose-plain pt-1">
              <h2 className="!mt-0 !text-2xl">{step.title}</h2>
              <p>{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="wrap-narrow flex flex-wrap gap-3">
        <Link to="/signup" className="btn btn-volt">Start step one</Link>
        <Link to="/templates" className="btn btn-ghost">Look at templates first</Link>
      </div>
    </>
  );
}
