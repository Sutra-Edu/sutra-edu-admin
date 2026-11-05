"use client";

import { useState } from "react";
import api, { errorMessage } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useApi, useCatalog } from "@/lib/hooks";
import { P } from "@/lib/permissions";
import { Alert, Badge, Button, Card, Checkbox, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, StatusBadge, Table, Td, Textarea, fmtDate } from "@/components/ui";

interface Lecture {
  id: string; title: string; description: string | null; tutorName: string; tutorAvatar: string | null; topicId: string; assetId: string;
  boardIds: string[]; classIds: string[]; startsAt: string; waitingRoomMinutes: number; isPremium: boolean; status: string;
  _count: { reminders: number };
}
interface Asset { id: string; kind: string; title: string | null; durationSec: number | null; generation: { language: string; purpose: string } }

const toLocal = (iso: string) => { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const dur = (s: number | null) => (s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}` : "—");

export default function LecturesPage() {
  const { can } = useAuth();
  const list = useApi<Lecture[]>("/admin/lectures", []);
  const [editing, setEditing] = useState<Lecture | "new" | null>(null);
  return (
    <>
      <PageHeader
        title="Lecture premieres"
        description='"Live sessions" on the home screen: a topic&apos;s AI lecture (the video made from the book, approved in the Review queue), played behind the 3D tutor at a set time. Everyone who joins watches the same moment; students can set a reminder (sent 10 minutes before). Outside premieres every approved lecture plays on demand in its topic.'
        actions={can(P.MANAGE_CONTENT_SETTINGS) && <Button onClick={() => setEditing("new")}>Schedule a premiere</Button>}
      />
      <Card title="Upcoming and recent">
        {list.error && <Alert>{list.error}</Alert>}
        {list.loading ? <Spinner /> : !list.data.length ? <EmptyState title="No premieres scheduled" description="Lectures still play on demand in each topic." /> : (
          <Table head={["Lecture", "Starts", "Reminders", "", ""]}>
            {list.data.map((l) => (
              <tr key={l.id}>
                <Td><div className="font-medium">{l.title}</div><div className="text-xs text-slate-500">with {l.tutorName}</div></Td>
                <Td className="text-xs">{fmtDate(l.startsAt)} · waiting room {l.waitingRoomMinutes} min before</Td>
                <Td>{l._count.reminders}</Td>
                <Td>{l.isPremium && <Badge color="amber">premium</Badge>} <StatusBadge status={l.status} /></Td>
                <Td>{can(P.MANAGE_CONTENT_SETTINGS) && <Button size="sm" variant="secondary" onClick={() => setEditing(l)}>Edit</Button>}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      {editing && <LectureModal lecture={editing === "new" ? null : editing} onClose={() => { setEditing(null); list.reload(); }} />}
    </>
  );
}

function LectureModal({ lecture, onClose }: { lecture: Lecture | null; onClose: () => void }) {
  const catalog = useCatalog();
  const [form, setForm] = useState({
    title: lecture?.title ?? "", description: lecture?.description ?? "", tutorName: lecture?.tutorName ?? "Sutra", tutorAvatar: lecture?.tutorAvatar ?? "",
    topicId: lecture?.topicId ?? "", assetId: lecture?.assetId ?? "", startsAt: lecture ? toLocal(lecture.startsAt) : "",
    waitingRoomMinutes: String(lecture?.waitingRoomMinutes ?? 15), isPremium: lecture?.isPremium ?? false,
    boardIds: lecture?.boardIds ?? [], classIds: lecture?.classIds ?? [], cancelled: lecture?.status === "CANCELLED",
  });
  const assets = useApi<Asset[]>(/^[0-9a-f-]{36}$/i.test(form.topicId.trim()) ? `/admin/lectures/assets?topicId=${form.topicId.trim()}` : null, []);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const toggle = (k: "boardIds" | "classIds", id: string, on: boolean) => setForm({ ...form, [k]: on ? [...form[k], id] : form[k].filter((x) => x !== id) });
  const save = async () => {
    setSaving(true);
    setErr(null);
    const body = {
      title: form.title.trim(), description: form.description || null, tutorName: form.tutorName || "Sutra", tutorAvatar: form.tutorAvatar || null,
      topicId: form.topicId.trim(), assetId: form.assetId, startsAt: new Date(form.startsAt).toISOString(), waitingRoomMinutes: Number(form.waitingRoomMinutes) || 0,
      isPremium: form.isPremium, boardIds: form.boardIds, classIds: form.classIds, status: form.cancelled ? "CANCELLED" : "SCHEDULED",
    };
    try {
      if (lecture) await api.patch(`/admin/lectures/${lecture.id}`, body);
      else await api.post("/admin/lectures", body);
      onClose();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={lecture ? "Edit premiere" : "Schedule a premiere"} wide
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={saving} disabled={!form.title.trim() || !form.assetId || !form.startsAt} onClick={save}>Save</Button></>}>
      <div className="space-y-4">
        <Field label="Topic id" required hint="From Curriculum → syllabus → topic"><Input value={form.topicId} onChange={(e) => setForm({ ...form, topicId: e.target.value, assetId: "" })} /></Field>
        <Field label="Lecture" required hint="Approved videos and narrations made for this topic">
          {assets.loading ? <Spinner /> : !assets.data.length ? <div className="text-sm text-slate-500">{form.topicId ? "No approved lecture for this topic yet (Review queue)." : "Enter a topic first."}</div> : (
            <Select value={form.assetId} onChange={(e) => setForm({ ...form, assetId: e.target.value, title: form.title || (assets.data.find((a) => a.id === e.target.value)?.title ?? "") })}>
              <option value="">Choose…</option>
              {assets.data.map((a) => <option key={a.id} value={a.id}>{a.kind === "VIDEO" ? "Video" : "Narration"} · {a.title ?? a.generation.purpose} · {a.generation.language} · {dur(a.durationSec)}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Title on the card" required><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <Field label="Description"><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Starts at" required><Input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} /></Field>
          <Field label="Waiting room (min before)"><Input type="number" value={form.waitingRoomMinutes} onChange={(e) => setForm({ ...form, waitingRoomMinutes: e.target.value })} /></Field>
          <Field label="Tutor name"><Input value={form.tutorName} onChange={(e) => setForm({ ...form, tutorName: e.target.value })} /></Field>
        </div>
        <Field label="Tutor avatar" hint="Which 3D avatar / outfit the app loads (optional)"><Input value={form.tutorAvatar} onChange={(e) => setForm({ ...form, tutorAvatar: e.target.value })} /></Field>
        <Field label="Only these boards (none = all)">
          <div className="flex flex-wrap gap-3">{catalog.boards.map((b) => <Checkbox key={b.id} label={b.name} checked={form.boardIds.includes(b.id)} onChange={(e) => toggle("boardIds", b.id, e.target.checked)} />)}</div>
        </Field>
        <Field label="Only these classes (none = all)">
          <div className="flex flex-wrap gap-3">{catalog.classes.map((c) => <Checkbox key={c.id} label={c.name} checked={form.classIds.includes(c.id)} onChange={(e) => toggle("classIds", c.id, e.target.checked)} />)}</div>
        </Field>
        <div className="flex gap-6">
          <Checkbox label="Paid plans only" checked={form.isPremium} onChange={(e) => setForm({ ...form, isPremium: e.target.checked })} />
          {lecture && <Checkbox label="Cancelled" checked={form.cancelled} onChange={(e) => setForm({ ...form, cancelled: e.target.checked })} />}
        </div>
        {err && <Alert>{err}</Alert>}
      </div>
    </Modal>
  );
}
