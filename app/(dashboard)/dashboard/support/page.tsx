"use client";

import { useState } from "react";
import api, { errorMessage } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/lib/hooks";
import { P } from "@/lib/permissions";
import { Alert, Badge, Button, Card, EmptyState, Modal, PageHeader, Select, Spinner, StatusBadge, Table, Td, Textarea, fmtDate, fullName } from "@/components/ui";
import { ResourceEditor, Tabs } from "@/components/resource-editor";

type Any = Record<string, unknown> & { id: string };
interface Ticket {
  id: string; number: number; subject: string; category: string | null; status: string; priority: string; updatedAt: string;
  user: { firstName: string | null; lastName: string | null; email: string | null; phone: string | null };
  _count: { messages: number };
}
interface TicketDetail extends Ticket { messages: { id: string; isStaff: boolean; body: string; createdAt: string }[] }

export default function SupportPage() {
  const { can } = useAuth();
  const [tab, setTab] = useState<"tickets" | "categories" | "articles" | "data">("tickets");
  const categories = useApi<Any[]>(tab === "articles" ? "/admin/cms/help/categories" : null, []);
  return (
    <>
      <PageHeader title="Support" description="Tickets from students and parents, the help centre the app's Support screen shows, and data requests." />
      <Tabs tabs={[{ key: "tickets", label: "Tickets" }, { key: "categories", label: "Help categories" }, { key: "articles", label: "Help articles" }, { key: "data", label: "Data requests" }]} value={tab} onChange={setTab} />
      {tab === "tickets" && <Tickets />}
      {tab === "categories" && (
        <ResourceEditor<Any>
          title="Help categories" listPath="/admin/cms/help/categories" createPath="/admin/cms/help/categories" updatePath={(r) => `/admin/cms/help/categories/${r.id}`}
          canEdit={can(P.MANAGE_SUPPORT)} defaults={{ isActive: true }}
          fields={[
            { key: "name", label: "Name", type: "text", required: true },
            { key: "description", label: "Description", type: "text" },
            { key: "icon", label: "Icon", type: "text" },
            { key: "sortOrder", label: "Order", type: "number" },
            { key: "isActive", label: "Active", type: "checkbox" },
          ]}
          columns={[
            { label: "Category", render: (r) => <><div className="font-medium">{String(r.name)}</div><div className="text-xs text-slate-500">{String(r.description ?? "")}</div></> },
            { label: "Articles", render: (r) => String((r._count as { articles: number }).articles) },
          ]}
        />
      )}
      {tab === "articles" && (
        <ResourceEditor<Any>
          title="Help articles" description="Markdown. Popular articles show as chips under the search box; the AI assistant answers from these."
          listPath="/admin/cms/help/articles" createPath="/admin/cms/help/articles" updatePath={(r) => `/admin/cms/help/articles/${r.id}`}
          canEdit={can(P.MANAGE_SUPPORT)} defaults={{ isActive: true }}
          fields={[
            { key: "categoryId", label: "Category", type: "select", required: true, options: categories.data.map((c) => ({ value: c.id, label: String(c.name) })) },
            { key: "title", label: "Title", type: "text", required: true },
            { key: "slug", label: "Slug", type: "text", required: true, placeholder: "reset-password" },
            { key: "body", label: "Article (markdown)", type: "textarea", required: true },
            { key: "tags", label: "Tags (one per line)", type: "list" },
            { key: "isPopular", label: "Popular", type: "checkbox" },
            { key: "sortOrder", label: "Order", type: "number" },
            { key: "isActive", label: "Active", type: "checkbox" },
          ]}
          columns={[
            { label: "Article", render: (r) => <><div className="font-medium">{String(r.title)}</div><div className="text-xs text-slate-500">/{String(r.slug)}</div></> },
            { label: "Category", render: (r) => String((r.category as { name: string }).name) },
            { label: "Helpful", render: (r) => <span className="text-xs">👍 {String(r.helpfulYes)} · 👎 {String(r.helpfulNo)}</span> },
            { label: "", render: (r) => r.isPopular ? <Badge color="purple">popular</Badge> : null },
          ]}
        />
      )}
      {tab === "data" && <DataRequests />}
    </>
  );
}

function Tickets() {
  const [status, setStatus] = useState("OPEN");
  const list = useApi<Ticket[]>(`/admin/cms/tickets${status ? `?status=${status}` : ""}`, []);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Card title="Tickets" actions={
      <Select value={status} onChange={(e) => setStatus(e.target.value)}>
        {["OPEN", "PENDING", "RESOLVED", "CLOSED", ""].map((s) => <option key={s} value={s}>{s ? s.toLowerCase() : "all"}</option>)}
      </Select>
    }>
      {list.loading ? <Spinner /> : !list.data.length ? <EmptyState title="No tickets" /> : (
        <Table head={["#", "Subject", "From", "Status", "Updated", ""]}>
          {list.data.map((t) => (
            <tr key={t.id}>
              <Td className="text-xs">{t.number}</Td>
              <Td><div className="font-medium">{t.subject}</div><div className="text-xs text-slate-500">{t.category ?? ""} · {t._count.messages} messages</div></Td>
              <Td>{fullName(t.user)}<div className="text-xs text-slate-500">{t.user.email ?? t.user.phone}</div></Td>
              <Td><StatusBadge status={t.status} />{t.priority !== "NORMAL" && <Badge color="red">{t.priority.toLowerCase()}</Badge>}</Td>
              <Td className="text-xs">{fmtDate(t.updatedAt)}</Td>
              <Td><Button size="sm" onClick={() => setOpen(t.id)}>Open</Button></Td>
            </tr>
          ))}
        </Table>
      )}
      {open && <TicketModal id={open} onClose={() => { setOpen(null); list.reload(); }} />}
    </Card>
  );
}

function TicketModal({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useApi<TicketDetail | null>(`/admin/cms/tickets/${id}`, null);
  const [reply, setReply] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      setReply("");
      t.reload();
    } catch (e) {
      setErr(errorMessage(e));
    }
  };
  return (
    <Modal open onClose={onClose} title={t.data ? `#${t.data.number} ${t.data.subject}` : "Ticket"} wide
      footer={<>
        <Button variant="secondary" onClick={() => act(() => api.put(`/admin/cms/tickets/${id}`, { status: "RESOLVED" }))}>Mark resolved</Button>
        <Button variant="secondary" onClick={() => act(() => api.put(`/admin/cms/tickets/${id}`, { status: "CLOSED" }))}>Close</Button>
        <Button disabled={!reply.trim()} onClick={() => act(() => api.post(`/admin/cms/tickets/${id}/messages`, { body: reply }))}>Send reply</Button>
      </>}>
      {!t.data ? <Spinner /> : (
        <div className="space-y-3">
          {t.data.messages.map((m) => (
            <div key={m.id} className={`rounded-lg p-3 text-sm ${m.isStaff ? "bg-indigo-50 ml-8" : "bg-slate-50 mr-8"}`}>
              <div className="text-xs text-slate-500 mb-1">{m.isStaff ? "Support" : fullName(t.data!.user)} · {fmtDate(m.createdAt)}</div>
              <div className="whitespace-pre-wrap">{m.body}</div>
            </div>
          ))}
          <Textarea rows={3} placeholder="Reply (the user gets a notification)" value={reply} onChange={(e) => setReply(e.target.value)} />
          {err && <Alert>{err}</Alert>}
        </div>
      )}
    </Modal>
  );
}

function DataRequests() {
  const list = useApi<Any[]>("/admin/cms/data-requests", []);
  const [err, setErr] = useState<string | null>(null);
  const decide = async (id: string, approve: boolean) => {
    if (approve && !confirm("Delete this account's personal details? This cannot be undone.")) return;
    try {
      await api.post(`/admin/cms/data-requests/${id}`, { approve });
      list.reload();
    } catch (e) {
      setErr(errorMessage(e));
    }
  };
  return (
    <Card title="Account deletion requests">
      <p className="text-sm text-slate-500 mb-4">Approving deactivates the account and removes name, email, phone, sign-in links, devices and AI learning notes. Learning records stay without personal details. Data exports are self-service in the app.</p>
      {err && <Alert>{err}</Alert>}
      {list.loading ? <Spinner /> : !list.data.length ? <EmptyState title="No open requests" /> : (
        <Table head={["When", "User id", "Reason", ""]}>
          {list.data.map((r) => (
            <tr key={r.id}>
              <Td className="text-xs">{fmtDate(r.createdAt as string)}</Td>
              <Td className="text-xs font-mono">{String(r.userId)}</Td>
              <Td className="text-sm">{String(r.reason ?? "—")}</Td>
              <Td><div className="flex gap-1"><Button size="sm" variant="danger" onClick={() => decide(r.id, true)}>Delete account</Button><Button size="sm" variant="secondary" onClick={() => decide(r.id, false)}>Reject</Button></div></Td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  );
}
