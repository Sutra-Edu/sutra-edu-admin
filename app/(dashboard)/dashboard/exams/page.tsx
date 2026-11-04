"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import api, { errorMessage } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { Alert, Button, Card, Checkbox, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, StatusBadge, Table, Td, Textarea, fmtDate, fullName } from "@/components/ui";

interface Suggestion {
  transcript: string;
  questions: { question: string; marks: number; outOf: number | null; comment: string }[];
  totalMarks: number;
  outOf: number | null;
  overall: string;
  model: string;
}
interface Row {
  id: string;
  title: string;
  status: string;
  marks: number | null;
  maxMarks: number | null;
  createdAt: string;
  aiSuggestion: Suggestion | null;
  student: { firstName: string | null; lastName: string | null; board: { name: string } | null; academicClass: { name: string } | null };
}
interface Detail extends Row {
  questionText: string | null;
  feedback: string | null;
  files: { url: string; mimeType: string; page: number }[];
}

export default function ExamsPage() {
  const [status, setStatus] = useState("SUBMITTED");
  const list = useApi<Row[]>(`/admin/exams${status ? `?status=${status}` : ""}`, []);
  const [open, setOpen] = useState<string | null>(null);

  return (
    <>
      <PageHeader title="Exam marking" description="Handwritten answer sheets students uploaded. The AI reads them and suggests marks per question; you decide." />
      <Card title="Answer sheets" actions={
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="SUBMITTED">New</option>
          <option value="IN_REVIEW">Opened</option>
          <option value="GRADED">Marked</option>
          <option value="RETURNED">Sent back</option>
          <option value="">All</option>
        </Select>
      }>
        {list.error && <Alert>{list.error}</Alert>}
        {list.loading ? <Spinner /> : !list.data.length ? <EmptyState title="Nothing to mark" /> : (
          <Table head={["Exam", "Student", "Uploaded", "AI suggests", "Marks", ""]}>
            {list.data.map((r) => (
              <tr key={r.id}>
                <Td className="font-medium text-slate-900">{r.title}</Td>
                <Td>{fullName(r.student)}<div className="text-xs text-slate-500">{r.student.board?.name} {r.student.academicClass?.name}</div></Td>
                <Td className="text-xs">{fmtDate(r.createdAt)}</Td>
                <Td className="text-xs">{r.aiSuggestion ? `${r.aiSuggestion.totalMarks}${r.aiSuggestion.outOf ? `/${r.aiSuggestion.outOf}` : ""}` : "—"}</Td>
                <Td>{r.marks !== null ? `${r.marks}${r.maxMarks ? `/${r.maxMarks}` : ""}` : <StatusBadge status={r.status} />}</Td>
                <Td><Button size="sm" onClick={() => setOpen(r.id)}>{r.status === "GRADED" ? "View" : "Mark"}</Button></Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      {open && <MarkModal id={open} onClose={() => { setOpen(null); list.reload(); }} />}
    </>
  );
}

function MarkModal({ id, onClose }: { id: string; onClose: () => void }) {
  const detail = useApi<Detail | null>(`/admin/exams/${id}`, null);
  const d = detail.data;
  const [form, setForm] = useState<{ marks: string; maxMarks: string; feedback: string; redo: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "success" | "info"; text: string } | null>(null);
  const f = form ?? (d ? { marks: String(d.marks ?? d.aiSuggestion?.totalMarks ?? ""), maxMarks: String(d.maxMarks ?? d.aiSuggestion?.outOf ?? ""), feedback: d.feedback ?? d.aiSuggestion?.overall ?? "", redo: false } : null);

  const save = async () => {
    if (!f) return;
    setBusy(true);
    try {
      await api.post(`/admin/exams/${id}/grade`, {
        marks: Number(f.marks), ...(f.maxMarks ? { maxMarks: Number(f.maxMarks) } : {}), feedback: f.feedback || undefined, returnForRedo: f.redo,
      });
      onClose();
    } catch (err) {
      setMsg({ kind: "error", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };
  const resuggest = async () => {
    try {
      await api.post(`/admin/exams/${id}/suggest`);
      setMsg({ kind: "info", text: "The AI is reading the sheets again; reopen in a minute." });
    } catch (err) {
      setMsg({ kind: "error", text: errorMessage(err) });
    }
  };

  return (
    <Modal open onClose={onClose} title={d?.title ?? "Answer sheet"} wide
      footer={<><Button variant="secondary" onClick={onClose}>Close</Button><Button loading={busy} disabled={!f?.marks} onClick={save}>{f?.redo ? "Send back" : "Save marks"}</Button></>}>
      {!d || !f ? <Spinner /> : (
        <div className="space-y-5">
          <div className="text-sm text-slate-600">{fullName(d.student)} · uploaded {fmtDate(d.createdAt)}</div>
          {d.questionText && <div><div className="text-xs font-semibold uppercase text-slate-500 mb-1">Question paper</div><pre className="whitespace-pre-wrap text-sm bg-slate-50 rounded-lg p-3">{d.questionText}</pre></div>}
          <div className="grid gap-3 sm:grid-cols-2">
            {d.files.map((file) => file.mimeType.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived R2 link
              <a key={file.page} href={file.url} target="_blank" rel="noreferrer"><img src={file.url} alt={`Page ${file.page}`} className="rounded-lg border border-slate-200 w-full" /></a>
            ) : (
              <a key={file.page} href={file.url} target="_blank" rel="noreferrer" className="text-indigo-600 underline text-sm">Page {file.page} (PDF)</a>
            ))}
          </div>
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-indigo-900"><Sparkles className="w-4 h-4" /> AI suggestion</div>
              <Button size="sm" variant="secondary" onClick={resuggest}>Ask again</Button>
            </div>
            {!d.aiSuggestion ? <div className="text-sm text-slate-500">Not ready (needs VISION and LLM models), or still being read.</div> : (
              <>
                <ul className="text-sm space-y-1">
                  {d.aiSuggestion.questions.map((q, i) => (
                    <li key={i}><span className="font-medium">{q.question}</span>: {q.marks}{q.outOf ? `/${q.outOf}` : ""} — <span className="text-slate-600">{q.comment}</span></li>
                  ))}
                </ul>
                <div className="text-sm"><span className="font-medium">Total:</span> {d.aiSuggestion.totalMarks}{d.aiSuggestion.outOf ? `/${d.aiSuggestion.outOf}` : ""} · {d.aiSuggestion.overall}</div>
                <details className="text-xs text-slate-600"><summary className="cursor-pointer">What the AI read</summary><pre className="whitespace-pre-wrap mt-2">{d.aiSuggestion.transcript}</pre></details>
              </>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Marks" required><Input type="number" min={0} value={f.marks} onChange={(e) => setForm({ ...f, marks: e.target.value })} /></Field>
            <Field label="Out of"><Input type="number" min={1} value={f.maxMarks} onChange={(e) => setForm({ ...f, maxMarks: e.target.value })} /></Field>
          </div>
          <Field label="Feedback for the student"><Textarea rows={4} value={f.feedback} onChange={(e) => setForm({ ...f, feedback: e.target.value })} /></Field>
          <Checkbox label="Send it back to redo" checked={f.redo} onChange={(e) => setForm({ ...f, redo: e.target.checked })} />
          {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
        </div>
      )}
    </Modal>
  );
}
