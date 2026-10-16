"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { useApi } from "@/lib/hooks";
import { Alert, Badge, Card, EmptyState, Input, Modal, PageHeader, Spinner, StatusBadge, Table, Td, fmtDate, fullName } from "@/components/ui";

interface Person { id: string; firstName: string | null; lastName: string | null; phone: string | null; email: string | null }
interface Learner extends Person {
  userType: "STUDENT" | "GUARDIAN";
  status: string;
  isVerified: boolean;
  language: string | null;
  createdAt: string;
  board: { name: string } | null;
  academicClass: { name: string } | null;
  stream: { name: string } | null;
  guardians: { relationshipType: string | null; isPrimaryContact: boolean; guardian: Person }[];
  wards: { relationshipType: string | null; student: Person }[];
  profile?: { complete: boolean; missing: string[] };
}

export default function StudentsPage() {
  const [type, setType] = useState<"STUDENT" | "GUARDIAN">("STUDENT");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const qs = new URLSearchParams({ userType: type, take: "100", ...(q && { q }) }).toString();
  const { data, loading, error } = useApi<Learner[]>(`/admin/learners?${qs}`, []);
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <>
      <PageHeader title="Students & parents" description="Accounts created through the student app (OTP sign-in). Read-only." />
      <Card>
        <div className="flex flex-wrap gap-3 items-center justify-between mb-4">
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
            {(["STUDENT", "GUARDIAN"] as const).map((t) => (
              <button key={t} onClick={() => setType(t)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md ${type === t ? "bg-white shadow-sm text-slate-900" : "text-slate-500"}`}>
                {t === "STUDENT" ? "Students" : "Parents"}
              </button>
            ))}
          </div>
          <form className="relative w-full sm:w-72" onSubmit={(e) => { e.preventDefault(); setQ(search.trim()); }}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input className="pl-9" placeholder="Name, phone or email" value={search} onChange={(e) => setSearch(e.target.value)} onBlur={() => setQ(search.trim())} />
          </form>
        </div>
        {error && <Alert>{error}</Alert>}
        {loading ? <Spinner /> : data.length === 0 ? <EmptyState title={`No ${type === "STUDENT" ? "students" : "parents"} found`} /> : (
          <Table head={type === "STUDENT" ? ["Student", "Phone", "Board / class", "Parents", "Status", "Joined"] : ["Parent", "Phone", "Children", "Status", "Joined"]}>
            {data.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setOpenId(u.id)}>
                <Td>
                  <div className="font-medium">{fullName(u)}</div>
                  {u.email && <div className="text-xs text-slate-500">{u.email}</div>}
                </Td>
                <Td className="font-mono text-xs">{u.phone ?? "—"}</Td>
                {type === "STUDENT" ? <>
                  <Td>{u.board ? `${u.board.name} · ${u.academicClass?.name ?? "—"}${u.stream ? ` · ${u.stream.name}` : ""}` : <span className="text-slate-400">Not chosen</span>}</Td>
                  <Td>{u.guardians.map((g) => fullName(g.guardian)).join(", ") || "—"}</Td>
                </> : (
                  <Td>{u.wards.map((w) => fullName(w.student)).join(", ") || "—"}</Td>
                )}
                <Td><StatusBadge status={u.status} /></Td>
                <Td className="text-slate-500 whitespace-nowrap">{new Date(u.createdAt).toLocaleDateString()}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      {openId && <LearnerModal id={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}

function LearnerModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: u, loading, error } = useApi<Learner | null>(`/admin/learners/${id}`, null);
  return (
    <Modal open onClose={onClose} title={u ? fullName(u) : "Account"}>
      {loading ? <Spinner /> : error || !u ? <Alert>{error ?? "Not found"}</Alert> : (
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <Item label="Type">{u.userType === "STUDENT" ? "Student" : "Parent"}</Item>
          <Item label="Status"><StatusBadge status={u.status} /></Item>
          <Item label="Phone">{u.phone ?? "—"}</Item>
          <Item label="Email">{u.email ?? "—"}</Item>
          <Item label="Language">{u.language ?? "—"}</Item>
          <Item label="Joined">{fmtDate(u.createdAt)}</Item>
          {u.userType === "STUDENT" && <>
            <Item label="Board">{u.board?.name ?? "—"}</Item>
            <Item label="Class">{u.academicClass?.name ?? "—"}{u.stream ? ` · ${u.stream.name}` : ""}</Item>
            <div className="col-span-2">
              <dt className="text-xs uppercase tracking-wide text-slate-500">Profile</dt>
              <dd className="mt-1">{u.profile?.complete ? <Badge color="green">complete</Badge> : <Badge color="amber">missing: {u.profile?.missing.join(", ")}</Badge>}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs uppercase tracking-wide text-slate-500">Parents</dt>
              <dd className="mt-1 space-y-1">
                {u.guardians.length ? u.guardians.map((g) => (
                  <div key={g.guardian.id}>{fullName(g.guardian)} <span className="text-slate-500">({g.relationshipType ?? "guardian"}{g.isPrimaryContact ? ", primary" : ""}) · {g.guardian.phone}</span></div>
                )) : "—"}
              </dd>
            </div>
          </>}
          {u.userType === "GUARDIAN" && (
            <div className="col-span-2">
              <dt className="text-xs uppercase tracking-wide text-slate-500">Children</dt>
              <dd className="mt-1 space-y-1">
                {u.wards.length ? u.wards.map((w) => <div key={w.student.id}>{fullName(w.student)} <span className="text-slate-500">({w.relationshipType ?? "—"})</span></div>) : "—"}
              </dd>
            </div>
          )}
        </dl>
      )}
    </Modal>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-slate-900">{children}</dd>
    </div>
  );
}
