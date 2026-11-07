"use client";

import { useState } from "react";
import { Check, Sparkles, X } from "lucide-react";
import api, { errorMessage } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/lib/hooks";
import { P } from "@/lib/permissions";
import { Alert, Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, StatusBadge, Table, Td, Textarea } from "@/components/ui";
import { FieldDef, ResourceEditor, Tabs } from "@/components/resource-editor";

type Any = Record<string, unknown> & { id: string };
type Tab = "questions" | "tests" | "categories" | "reports" | "certificates";

const questionFields: FieldDef[] = [
  { key: "topicId", label: "Topic id", type: "text", hint: "Or chapterId / offeringId for wider questions" },
  { key: "chapterId", label: "Chapter id", type: "text" },
  { key: "type", label: "Type", type: "select", required: true, options: [{ value: "mcq", label: "Single answer" }, { value: "multi", label: "Several answers" }, { value: "numeric", label: "Number" }, { value: "truefalse", label: "True / false" }] },
  { key: "stem", label: "Question", type: "textarea", required: true },
  { key: "options", label: "Options (JSON list)", type: "json", hint: '["first", "second", "third", "fourth"]' },
  { key: "answer", label: "Answer (JSON)", type: "json", required: true, hint: "mcq: 1 (index from 0) · multi: [0, 2] · numeric: 9.8 · truefalse: true" },
  { key: "hint", label: "Hint", type: "text" },
  { key: "explanation", label: "Explanation", type: "textarea" },
  { key: "difficulty", label: "Difficulty", type: "select", options: [{ value: "easy", label: "easy" }, { value: "medium", label: "medium" }, { value: "hard", label: "hard" }] },
  { key: "metadata", label: "Extra (JSON)", type: "json", hint: 'numeric: {"tolerance": 0.1}' },
];

export default function AssessmentsPage() {
  const { can } = useAuth();
  const canEdit = can(P.MANAGE_ASSESSMENTS);
  const [tab, setTab] = useState<Tab>("questions");
  const categories = useApi<Any[]>("/admin/assessments/categories", []);
  const triggers = useApi<{ trigger: string; note: string }[]>(tab === "certificates" ? "/admin/gamification/triggers" : null, []);

  return (
    <>
      <PageHeader title="Tests & assessments" description="The question bank (AI drafts, teachers approve), exam categories and tests students see on the Examination screen, error reports and certificates." />
      <Tabs tabs={[
        { key: "questions", label: "Question bank" }, { key: "tests", label: "Tests" }, { key: "categories", label: "Exam categories" },
        { key: "reports", label: "Error reports" }, { key: "certificates", label: "Certificates" },
      ]} value={tab} onChange={setTab} />
      {tab === "questions" && <Questions canEdit={canEdit} />}
      {tab === "tests" && (
        <ResourceEditor<Any>
          title="Tests" description="Fixed tests use the questions you pick (Questions button). Adaptive tests draw approved questions from the chosen topics / chapters / syllabus, harder or easier as the student answers."
          listPath="/admin/assessments/tests" createPath="/admin/assessments/tests" updatePath={(r) => `/admin/assessments/tests/${r.id}`}
          canEdit={canEdit} defaults={{ mode: "adaptive", questionCount: 10, passPercent: 40, showHints: true, status: "DRAFT" }}
          fields={[
            { key: "title", label: "Title", type: "text", required: true },
            { key: "description", label: "Description", type: "textarea" },
            { key: "categoryId", label: "Category", type: "select", options: categories.data.map((c) => ({ value: c.id, label: String(c.name) })) },
            { key: "mode", label: "Mode", type: "select", options: [{ value: "fixed", label: "Fixed questions" }, { value: "adaptive", label: "Adaptive" }] },
            { key: "offeringId", label: "Syllabus (offering) id", type: "text" },
            { key: "boardId", label: "Only for board id", type: "text" },
            { key: "classId", label: "Only for class id", type: "text" },
            { key: "topicIds", label: "Topic ids (one per line)", type: "list" },
            { key: "chapterIds", label: "Chapter ids (one per line)", type: "list" },
            { key: "questionCount", label: "Questions (adaptive)", type: "number" },
            { key: "durationMin", label: "Time limit (minutes)", type: "number" },
            { key: "startsAt", label: "Opens at", type: "datetime" },
            { key: "endsAt", label: "Closes at", type: "datetime" },
            { key: "passPercent", label: "Pass mark %", type: "number" },
            { key: "showHints", label: "Hints allowed", type: "checkbox" },
            { key: "isPremium", label: "Paid plans only", type: "checkbox" },
            { key: "status", label: "Status", type: "select", options: [{ value: "DRAFT", label: "draft" }, { value: "PUBLISHED", label: "published" }, { value: "ARCHIVED", label: "archived" }] },
          ]}
          columns={[
            { label: "Test", render: (r) => <><div className="font-medium">{String(r.title)}</div><div className="text-xs text-slate-500">{String((r.category as { name: string } | null)?.name ?? "No category")} · {String(r.mode)}</div></> },
            { label: "Questions", render: (r) => r.mode === "fixed" ? String((r._count as { questions: number }).questions) : String(r.questionCount) },
            { label: "Opens", render: (r) => <span className="text-xs">{r.startsAt ? new Date(String(r.startsAt)).toLocaleString() : "any time"}</span> },
            { label: "Attempts", render: (r) => String((r._count as { attempts: number }).attempts) },
            { label: "", render: (r) => <StatusBadge status={String(r.status)} /> },
          ]}
          extraActions={(r) => r.mode === "fixed" && canEdit ? <TestQuestions testId={r.id} /> : null}
        />
      )}
      {tab === "categories" && (
        <ResourceEditor<Any>
          title="Exam categories" description="The cards on the Examination screen (Weekly, Monthly, Quarterly, Half-yearly, Board mock…)."
          listPath="/admin/assessments/categories" createPath="/admin/assessments/categories" updatePath={(r) => `/admin/assessments/categories/${r.id}`}
          canEdit={canEdit} defaults={{ isActive: true }}
          fields={[
            { key: "code", label: "Code", type: "text", required: true, createOnly: true },
            { key: "name", label: "Name", type: "text", required: true },
            { key: "description", label: "Description", type: "textarea" },
            { key: "level", label: "Level label", type: "text", hint: "Beginner, Intermediate, Advanced, High stakes…" },
            { key: "icon", label: "Icon", type: "text" },
            { key: "color", label: "Colour", type: "text" },
            { key: "isPremium", label: "Paid plans only", type: "checkbox" },
            { key: "sortOrder", label: "Order", type: "number" },
            { key: "isActive", label: "Active", type: "checkbox" },
          ]}
          columns={[
            { label: "Category", render: (r) => <><div className="font-medium">{String(r.name)}</div><div className="text-xs text-slate-500">{String(r.description ?? "")}</div></> },
            { label: "Level", render: (r) => <Badge>{String(r.level ?? "—")}</Badge> },
            { label: "Tests", render: (r) => String((r._count as { tests: number }).tests) },
            { label: "", render: (r) => r.isPremium ? <Badge color="amber">premium</Badge> : null },
          ]}
        />
      )}
      {tab === "reports" && <Reports />}
      {tab === "certificates" && (
        <ResourceEditor<Any>
          title="Certificate templates" description="A certificate is issued when the event happens and the conditions match. {field} in the title is filled from the event (e.g. {title} for tests)."
          listPath="/admin/assessments/certificate-templates" createPath="/admin/assessments/certificate-templates" updatePath={(r) => `/admin/assessments/certificate-templates/${r.id}`}
          canEdit={can(P.MANAGE_GAMIFICATION)} defaults={{ isActive: true }}
          fields={[
            { key: "code", label: "Code", type: "text", required: true, createOnly: true },
            { key: "title", label: "Title", type: "text", required: true },
            { key: "description", label: "Description", type: "text" },
            { key: "trigger", label: "When", type: "select", required: true, options: triggers.data.map((t) => ({ value: t.trigger, label: `${t.trigger} — ${t.note}` })) },
            { key: "conditions", label: "Conditions (JSON)", type: "json", hint: '{"minPercent": 75}' },
            { key: "isActive", label: "Active", type: "checkbox" },
          ]}
          columns={[
            { label: "Certificate", render: (r) => <><div className="font-medium">{String(r.title)}</div><div className="text-xs text-slate-500">{String(r.trigger)}</div></> },
            { label: "Issued", render: (r) => String((r._count as { certificates: number }).certificates) },
          ]}
        />
      )}
    </>
  );
}

function Questions({ canEdit }: { canEdit: boolean }) {
  const [status, setStatus] = useState("IN_REVIEW");
  const [topicId, setTopicId] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [key, setKey] = useState(0);
  const review = async (ids: string[], s: "APPROVED" | "REJECTED") => {
    try {
      await api.post("/admin/assessments/questions/review", { ids, status: s });
      setKey(key + 1);
    } catch (err) {
      setMsg({ kind: "error", text: errorMessage(err) });
    }
  };
  const qs = new URLSearchParams({ ...(status && { status }), ...(topicId.trim() && { topicId: topicId.trim() }) }).toString();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            {["IN_REVIEW", "APPROVED", "REJECTED", ""].map((s) => <option key={s} value={s}>{s ? s.replace("_", " ").toLowerCase() : "all"}</option>)}
          </Select>
        </Field>
        <Field label="Topic id"><Input value={topicId} onChange={(e) => setTopicId(e.target.value)} placeholder="all topics" /></Field>
        {canEdit && <Button onClick={() => setDrafting(true)}><Sparkles className="w-4 h-4" /> AI draft for a topic</Button>}
      </div>
      {msg && <Alert kind={msg.kind} onClose={() => setMsg(null)}>{msg.text}</Alert>}
      <ResourceEditor<Any>
        key={`${qs}-${key}`}
        title="Questions" description="Autopilot drafts questions for every topic. Only approved questions are used in tests, practice and revision quizzes; editing an approved one sends it back to review."
        listPath={`/admin/assessments/questions?${qs}`} createPath="/admin/assessments/questions" updatePath={(r) => `/admin/assessments/questions/${r.id}`}
        canEdit={canEdit} defaults={{ type: "mcq", difficulty: "medium", options: ["", "", "", ""], answer: 0 }} fields={questionFields}
        columns={[
          { label: "Question", render: (r) => <><div className="text-sm text-slate-900 max-w-md">{String(r.stem)}</div><div className="text-xs text-slate-500">{(r.options as string[] | null)?.map((o, i) => `${i === r.answer ? "✓ " : ""}${o}`).join(" · ")}</div></> },
          { label: "Topic", render: (r) => <span className="text-xs">{String((r.topic as { title: string } | null)?.title ?? "—")}</span> },
          { label: "Level", render: (r) => <Badge>{String(r.difficulty ?? "")}</Badge> },
          { label: "From", render: (r) => <span className="text-xs">{String(r.source).replace("_", " ").toLowerCase()}</span> },
          { label: "", render: (r) => <StatusBadge status={String(r.status)} /> },
        ]}
        extraActions={(r) => canEdit && r.status !== "APPROVED" ? (
          <>
            <Button size="sm" onClick={() => review([r.id], "APPROVED")}><Check className="w-3.5 h-3.5" /></Button>
            <Button size="sm" variant="secondary" onClick={() => review([r.id], "REJECTED")}><X className="w-3.5 h-3.5" /></Button>
          </>
        ) : null}
      />
      {drafting && <DraftModal onClose={() => { setDrafting(false); setKey(key + 1); }} />}
    </div>
  );
}

function DraftModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ topicId: "", count: "10", language: "en" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const run = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/admin/assessments/questions/generate", { topicId: form.topicId.trim(), count: Number(form.count), language: form.language });
      setMsg({ kind: "success", text: `Drafted ${data.drafted} questions${data.skipped ? ` (${data.skipped} invalid ones skipped)` : ""}. They are waiting for review.` });
    } catch (err) {
      setMsg({ kind: "error", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title="AI draft questions" footer={<><Button variant="secondary" onClick={onClose}>Close</Button><Button loading={busy} disabled={!form.topicId.trim()} onClick={run}>Draft</Button></>}>
      <div className="space-y-4">
        <Field label="Topic id" required hint="From Curriculum → syllabus → topic"><Input value={form.topicId} onChange={(e) => setForm({ ...form, topicId: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="How many"><Input type="number" value={form.count} onChange={(e) => setForm({ ...form, count: e.target.value })} /></Field>
          <Field label="Language"><Input value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} /></Field>
        </div>
        {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
      </div>
    </Modal>
  );
}

function TestQuestions({ testId }: { testId: string }) {
  const [open, setOpen] = useState(false);
  const test = useApi<{ questions: { questionId: string; marks: number; question: { stem: string; status: string } }[] } | null>(open ? `/admin/assessments/tests/${testId}` : null, null);
  const [text, setText] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const value = text ?? (test.data ? test.data.questions.map((q) => `${q.questionId} ${q.marks}`).join("\n") : "");
  const save = async () => {
    try {
      const questions = value.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
        const [questionId, marks] = l.split(/\s+/);
        return { questionId, marks: marks ? Number(marks) : 1 };
      });
      await api.put(`/admin/assessments/tests/${testId}/questions`, { questions });
      setOpen(false);
      setText(null);
    } catch (e) {
      setErr(errorMessage(e));
    }
  };
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>Questions</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Questions in this test" wide footer={<Button onClick={save}>Save</Button>}>
        {test.loading ? <Spinner /> : (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">One question per line, in order: <code>question-id marks</code>. Copy ids from the question bank (approved questions only are shown to students).</p>
            <Textarea rows={12} className="font-mono text-xs" value={value} onChange={(e) => setText(e.target.value)} />
            {test.data && <ul className="text-xs text-slate-600 list-decimal pl-5">{test.data.questions.map((q) => <li key={q.questionId}>{q.question.stem} {q.question.status !== "APPROVED" && <Badge color="amber">not approved</Badge>}</li>)}</ul>}
            {err && <Alert>{err}</Alert>}
          </div>
        )}
      </Modal>
    </>
  );
}

function Reports() {
  const list = useApi<Any[]>("/admin/assessments/reports", []);
  const resolve = async (id: string, status: "FIXED" | "DISMISSED") => {
    await api.post(`/admin/assessments/reports/${id}`, { status });
    list.reload();
  };
  return (
    <Card title="Students reported these questions">
      {list.loading ? <Spinner /> : !list.data.length ? <EmptyState title="No open reports" /> : (
        <Table head={["Question", "Report", ""]}>
          {list.data.map((r) => {
            const q = r.question as { id: string; stem: string; options: string[] | null; answer: unknown };
            return (
              <tr key={r.id}>
                <Td><div className="text-sm">{q.stem}</div><div className="text-xs text-slate-500">{q.options?.join(" · ")} · answer {JSON.stringify(q.answer)} · id {q.id}</div></Td>
                <Td className="text-sm">{String(r.reason)}</Td>
                <Td><div className="flex gap-1"><Button size="sm" onClick={() => resolve(r.id, "FIXED")}>Fixed</Button><Button size="sm" variant="secondary" onClick={() => resolve(r.id, "DISMISSED")}>Dismiss</Button></div></Td>
              </tr>
            );
          })}
        </Table>
      )}
    </Card>
  );
}
