"use client";

import { Fragment, useState } from "react";
import { useApi } from "@/lib/hooks";
import { Alert, Button, Card, EmptyState, PageHeader, Select, Spinner, Table, Td, fmtDate, fullName } from "@/components/ui";

interface Log {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  createdAt: string;
  actor: { id: string; email: string | null; firstName: string | null; lastName: string | null } | null;
}

const ENTITY_TYPES = ["Book", "BookFile", "User", "Role", "CurriculumOffering", "Board", "AcademicClass", "Subject", "Page", "ProcessingJob"];
const PAGE = 50;

export default function AuditLogsPage() {
  const [entityType, setEntityType] = useState("");
  const [skip, setSkip] = useState(0);
  const qs = new URLSearchParams({ take: String(PAGE), skip: String(skip), ...(entityType && { entityType }) }).toString();
  const { data, loading, error } = useApi<Log[]>(`/admin/audit-logs?${qs}`, []);
  const [open, setOpen] = useState<string | null>(null);

  return (
    <>
      <PageHeader title="Audit log" description="Every change made from the admin panel: who did it, when, and what changed." />
      <Card actions={
        <Select className="w-56" value={entityType} onChange={(e) => { setEntityType(e.target.value); setSkip(0); }}>
          <option value="">Everything</option>
          {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>
      } title="Changes">
        {error && <Alert>{error}</Alert>}
        {loading ? <Spinner /> : data.length === 0 ? <EmptyState title="Nothing logged yet" /> : (
          <>
            <Table head={["When", "Who", "Action", "Record", ""]}>
              {data.map((l) => (
                <Fragment key={l.id}>
                  <tr>
                    <Td className="text-slate-500 whitespace-nowrap">{fmtDate(l.createdAt)}</Td>
                    <Td>{l.actor ? fullName(l.actor) : <span className="text-slate-400">System</span>}</Td>
                    <Td className="font-mono text-xs">{l.action}</Td>
                    <Td className="text-xs"><span className="font-medium">{l.entityType}</span>{l.entityId && <span className="text-slate-400 font-mono block">{l.entityId}</span>}</Td>
                    <Td className="text-right">
                      {(l.before != null || l.after != null) && <Button size="sm" variant="ghost" onClick={() => setOpen(open === l.id ? null : l.id)}>{open === l.id ? "Hide" : "Details"}</Button>}
                    </Td>
                  </tr>
                  {open === l.id && (
                    <tr>
                      <td colSpan={5} className="px-5 pb-4">
                        <div className="grid gap-3 md:grid-cols-2">
                          <JsonBox title="Before" value={l.before} />
                          <JsonBox title="After" value={l.after} />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </Table>
            <div className="flex justify-between items-center mt-4">
              <Button variant="secondary" size="sm" disabled={skip === 0} onClick={() => setSkip(Math.max(0, skip - PAGE))}>Newer</Button>
              <span className="text-xs text-slate-500">{skip + 1}–{skip + data.length}</span>
              <Button variant="secondary" size="sm" disabled={data.length < PAGE} onClick={() => setSkip(skip + PAGE)}>Older</Button>
            </div>
          </>
        )}
      </Card>
    </>
  );
}

function JsonBox({ title, value }: { title: string; value: unknown }) {
  return (
    <div>
      <div className="text-xs font-semibold text-slate-500 mb-1">{title}</div>
      <pre className="bg-slate-900 text-slate-100 rounded-lg p-3 text-[11px] overflow-auto max-h-72">{value == null ? "—" : JSON.stringify(value, null, 2)}</pre>
    </div>
  );
}
