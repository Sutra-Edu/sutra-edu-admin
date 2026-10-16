"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import api, { errorMessage, setSession } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Alert, Badge, Button, Card, Field, Input, PageHeader, fmtDate } from "@/components/ui";
import type { AdminUser } from "@/lib/types";

export default function ProfilePage() {
  const { user } = useAuth();
  if (!user) return null;
  // Remount when the signed-in admin changes so the forms start from their data
  return <ProfileForms key={user.id} user={user} />;
}

function ProfileForms({ user }: { user: AdminUser }) {
  const { setUser, refresh } = useAuth();
  const [name, setName] = useState({ firstName: user.firstName ?? "", lastName: user.lastName ?? "" });
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [saving, setSaving] = useState<"name" | "pw" | null>(null);
  const [notice, setNotice] = useState<{ kind: "error" | "success"; text: string; for: "name" | "pw" } | null>(null);

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving("name");
    setNotice(null);
    try {
      const res = await api.patch<AdminUser>("/admin/me", { firstName: name.firstName.trim(), lastName: name.lastName.trim() });
      setUser(res.data);
      setNotice({ kind: "success", text: "Name updated", for: "name" });
    } catch (err) {
      setNotice({ kind: "error", text: errorMessage(err), for: "name" });
    } finally {
      setSaving(null);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.newPassword !== pw.confirm) {
      setNotice({ kind: "error", text: "The new passwords don't match", for: "pw" });
      return;
    }
    setSaving("pw");
    setNotice(null);
    try {
      // Other sessions are signed out; this one continues with the returned token
      const res = await api.patch<{ token: string }>("/admin/me/password", { currentPassword: pw.currentPassword, newPassword: pw.newPassword });
      setSession(res.data.token, user);
      await refresh();
      setPw({ currentPassword: "", newPassword: "", confirm: "" });
      setNotice({ kind: "success", text: "Password changed. Your other sessions were signed out.", for: "pw" });
    } catch (err) {
      setNotice({ kind: "error", text: errorMessage(err), for: "pw" });
    } finally {
      setSaving(null);
    }
  };

  return (
    <>
      <PageHeader title="My profile" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Account">
          <dl className="grid grid-cols-2 gap-4 text-sm mb-6">
            <div><dt className="text-xs uppercase tracking-wide text-slate-500">Email</dt><dd className="mt-1">{user.email}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-slate-500">Access</dt><dd className="mt-1">
              {user.isSuperAdmin ? <Badge color="purple"><ShieldCheck className="w-3 h-3 mr-1" />Super admin</Badge> : user.role ? <Badge color="blue">{user.role.name}</Badge> : "No role"}
            </dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-slate-500">Last sign-in</dt><dd className="mt-1">{fmtDate(user.lastLoginAt)}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-slate-500">Permissions</dt><dd className="mt-1 text-xs">{user.isSuperAdmin ? "All" : user.permissions.join(", ") || "None"}</dd></div>
          </dl>
          <form onSubmit={saveName} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name"><Input value={name.firstName} onChange={(e) => setName({ ...name, firstName: e.target.value })} /></Field>
              <Field label="Last name"><Input value={name.lastName} onChange={(e) => setName({ ...name, lastName: e.target.value })} /></Field>
            </div>
            {notice?.for === "name" && <Alert kind={notice.kind}>{notice.text}</Alert>}
            <Button type="submit" loading={saving === "name"}>Save name</Button>
          </form>
        </Card>

        <Card title="Change password">
          <form onSubmit={changePassword} className="space-y-4">
            <Field label="Current password" required><Input type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} required /></Field>
            <Field label="New password" required hint="At least 10 characters"><Input type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} required minLength={10} /></Field>
            <Field label="Confirm new password" required><Input type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required /></Field>
            {notice?.for === "pw" && <Alert kind={notice.kind}>{notice.text}</Alert>}
            <Button type="submit" loading={saving === "pw"}>Change password</Button>
          </form>
        </Card>
      </div>
    </>
  );
}
