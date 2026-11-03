"use client";

import { useState } from "react";
import api, { errorMessage } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/lib/hooks";
import { P } from "@/lib/permissions";
import { Alert, Badge, Button, Card, Checkbox, Field, Input, PageHeader, Spinner, Textarea } from "@/components/ui";

interface Output { kind: "TEXT" | "AUDIO" | "IMAGE" | "VIDEO"; purpose: string }
interface Settings {
  web: { enabled: boolean; allowedDomains: string[]; maxResults: number; provider: { configured: boolean; provider: string | null; reason: string | null } };
  tutor: { verifyCitations: boolean; moderation: boolean; allowWeb: boolean; passages: number };
  autopilot: {
    enabled: boolean; outputs: Output[]; languages: string[]; games: boolean; maxGamesPerTopic: number; itemsPerGame: number;
    mapTopics: boolean; requireConfirmedRanges: boolean;
  };
}

// Everything autopilot can make for a topic (mirrors PURPOSES in the backend's content/prompts.ts)
const OUTPUTS: (Output & { label: string })[] = [
  { kind: "TEXT", purpose: "lesson", label: "Lesson (text)" },
  { kind: "TEXT", purpose: "summary", label: "Summary (text)" },
  { kind: "TEXT", purpose: "notes", label: "Revision notes (text)" },
  { kind: "TEXT", purpose: "quiz", label: "Practice questions (text)" },
  { kind: "AUDIO", purpose: "narration", label: "Explained narration (audio)" },
  { kind: "AUDIO", purpose: "summary", label: "Audio summary" },
  { kind: "IMAGE", purpose: "diagram", label: "Labelled diagram (image)" },
  { kind: "IMAGE", purpose: "illustration", label: "Concept illustration (image)" },
  { kind: "VIDEO", purpose: "explainer", label: "Explainer video" },
  { kind: "VIDEO", purpose: "summary", label: "Recap video" },
];
const same = (a: Output, b: Output) => a.kind === b.kind && a.purpose === b.purpose;

export default function AiSettingsPage() {
  const settings = useApi<Settings | null>("/admin/settings", null);
  const [notice, setNotice] = useState<Notice>(null);
  if (!settings.data) return settings.error ? <Alert>{settings.error}</Alert> : <Spinner />;
  // Remounts with fresh values after every save
  return <Editor key={JSON.stringify(settings.data)} initial={settings.data} reload={settings.reload} notice={notice} setNotice={setNotice} />;
}

type Notice = { kind: "error" | "success"; text: string } | null;

function Editor({ initial, reload, notice, setNotice }: { initial: Settings; reload: () => void; notice: Notice; setNotice: (n: Notice) => void }) {
  const { can } = useAuth();
  const canEdit = can(P.MANAGE_SYSTEM_SETTINGS);
  const [web, setWeb] = useState(initial.web);
  const [domains, setDomains] = useState(initial.web.allowedDomains.join("\n"));
  const [tutor, setTutor] = useState(initial.tutor);
  const [auto, setAuto] = useState(initial.autopilot);
  const [languages, setLanguages] = useState(initial.autopilot.languages.join(", "));
  const [saving, setSaving] = useState<string | null>(null);
  const [testQ, setTestQ] = useState("");
  const [testResults, setTestResults] = useState<{ title: string; url: string; snippet: string }[] | null>(null);

  const save = async (key: "web" | "tutor" | "autopilot", body: object) => {
    setSaving(key);
    setNotice(null);
    try {
      await api.patch(`/admin/settings/${key}`, body);
      setNotice({ kind: "success", text: "Saved" });
      reload();
    } catch (err) {
      setNotice({ kind: "error", text: errorMessage(err) });
    } finally {
      setSaving(null);
    }
  };
  const testWeb = async () => {
    setTestResults(null);
    try {
      const { data } = await api.get(`/admin/settings/web/test?q=${encodeURIComponent(testQ)}`);
      setTestResults(data.results);
    } catch (err) {
      setNotice({ kind: "error", text: errorMessage(err) });
    }
  };

  return (
    <>
      <PageHeader title="AI settings" description="How the tutor answers, which websites it may use, and what autopilot makes for every topic." />
      {notice && <div className="mb-4"><Alert kind={notice.kind} onClose={() => setNotice(null)}>{notice.text}</Alert></div>}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Autopilot" actions={<Badge color={auto.enabled ? "green" : "gray"}>{auto.enabled ? "on" : "off"}</Badge>}>
          <div className="space-y-4">
            <Checkbox disabled={!canEdit} checked={auto.enabled} onChange={(e) => setAuto({ ...auto, enabled: e.target.checked })}
              label="Make content automatically" description="When a book finishes processing, the AI maps topics to pages and makes everything below for each topic. People only review." />
            <Checkbox disabled={!canEdit} checked={auto.mapTopics} onChange={(e) => setAuto({ ...auto, mapTopics: e.target.checked })}
              label="Map syllabus topics to book pages with AI" description="Saved as suggestions in the Review queue." />
            <Checkbox disabled={!canEdit} checked={auto.requireConfirmedRanges} onChange={(e) => setAuto({ ...auto, requireConfirmedRanges: e.target.checked })}
              label="Wait for a person to confirm topic pages before making content" description="Safer and cheaper (nothing is made from a wrong mapping), but slower." />
            <div>
              <div className="text-sm font-medium text-slate-700 mb-2">Make for every topic</div>
              <div className="grid sm:grid-cols-2 gap-2">
                {OUTPUTS.map((o) => (
                  <Checkbox key={`${o.kind}-${o.purpose}`} disabled={!canEdit} label={o.label}
                    checked={auto.outputs.some((x) => same(x, o))}
                    onChange={(e) => setAuto({ ...auto, outputs: e.target.checked ? [...auto.outputs, { kind: o.kind, purpose: o.purpose }] : auto.outputs.filter((x) => !same(x, o)) })} />
                ))}
              </div>
            </div>
            <Field label="Languages" hint="Comma-separated codes, e.g. en, hi, hinglish. Empty = each book's own language. Every language multiplies the work.">
              <Input disabled={!canEdit} value={languages} onChange={(e) => setLanguages(e.target.value)} placeholder="book's language" />
            </Field>
            <Checkbox disabled={!canEdit} checked={auto.games} onChange={(e) => setAuto({ ...auto, games: e.target.checked })} label="Draft game rounds for every topic" />
            <div className="grid grid-cols-2 gap-4">
              <Field label="Games per topic"><Input type="number" min={0} max={10} disabled={!canEdit} value={auto.maxGamesPerTopic} onChange={(e) => setAuto({ ...auto, maxGamesPerTopic: Number(e.target.value) })} /></Field>
              <Field label="Questions per round"><Input type="number" min={2} max={30} disabled={!canEdit} value={auto.itemsPerGame} onChange={(e) => setAuto({ ...auto, itemsPerGame: Number(e.target.value) })} /></Field>
            </div>
            {canEdit && (
              <Button loading={saving === "autopilot"} onClick={() => save("autopilot", {
                ...auto, languages: languages.split(",").map((l) => l.trim()).filter(Boolean),
              })}>Save autopilot</Button>
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card title="Tutor">
            <div className="space-y-4">
              <Checkbox disabled={!canEdit} checked={tutor.verifyCitations} onChange={(e) => setTutor({ ...tutor, verifyCitations: e.target.checked })}
                label="Check every quote against its source" description="Quotes that don't appear in the cited page are dropped; answers left without a checked citation are flagged." />
              <Checkbox disabled={!canEdit} checked={tutor.moderation} onChange={(e) => setTutor({ ...tutor, moderation: e.target.checked })}
                label="Safety check questions and answers" description="Uses the MODERATION model when one is active." />
              <Checkbox disabled={!canEdit} checked={tutor.allowWeb} onChange={(e) => setTutor({ ...tutor, allowWeb: e.target.checked })}
                label="Answer beyond the syllabus from allowed websites" description="Only for questions about the subject or topic that the books don't fully answer." />
              <Field label="Book passages per question" hint="Searched across every book the syllabus uses">
                <Input type="number" min={0} max={20} disabled={!canEdit} value={tutor.passages} onChange={(e) => setTutor({ ...tutor, passages: Number(e.target.value) })} />
              </Field>
              {canEdit && <Button loading={saving === "tutor"} onClick={() => save("tutor", tutor)}>Save tutor</Button>}
            </div>
          </Card>

          <Card title="Web search" actions={web.provider.configured ? <Badge color="green">{web.provider.provider}</Badge> : <Badge color="red">not set up</Badge>}>
            <div className="space-y-4">
              {!web.provider.configured && <Alert kind="info">{web.provider.reason} in the backend .env, then restart. See docs/SETUP.md → Web search.</Alert>}
              <Checkbox disabled={!canEdit} checked={web.enabled} onChange={(e) => setWeb({ ...web, enabled: e.target.checked })} label="Web search on" />
              <Field label="Allowed websites" hint="One per line. Subdomains are included (ncert.nic.in covers www.ncert.nic.in). Nothing else is ever searched or quoted.">
                <Textarea rows={8} className="font-mono text-xs" disabled={!canEdit} value={domains} onChange={(e) => setDomains(e.target.value)} />
              </Field>
              <Field label="Results per search"><Input type="number" min={1} max={10} disabled={!canEdit} value={web.maxResults} onChange={(e) => setWeb({ ...web, maxResults: Number(e.target.value) })} /></Field>
              {canEdit && (
                <Button loading={saving === "web"} onClick={() => save("web", {
                  enabled: web.enabled, maxResults: web.maxResults, allowedDomains: domains.split(/\s+/).filter(Boolean),
                })}>Save web search</Button>
              )}
              {canEdit && web.provider.configured && (
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <div className="flex gap-2">
                    <Input placeholder="Try a question, e.g. why is the sky blue" value={testQ} onChange={(e) => setTestQ(e.target.value)} />
                    <Button variant="secondary" disabled={!testQ.trim()} onClick={testWeb}>Test</Button>
                  </div>
                  {testResults && (testResults.length ? (
                    <ul className="text-sm space-y-2">
                      {testResults.map((r) => (
                        <li key={r.url}><a href={r.url} target="_blank" rel="noreferrer" className="text-indigo-600 underline">{r.title}</a><div className="text-xs text-slate-500">{r.snippet.slice(0, 200)}</div></li>
                      ))}
                    </ul>
                  ) : <div className="text-sm text-slate-500">No results from the allowed sites.</div>)}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
