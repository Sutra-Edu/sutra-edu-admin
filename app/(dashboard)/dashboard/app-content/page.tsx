"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/lib/hooks";
import { P } from "@/lib/permissions";
import { Alert, Badge, PageHeader, Spinner } from "@/components/ui";
import { FieldDef, ResourceEditor, Tabs } from "@/components/resource-editor";

type Any = Record<string, unknown> & { id: string };
interface Collection { key: string; label: string; note: string }

const itemFields = (collection: string): FieldDef[] => [
  { key: "collection", label: "Collection", type: "text", required: true, createOnly: true },
  { key: "key", label: "Key", type: "text", hint: "Stable id the app looks up (e.g. welcome.title, explain_again)" },
  { key: "title", label: collection === "tutor_action" ? "Chip label" : "Title / text", type: "text", required: true },
  { key: "body", label: "Body / subtitle", type: "textarea" },
  { key: "icon", label: "Icon", type: "text" },
  { key: "imageUrl", label: "Image URL", type: "text" },
  { key: "data", label: "Data (JSON)", type: "json", hint: collection === "tutor_action" ? '{"instruction": "what the tutor should do"}' : collection === "grade_scale" ? '{"min": 90, "grade": "A+"}' : collection === "support_channel" ? '{"kind": "chat|call|community|email|whatsapp", "url": "", "phone": "", "hours": ""}' : collection === "home_banner" ? '{"topicId": "…", "cta": "Start now"}' : undefined },
  { key: "audience", label: "Who sees it (JSON)", type: "json", hint: '{"boardIds": [...], "classIds": [...], "userTypes": ["STUDENT"]} — empty = everyone' },
  { key: "startsAt", label: "Show from", type: "datetime" },
  { key: "endsAt", label: "Show until", type: "datetime" },
  { key: "sortOrder", label: "Order", type: "number" },
  { key: "isActive", label: "Active", type: "checkbox" },
];

export default function AppContentPage() {
  const { can } = useAuth();
  const collections = useApi<Collection[]>("/admin/cms/collections", []);
  const [tab, setTab] = useState<string>("learner_status");
  const current = collections.data.find((c) => c.key === tab);

  return (
    <>
      <PageHeader title="App content" description="Every list of options and piece of copy the app shows, so changes don't need an app release." />
      {collections.error && <Alert>{collections.error}</Alert>}
      {collections.loading ? <Spinner /> : (
        <>
          <Tabs tabs={[{ key: "learner_status", label: "Learner statuses" }, ...collections.data.map((c) => ({ key: c.key, label: c.label }))]} value={tab} onChange={setTab} />
          {tab === "learner_status" ? (
            <ResourceEditor<Any>
              title="Learner statuses" description='Signup step "What is your current status?". Ask-for fields add extra questions for that status.'
              listPath="/admin/cms/learner-statuses" createPath="/admin/cms/learner-statuses" updatePath={(r) => `/admin/cms/learner-statuses/${r.id}`}
              canEdit={can(P.MANAGE_CURRICULUM)} defaults={{ isActive: true, askFor: [] }}
              fields={[
                { key: "code", label: "Code", type: "text", required: true, createOnly: true, placeholder: "OPEN_BOARD" },
                { key: "name", label: "Name", type: "text", required: true },
                { key: "description", label: "Description", type: "text" },
                { key: "icon", label: "Icon", type: "text" },
                { key: "askFor", label: "Also ask for", type: "multiselect", options: [{ value: "institutionName", label: "School / college" }, { value: "targetExam", label: "Target exam" }, { value: "targetExamDate", label: "Exam date" }] },
                { key: "sortOrder", label: "Order", type: "number" },
                { key: "isActive", label: "Active", type: "checkbox" },
              ]}
              columns={[
                { label: "Status", render: (r) => <><div className="font-medium">{String(r.name)}</div><div className="text-xs text-slate-500">{String(r.code)} · {String(r.description ?? "")}</div></> },
                { label: "Asks for", render: (r) => <span className="text-xs">{(r.askFor as string[]).join(", ") || "—"}</span> },
                { label: "", render: (r) => <Badge color={r.isActive ? "green" : "gray"}>{r.isActive ? "shown" : "hidden"}</Badge> },
              ]}
            />
          ) : current && (
            <ResourceEditor<Any>
              key={current.key}
              title={current.label} description={current.note}
              listPath={`/admin/cms/content?collection=${current.key}`} createPath="/admin/cms/content" updatePath={(r) => `/admin/cms/content/${r.id}`}
              canEdit={can(P.MANAGE_CONTENT_SETTINGS)} defaults={{ collection: current.key, isActive: true }}
              fields={itemFields(current.key)}
              columns={[
                { label: "Item", render: (r) => <><div className="font-medium">{String(r.title)}</div><div className="text-xs text-slate-500">{String(r.key ?? "")}</div></> },
                { label: "Body", render: (r) => <span className="text-xs text-slate-600">{String(r.body ?? "").slice(0, 80)}</span> },
                { label: "Data", render: (r) => <span className="text-xs font-mono">{r.data ? JSON.stringify(r.data).slice(0, 60) : ""}</span> },
                { label: "", render: (r) => <Badge color={r.isActive ? "green" : "gray"}>{r.isActive ? "shown" : "hidden"}</Badge> },
              ]}
            />
          )}
        </>
      )}
    </>
  );
}
