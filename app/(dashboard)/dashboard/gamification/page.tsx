"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/lib/hooks";
import { P } from "@/lib/permissions";
import { Badge, PageHeader } from "@/components/ui";
import { FieldDef, ResourceEditor, Tabs, opts } from "@/components/resource-editor";

type Tab = "rules" | "badges" | "items" | "drops";
type Any = Record<string, unknown> & { id: string };

const PERIODS = ["ONCE", "DAILY", "WEEKLY", "PER_REF", "UNLIMITED"];
const SLOTS = ["HAIR", "FACE", "TOP", "BOTTOM", "SHOES", "HEADWEAR", "EYEWEAR", "NECKWEAR", "HANDHELD", "BACK", "PET", "FRAME", "ROOM_WALL", "ROOM_FLOOR", "ROOM_DESK", "ROOM_DECOR"];
const RARITY = ["COMMON", "RARE", "EPIC", "LEGENDARY"];
const UNLOCK = ["DEFAULT", "SHOP", "DROP", "LEVEL", "BADGE", "EVENT"];

export default function GamificationPage() {
  const { can } = useAuth();
  const canEdit = can(P.MANAGE_GAMIFICATION);
  const [tab, setTab] = useState<Tab>("rules");
  const triggers = useApi<{ trigger: string; note: string }[]>("/admin/gamification/triggers", []);
  const badges = useApi<Any[]>("/admin/gamification/badges", []);
  const drops = useApi<Any[]>("/admin/gamification/drop-tables", []);

  const ruleFields: FieldDef[] = [
    { key: "key", label: "Key", type: "text", required: true, createOnly: true, placeholder: "DAILY_LOGIN", hint: "Capitals and underscores; never changes" },
    { key: "name", label: "Name", type: "text", required: true },
    { key: "description", label: "Description", type: "textarea" },
    { key: "trigger", label: "When", type: "select", required: true, options: triggers.data.map((t) => ({ value: t.trigger, label: `${t.trigger} — ${t.note}` })) },
    { key: "conditions", label: "Conditions (JSON)", type: "json", hint: 'e.g. {"minSeconds": 3600} or {"minAccuracy": 1, "minItems": 5}' },
    { key: "points", label: "Points", type: "number", required: true },
    { key: "period", label: "How often", type: "select", options: opts(PERIODS) },
    { key: "maxPerPeriod", label: "Max per period", type: "number" },
    { key: "badgeId", label: "Also award badge", type: "select", options: badges.data.map((b) => ({ value: b.id, label: String(b.name) })) },
    { key: "dropTableId", label: "Also drop an item from", type: "select", options: drops.data.map((d) => ({ value: d.id, label: String(d.name) })) },
    { key: "grantsCrate", label: "Give a crate instead of dropping straight away", type: "checkbox" },
    { key: "isActive", label: "Active", type: "checkbox" },
  ];

  return (
    <>
      <PageHeader title="Rewards & avatar" description="The points economy: what earns points, badges, avatar items and crates. Points buy looks only." />
      <Tabs tabs={[{ key: "rules", label: "Reward rules" }, { key: "badges", label: "Badges" }, { key: "items", label: "Avatar items" }, { key: "drops", label: "Drop tables" }]} value={tab} onChange={setTab} />
      {tab === "rules" && (
        <ResourceEditor<Any>
          title="Reward rules" description="Each rule pays points (and optionally a badge or item) when its event happens, at most as often as its period allows."
          listPath="/admin/gamification/rules" createPath="/admin/gamification/rules" updatePath={(r) => `/admin/gamification/rules/${r.id}`}
          canEdit={canEdit} fields={ruleFields} defaults={{ isActive: true, period: "DAILY" }}
          columns={[
            { label: "Rule", render: (r) => <><div className="font-medium text-slate-900">{String(r.name)}</div><div className="text-xs text-slate-500">{String(r.key)}</div></> },
            { label: "When", render: (r) => <span className="text-xs">{String(r.trigger)}</span> },
            { label: "Points", render: (r) => String(r.points) },
            { label: "Period", render: (r) => <span className="text-xs">{String(r.period).toLowerCase()}{r.maxPerPeriod ? ` ×${r.maxPerPeriod}` : ""}</span> },
            { label: "", render: (r) => <Badge color={r.isActive ? "green" : "gray"}>{r.isActive ? "active" : "off"}</Badge> },
          ]}
        />
      )}
      {tab === "badges" && (
        <ResourceEditor<Any>
          title="Badges" listPath="/admin/gamification/badges" createPath="/admin/gamification/badges" updatePath={(r) => `/admin/gamification/badges/${r.id}`}
          canEdit={canEdit} defaults={{ isActive: true, tier: 1 }}
          fields={[
            { key: "code", label: "Code", type: "text", required: true, createOnly: true },
            { key: "name", label: "Name", type: "text", required: true },
            { key: "description", label: "Description", type: "textarea" },
            { key: "tier", label: "Tier (1-10)", type: "number" },
            { key: "isActive", label: "Active", type: "checkbox" },
          ]}
          columns={[
            { label: "Badge", render: (r) => <><div className="font-medium">{String(r.name)}</div><div className="text-xs text-slate-500">{String(r.code)}</div></> },
            { label: "Tier", render: (r) => String(r.tier) },
            { label: "Awarded", render: (r) => String((r._count as { awards?: number } | undefined)?.awards ?? 0) },
          ]}
        />
      )}
      {tab === "items" && (
        <ResourceEditor<Any>
          title="Avatar items" description="Upload the 3D asset and thumbnail for each item with the backend upload route; the app loads them from there."
          listPath="/admin/gamification/cosmetics" createPath="/admin/gamification/cosmetics" updatePath={(r) => `/admin/gamification/cosmetics/${r.id}`}
          canEdit={canEdit} defaults={{ isActive: true, rarity: "COMMON", unlockMethod: "SHOP" }}
          fields={[
            { key: "code", label: "Code", type: "text", required: true, createOnly: true },
            { key: "name", label: "Name", type: "text", required: true },
            { key: "description", label: "Description", type: "textarea" },
            { key: "slot", label: "Slot", type: "select", required: true, options: opts(SLOTS) },
            { key: "rarity", label: "Rarity", type: "select", options: opts(RARITY) },
            { key: "unlockMethod", label: "Unlocked by", type: "select", options: opts(UNLOCK) },
            { key: "price", label: "Price (points, for the shop)", type: "number" },
            { key: "unlockValue", label: "Unlock value (JSON)", type: "json", hint: 'LEVEL: {"level": 5} · BADGE: {"badgeCode": "STREAK_7"}' },
            { key: "metadata", label: "Metadata (JSON)", type: "json", hint: "Anything the app needs, e.g. colours or animation names" },
            { key: "sortOrder", label: "Sort order", type: "number" },
            { key: "isActive", label: "Active", type: "checkbox" },
          ]}
          columns={[
            { label: "Item", render: (r) => <><div className="font-medium">{String(r.name)}</div><div className="text-xs text-slate-500">{String(r.code)}</div></> },
            { label: "Slot", render: (r) => <span className="text-xs">{String(r.slot).toLowerCase()}</span> },
            { label: "Rarity", render: (r) => <Badge color={r.rarity === "LEGENDARY" ? "amber" : r.rarity === "EPIC" ? "purple" : r.rarity === "RARE" ? "blue" : "gray"}>{String(r.rarity).toLowerCase()}</Badge> },
            { label: "Unlock", render: (r) => <span className="text-xs">{String(r.unlockMethod).toLowerCase()}{r.price ? ` · ${r.price} pts` : ""}</span> },
            { label: "Owners", render: (r) => String((r._count as { owners?: number } | undefined)?.owners ?? 0) },
          ]}
        />
      )}
      {tab === "drops" && (
        <ResourceEditor<Any>
          title="Drop tables" description="What a drop or crate can give, with weights. Odds are public in the app."
          listPath="/admin/gamification/drop-tables" createPath="/admin/gamification/drop-tables" updatePath={(r) => `/admin/gamification/drop-tables/${r.id}`}
          canEdit={canEdit} defaults={{ isActive: true, entries: [{ itemCode: "CAP_RED", weight: 10 }] }}
          fields={[
            { key: "code", label: "Code", type: "text", required: true, createOnly: true },
            { key: "name", label: "Name", type: "text", required: true },
            { key: "description", label: "Description", type: "textarea" },
            { key: "entries", label: "Entries (JSON)", type: "json", required: true, hint: '[{"itemCode": "CAP_RED", "weight": 10}, …] — weight / total = chance' },
            { key: "duplicatePoints", label: "Points instead of a duplicate item", type: "number" },
            { key: "isActive", label: "Active", type: "checkbox" },
          ]}
          columns={[
            { label: "Table", render: (r) => <><div className="font-medium">{String(r.name)}</div><div className="text-xs text-slate-500">{String(r.code)}</div></> },
            { label: "Items", render: (r) => String(((r.entries as unknown[]) ?? []).length) },
          ]}
        />
      )}
    </>
  );
}
