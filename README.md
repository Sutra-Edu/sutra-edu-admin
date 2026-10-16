# Sutra Edu Admin

Next.js 16 admin panel for the Sutra Edu backend (`../sutra-edu-backend`), modelled on the Rentzoi admin.

```bash
npm install
npm run dev        # http://localhost:3005 (backend expected at NEXT_PUBLIC_API_URL, default http://localhost:3004)
```

Sign in with an admin account (dev seed: `sutraedu.official@gmail.com` / `sutra@123`).

| Page | Needs |
|---|---|
| Dashboard | any admin |
| Upload Book: pick board/class/subject, details, PDF (through the API or straight to the bucket) | `upload:books` (+ `manage:books`; `manage:curriculum` to create a missing syllabus) |
| Books, book detail (versions, new version, reprocess, archive, edit, usage) | `view:books` / `manage:books` / `upload:books` |
| Curriculum: boards, classes, subjects, syllabi | `view:curriculum` / `manage:curriculum` |
| Processing Jobs | `view:jobs` / `manage:jobs` |
| AI Studio: generate text, audio, images, video from book pages; review and approve | `view:books`, `generate:content`, `review:content` |
| AI Models: the model endpoint for each task | `view:model_configs` / `manage:model_configs` |
| Students & Parents (read-only) | `view:students` |
| Admin Staff, Roles & Permissions | `manage:admin_accounts`, `manage:roles` |
| Cloud Storage (status, test upload, bucket setup steps) | `manage:system_settings` |
| Audit Log | `view:audit_logs` |
| My Profile (name, password) | any admin |

The sidebar only shows pages the admin can use, and pages reached by URL without the permission show "Access denied".
The backend enforces every permission regardless.

Layout: `context/AuthContext.tsx` (session in localStorage, revalidated with `/admin/me`), `lib/api.ts` (axios, 401 →
login), `components/dashboard-shell.tsx` (sidebar + access gate), `components/ui.tsx` (shared UI), `app/(dashboard)/dashboard/*`.
