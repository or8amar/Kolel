# Kolel Payments Tracker

מערכת WEB לניהול אנשי קשר, פוטנציאל תשלום, הזנת תרומות ודשבורד KPI.

## סטאק

- **Frontend:** Next.js (App Router) + TypeScript + Tailwind — `web/`
- **Backend:** Supabase Cloud (Auth + Postgres + RLS)
- **Deploy:** Netlify, ענף **`main`** = פרודקשן

## סביבה אחת

אין סביבת dev נפרדת ב-Docker. **פרויקט Supabase אחד בענן** משמש גם לפיתוח מקומי (`npm run dev`) וגם לאתר ב-Netlify.

> פיתוח מקומי כותב לאותו DB כמו האתר החי. היזהר בשינויים הרסניים.

## מה יש בפרויקט

| נתיב | תיאור |
|------|--------|
| `web/` | אפליקציית Next.js |
| `supabase/migrations/` | סכמת DB + RLS (אדמין יחיד) |
| `supabase/seed.sql` | נתוני דמה (אופציונלי, לא לפרודקשן) |
| `netlify.toml` | בילד Netlify |
| `docs/WORK_PLAN.md` | תוכנית עבודה לשימוש ראשון |
| `docs/SMOKE_TEST.md` | בדיקות ידניות |

## התחלה מהירה (Windows)

### 1) דרישות

- Node.js 20+ (`web/.nvmrc`)
- npm
- [Supabase CLI](https://supabase.com/docs/guides/cli) — רק ל-`db push`, **לא** חובה להריץ `supabase start`

### 2) Supabase Cloud (פעם אחת)

1. צור פרויקט ב-[supabase.com/dashboard](https://supabase.com/dashboard).
2. העלה migrations:
   ```powershell
   supabase login
   cd c:\Repos\Kolel
   supabase link --project-ref <PROJECT_REF>
   supabase db push
   ```
3. צור משתמש Auth: `turgnr7@gmail.com` (Auto Confirm) — ראה [DEPLOY_CHECKLIST.md](DEPLOY_CHECKLIST.md).

### 3) משתני סביבה מקומיים

```powershell
cd c:\Repos\Kolel\web
copy .env.local.example .env.local
```

ערוך `web\.env.local` — הדבק מ-**Project Settings → API**:

- `NEXT_PUBLIC_SUPABASE_URL` — Project URL (למשל `https://xxxxx.supabase.co`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — מפתח `anon` `public`

אם הקובץ כבר קיים עם `http://127.0.0.1:54321` — **החלף** בערכי הענן מהדשבורד.

### 4) הרצה

```powershell
cd c:\Repos\Kolel\web
npm install
npm run dev
```

פתח: `http://localhost:3000/login`

### 5) בדיקות בילד

```powershell
cd c:\Repos\Kolel\web
npm run typecheck
npm run build
```

## מסכים

| נתיב | תפקיד |
|------|--------|
| `/login` | התחברות אדמין |
| `/import` | ייבוא אנשי קשר |
| `/potentials` | ניהול פוטנציאלים |
| `/potentials/[id]` | כרטיס איש קשר |
| `/payments` | הזנת תשלום |
| `/` | דשבורד KPI |

## Netlify (פרודקשן)

`netlify.toml`: `base = "web"`, `@netlify/plugin-nextjs`.

1. חבר רפו GitHub, Production branch = **`main`**.
2. Environment variables (Production):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. אחרי Deploy — עדכן ב-Supabase **Authentication → URL Configuration** את כתובת האתר.

פרטים: [DEPLOY_CHECKLIST.md](DEPLOY_CHECKLIST.md).

## תיעוד נוסף

- [docs/WORK_PLAN.md](docs/WORK_PLAN.md)
- [docs/SMOKE_TEST.md](docs/SMOKE_TEST.md)

## פתרון בעיות (פיתוח מקומי)

### 404 על `/_next/static/chunks/main-app.js` או `app-pages-internals.js`

בדרך כלל אחד משני מצבים:

1. **מטמון `.next` לא תקין** (למשל אחרי `npm run build` או עצירה לא נקייה) — ה-HTML מפנה לקבצים שלא קיימים בדיסק.
2. **גישה דרך IP ברשת** (למשל `http://192.168.50.31:3001`) בעוד שהשרת עלה על `localhost` — Next.js 15 חוסם בקשות cross-origin לנכסי dev (`allowedDevOrigins` ב-`web/next.config.ts`).

**תיקון מיידי:**

```powershell
# עצור את כל תהליכי node (Ctrl+C בטרמינלים)
cd c:\Repos\Kolel\web
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run dev
```

לגישה מהרשת המקומית:

```powershell
npx next dev -H 0.0.0.0 -p 3001
```

ואז `http://<IP-של-המחשב>:3001/contacts` (לא לערבב עם `next start` או בילד ישן).
