"use client";

import { useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw, Rocket } from "lucide-react";
import api, { errorMessage } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/lib/hooks";
import { P } from "@/lib/permissions";
import { Alert, Badge, Button, Card, EmptyState, PageHeader, ProgressBar, Spinner, Table, Td } from "@/components/ui";

interface Check { key: string; label: string; level: "ok" | "warn" | "missing"; detail: string; fix?: string; docs?: string }
interface PipelineRow {
  offeringId: string;
  name: string;
  books: number;
  booksReady: number;
  booksProcessing: number;
  pagesNeedingReview: number;
  passages: number;
  passagesEmbedded: number;
  topics: number;
  topicRanges: { confirmed: number; suggested: number; rejected: number };
  generations: Record<string, number>;
  assets: Record<string, number>;
  games: Record<string, number>;
}
interface Status {
  ready: boolean;
  counts: { ok: number; warn: number; missing: number };
  platform: Check[];
  models: Check[];
  autopilot: { enabled: boolean; mapTopics: boolean; requireConfirmedRanges: boolean };
  queue: { type: string; status: string; count: number }[];
  pipeline: PipelineRow[];
  nextSteps: string[];
}
interface PlanResult { topics: number; generationsQueued: number; gamesQueued: number; alreadyMade: number; waitingForModels: Record<string, number>; waitingForRanges: number }

const ICON = {
  ok: <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />,
  warn: <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />,
  missing: <XCircle className="w-4 h-4 text-red-600 shrink-0" />,
};

function Checks({ items }: { items: Check[] }) {
  return (
    <ul className="divide-y divide-slate-100 -my-2">
      {items.map((c) => (
        <li key={c.key} className="py-2.5 flex gap-3">
          {ICON[c.level]}
          <div className="min-w-0">
            <div className="text-sm font-medium text-slate-900">{c.label}</div>
            <div className="text-xs text-slate-500 break-words">{c.detail}</div>
            {c.level !== "ok" && c.fix && (
              <div className="text-xs text-indigo-700 mt-0.5">
                → {c.fix}
                {c.docs && <span className="text-slate-400"> (docs/SETUP.md · {c.docs})</span>}
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

const sum = (r: Record<string, number>, ...keys: string[]) => keys.reduce((a, k) => a + (r[k] ?? 0), 0);

export default function SetupPage() {
  const { can } = useAuth();
  const status = useApi<Status | null>("/admin/setup/status", null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "error" | "success" | "info"; text: string } | null>(null);

  const run = async (key: string, path: string, body: object, done: (data: never) => string) => {
    setBusy(key);
    setNotice(null);
    try {
      const { data } = await api.post(path, body);
      setNotice({ kind: "success", text: done(data as never) });
      status.reload();
    } catch (err) {
      setNotice({ kind: "error", text: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  };
  const planned = (r: PlanResult) => {
    const waiting = Object.entries(r.waitingForModels).map(([k, v]) => `${k} (${v})`).join(", ");
    return `Autopilot checked ${r.topics} topics: queued ${r.generationsQueued} media and ${r.gamesQueued} game rounds; ${r.alreadyMade} already made.` +
      (r.waitingForRanges ? ` ${r.waitingForRanges} topics have no pages yet.` : "") + (waiting ? ` Waiting for: ${waiting}.` : "");
  };

  const s = status.data;
  return (
    <>
      <PageHeader
        title="Setup"
        description="What is configured, what is missing, and how far each syllabus has got. Admins upload books and review; the AI maps topics to pages and makes the lessons, audio, images, videos and game rounds."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => status.reload()}><RefreshCw className="w-4 h-4" /> Refresh</Button>
            {can(P.UPLOAD_BOOKS) && (
              <Button variant="secondary" loading={busy === "reindex"} onClick={() => run("reindex", "/admin/setup/reindex", { mapTopics: true }, (d: { queued: number }) => `Re-indexing ${d.queued} books (passages, embeddings, topic mapping)`)}>
                Re-index books
              </Button>
            )}
            {can(P.GENERATE_CONTENT) && (
              <Button loading={busy === "autopilot"} onClick={() => run("autopilot", "/admin/setup/autopilot/run", {}, planned)}>
                <Rocket className="w-4 h-4" /> Run autopilot
              </Button>
            )}
          </div>
        }
      />
      {notice && <div className="mb-4"><Alert kind={notice.kind} onClose={() => setNotice(null)}>{notice.text}</Alert></div>}
      {status.error && <Alert>{status.error}</Alert>}
      {!s && status.loading && <Spinner />}
      {s && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card><div className="text-3xl font-semibold text-emerald-600">{s.counts.ok}</div><div className="text-sm text-slate-500">ready</div></Card>
            <Card><div className="text-3xl font-semibold text-amber-500">{s.counts.warn}</div><div className="text-sm text-slate-500">optional or not for production</div></Card>
            <Card><div className="text-3xl font-semibold text-red-600">{s.counts.missing}</div><div className="text-sm text-slate-500">missing</div></Card>
          </div>

          {s.nextSteps.length > 0 && (
            <Card title="Next steps">
              <ol className="list-decimal pl-5 space-y-1 text-sm text-slate-700">
                {s.nextSteps.map((n, i) => <li key={i}>{n}</li>)}
              </ol>
            </Card>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Services"><Checks items={s.platform} /></Card>
            <Card title="AI models" actions={<Badge color={s.autopilot.enabled ? "green" : "gray"}>autopilot {s.autopilot.enabled ? "on" : "off"}</Badge>}>
              <Checks items={s.models} />
            </Card>
          </div>

          <Card title="Content pipeline per syllabus">
            {!s.pipeline.length ? (
              <EmptyState title="No syllabus has a book yet" description="Upload a book for a board, class and subject to start." />
            ) : (
              <Table head={["Syllabus", "Books", "Search", "Topics → pages", "AI media", "Game rounds"]}>
                {s.pipeline.map((p) => {
                  const mapped = p.topicRanges.confirmed + p.topicRanges.suggested;
                  return (
                    <tr key={p.offeringId}>
                      <Td className="font-medium text-slate-900">{p.name}</Td>
                      <Td>
                        {p.booksReady}/{p.books} ready
                        {p.booksProcessing > 0 && <div className="text-xs text-indigo-600">{p.booksProcessing} processing</div>}
                        {p.pagesNeedingReview > 0 && <div className="text-xs text-amber-600">{p.pagesNeedingReview} pages need review</div>}
                      </Td>
                      <Td>
                        {p.passages} passages
                        <div className="text-xs text-slate-500">{p.passages ? Math.round((p.passagesEmbedded / p.passages) * 100) : 0}% embedded</div>
                      </Td>
                      <Td className="min-w-40">
                        <ProgressBar value={p.topics ? Math.min(100, (p.topicRanges.confirmed / p.topics) * 100) : 0} />
                        <div className="text-xs text-slate-500 mt-1">{p.topicRanges.confirmed} confirmed · {p.topicRanges.suggested} to review · {p.topics} topics</div>
                        {mapped === 0 && p.booksReady > 0 && <div className="text-xs text-amber-600">not mapped yet</div>}
                      </Td>
                      <Td>
                        <div className="text-xs space-y-0.5">
                          <div>{sum(p.generations, "QUEUED", "RUNNING")} in progress · {p.generations.FAILED ?? 0} failed</div>
                          <div>{p.assets.PENDING_REVIEW ?? 0} to review · {p.assets.APPROVED ?? 0} live</div>
                        </div>
                      </Td>
                      <Td>
                        <div className="text-xs space-y-0.5">
                          <div>{p.games.IN_REVIEW ?? 0} to review</div>
                          <div>{p.games.APPROVED ?? 0} live</div>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </Table>
            )}
          </Card>

          {s.queue.length > 0 && (
            <Card title="Background work">
              <div className="flex flex-wrap gap-2">
                {s.queue.map((q) => (
                  <Badge key={`${q.type}-${q.status}`} color={q.status === "DEAD" || q.status === "FAILED" ? "red" : "blue"}>
                    {q.type.replace(/_/g, " ").toLowerCase()} · {q.status.toLowerCase()} · {q.count}
                  </Badge>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
