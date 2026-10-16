"use client";

import { useState } from "react";
import { Plus, ShieldCheck } from "lucide-react";
import api, { errorMessage } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/lib/hooks";
import { P } from "@/lib/permissions";
import { PermissionChecklist } from "@/components/permission-checklist";
import {
  Alert, Badge, Button, Card, Checkbox, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, StatusBadge, Table, Td, fmtDate, fullName,
} from "@/components/ui";
import type { AdminUser, PermissionRow, Role } from "@/lib/types";

export default function AdminsPage() {
  const { user: me, can } = useAuth();
  const canRoles = can(P.MANAGE_ROLES);
  const admins = useApi<AdminUser[]>("/admin/users?take=200", []);
  const roles = useApi<Role[]>(canRoles ? "/admin/rbac/roles" : null, []);
  const perms = useApi<PermissionRow[]>(canRoles ? "/admin/rbac/permissions" : null, []);
  const [modal, setModal] = useState<{ mode: "create" } | { mode: "edit"; id: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <>
      <PageHeader title="Admin staff" description="People who can sign in to this panel. What they can do comes from their role plus any direct permissions."
        actions={<Button onClick={() => setModal({ mode: "create" })}><Plus className="w-4 h-4" /> Add admin</Button>} />
      {notice && <div className="mb-4"><Alert kind="success" onClose={() => setNotice(null)}>{notice}</Alert></div>}
      <Card>
        {admins.error && <Alert>{admins.error}</Alert>}
        {admins.loading ? <Spinner /> : admins.data.length === 0 ? <EmptyState title="No admins" /> : (
          <Table head={["Admin", "Role", "Status", "Last sign-in", ""]}>
            {admins.data.map((a) => (
              <tr key={a.id}>
                <Td>
                  <div className="font-medium flex items-center gap-1.5">{fullName(a)} {a.id === me?.id && <Badge>you</Badge>}</div>
                  <div className="text-xs text-slate-500">{a.email}{a.phone ? ` · ${a.phone}` : ""}</div>
                </Td>
                <Td>{a.isSuperAdmin ? <Badge color="purple"><ShieldCheck className="w-3 h-3 mr-1" />Super admin</Badge> : a.role ? <Badge color="blue">{a.role.name}</Badge> : <span className="text-slate-400">No role</span>}</Td>
                <Td><StatusBadge status={a.status} /></Td>
                <Td className="text-slate-500 whitespace-nowrap">{fmtDate(a.lastLoginAt)}</Td>
                <Td className="text-right">
                  {(!a.isSuperAdmin || me?.isSuperAdmin) && <Button size="sm" variant="ghost" onClick={() => setModal({ mode: "edit", id: a.id })}>Manage</Button>}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {modal?.mode === "create" && (
        <CreateAdminModal roles={roles.data} perms={perms.data} canRoles={canRoles} onClose={() => setModal(null)}
          onSaved={(email) => { setModal(null); admins.reload(); setNotice(`Admin ${email} created. Share the password with them; they can change it from My Profile.`); }} />
      )}
      {modal?.mode === "edit" && (
        <EditAdminModal id={modal.id} roles={roles.data} perms={perms.data} canRoles={canRoles} onClose={() => setModal(null)}
          onSaved={() => { setModal(null); admins.reload(); setNotice("Admin updated"); }} />
      )}
    </>
  );
}

function CreateAdminModal({ roles, perms, canRoles, onClose, onSaved }: {
  roles: Role[]; perms: PermissionRow[]; canRoles: boolean; onClose: () => void; onSaved: (email: string) => void;
}) {
  const { user: me, permissions } = useAuth();
  const [form, setForm] = useState({ email: "", password: "", firstName: "", lastName: "", phone: "", roleId: "", isSuperAdmin: false });
  const [direct, setDirect] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.post("/admin/users", {
        email: form.email.trim(), password: form.password,
        firstName: form.firstName.trim() || undefined, lastName: form.lastName.trim() || undefined, phone: form.phone.trim() || undefined,
        roleId: form.isSuperAdmin ? undefined : form.roleId || undefined,
        permissions: form.isSuperAdmin || !direct.length ? undefined : direct,
        isSuperAdmin: form.isSuperAdmin || undefined,
      });
      onSaved(form.email.trim());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const rolePerms = roles.find((r) => r.id === form.roleId)?.permissions.map((p) => p.action) ?? [];

  return (
    <Modal open onClose={onClose} title="Add admin" wide
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={saving} onClick={save} disabled={!form.email || form.password.length < 10}>Create admin</Button></>}>
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" required><Input type="email" value={form.email} onChange={set("email")} /></Field>
          <Field label="Temporary password" required hint="At least 10 characters"><Input type="text" value={form.password} onChange={set("password")} /></Field>
          <Field label="First name"><Input value={form.firstName} onChange={set("firstName")} /></Field>
          <Field label="Last name"><Input value={form.lastName} onChange={set("lastName")} /></Field>
          <Field label="Phone" hint="Optional, 10 digits"><Input value={form.phone} onChange={set("phone")} /></Field>
          {canRoles && !form.isSuperAdmin && (
            <Field label="Role">
              <Select value={form.roleId} onChange={set("roleId")}>
                <option value="">No role</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </Select>
            </Field>
          )}
        </div>
        {me?.isSuperAdmin && (
          <Checkbox checked={form.isSuperAdmin} onChange={set("isSuperAdmin")} label="Super admin" description="Can do everything, including managing other super admins." />
        )}
        {canRoles && !form.isSuperAdmin && perms.length > 0 && (
          <div>
            <div className="text-sm font-medium text-slate-700 mb-2">Extra permissions <span className="font-normal text-slate-500">(on top of the role)</span></div>
            <PermissionChecklist all={perms} selected={direct} onChange={setDirect} grantable={permissions} locked={rolePerms} />
          </div>
        )}
        {error && <Alert>{error}</Alert>}
      </div>
    </Modal>
  );
}

function EditAdminModal({ id, roles, perms, canRoles, onClose, onSaved }: {
  id: string; roles: Role[]; perms: PermissionRow[]; canRoles: boolean; onClose: () => void; onSaved: () => void;
}) {
  const { data: admin, loading, error: loadError } = useApi<AdminUser | null>(`/admin/users/${id}`, null);
  if (loading || !admin) {
    return (
      <Modal open onClose={onClose} title="Manage admin">
        {loadError ? <Alert>{loadError}</Alert> : <Spinner />}
      </Modal>
    );
  }
  return <EditAdminForm admin={admin} roles={roles} perms={perms} canRoles={canRoles} onClose={onClose} onSaved={onSaved} />;
}

function EditAdminForm({ admin, roles, perms, canRoles, onClose, onSaved }: {
  admin: AdminUser; roles: Role[]; perms: PermissionRow[]; canRoles: boolean; onClose: () => void; onSaved: () => void;
}) {
  const { user: me, permissions } = useAuth();
  const id = admin.id;
  const [form, setForm] = useState({
    firstName: admin.firstName ?? "", lastName: admin.lastName ?? "", status: admin.status as string, roleId: admin.role?.id ?? "",
    isSuperAdmin: admin.isSuperAdmin, password: "",
  });
  const [direct, setDirect] = useState<string[]>(admin.customPermissions?.map((p) => p.action) ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const self = id === me?.id;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { firstName: form.firstName.trim(), lastName: form.lastName.trim() };
      if (form.status !== admin.status) body.status = form.status;
      if (form.isSuperAdmin !== admin.isSuperAdmin) body.isSuperAdmin = form.isSuperAdmin;
      if (canRoles && !form.isSuperAdmin && form.roleId !== (admin.role?.id ?? "")) body.roleId = form.roleId || null;
      if (form.password) body.password = form.password;
      await api.patch(`/admin/users/${id}`, body);
      const before = (admin.customPermissions ?? []).map((p) => p.action).sort().join();
      if (canRoles && !form.isSuperAdmin && direct.slice().sort().join() !== before) {
        await api.put(`/admin/rbac/users/${id}/permissions`, { permissions: direct });
      }
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const rolePerms = roles.find((r) => r.id === form.roleId)?.permissions.map((p) => p.action) ?? [];

  return (
    <Modal open onClose={onClose} title={`Manage ${fullName(admin)}`} wide
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={saving} onClick={save}>Save changes</Button></>}>
      {(
        <div className="space-y-5">
          <div className="text-sm text-slate-500">{admin.email} · created {fmtDate(admin.createdAt)}</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name"><Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></Field>
            <Field label="Last name"><Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></Field>
            <Field label="Status" hint={self ? "You can't deactivate yourself" : "Suspending signs them out immediately"}>
              <Select value={form.status} disabled={self} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="DEACTIVATED">Deactivated</option>
              </Select>
            </Field>
            {canRoles && !form.isSuperAdmin && (
              <Field label="Role" hint={self && !me?.isSuperAdmin ? "You can't change your own role" : undefined}>
                <Select value={form.roleId} disabled={self && !me?.isSuperAdmin} onChange={(e) => setForm({ ...form, roleId: e.target.value })}>
                  <option value="">No role</option>
                  {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </Select>
              </Field>
            )}
            <Field label="Reset password" hint="Leave empty to keep it. At least 10 characters; signs them out everywhere.">
              <Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="New password" />
            </Field>
          </div>
          {me?.isSuperAdmin && !self && (
            <Checkbox checked={form.isSuperAdmin} onChange={(e) => setForm({ ...form, isSuperAdmin: e.target.checked })} label="Super admin" description="Full access, bypasses all permission checks." />
          )}
          {canRoles && !form.isSuperAdmin && perms.length > 0 && !(self && !me?.isSuperAdmin) && (
            <div>
              <div className="text-sm font-medium text-slate-700 mb-2">Extra permissions <span className="font-normal text-slate-500">(on top of the role)</span></div>
              <PermissionChecklist all={perms} selected={direct} onChange={setDirect} grantable={permissions} locked={rolePerms} />
            </div>
          )}
          {!form.isSuperAdmin && (
            <div className="text-xs text-slate-500">Effective permissions now: {admin.permissions.length ? admin.permissions.join(", ") : "none"}</div>
          )}
          {error && <Alert>{error}</Alert>}
        </div>
      )}
    </Modal>
  );
}
