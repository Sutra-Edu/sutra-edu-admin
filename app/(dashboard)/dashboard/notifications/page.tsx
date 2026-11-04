"use client";

import { useState } from "react";
import api, { errorMessage } from "@/lib/api";
import { useApi, useCatalog } from "@/lib/hooks";
import { Alert, Badge, Button, Card, Checkbox, EmptyState, Field, Input, PageHeader, Spinner, StatusBadge, Table, Td, Textarea, fmtDate } from "@/components/ui";

interface Campaign { id: string; title: string; body: string; status: string; recipients: number; pushed: number; failed: number; scheduledAt: string | null; sentAt: string | null; createdAt: string }

export default function NotificationsPage() {
  const list = useApi<{ push: { configured: boolean; reason: string | null }; campaigns: Campaign[] } | null>("/admin/notifications/campaigns", null);
  const catalog = useCatalog();
  const [form, setForm] = useState({ title: "", body: "", students: true, parents: true, boardIds: [] as string[], classIds: [] as string[], screen: "", scheduledAt: "" });
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  const audience = () => ({
    userTypes: [...(form.students ? ["STUDENT"] : []), ...(form.parents ? ["GUARDIAN"] : [])],
    ...(form.boardIds.length ? { boardIds: form.boardIds } : {}),
    ...(form.classIds.length ? { classIds: form.classIds } : {}),
  });
  const check = async () => {
    try {
      setCount((await api.post("/admin/notifications/audience/count", audience())).data.recipients);
    } catch (err) {
      setMsg({ kind: "error", text: errorMessage(err) });
    }
  };
  const send = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await api.post("/admin/notifications/campaigns", {
        title: form.title, body: form.body, audience: audience(), send: true,
        ...(form.screen ? { data: { screen: form.screen } } : {}),
        ...(form.scheduledAt ? { scheduledAt: new Date(form.scheduledAt).toISOString() } : {}),
      });
      setMsg({ kind: "success", text: form.scheduledAt ? "Scheduled" : "Sending now" });
      setForm({ ...form, title: "", body: "" });
      list.reload();
    } catch (err) {
      setMsg({ kind: "error", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };
  const toggle = (key: "boardIds" | "classIds", id: string, on: boolean) => setForm({ ...form, [key]: on ? [...form[key], id] : form[key].filter((x) => x !== id) });

  return (
    <>
      <PageHeader title="Notifications" description="Push messages and in-app inbox. Streak and revision reminders go out by themselves every evening." />
      {list.data && !list.data.push.configured && <div className="mb-4"><Alert kind="info">Push is not connected ({list.data.push.reason}); messages still reach the in-app inbox. See docs/SETUP.md → push.</Alert></div>}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="New message">
          <div className="space-y-4">
            <Field label="Title" required><Input maxLength={100} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <Field label="Message" required><Textarea rows={3} maxLength={500} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></Field>
            <div className="flex gap-6">
              <Checkbox label="Students" checked={form.students} onChange={(e) => setForm({ ...form, students: e.target.checked })} />
              <Checkbox label="Parents" checked={form.parents} onChange={(e) => setForm({ ...form, parents: e.target.checked })} />
            </div>
            <Field label="Boards" hint="None ticked = every board">
              <div className="flex flex-wrap gap-3">{catalog.boards.map((b) => <Checkbox key={b.id} label={b.name} checked={form.boardIds.includes(b.id)} onChange={(e) => toggle("boardIds", b.id, e.target.checked)} />)}</div>
            </Field>
            <Field label="Classes" hint="None ticked = every class">
              <div className="flex flex-wrap gap-3">{catalog.classes.map((c) => <Checkbox key={c.id} label={c.name} checked={form.classIds.includes(c.id)} onChange={(e) => toggle("classIds", c.id, e.target.checked)} />)}</div>
            </Field>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Open screen (optional)" hint="Deep link the app understands, e.g. revision, duel, home"><Input value={form.screen} onChange={(e) => setForm({ ...form, screen: e.target.value })} /></Field>
              <Field label="Send at (optional)"><Input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} /></Field>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="secondary" onClick={check}>Count recipients</Button>
              {count !== null && <span className="text-sm text-slate-600">{count} people</span>}
              <Button loading={busy} disabled={!form.title.trim() || !form.body.trim() || (!form.students && !form.parents)} onClick={send}>{form.scheduledAt ? "Schedule" : "Send"}</Button>
            </div>
            {msg && <Alert kind={msg.kind} onClose={() => setMsg(null)}>{msg.text}</Alert>}
          </div>
        </Card>
        <Card title="Sent and scheduled">
          {!list.data ? <Spinner /> : !list.data.campaigns.length ? <EmptyState title="Nothing sent yet" /> : (
            <Table head={["Message", "Status", "Reached"]}>
              {list.data.campaigns.map((c) => (
                <tr key={c.id}>
                  <Td><div className="font-medium">{c.title}</div><div className="text-xs text-slate-500">{c.body}</div><div className="text-xs text-slate-400">{fmtDate(c.sentAt ?? c.scheduledAt ?? c.createdAt)}</div></Td>
                  <Td><StatusBadge status={c.status} /></Td>
                  <Td className="text-xs">{c.recipients} inbox · {c.pushed} push{c.failed ? <Badge color="amber">{c.failed} failed</Badge> : null}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
