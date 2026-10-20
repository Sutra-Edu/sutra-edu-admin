"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Cloud, XCircle } from "lucide-react";
import api, { errorMessage } from "@/lib/api";
import { Alert, Button, Card, PageHeader, Spinner } from "@/components/ui";

interface BucketStatus {
  configured: boolean;
  bucket: string | null;
  reachable: boolean;
  writable: boolean | null;
  error?: string;
}

// Top-level fields describe the books bucket; `media` the AI media bucket
interface Status extends BucketStatus {
  endpoint: string | null;
  media: BucketStatus;
}

const CORS_RULE = `[
  {
    "AllowedOrigins": ["http://localhost:3005"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]`;

export default function StoragePage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [checking, setChecking] = useState<"read" | "write" | null>("read");
  const [error, setError] = useState<string | null>(null);

  const check = async (write: boolean) => {
    setChecking(write ? "write" : "read");
    setError(null);
    try {
      const res = await api.get<Status>(`/admin/storage/status${write ? "?write=true" : ""}`);
      setStatus(res.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setChecking(null);
    }
  };

  useEffect(() => {
    api.get<Status>("/admin/storage/status")
      .then((res) => setStatus(res.data))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setChecking(null));
  }, []);

  return (
    <>
      <PageHeader title="Cloud storage" description="Two private Cloudflare R2 buckets: one for books (PDFs, page images, figures) and one for AI-generated media. Check both here before uploading or generating."
        actions={<>
          <Button variant="secondary" loading={checking === "read"} onClick={() => check(false)}>Check connection</Button>
          <Button loading={checking === "write"} onClick={() => check(true)}>Test upload</Button>
        </>} />

      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <BucketCard title="Books bucket" envVar="R2_BUCKET" status={status} ready="Book uploads will work." />
          <BucketCard title="AI media bucket" envVar="R2_MEDIA_BUCKET" status={status?.media ?? null} ready="AI generation can store its media." />
          {status?.endpoint && <p className="text-xs text-slate-500 break-all">Endpoint: {status.endpoint}</p>}
        </div>

        <Card title="Setting up the buckets" className="lg:col-span-2">
          <ol className="space-y-4 text-sm text-slate-700 list-decimal pl-5">
            <li>
              In the Cloudflare dashboard open <b>R2</b>, create two buckets: one for books (e.g. <code className="bg-slate-100 px-1 rounded">sutra-edu-upload</code>)
              and one for AI media (e.g. <code className="bg-slate-100 px-1 rounded">sutra-edu-media</code>). Note your <b>Account ID</b>.
            </li>
            <li>
              Under <b>R2 → Manage API tokens</b>, create one token with <b>Object Read &amp; Write</b> on all buckets in the account. Copy the Access Key ID and Secret Access Key.
            </li>
            <li>
              Put them in <code className="bg-slate-100 px-1 rounded">sutra-edu-backend/.env</code> and restart the backend:
              <pre className="mt-2 bg-slate-900 text-slate-100 rounded-lg p-3 text-xs overflow-x-auto">{`R2_ACCOUNT_ID="your-account-id"
R2_ACCESS_KEY_ID="..."
R2_SECRET_ACCESS_KEY="..."
R2_BUCKET="sutra-edu-upload"
R2_MEDIA_BUCKET="sutra-edu-media"`}</pre>
            </li>
            <li>
              Optional, for &ldquo;Directly to cloud&rdquo; uploads (large files): in the <b>books</b> bucket&apos;s <b>Settings → CORS policy</b> add this rule (add your admin panel&apos;s live URL too). The media bucket needs none.
              <pre className="mt-2 bg-slate-900 text-slate-100 rounded-lg p-3 text-xs overflow-x-auto">{CORS_RULE}</pre>
            </li>
            <li>Click <b>Test upload</b> above. All checks on both buckets should be green.</li>
          </ol>
          <div className="mt-5 flex items-start gap-2 text-xs text-slate-500">
            <Cloud className="w-4 h-4 shrink-0" />
            Both buckets use the same folders, books/&#123;board&#125;/&#123;class&#125;/&#123;subject&#125;/&#123;book-code&#125;/v&#123;n&#125;/: the books bucket holds original/, pages/ and figures/; the media bucket holds generated/.
          </div>
        </Card>
      </div>
    </>
  );
}

function BucketCard({ title, envVar, status, ready }: { title: string; envVar: string; status: BucketStatus | null; ready: string }) {
  return (
    <Card title={title}>
      {!status ? <Spinner label="Checking…" /> : (
        <ul className="space-y-3 text-sm">
          <Check ok={status.configured && !!status.bucket} label={status.bucket ? `${envVar} = ${status.bucket}` : `${envVar} not set`} />
          <Check ok={status.reachable} label="Bucket reachable" />
          <Check ok={status.writable} label="Can write and delete a test file" pending={status.writable === null && status.reachable ? "Run “Test upload”" : undefined} />
          {status.error && <li><Alert>{status.error}</Alert></li>}
          {status.reachable && status.writable && <li><Alert kind="success">{ready}</Alert></li>}
        </ul>
      )}
    </Card>
  );
}

function Check({ ok, label, pending }: { ok: boolean | null; label: string; pending?: string }) {
  return (
    <li className="flex items-start gap-2">
      {ok ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" /> : <XCircle className={`w-5 h-5 shrink-0 ${pending ? "text-slate-300" : "text-red-500"}`} />}
      <span>
        {label}
        {pending && <span className="block text-xs text-slate-400">{pending}</span>}
      </span>
    </li>
  );
}
