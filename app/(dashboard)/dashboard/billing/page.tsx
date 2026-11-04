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
  settings: { enforce: boolean; freeFeatures: string[]; taxPercent: number; taxInclusive: boolean };
  features: string[];
}
const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const INTERVALS = ["MONTH", "QUARTER", "HALF_YEAR", "YEAR"];

export default function BillingPage() {
  const { can } = useAuth();
  const canEdit = can(P.MANAGE_SUBSCRIPTIONS);
  const summary = useApi<Summary | null>("/admin/billing/summary", null);
  const [tab, setTab] = useState<"plans" | "coupons" | "subs" | "payments">("plans");
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
          <Tabs tabs={[{ key: "plans", label: "Plans" }, { key: "coupons", label: "Promo codes" }, { key: "subs", label: "Subscriptions" }, { key: "payments", label: "Payments" }]} value={tab} onChange={setTab} />
          {tab === "coupons" && (
            <ResourceEditor<Any>
              title="Promo codes" description="Percent or flat discounts. For recurring plans add the matching Razorpay offer id (Razorpay → Subscriptions → Offers); without one the student pays once for the first period."
              listPath="/admin/billing/coupons" createPath="/admin/billing/coupons" updatePath={(r) => `/admin/billing/coupons/${r.id}`} canEdit={canEdit}
              defaults={{ isActive: true, perUserLimit: 1 }}
              fields={[
                { key: "code", label: "Code", type: "text", required: true, createOnly: true, placeholder: "WELCOME50" },
                { key: "description", label: "Description", type: "text" },
                { key: "percentOff", label: "% off", type: "number" },
                { key: "amountOffPaise", label: "or flat off (paise)", type: "number" },
                { key: "planCodes", label: "Only for plans (codes, one per line)", type: "list" },
                { key: "maxRedemptions", label: "Total uses", type: "number" },
                { key: "perUserLimit", label: "Uses per person", type: "number" },
                { key: "validFrom", label: "Valid from", type: "datetime" },
                { key: "validUntil", label: "Valid until", type: "datetime" },
                { key: "razorpayOfferId", label: "Razorpay offer id", type: "text" },
                { key: "isActive", label: "Active", type: "checkbox" },
              ]}
              columns={[
                { label: "Code", render: (r) => <><div className="font-mono font-medium">{String(r.code)}</div><div className="text-xs text-slate-500">{String(r.description ?? "")}</div></> },
                { label: "Discount", render: (r) => r.percentOff ? `${r.percentOff}%` : rupees(Number(r.amountOffPaise ?? 0)) },
                { label: "Used", render: (r) => `${r.redeemed}${r.maxRedemptions ? ` / ${r.maxRedemptions}` : ""}` },
                { label: "", render: (r) => <Badge color={r.isActive ? "green" : "gray"}>{r.isActive ? "active" : "off"}</Badge> },
              ]}
            />
          )}
          {tab === "plans" && (
            <ResourceEditor<Any>
              title="Plans" description="Changing a price applies to new subscribers; existing ones keep theirs until they renew on a new plan."
              listPath="/admin/billing/plans" createPath="/admin/billing/plans" updatePath={(r) => `/admin/billing/plans/${r.id}`} canEdit={canEdit}
              defaults={{ isActive: true, interval: "MONTH", features: ["tutor", "voice", "photo", "viva", "duels", "groups", "downloads", "revision", "exams"] }}
              fields={[
                { key: "code", label: "Code", type: "text", required: true, createOnly: true, placeholder: "PRO_MONTHLY" },
                { key: "name", label: "Name", type: "text", required: true },
                { key: "description", label: "Description", type: "textarea" },
                { key: "pricePaise", label: "Price in paise (₹499 = 49900; 0 = free)", type: "number", required: true },
                { key: "interval", label: "Billed every", type: "select", required: true, options: opts(INTERVALS) },
                { key: "trialDays", label: "Free trial days", type: "number" },
                { key: "features", label: "Unlocks", type: "multiselect", options: s.features.map((f) => ({ value: f, label: f })) },
                { key: "limits", label: "Limits (JSON)", type: "json", hint: '{"tutor": {"questionsPerDay": 50}}' },
                { key: "tagline", label: "Tagline", type: "text", hint: "Under the name on the card" },
                { key: "highlights", label: "Card bullet points (one per line)", type: "list" },
                { key: "badge", label: "Badge", type: "text", hint: "e.g. Most popular" },
                { key: "ctaLabel", label: "Button text", type: "text", hint: "Get started / Subscribe now / Contact sales" },
                { key: "ctaType", label: "Button does", type: "select", options: [{ value: "checkout", label: "Checkout" }, { value: "contact", label: "Contact sales" }] },
                { key: "contactUrl", label: "Contact link", type: "text" },
                { key: "comparison", label: "Comparison table values (JSON)", type: "json", hint: 'Keys are the rows under App content → Plan comparison rows, e.g. {"ai_tutor": "Unlimited", "certification": true}' },
                { key: "planGroup", label: "Group", type: "text", hint: "Same group = monthly / yearly versions of one tier (e.g. pro)" },
                { key: "billingMode", label: "Billing", type: "select", options: [{ value: "RECURRING", label: "Recurring (autopay)" }, { value: "ONE_TIME", label: "Pay once per period" }] },
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
  const [tax, setTax] = useState({ percent: String(summary.settings.taxPercent ?? 18), inclusive: summary.settings.taxInclusive ?? true });
  const [msg, setMsg] = useState<string | null>(null);
  const save = async () => {
    try {
      await api.patch("/admin/billing/settings", { enforce, freeFeatures: free, taxPercent: Number(tax.percent) || 0, taxInclusive: tax.inclusive });
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
        <div className="flex flex-wrap items-end gap-4 pt-2">
          <Field label="GST %"><Input type="number" disabled={!canEdit} value={tax.percent} onChange={(e) => setTax({ ...tax, percent: e.target.value })} /></Field>
          <Checkbox disabled={!canEdit} label="Prices include GST" checked={tax.inclusive} onChange={(e) => setTax({ ...tax, inclusive: e.target.checked })} />
        </div>
        {canEdit && <Button onClick={save}>Save paywall & tax</Button>}
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
