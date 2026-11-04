"use client";

import { useState } from "react";
import api, { errorMessage } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/lib/hooks";
import { P } from "@/lib/permissions";
import { Alert, Badge, Button, Card, Checkbox, EmptyState, Field, Input, PageHeader, Select, Spinner, StatusBadge, Table, Td, fmtDate, fullName } from "@/components/ui";
import { ResourceEditor, Tabs, opts } from "@/components/resource-editor";

type Any = Record<string, unknown> & { id: string };
interface Summary {
  active: number;
  pastDue: number;
  last30Days: { payments: number; amountPaise: number };
  razorpay: { configured: boolean; reason: string | null };
  settings: { enforce: boolean; freeFeatures: string[] };
  features: string[];
}
const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const INTERVALS = ["MONTH", "QUARTER", "HALF_YEAR", "YEAR"];

export default function BillingPage() {
  const { can } = useAuth();
  const canEdit = can(P.MANAGE_SUBSCRIPTIONS);
  const summary = useApi<Summary | null>("/admin/billing/summary", null);
  const [tab, setTab] = useState<"plans" | "subs" | "payments">("plans");
  const s = summary.data;

  return (
    <>
      <PageHeader title="Plans & payments" description="Subscription plans (Razorpay), who is subscribed, payments, and whether features need a plan." />
      {summary.error && <Alert>{summary.error}</Alert>}
      {!s ? <Spinner /> : (
        <div className="space-y-6">
          {!s.razorpay.configured && <Alert kind="info">Razorpay is not connected: {s.razorpay.reason}. Plans and admin grants still work. See docs/SETUP.md → payments.</Alert>}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card><div className="text-3xl font-semibold text-slate-900">{s.active}</div><div className="text-sm text-slate-500">active subscriptions</div></Card>
            <Card><div className="text-3xl font-semibold text-amber-600">{s.pastDue}</div><div className="text-sm text-slate-500">payment failed (still has access)</div></Card>
            <Card><div className="text-3xl font-semibold text-emerald-600">{rupees(s.last30Days.amountPaise)}</div><div className="text-sm text-slate-500">{s.last30Days.payments} payments in 30 days</div></Card>
          </div>
          <Paywall summary={s} canEdit={canEdit} onSaved={summary.reload} />
          <Tabs tabs={[{ key: "plans", label: "Plans" }, { key: "subs", label: "Subscriptions" }, { key: "payments", label: "Payments" }]} value={tab} onChange={setTab} />
          {tab === "plans" && (
            <ResourceEditor<Any>
              title="Plans" description="Changing a price applies to new subscribers; existing ones keep theirs until they renew on a new plan."
              listPath="/admin/billing/plans" createPath="/admin/billing/plans" updatePath={(r) => `/admin/billing/plans/${r.id}`} canEdit={canEdit}
              defaults={{ isActive: true, interval: "MONTH", features: ["tutor", "voice", "photo", "viva", "duels", "groups", "downloads", "revision", "exams"] }}
              fields={[
                { key: "code", label: "Code", type: "text", required: true, createOnly: true, placeholder: "PRO_MONTHLY" },
                { key: "name", label: "Name", type: "text", required: true },
                { key: "description", label: "Description", type: "textarea" },
                { key: "pricePaise", label: "Price in paise (₹499 = 49900)", type: "number", required: true },
                { key: "interval", label: "Billed every", type: "select", required: true, options: opts(INTERVALS) },
                { key: "trialDays", label: "Free trial days", type: "number" },
                { key: "features", label: "Unlocks", type: "multiselect", options: s.features.map((f) => ({ value: f, label: f })) },
                { key: "limits", label: "Limits (JSON)", type: "json", hint: '{"tutor": {"questionsPerDay": 50}}' },
                { key: "sortOrder", label: "Sort order", type: "number" },
                { key: "isActive", label: "On sale", type: "checkbox" },
              ]}
              columns={[
                { label: "Plan", render: (r) => <><div className="font-medium">{String(r.name)}</div><div className="text-xs text-slate-500">{String(r.code)}</div></> },
                { label: "Price", render: (r) => `${rupees(Number(r.pricePaise))} / ${String(r.interval).toLowerCase().replace("_", " ")}` },
                { label: "Unlocks", render: (r) => <span className="text-xs">{(r.features as string[]).join(", ")}</span> },
                { label: "Subscribers", render: (r) => String((r._count as { subscriptions: number }).subscriptions) },
                { label: "", render: (r) => <Badge color={r.isActive ? "green" : "gray"}>{r.isActive ? "on sale" : "off"}</Badge> },
              ]}
            />
          )}
          {tab === "subs" && <Subscriptions canEdit={canEdit} />}
          {tab === "payments" && <Payments />}
        </div>
      )}
    </>
  );
}

function Paywall({ summary, canEdit, onSaved }: { summary: Summary; canEdit: boolean; onSaved: () => void }) {
  const [enforce, setEnforce] = useState(summary.settings.enforce);
  const [free, setFree] = useState(summary.settings.freeFeatures);
  const [msg, setMsg] = useState<string | null>(null);
  const save = async () => {
    try {
      await api.patch("/admin/billing/settings", { enforce, freeFeatures: free });
      setMsg("Saved");
      onSaved();
    } catch (err) {
      setMsg(errorMessage(err));
    }
  };
  return (
    <Card title="Paywall">
      <div className="space-y-3">
        <Checkbox disabled={!canEdit} checked={enforce} onChange={(e) => setEnforce(e.target.checked)} label="Features need a plan"
          description="Off: everything is free (pilot). On: students need a plan that includes a feature, unless it is free below." />
        <div className="text-sm font-medium text-slate-700">Free for everyone</div>
        <div className="grid sm:grid-cols-5 gap-2">
          {summary.features.map((f) => (
            <Checkbox key={f} disabled={!canEdit} label={f} checked={free.includes(f)} onChange={(e) => setFree(e.target.checked ? [...free, f] : free.filter((x) => x !== f))} />
          ))}
        </div>
        {canEdit && <Button onClick={save}>Save paywall</Button>}
        {msg && <div className="text-sm text-slate-600">{msg}</div>}
      </div>
    </Card>
  );
}

function Subscriptions({ canEdit }: { canEdit: boolean }) {
  const [status, setStatus] = useState("");
  const list = useApi<Any[]>(`/admin/billing/subscriptions${status ? `?status=${status}` : ""}`, []);
  const [grant, setGrant] = useState({ userId: "", planCode: "", days: "30", note: "" });
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const doGrant = async () => {
    try {
      await api.post("/admin/billing/subscriptions/grant", { ...grant, days: Number(grant.days), note: grant.note || undefined });
      setMsg({ kind: "success", text: "Plan given" });
      list.reload();
    } catch (err) {
      setMsg({ kind: "error", text: errorMessage(err) });
    }
  };
  const cancel = async (id: string, immediately: boolean) => {
    try {
      await api.post(`/admin/billing/subscriptions/${id}/cancel`, { immediately });
      list.reload();
    } catch (err) {
      setMsg({ kind: "error", text: errorMessage(err) });
    }
  };
  return (
    <div className="space-y-6">
      {canEdit && (
        <Card title="Give a plan (scholarship, school invoice, testing)">
          <div className="grid sm:grid-cols-4 gap-3">
            <Field label="Student id"><Input value={grant.userId} onChange={(e) => setGrant({ ...grant, userId: e.target.value })} /></Field>
            <Field label="Plan code"><Input value={grant.planCode} onChange={(e) => setGrant({ ...grant, planCode: e.target.value })} /></Field>
            <Field label="Days"><Input type="number" value={grant.days} onChange={(e) => setGrant({ ...grant, days: e.target.value })} /></Field>
            <Field label="Note"><Input value={grant.note} onChange={(e) => setGrant({ ...grant, note: e.target.value })} /></Field>
          </div>
          <div className="mt-3"><Button disabled={!grant.userId || !grant.planCode} onClick={doGrant}>Give plan</Button></div>
        </Card>
      )}
      {msg && <Alert kind={msg.kind} onClose={() => setMsg(null)}>{msg.text}</Alert>}
      <Card title="Subscriptions" actions={
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All</option>
          {["CREATED", "ACTIVE", "PAST_DUE", "CANCELLED", "EXPIRED"].map((x) => <option key={x} value={x}>{x.replace("_", " ").toLowerCase()}</option>)}
        </Select>
      }>
        {list.loading ? <Spinner /> : !list.data.length ? <EmptyState title="No subscriptions" /> : (
          <Table head={["Student", "Plan", "Status", "Until", "Via", ""]}>
            {list.data.map((r) => {
              const u = r.user as { firstName: string | null; lastName: string | null; email: string | null; phone: string | null };
              return (
                <tr key={r.id}>
                  <Td>{fullName(u)}<div className="text-xs text-slate-500">{u.email ?? u.phone}</div></Td>
                  <Td>{(r.plan as { name: string }).name}</Td>
                  <Td><StatusBadge status={String(r.status)} />{r.cancelAtPeriodEnd ? <div className="text-xs text-slate-500">won&apos;t renew</div> : null}</Td>
                  <Td className="text-xs">{fmtDate(r.currentPeriodEnd as string | null)}</Td>
                  <Td className="text-xs">{String(r.provider)}{r.note ? ` · ${r.note}` : ""}</Td>
                  <Td>{canEdit && ["ACTIVE", "PAST_DUE", "CANCELLED"].includes(String(r.status)) && (
                    <div className="flex gap-1">
                      {r.status !== "CANCELLED" && <Button size="sm" variant="secondary" onClick={() => cancel(r.id, false)}>Stop renewing</Button>}
                      <Button size="sm" variant="danger" onClick={() => cancel(r.id, true)}>End now</Button>
                    </div>
                  )}</Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
    </div>
  );
}

function Payments() {
  const list = useApi<Any[]>("/admin/billing/payments", []);
  return (
    <Card title="Payments">
      {list.loading ? <Spinner /> : !list.data.length ? <EmptyState title="No payments yet" /> : (
        <Table head={["When", "Who", "Plan", "Amount", "Method", "Status", "Razorpay id"]}>
          {list.data.map((p) => (
            <tr key={p.id}>
              <Td className="text-xs">{fmtDate(p.createdAt as string)}</Td>
              <Td>{fullName(p.user as { firstName: string | null; lastName: string | null })}</Td>
              <Td>{(p.subscription as { plan: { name: string } } | null)?.plan.name ?? "—"}</Td>
              <Td>{rupees(Number(p.amountPaise))}</Td>
              <Td className="text-xs">{String(p.method ?? "—")}</Td>
              <Td><StatusBadge status={String(p.status).toUpperCase()} /></Td>
              <Td className="text-xs font-mono">{String(p.providerPaymentId ?? "")}</Td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  );
}
