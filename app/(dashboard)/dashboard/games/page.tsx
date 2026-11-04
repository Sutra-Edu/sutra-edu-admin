"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import api, { errorMessage } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/lib/hooks";
import { P } from "@/lib/permissions";
import { Alert, Badge, Button, Field, Input, Modal, PageHeader, Select, StatusBadge, Textarea } from "@/components/ui";
import { ResourceEditor, Tabs, opts } from "@/components/resource-editor";

type Any = Record<string, unknown> & { id: string };
const TYPES = ["MCQ_RUSH", "ORDERING", "MAP_PIN", "NUMERIC", "MATCHING", "BRANCHING", "LAB_PROCEDURE", "SIMULATION"];
const STATUSES = ["DRAFT", "IN_REVIEW", "APPROVED", "REJECTED", "ARCHIVED"];

export default function GamesPage() {
  const { can } = useAuth();
  const canEdit = can(P.MANAGE_GAMES);
  const [tab, setTab] = useState<"games" | "content">("content");
  const [status, setStatus] = useState("");
  const [draft, setDraft] = useState(false);

  return (
    <>
      <PageHeader title="Games" description="Game types and the rounds students play. Autopilot drafts rounds for every topic; anything edited here goes back to review."
        actions={canEdit && <Button onClick={() => setDraft(true)}><Sparkles className="w-4 h-4" /> AI draft for a topic</Button>} />
      <Tabs tabs={[{ key: "content", label: "Rounds" }, { key: "games", label: "Game types" }]} value={tab} onChange={setTab} />
      {tab === "games" && (
        <ResourceEditor<Any>
          title="Game types" listPath="/admin/games" createPath="/admin/games" updatePath={(r) => `/admin/games/${r.id}`} canEdit={canEdit}
          defaults={{ isActive: true, config: { itemsPerRound: 10, timeLimitSec: 20, pointsPerItem: 10 } }}
          fields={[
            { key: "key", label: "Key", type: "text", required: true, createOnly: true, placeholder: "timeline-battle" },
            { key: "name", label: "Name", type: "text", required: true },
            { key: "description", label: "Description", type: "textarea" },
            { key: "type", label: "Engine", type: "select", required: true, options: opts(TYPES), createOnly: true },
            { key: "config", label: "Config (JSON)", type: "json", hint: '{"itemsPerRound", "timeLimitSec", "pointsPerItem", "sessionTtlMin", "shuffle"}' },
            { key: "sortOrder", label: "Sort order", type: "number" },
            { key: "isActive", label: "Active", type: "checkbox" },
          ]}
          columns={[
            { label: "Game", render: (r) => <><div className="font-medium">{String(r.name)}</div><div className="text-xs text-slate-500">{String(r.key)}</div></> },
            { label: "Engine", render: (r) => <span className="text-xs">{String(r.type).replace(/_/g, " ").toLowerCase()}</span> },
            { label: "Rounds", render: (r) => String((r._count as { contents?: number })?.contents ?? 0) },
            { label: "Plays", render: (r) => String((r._count as { sessions?: number })?.sessions ?? 0) },
            { label: "", render: (r) => <Badge color={r.isActive ? "green" : "gray"}>{r.isActive ? "active" : "off"}</Badge> },
          ]}
        />
      )}
      {tab === "content" && (
        <>
          <div className="mb-4 w-56">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Every status</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ").toLowerCase()}</option>)}
            </Select>
          </div>
          <ResourceEditor<Any>
            key={status}
            title="Rounds" description="Edit the questions as JSON (shapes are listed under GET /admin/games/schema). Approve them in the Review queue."
            listPath={`/admin/games/content/list${status ? `?status=${status}` : ""}`} createPath="/admin/games/content" updatePath={(r) => `/admin/games/content/${r.id}`}
            canEdit={false}
            fields={[]}
            columns={[
              { label: "Round", render: (r) => <div className="font-medium">{String(r.title)}</div> },
              { label: "Game", render: (r) => String((r.game as { name: string }).name) },
              { label: "Topic", render: (r) => String((r.topic as { title: string } | null)?.title ?? "—") },
              { label: "Level", render: (r) => `${r.difficulty}/5 · ${r.language}` },
              { label: "Status", render: (r) => <StatusBadge status={String(r.status)} /> },
            ]}
            extraActions={(r, reload) => canEdit ? <RoundEditor id={r.id} onDone={reload} /> : null}
          />
        </>
      )}
      {draft && <DraftModal onClose={() => setDraft(false)} />}
    </>
  );
}

function RoundEditor({ id, onDone }: { id: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const detail = useApi<{ title: string; payload: unknown; status: string } | null>(open ? `/admin/games/content/${id}` : null, null);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const value = text ?? (detail.data ? JSON.stringify(detail.data.payload, null, 2) : "");
  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      setOpen(false);
      setText(null);
      onDone();
    } catch (err) {
      setError(err instanceof SyntaxError ? "Not valid JSON" : errorMessage(err));
    }
  };
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>Edit</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={detail.data?.title ?? "Round"} wide
        footer={<>
          <Button variant="secondary" onClick={() => act(() => api.post(`/admin/games/content/${id}/archive`))}>Archive</Button>
          <Button variant="secondary" onClick={() => act(() => api.post(`/admin/games/content/${id}/submit`))}>Send to review</Button>
          <Button onClick={() => act(() => api.patch(`/admin/games/content/${id}`, { payload: JSON.parse(value) }))}>Save questions</Button>
        </>}>
        <div className="space-y-3">
          <Textarea rows={18} className="font-mono text-xs" value={value} onChange={(e) => setText(e.target.value)} />
          {error && <Alert>{error}</Alert>}
        </div>
      </Modal>
    </>
  );
}

function DraftModal({ onClose }: { onClose: () => void }) {
  const games = useApi<Any[]>("/admin/games", []);
  const [form, setForm] = useState({ gameId: "", topicId: "", count: "8", difficulty: "2", language: "en" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const run = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await api.post("/admin/games/content/generate", { gameId: form.gameId, topicId: form.topicId.trim(), count: Number(form.count), difficulty: Number(form.difficulty), language: form.language });
      setMsg({ kind: "success", text: "Drafted. Open it under Rounds (status draft), check it and send it to review." });
    } catch (err) {
      setMsg({ kind: "error", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title="AI draft a round" footer={<><Button variant="secondary" onClick={onClose}>Close</Button><Button loading={busy} disabled={!form.gameId || !form.topicId.trim()} onClick={run}>Draft</Button></>}>
      <div className="space-y-4">
        <Field label="Game" required>
          <Select value={form.gameId} onChange={(e) => setForm({ ...form, gameId: e.target.value })}>
            <option value="">Choose…</option>
            {games.data.map((g) => <option key={g.id} value={g.id}>{String(g.name)}</option>)}
          </Select>
        </Field>
        <Field label="Topic id" required hint="From Curriculum → syllabus → topic"><Input value={form.topicId} onChange={(e) => setForm({ ...form, topicId: e.target.value })} /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Questions"><Input type="number" value={form.count} onChange={(e) => setForm({ ...form, count: e.target.value })} /></Field>
          <Field label="Difficulty 1-5"><Input type="number" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })} /></Field>
          <Field label="Language"><Input value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} /></Field>
        </div>
        {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
      </div>
    </Modal>
  );
}
