import { useEffect, useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ExternalLink,
  ImagePlus,
  LoaderCircle,
  Mail,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";

const ACTIVE_KEY = "patch.activeRepair";
const DEMO_DESCRIPTION = "My bedroom doorknob is broken. The handle turns but the door won’t open properly.";

type RepairView = NonNullable<ReturnType<typeof useRepair>>;

function useRepair(publicId: string | null) {
  return useQuery(api.repairs.getByPublicId, publicId ? { publicId } : "skip");
}

export default function App() {
  const [publicId, setPublicId] = useState<string | null>(() => {
    const fromUrl = new URLSearchParams(location.search).get("repair");
    return fromUrl || localStorage.getItem(ACTIVE_KEY);
  });
  const repair = useRepair(publicId);

  useEffect(() => {
    if (!publicId) return;
    localStorage.setItem(ACTIVE_KEY, publicId);
    const url = new URL(location.href);
    url.searchParams.set("repair", publicId);
    history.replaceState(null, "", url);
  }, [publicId]);

  function leaveRepair() {
    localStorage.removeItem(ACTIVE_KEY);
    const url = new URL(location.href);
    url.searchParams.delete("repair");
    history.replaceState(null, "", url);
    setPublicId(null);
  }

  if (publicId && repair === undefined) return <LoadingPage />;
  if (publicId && repair === null) {
    localStorage.removeItem(ACTIVE_KEY);
    return <NotFound onHome={leaveRepair} />;
  }
  return repair ? <RepairPage repair={repair} onHome={leaveRepair} /> : <Home onCreated={setPublicId} />;
}

function Shell({ children, onHome }: { children: React.ReactNode; onHome?: () => void }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand-button" onClick={onHome} aria-label="Patch home">
          <span className="brand-mark">P</span><span>Patch</span>
        </button>
        <span className="topbar-note">Repairs without the phone chase.</span>
      </header>
      {children}
      <footer><span>Patch</span><span>You choose who takes the job.</span></footer>
    </div>
  );
}

function Home({ onCreated }: { onCreated: (publicId: string) => void }) {
  const [reporting, setReporting] = useState(false);
  return (
    <Shell>
      {reporting ? (
        <ReportForm onCancel={() => setReporting(false)} onCreated={onCreated} />
      ) : (
        <main className="home">
          <section className="hero">
            <div className="hero-copy">
              <p className="eyebrow"><span className="eyebrow-dot" /> Home repairs, sorted</p>
              <h1>Something<br /><em>broke?</em></h1>
              <p className="hero-lede">Tell Patch what happened. We’ll ask nearby repair people for their real price and time, then bring the answers back here.</p>
              <button className="button button--primary button--large" onClick={() => setReporting(true)}>
                Tell Patch what broke <ArrowRight size={19} />
              </button>
              <p className="under-button">No calls. No account needed for repair people. You decide.</p>
            </div>
            <div className="hero-story" aria-label="How Patch works">
              <div className="story-question">
                <span className="story-number">01</span>
                <p>“My bedroom doorknob is stuck.”</p>
              </div>
              <div className="story-line" />
              <div className="story-answer">
                <div className="avatar">TA</div>
                <div>
                  <strong>Tunde can come today</strong>
                  <span>2 PM · ₦12,000</span>
                </div>
                <Check size={20} />
              </div>
              <p className="story-caption">A real answer from a real repair person.</p>
            </div>
          </section>
          <section className="promise-strip">
            <div><strong>01</strong><span>Tell us once</span><p>Describe the problem in your own words.</p></div>
            <div><strong>02</strong><span>We do the asking</span><p>Patch contacts people who handle that repair.</p></div>
            <div><strong>03</strong><span>Compare real answers</span><p>See their stated price and time side by side.</p></div>
          </section>
        </main>
      )}
    </Shell>
  );
}

function ReportForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (id: string) => void }) {
  const create = useMutation(api.repairs.create);
  const uploadUrl = useMutation(api.repairs.generateUploadUrl);
  const discover = useAction(api.integrations.discover);
  const [description, setDescription] = useState(DEMO_DESCRIPTION);
  const [area, setArea] = useState("Bwari, Abuja");
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      let photoId: Id<"_storage"> | undefined;
      if (photo) {
        const url = await uploadUrl();
        const result = await fetch(url, { method: "POST", headers: { "Content-Type": photo.type }, body: photo });
        if (!result.ok) throw new Error("The photo could not be uploaded. Try again without it.");
        ({ storageId: photoId } = (await result.json()) as { storageId: Id<"_storage"> });
      }
      const created = await create({ description, area, photoId });
      onCreated(created.publicId);
      void discover({ repairId: created.repairId }).catch((reason) => console.error("Discovery failed", reason));
    } catch (reason) {
      setError(humanError(reason));
      setBusy(false);
    }
  }

  return (
    <main className="report-layout">
      <section className="form-intro">
        <button className="back-button" onClick={onCancel}><ArrowLeft size={18} /> Back</button>
        <p className="eyebrow">Start a repair</p>
        <h1>What broke?</h1>
        <p>Say it the way you’d explain it to a neighbour. A photo helps, but isn’t required.</p>
      </section>
      <form className="report-form" onSubmit={submit}>
        <label>
          <span>What happened?</span>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} maxLength={1200} required autoFocus />
          <small>{description.length}/1200</small>
        </label>
        <label>
          <span>Your area</span>
          <input value={area} onChange={(event) => setArea(event.target.value)} placeholder="e.g. Bwari, Abuja" maxLength={120} required />
          <small>Area or neighbourhood is enough.</small>
        </label>
        <div className="photo-field">
          <span className="field-title">Photo <i>Optional</i></span>
          {photo ? (
            <div className="photo-picked"><ImagePlus size={20} /><span>{photo.name}</span><button type="button" onClick={() => setPhoto(null)} aria-label="Remove photo"><X size={17} /></button></div>
          ) : (
            <label className="photo-drop"><ImagePlus size={22} /><span>Add a photo</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} /></label>
          )}
        </div>
        {error && <div className="form-error">{error}</div>}
        <button className="button button--primary button--full" disabled={busy || description.trim().length < 12 || area.trim().length < 2}>
          {busy ? <><LoaderCircle className="spin" size={19} /> Starting your search…</> : <>Find people who can help <ArrowRight size={19} /></>}
        </button>
        <p className="truth-note"><ShieldCheck size={16} /> We only show a price or time after a repair person replies.</p>
      </form>
    </main>
  );
}

function RepairPage({ repair, onHome }: { repair: RepairView; onHome: () => void }) {
  const ask = useAction(api.integrations.askCandidates);
  const discover = useAction(api.integrations.discover);
  const choose = useMutation(api.repairs.choose);
  const [selected, setSelected] = useState<Set<Id<"candidates">>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentIds = useMemo(() => new Set(repair.outreach.filter((item) => item.status === "sent").map((item) => item.candidateId)), [repair.outreach]);
  const repliesByCandidate = useMemo(() => new Map(repair.replies.map((reply) => [reply.candidateId, reply])), [repair.replies]);
  const chosen = repair.candidates.find((candidate) => candidate._id === repair.chosenCandidateId);
  const chosenReply = chosen ? repliesByCandidate.get(chosen._id) : undefined;

  useEffect(() => {
    if (selected.size || repair.status !== "looking") return;
    const contactable = repair.candidates.filter((candidate) => candidate.contactEmail).map((candidate) => candidate._id);
    if (contactable.length) setSelected(new Set(contactable));
  }, [repair.candidates, repair.status, selected.size]);

  async function sendRequests() {
    setBusy(true); setError(null);
    try {
      await ask({ repairId: repair._id, candidateIds: [...selected] });
    } catch (reason) { setError(humanError(reason)); }
    finally { setBusy(false); }
  }

  async function choosePerson(candidateId: Id<"candidates">) {
    setBusy(true); setError(null);
    try { await choose({ repairId: repair._id, candidateId }); }
    catch (reason) { setError(humanError(reason)); }
    finally { setBusy(false); }
  }

  return (
    <Shell onHome={onHome}>
      <main className="repair-page">
        <section className="repair-head">
          <button className="back-button" onClick={onHome}><ArrowLeft size={18} /> Start another repair</button>
          <div className="repair-title-row">
            <div>
              <p className="eyebrow">Your repair · {repair.area}</p>
              <h1>{repair.description}</h1>
            </div>
            {repair.photoUrl && <img className="repair-photo" src={repair.photoUrl} alt="The reported repair" />}
          </div>
          <Progress status={repair.status} />
        </section>

        {repair.status === "reported" && (
          <StatePanel icon={<LoaderCircle className="spin" />} title="Getting your search ready" body="This should only take a moment." />
        )}
        {repair.status === "looking" && repair.candidates.length === 0 && !repair.discoveryCompleted && (
          <StatePanel icon={<Sparkles />} title="Finding people who handle this repair" body={`Looking for clear service evidence around ${repair.area}. We won’t treat a website as proof that anyone is available.`} />
        )}
        {repair.status === "looking" && repair.candidates.length === 0 && repair.discoveryCompleted && (
          <section className="empty-state">
            <p className="eyebrow">Search paused</p>
            <h2>{repair.integrationError ? "We couldn’t finish that search." : "We couldn’t find a strong match."}</h2>
            <p>{repair.integrationError ? repair.integrationError : `Nothing we found clearly said it handles this repair around ${repair.area}. Patch won’t pad the list with weak matches.`}</p>
            <button className="button button--ink" disabled={busy} onClick={async () => {
              setBusy(true); setError(null);
              try { await discover({ repairId: repair._id }); }
              catch (reason) { setError(humanError(reason)); }
              finally { setBusy(false); }
            }}><RefreshCw size={17} className={busy ? "spin" : ""} /> Try the search again</button>
          </section>
        )}
        {repair.status === "looking" && repair.candidates.length > 0 && <CandidatePicker />}
        {(repair.status === "waiting" || repair.status === "options_ready") && <Replies />}
        {repair.status === "chosen" && chosen && (
          <section className="done-panel">
            <span className="done-check"><Check size={28} /></span>
            <p className="eyebrow">That’s sorted</p>
            <h2>{chosen.name} is your choice.</h2>
            {chosenReply?.arrivalText && <p className="done-time">{chosenReply.arrivalText}</p>}
            <p>They shared the details below in their reply. Keep the original message handy for anything else they mentioned.</p>
            <ReplyReceipt candidate={chosen} reply={chosenReply} selected />
          </section>
        )}
        {error && <div className="page-error">{error}</div>}
      </main>
    </Shell>
  );

  function CandidatePicker() {
    const contactable = repair.candidates.filter((candidate) => candidate.contactEmail);
    return (
      <section className="content-section">
        <div className="section-heading"><div><p className="eyebrow">People found</p><h2>Who should we ask?</h2></div><p>We found service evidence on their public websites. That doesn’t mean they’re free yet—we’ll ask.</p></div>
        <div className="candidate-list">
          {repair.candidates.map((candidate) => {
            const canAsk = Boolean(candidate.contactEmail);
            const isSelected = selected.has(candidate._id);
            return (
              <article className={`candidate-row ${isSelected ? "candidate-row--selected" : ""}`} key={candidate._id}>
                <button className="candidate-select" disabled={!canAsk} onClick={() => setSelected((current) => toggleSet(current, candidate._id))} aria-label={`${isSelected ? "Remove" : "Add"} ${candidate.name}`}>
                  {isSelected && <Check size={16} />}
                </button>
                <div className="candidate-main"><h3>{candidate.name}</h3><p>{candidate.serviceEvidence}</p><a href={candidate.sourceUrl} target="_blank" rel="noreferrer">See the source <ExternalLink size={14} /></a></div>
                <span className={canAsk ? "email-found" : "email-missing"}>{canAsk ? "Email found" : "No public email"}</span>
              </article>
            );
          })}
        </div>
        {contactable.length === 0 ? (
          <div className="empty-callout"><h3>We found relevant people, but no public email.</h3><p>Try a nearby area or start another repair. Patch won’t pretend it can contact someone when it can’t.</p></div>
        ) : (
          <div className="sticky-action"><div><strong>{selected.size} {selected.size === 1 ? "person" : "people"} selected</strong><span>Each gets one ordinary email.</span></div><button className="button button--primary" disabled={busy || selected.size === 0} onClick={sendRequests}>{busy ? <LoaderCircle className="spin" size={18} /> : <Mail size={18} />} Ask for price and time</button></div>
        )}
      </section>
    );
  }

  function Replies() {
    const sent = repair.candidates.filter((candidate) => sentIds.has(candidate._id));
    const availableReplies = repair.replies.filter((reply) => reply.canTakeJob === "true");
    return (
      <section className="content-section">
        <div className="section-heading"><div><p className="eyebrow">{repair.replies.length ? "Answers are in" : "Requests sent"}</p><h2>{repair.replies.length ? "Here’s what they said." : `We’ve asked ${sent.length} ${sent.length === 1 ? "person" : "people"}.`}</h2></div><p>{repair.replies.length ? "These details come from their actual replies." : "Replies will appear here automatically. You don’t need to refresh."}</p></div>
        {repair.replies.length === 0 ? (
          <div className="waiting-panel"><div className="mail-orbit"><Mail size={24} /></div><div><strong>Waiting for a real reply</strong><p>Patch sent the request. We’ll only show a price or time when someone states it.</p></div></div>
        ) : (
          <div className="reply-list">
            {repair.replies.map((reply) => {
              const candidate = repair.candidates.find((item) => item._id === reply.candidateId);
              return candidate ? <ReplyReceipt key={reply._id} candidate={candidate} reply={reply} onChoose={reply.canTakeJob === "true" ? () => choosePerson(candidate._id) : undefined} disabled={busy} /> : null;
            })}
          </div>
        )}
        {availableReplies.length > 0 && <p className="choice-footnote">You make the final choice. Patch never hires or pays anyone for you.</p>}
      </section>
    );
  }
}

function Progress({ status }: { status: string }) {
  const steps = ["Reported", "Finding people", "Waiting for replies", "Choose"];
  const active = status === "reported" ? 0 : status === "looking" ? 1 : status === "waiting" ? 2 : 3;
  return <ol className="progress">{steps.map((step, index) => <li className={index <= active ? "active" : ""} key={step}><span>{index < active ? <Check size={13} /> : index + 1}</span>{step}</li>)}</ol>;
}

function ReplyReceipt({ candidate, reply, onChoose, disabled, selected }: { candidate: RepairView["candidates"][number]; reply?: RepairView["replies"][number]; onChoose?: () => void; disabled?: boolean; selected?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!reply) return null;
  const price = reply.priceAmount !== undefined ? formatMoney(reply.priceAmount, reply.currency) : null;
  return (
    <article className={`reply-card ${selected ? "reply-card--chosen" : ""}`}>
      <div className="reply-top"><div className="avatar">{initials(candidate.name)}</div><div><h3>{candidate.name}</h3><span>{reply.canTakeJob === "true" ? "Can take the job" : reply.canTakeJob === "false" ? "Can’t take this one" : "Reply needs a closer look"}</span></div>{selected && <span className="chosen-label"><Check size={14} /> Chosen</span>}</div>
      <div className="reply-facts">
        <div><span>When</span><strong>{reply.arrivalText || "Not stated"}</strong></div>
        <div><span>Price</span><strong>{price || "Not stated"}</strong></div>
      </div>
      {reply.note && <p className="reply-note">{reply.note}</p>}
      <button className="original-toggle" onClick={() => setOpen((value) => !value)}>Original reply <ChevronDown className={open ? "rotate" : ""} size={16} /></button>
      {open && <blockquote>{reply.rawText}</blockquote>}
      {onChoose && <button className="button button--ink button--full" onClick={onChoose} disabled={disabled}>Choose {candidate.name.split(" ")[0]} <ArrowRight size={18} /></button>}
    </article>
  );
}

function StatePanel({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return <section className="state-panel"><div className="state-icon">{icon}</div><div><h2>{title}</h2><p>{body}</p></div></section>;
}

function LoadingPage() { return <div className="loading-page"><div className="brand"><span className="brand-mark">P</span>Patch</div><LoaderCircle className="spin" /></div>; }
function NotFound({ onHome }: { onHome: () => void }) { return <Shell><main className="not-found"><h1>This repair isn’t here anymore.</h1><button className="button button--primary" onClick={onHome}>Start a repair</button></main></Shell>; }

function toggleSet<T>(current: Set<T>, value: T) {
  const next = new Set(current);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}
function initials(name: string) { return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
function formatMoney(amount: number, currency?: string) { try { return new Intl.NumberFormat("en-NG", { style: "currency", currency: currency || "NGN", maximumFractionDigits: 0 }).format(amount); } catch { return `${currency || "NGN"} ${amount.toLocaleString()}`; } }
function humanError(reason: unknown) { const raw = reason instanceof Error ? reason.message : "Something went wrong. Please try again."; return raw.replace(/^\[CONVEX[^\]]*\]\s*/, "").replace(/Uncaught Error:\s*/, "").split("\n")[0]; }
