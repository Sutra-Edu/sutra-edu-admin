"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import api, { errorMessage } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/lib/hooks";
import { P } from "@/lib/permissions";
import { Alert, Badge, Button, Card, EmptyState, Input, Modal, PageHeader, Select, Spinner, StatusBadge, Table, Td, Textarea, fmtDate } from "@/components/ui";

interface Summary { topicRanges: number; assets: number; games: number; pages: number; flaggedAnswers: number; total: number }

interface Range {
  id: string;
  pageStart: number;
  pageEnd: number;
  source: string;
  status: string;
  confidence: number | null;
  reason: string | null;
  book: { id: string; code: string; title: string; files: { pageCount: number | null }[] };
  topic: { id: string; title: string; chapter: { title: string; number: number | null; offering: { board: { name: string }; class: { name: string }; subject: { name: string } } } };
}

interface Asset {
  id: string;
  kind: "TEXT" | "AUDIO" | "IMAGE" | "VIDEO";
  title: string | null;
  text: string | null;
  mimeType: string;
  pageFrom: number;
  pageTo: number;
  url: string;
  createdAt: string;
  book: { title: string };
  generation: { purpose: string; language: string; autoKey: string | null; topic: { title: string } | null };
}

interface GameContentRow {
  id: string;
  title: string;
  difficulty: number;
  language: string;
  status: string;
  source: string;
  createdAt: string;
  game: { name: string; type: string };
  topic: { title: string } | null;
}

interface FlaggedAnswer {
  id: string;
  content: string;
  source: string | null;
  citations: { type: string; bookTitle?: string; page?: number; url?: string; title?: string; quote?: string | null }[] | null;
  verification: Record<string, unknown> | null;
  flaggedBy: string | null;
  flagReason: string | null;
  createdAt: string;
  question: { content: string; inputType: string } | null;
  session: { student: { firstName: string | null; lastName: string | null }; topic: { title: string } | null };
}

type Tab = "ranges" | "assets" | "games" | "answers";

export default function ReviewPage() {
  const { can } = useAuth();
  const summary = useApi<Summary | null>("/admin/review/summary", null);
  const tabs: { key: Tab; label: string; count: number; allowed: boolean }[] = [
    { key: "ranges", label: "Topic pages", count: summary.data?.topicRanges ?? 0, allowed: can(P.VIEW_BOOKS) },
    { key: "assets", label: "AI media", count: summary.data?.assets ?? 0, allowed: can(P.REVIEW_CONTENT) },
    { key: "games", label: "Game rounds", count: summary.data?.games ?? 0, allowed: can(P.MANAGE_GAMES) },
    { key: "answers", label: "Tutor answers", count: summary.data?.flaggedAnswers ?? 0, allowed: can(P.VIEW_STUDENTS, P.REVIEW_CONTENT) },
  ];
  const visible = tabs.filter((t) => t.allowed);
  const [tab, setTab] = useState<Tab | null>(null);
  const current = tab ?? visible[0]?.key ?? null;

  return (
    <>
      <PageHeader
        title="Review queue"
        description="Everything the AI made that a person still has to check. Nothing reaches students until it is approved here."
      />
      <div className="flex flex-wrap gap-2 mb-5">
        {visible.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${current === t.key ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"}`}
          >
            {t.label} <span className={current === t.key ? "text-indigo-100" : "text-slate-400"}>{t.count}</span>
          </button>
        ))}
        {summary.data && summary.data.pages > 0 && (
          <span className="text-sm text-slate-500 self-center ml-2">{summary.data.pages} extracted pages also need review (Books → book → pages)</span>
        )}
      </div>
      {!visible.length && <EmptyState title="Nothing here for your role" description="Reviewing needs review:content, manage:books, manage:games or view:students." />}
      {current === "ranges" && <Ranges onChange={summary.reload} canEdit={can(P.MANAGE_BOOKS)} />}
      {current === "assets" && <Assets onChange={summary.reload} />}
      {current === "games" && <Games onChange={summary.reload} canReview={can(P.REVIEW_GAME_CONTENT)} />}
      {current === "answers" && <Answers onChange={summary.reload} />}
    </>
  );
}

// ---------------- Topic → page mappings ----------------

function Ranges({ onChange, canEdit }: { onChange: () => void; canEdit: boolean }) {
  const [status, setStatus] = useState("SUGGESTED");
  const list = useApi<Range[]>(`/admin/review/topic-ranges?status=${status}`, []);
  const [edits, setEdits] = useState<Record<string, { pageStart: string; pageEnd: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const decide = async (r: Range, decision: "CONFIRM" | "REJECT") => {
    setBusy(r.id);
    setError(null);
    try {
      const e = edits[r.id];
      await api.post(`/admin/review/topic-ranges/${r.id}`, {
        decision,
        ...(e ? { pageStart: Number(e.pageStart), pageEnd: Number(e.pageEnd) } : {}),
      });
      list.reload();
      onChange();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };
  const confirmAll = async () => {
    setBusy("all");
    try {
      await api.post("/admin/review/topic-ranges", { ids: list.data.map((r) => r.id), decision: "CONFIRM" });
      list.reload();
      onChange();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card
      title="Which pages teach each topic"
      actions={
        <div className="flex gap-2">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="SUGGESTED">To review</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="REJECTED">Rejected</option>
          </Select>
          {canEdit && status === "SUGGESTED" && list.data.length > 0 && (
            <Button size="sm" loading={busy === "all"} onClick={confirmAll}>Confirm all {list.data.length}</Button>
          )}
        </div>
      }
    >
      <p className="text-sm text-slate-500 mb-4">
        The AI read each book&apos;s headings and matched them to the syllabus. The tutor reads these pages, and autopilot makes each topic&apos;s content from them.
        Fix the page numbers if they are off, then confirm.
      </p>
      {error && <div className="mb-3"><Alert onClose={() => setError(null)}>{error}</Alert></div>}
      {list.loading ? <Spinner /> : !list.data.length ? (
        <EmptyState title="Nothing to review" description="New books are mapped automatically once they finish processing." />
      ) : (
        <Table head={["Topic", "Book", "Pages", "AI note", ""]}>
          {list.data.map((r) => {
            const e = edits[r.id] ?? { pageStart: String(r.pageStart), pageEnd: String(r.pageEnd) };
            const o = r.topic.chapter.offering;
            return (
              <tr key={r.id}>
                <Td>
                  <div className="font-medium text-slate-900">{r.topic.title}</div>
                  <div className="text-xs text-slate-500">Ch {r.topic.chapter.number ?? ""} {r.topic.chapter.title} · {o.board.name} {o.class.name} {o.subject.name}</div>
                </Td>
                <Td>
                  <div>{r.book.title}</div>
                  <div className="text-xs text-slate-500">{r.book.files[0]?.pageCount ?? "?"} pages</div>
                </Td>
                <Td>
                  {canEdit && status !== "CONFIRMED" ? (
                    <div className="flex items-center gap-1 w-36">
                      <Input type="number" min={1} value={e.pageStart} onChange={(ev) => setEdits({ ...edits, [r.id]: { ...e, pageStart: ev.target.value } })} />
                      <span>–</span>
                      <Input type="number" min={1} value={e.pageEnd} onChange={(ev) => setEdits({ ...edits, [r.id]: { ...e, pageEnd: ev.target.value } })} />
                    </div>
                  ) : (
                    <span>{r.pageStart}–{r.pageEnd}</span>
                  )}
                </Td>
                <Td className="text-xs text-slate-500 max-w-xs">
                  {r.confidence !== null && <Badge color={r.confidence >= 0.75 ? "green" : r.confidence >= 0.5 ? "amber" : "red"}>{Math.round(r.confidence * 100)}%</Badge>}{" "}
                  {r.reason ?? (r.source === "MANUAL" ? "Set by an admin" : "")}
                </Td>
                <Td>
                  {canEdit && status !== "CONFIRMED" && (
                    <div className="flex gap-1">
                      <Button size="sm" loading={busy === r.id} onClick={() => decide(r, "CONFIRM")}><Check className="w-3.5 h-3.5" /> Confirm</Button>
                      {status === "SUGGESTED" && <Button size="sm" variant="secondary" onClick={() => decide(r, "REJECT")}><X className="w-3.5 h-3.5" /></Button>}
                    </div>
                  )}
                </Td>
              </tr>
            );
          })}
        </Table>
      )}
    </Card>
  );
}

// ---------------- Generated media ----------------

function Preview({ a }: { a: Asset }) {
  // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived R2 link
  if (a.kind === "IMAGE") return <img src={a.url} alt={a.title ?? ""} className="max-h-64 rounded-lg border border-slate-200" />;
  if (a.kind === "AUDIO") return <audio controls src={a.url} className="w-full" />;
  if (a.kind === "VIDEO") return <video controls src={a.url} className="max-h-72 rounded-lg border border-slate-200" />;
  return <pre className="whitespace-pre-wrap text-sm text-slate-800 bg-slate-50 rounded-lg p-3 max-h-80 overflow-y-auto">{a.text}</pre>;
}

function Assets({ onChange }: { onChange: () => void }) {
  const [kind, setKind] = useState("");
  const list = useApi<Asset[]>(`/admin/review/assets?take=30${kind ? `&kind=${kind}` : ""}`, []);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const review = async (ids: string[], status: "APPROVED" | "REJECTED") => {
    setBusy(ids.length > 1 ? "all" : ids[0]);
    setError(null);
    try {
      await api.post("/admin/review/assets", { ids, status });
      list.reload();
      onChange();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card
      title="Lessons, notes, quizzes, audio, images and videos"
      actions={
        <div className="flex gap-2">
          <Select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">All kinds</option>
            <option value="TEXT">Text</option>
            <option value="AUDIO">Audio</option>
            <option value="IMAGE">Images</option>
            <option value="VIDEO">Video</option>
          </Select>
          {list.data.length > 1 && (
            <Button size="sm" loading={busy === "all"} onClick={() => review(list.data.map((a) => a.id), "APPROVED")}>Approve all {list.data.length}</Button>
          )}
        </div>
      }
    >
      <p className="text-sm text-slate-500 mb-4">Check each item against the book pages it was made from: no invented facts, right level, right language.</p>
      {error && <div className="mb-3"><Alert onClose={() => setError(null)}>{error}</Alert></div>}
      {list.loading ? <Spinner /> : !list.data.length ? (
        <EmptyState title="Nothing to review" description="Autopilot fills this as it makes content; check Setup for what it is waiting on." />
      ) : (
        <div className="space-y-4">
          {list.data.map((a) => (
            <div key={a.id} className="border border-slate-200 rounded-xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                <div>
                  <div className="font-medium text-slate-900">{a.title ?? `${a.generation.purpose} (${a.kind.toLowerCase()})`}</div>
                  <div className="text-xs text-slate-500">
                    {a.generation.topic?.title ? `${a.generation.topic.title} · ` : ""}{a.book.title} p.{a.pageFrom}–{a.pageTo} · {a.generation.purpose} · {a.generation.language}
                    {a.generation.autoKey && " · autopilot"} · {fmtDate(a.createdAt)}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" loading={busy === a.id} onClick={() => review([a.id], "APPROVED")}><Check className="w-3.5 h-3.5" /> Approve</Button>
                  <Button size="sm" variant="secondary" onClick={() => review([a.id], "REJECTED")}><X className="w-3.5 h-3.5" /> Reject</Button>
                </div>
              </div>
              <Preview a={a} />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ---------------- Game rounds ----------------

function Games({ onChange, canReview }: { onChange: () => void; canReview: boolean }) {
  const list = useApi<GameContentRow[]>("/admin/games/content/list?status=IN_REVIEW", []);
  const [open, setOpen] = useState<string | null>(null);
  const detail = useApi<{ payload: unknown } | null>(open ? `/admin/games/content/${open}` : null, null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const review = async (id: string, status: "APPROVED" | "REJECTED") => {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/admin/games/content/${id}/review`, { status, note: note.trim() || undefined });
      setOpen(null);
      setNote("");
      list.reload();
      onChange();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Game rounds drafted by the AI">
      {list.error && <Alert>{list.error}</Alert>}
      {list.loading ? <Spinner /> : !list.data.length ? (
        <EmptyState title="Nothing to review" />
      ) : (
        <Table head={["Round", "Game", "Topic", "Level", "Made", ""]}>
          {list.data.map((g) => (
            <tr key={g.id}>
              <Td className="font-medium text-slate-900">{g.title}</Td>
              <Td>{g.game.name} <span className="text-xs text-slate-500">({g.game.type.replace(/_/g, " ").toLowerCase()})</span></Td>
              <Td>{g.topic?.title ?? "—"}</Td>
              <Td>{g.difficulty}/5 · {g.language}</Td>
              <Td className="text-xs text-slate-500">{g.source === "AI_GENERATED" ? "AI" : g.source.toLowerCase()} · {fmtDate(g.createdAt)}</Td>
              <Td><Button size="sm" variant="secondary" onClick={() => setOpen(g.id)}>Open</Button></Td>
            </tr>
          ))}
        </Table>
      )}
      <Modal
        open={!!open}
        onClose={() => setOpen(null)}
        title="Check the questions and answers"
        wide
        footer={canReview && open ? (
          <>
            <Button variant="secondary" loading={busy} onClick={() => review(open, "REJECTED")}>Reject</Button>
            <Button loading={busy} onClick={() => review(open, "APPROVED")}>Approve</Button>
          </>
        ) : undefined}
      >
        {detail.loading ? <Spinner /> : (
          <div className="space-y-3">
            <pre className="whitespace-pre-wrap text-xs bg-slate-50 rounded-lg p-3 max-h-[50vh] overflow-y-auto">{JSON.stringify(detail.data?.payload ?? null, null, 2)}</pre>
            {canReview && <Textarea rows={2} placeholder="Note for the record (optional)" value={note} onChange={(e) => setNote(e.target.value)} />}
            {error && <Alert>{error}</Alert>}
          </div>
        )}
      </Modal>
    </Card>
  );
}

// ---------------- Tutor answers ----------------

function Answers({ onChange }: { onChange: () => void }) {
  const [resolved, setResolved] = useState(false);
  const list = useApi<FlaggedAnswer[]>(`/admin/review/answers?resolved=${resolved}`, []);
  const [text, setText] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const resolve = async (id: string, resolution: string) => {
    setError(null);
    try {
      await api.post(`/admin/review/answers/${id}/resolve`, { resolution });
      list.reload();
      onChange();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Card
      title="Tutor answers that failed a check or that students reported"
      actions={
        <Select value={String(resolved)} onChange={(e) => setResolved(e.target.value === "true")}>
          <option value="false">Open</option>
          <option value="true">Resolved</option>
        </Select>
      }
    >
      <p className="text-sm text-slate-500 mb-4">
        Answers are flagged when a quote doesn&apos;t match its source, when there is no citation, when moderation catches something, or when a student taps &quot;this is wrong&quot;.
        Patterns here tell you which pages need correcting or which prompts need work.
      </p>
      {error && <div className="mb-3"><Alert onClose={() => setError(null)}>{error}</Alert></div>}
      {list.loading ? <Spinner /> : !list.data.length ? <EmptyState title="Nothing flagged" /> : (
        <div className="space-y-4">
          {list.data.map((m) => (
            <div key={m.id} className="border border-slate-200 rounded-xl p-4 space-y-2">
              <div className="flex flex-wrap gap-2 items-center text-xs text-slate-500">
                <Badge color={m.flaggedBy === "student" ? "amber" : "red"}>{m.flaggedBy === "student" ? "reported by student" : "failed check"}</Badge>
                <span>{m.flagReason}</span>
                <span>· {m.session.student.firstName ?? "Student"} · {m.session.topic?.title ?? "no topic"} · {fmtDate(m.createdAt)}</span>
                {m.source && <StatusBadge status={m.source} />}
              </div>
              {m.question && <div className="text-sm"><span className="font-medium">Q{m.question.inputType !== "text" ? ` (${m.question.inputType})` : ""}:</span> {m.question.content}</div>}
              <div className="text-sm bg-slate-50 rounded-lg p-3 whitespace-pre-wrap"><span className="font-medium">A:</span> {m.content}</div>
              {!!m.citations?.length && (
                <ul className="text-xs text-slate-600 list-disc pl-5">
                  {m.citations.map((c, i) => (
                    <li key={i}>{c.type === "book" ? `${c.bookTitle} p.${c.page}` : <a className="text-indigo-600 underline" href={c.url} target="_blank" rel="noreferrer">{c.title}</a>}{c.quote ? ` — “${c.quote}”` : ""}</li>
                  ))}
                </ul>
              )}
              {!resolved && (
                <div className="flex gap-2">
                  <Input placeholder="What you did (e.g. corrected page 42; answer was fine)" value={text[m.id] ?? ""} onChange={(e) => setText({ ...text, [m.id]: e.target.value })} />
                  <Button size="sm" disabled={!(text[m.id] ?? "").trim()} onClick={() => resolve(m.id, text[m.id])}>Resolve</Button>
                  <Button size="sm" variant="secondary" onClick={() => resolve(m.id, "Answer was correct")}>Answer was fine</Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
