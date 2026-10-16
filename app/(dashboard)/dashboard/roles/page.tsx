"use client";

import { useState } from "react";
import { KeyRound, Plus, Trash2, Users } from "lucide-react";
import api, { errorMessage } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/lib/hooks";
import { PermissionChecklist } from "@/components/permission-checklist";
import { Alert, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Spinner, Textarea } from "@/components/ui";
import type { PermissionRow, Role } from "@/lib/types";

export default function RolesPage() {
  const roles = useApi<Role[]>("/admin/rbac/roles", []);
  const perms = useApi<PermissionRow[]>("/admin/rbac/permissions", []);
  const [editing, setEditing] = useState<Role | "new" | null>(null);
  const [notice, setNotice] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  const remove = async (role: Role) => {
    if (!confirm(`Delete the role ${role.name}?`)) return;
    try {
      await api.delete(`/admin/rbac/roles/${role.id}`);
      setNotice({ kind: "success", text: `Role ${role.name} deleted` });
      roles.reload();
    } catch (err) {
      setNotice({ kind: "error", text: errorMessage(err) });
    }
  };

  return (
    <>
      <PageHeader title="Roles & permissions"
        description="A role is a named set of permissions. Give admins a role on the Admin Staff page; super admins have every permission."
        actions={<Button onClick={() => setEditing("new")}><Plus className="w-4 h-4" /> New role</Button>} />
      {notice && <div className="mb-4"><Alert kind={notice.kind} onClose={() => setNotice(null)}>{notice.text}</Alert></div>}
      {roles.error && <Alert>{roles.error}</Alert>}

      {roles.loading ? <Spinner /> : roles.data.length === 0 ? <Card><EmptyState title="No roles yet" /></Card> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {roles.data.map((r) => (
            <div key={r.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center"><KeyRound className="w-4 h-4" /></div>
                  <div>
                    <div className="font-semibold">{r.name}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-1"><Users className="w-3 h-3" /> {r._count.users} admin{r._count.users === 1 ? "" : "s"}</div>
                  </div>
                </div>
                <button onClick={() => remove(r)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50" title="Delete role"><Trash2 className="w-4 h-4" /></button>
              </div>
              {r.description && <p className="text-sm text-slate-600 mt-3">{r.description}</p>}
              <div className="flex flex-wrap gap-1 mt-3 flex-1 content-start">
                {r.permissions.length ? r.permissions.map((p) => <span key={p.id} className="text-[11px] font-mono bg-slate-100 text-slate-700 rounded px-1.5 py-0.5">{p.action}</span>)
                  : <span className="text-xs text-slate-400">No permissions</span>}
              </div>
              <Button variant="secondary" size="sm" className="mt-4" onClick={() => setEditing(r)}>Edit role</Button>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <RoleModal role={editing === "new" ? null : editing} perms={perms.data} onClose={() => setEditing(null)}
          onSaved={(name) => { setEditing(null); roles.reload(); setNotice({ kind: "success", text: `Role ${name} saved` }); }} />
      )}
    </>
  );
}

function RoleModal({ role, perms, onClose, onSaved }: { role: Role | null; perms: PermissionRow[]; onClose: () => void; onSaved: (name: string) => void }) {
  const { permissions } = useAuth();
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [selected, setSelected] = useState<string[]>(role?.permissions.map((p) => p.action) ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      let saved: Role;
      if (role) {
        saved = (await api.patch<Role>(`/admin/rbac/roles/${role.id}`, { name, description })).data;
        await api.put(`/admin/rbac/roles/${role.id}/permissions`, { permissions: selected });
      } else {
        saved = (await api.post<Role>("/admin/rbac/roles", { name, description: description || undefined, permissions: selected })).data;
      }
      onSaved(saved.name);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={role ? `Edit ${role.name}` : "New role"} wide
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={saving} disabled={!name.trim()} onClick={save}>Save role</Button></>}>
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" required hint="Saved in capitals, e.g. BOOK_UPLOADER"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Book uploader" /></Field>
          <Field label="Description"><Textarea rows={1} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        </div>
        <div>
          <div className="text-sm font-medium text-slate-700 mb-2">Permissions <span className="font-normal text-slate-500">({selected.length} selected)</span></div>
          <PermissionChecklist all={perms} selected={selected} onChange={setSelected} grantable={permissions} />
          {!permissions.includes("*") && <p className="text-xs text-slate-500 mt-2">You can only add permissions you hold yourself.</p>}
        </div>
        {error && <Alert>{error}</Alert>}
      </div>
    </Modal>
  );
}
