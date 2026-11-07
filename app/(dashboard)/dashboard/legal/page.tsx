"use client";

import api, { errorMessage } from "@/lib/api";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { P } from "@/lib/permissions";
import { Alert, Badge, Button, PageHeader } from "@/components/ui";
import { ResourceEditor } from "@/components/resource-editor";

type Any = Record<string, unknown> & { id: string };

export default function LegalPage() {
  const { can } = useAuth();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <>
      <PageHeader title="Privacy & terms" description="Each save is a version; publish it to show it in the app. Documents that need acceptance are shown to every user until they accept the latest version." />
      {msg && <div className="mb-4"><Alert kind="info" onClose={() => setMsg(null)}>{msg}</Alert></div>}
      <ResourceEditor<Any>
        title="Documents" listPath="/admin/cms/legal" createPath="/admin/cms/legal" updatePath={(r) => `/admin/cms/legal/${r.id}`}
        canEdit={can(P.MANAGE_CONTENT_SETTINGS)}
        defaults={{ kind: "privacy", sections: [{ heading: "Information we collect", body: "…", icon: "database" }], highlights: [] }}
        fields={[
          { key: "kind", label: "Kind", type: "text", required: true, hint: "privacy | terms | refund | community", createOnly: false },
          { key: "title", label: "Title", type: "text", required: true },
          { key: "summary", label: "Summary", type: "textarea" },
          { key: "sections", label: "Sections (JSON)", type: "json", required: true, hint: '[{"heading": "1. Acceptance of terms", "body": "markdown…", "icon": "check"}]' },
          { key: "highlights", label: "Quick-summary chips (one per line)", type: "list" },
          { key: "requireAcceptance", label: "Users must accept it", type: "checkbox" },
        ]}
        columns={[
          { label: "Document", render: (r) => <><div className="font-medium">{String(r.title)}</div><div className="text-xs text-slate-500">{String(r.kind)} · version {String(r.version)}</div></> },
          { label: "Status", render: (r) => <Badge color={r.status === "PUBLISHED" ? "green" : "gray"}>{String(r.status).toLowerCase()}</Badge> },
          { label: "Accepted by", render: (r) => String((r._count as { acceptances: number }).acceptances) },
        ]}
        extraActions={(r, reload) => r.status !== "PUBLISHED" && can(P.MANAGE_CONTENT_SETTINGS) ? (
          <Button size="sm" onClick={async () => {
            try { await api.post(`/admin/cms/legal/${r.id}/publish`); setMsg("Published"); reload(); } catch (err) { setMsg(errorMessage(err)); }
          }}>Publish</Button>
        ) : null}
      />
    </>
  );
}
