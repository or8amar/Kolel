# תוכנית עבודה — Kolel Payments Tracker

מטרה: להגיע במהירות למצב **"אפשר להשתמש במערכת"** — אדמין אחד (`turgnr7@gmail.com`) מתחבר, מייבא אנשי קשר, מנהל פוטנציאלים, מזין תשלומים ורואה דשבורד.

**עקרון:** סביבה אחת בלבד — **Supabase Cloud** + **Netlify מענף `main`**. אין חובה להריץ Supabase מקומי ב-Docker.

---

## מצב נוכחי (סיכום סריקה)

### מה כבר מיושם

| אזור | סטטוס |
|------|--------|
| אפליקציית Next.js (`web/`) | מסכים: `/login`, `/`, `/contacts`, `/contacts/add`, `/import`, `/potentials`, `/potentials/[id]`, `/payments` |
| Supabase schema + RLS | `supabase/migrations/` — טבלאות, `is_admin()`, מדיניות לאדמין בלבד |
| אדמין ב-DB | `turgnr7@gmail.com` ב-`202605080001_seed_admin.sql` |
| ייבוא אנשי קשר | CSV, VCF, Excel, JSON, הדבקה, ידני, Browser Contacts API (כשזמין); זיהוי כפילויות לפי טלפון |
| הוספה ידנית / אחראי / אמצעי תשלום | Phase B — ראה למטה |
| Netlify | `netlify.toml` — base `web`, plugin Next.js |
| בילד | `npm run typecheck` ו-`npm run build` עוברים (נבדק מקומית) |

### מה חסר / דורש פעולה ידנית

| נושא | פירוט |
|------|--------|
| פרויקט Supabase בענן | עדיין לא מחובר — `web/.env.local` מכיל placeholders |
| משתמש Auth | צריך ליצור ב-Supabase Dashboard עם אותו אימייל כמו ב-`app_admins` |
| Migrations בענן | להריץ `supabase db push` אחרי `supabase link` |
| Deploy ל-Netlify | חיבור רפו + משתני סביבה |
| Auth URLs | `Site URL` + `Redirect URLs` ב-Supabase אחרי שיש URL מ-Netlify |
| בדיקות אוטומטיות | אין Vitest/Jest ב-`web/` — רק smoke ידני |
| אימות אדמין ב-UI | `AuthGuard` בודק session בלבד, לא `app_admins` (מספיק אם רק אדמין אחד קיים) |

### הערות טכניות

- האפליקציה הישנה (Vite בשורש) הוסרה — כל הפיתוח ב-`web/`.
- `supabase/config.toml` נשאר לצורך CLI (`db push`); **אין חובה** להריץ `supabase start`.
- seed (`supabase/seed.sql`) — נתוני דמה; **לא** מומלץ בפרודקשן.

---

## שלבים מומלצים

### שלב 1 — Supabase Cloud (יום 1, ~30–45 דק')

**תוצאה:** DB בענן עם סכמה + שורת אדמין + משתמש Auth.

1. צור פרויקט ב-[Supabase Dashboard](https://supabase.com/dashboard) (Region: Frankfurt או קרוב).
2. העתק מ-**Project Settings → API**:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. התקן [Supabase CLI](https://supabase.com/docs/guides/cli) והתחבר:
   ```powershell
   supabase login
   cd c:\Repos\Kolel
   supabase link --project-ref <PROJECT_REF>
   supabase db push
   ```
4. ודא ב-**Table Editor**: `contacts`, `payment_potentials`, `donations`, `donation_plans`, `status_history`, `app_admins`.
5. **Authentication → Users → Add user**:
   - אימייל: `turgnr7@gmail.com`
   - סיסמה חזקה
   - סמן **Auto Confirm User**
6. (מאוחר יותר) עדכן **Authentication → URL Configuration** אחרי שיש URL מ-Netlify.

פירוט מלא: [DEPLOY_CHECKLIST.md](../DEPLOY_CHECKLIST.md).

---

### שלב 2 — פיתוח מקומי מול הענן (יום 1, ~15 דק')

**תוצאה:** `npm run dev` עובד מול אותו DB כמו פרודקשן.

```powershell
cd c:\Repos\Kolel\web
copy .env.local.example .env.local
# ערוך .env.local — הדבק URL ו-anon key מהדשבורד (לא מ-127.0.0.1)
npm install
npm run dev
```

פתח `http://localhost:3000/login` והתחבר.

> **אזהרה:** פיתוח מקומי כותב לאותו DB כמו האתר החי. לניסויים הרסניים — עדיף פרויקט Supabase נפרד (רק אם תרצה בעתיד).

---

### שלב 3 — Netlify + `main` = פרודקשן (יום 1–2, ~30 דק')

**תוצאה:** אתר חי ב-HTTPS.

1. דחוף קוד ל-GitHub, ענף `main`.
2. Netlify: **Add site → Import** → בחר רפו.
3. ודא: Production branch = **`main`** (ללא ענף `develop` נפרד).
4. **Environment variables** (Production):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Deploy → העתק URL (`https://….netlify.app`).
6. ב-Supabase: **Site URL** + **Redirect URLs** = URL מ-Netlify (+ `http://localhost:3000` לפיתוח).

---

### שלב 4 — Smoke test (יום 2, ~20 דק')

הרץ את [SMOKE_TEST.md](./SMOKE_TEST.md) מול localhost ואז מול האתר ב-Netlify.

---

### שלב 5 — שימוש שוטף (אחרי שעובד)

זרימה מינימלית:

1. `git checkout main && git pull`
2. שינוי ב-`web/` או `supabase/migrations/`
3. אם יש migration חדש: `supabase db push`
4. `npm run typecheck && npm run build` ב-`web/`
5. `git push origin main` → Deploy אוטומטי ב-Netlify

---

### שלב 6 — שיפורים אופציונליים (לא חוסם שימוש)

| עדיפות | משימה |
|--------|--------|
| נמוכה | בדיקת `app_admins` ב-`AuthGuard` אחרי login |
| נמוכה | בדיקות יחידה ל-`dashboard-metrics`, `donations`, `contacts-import` |
| נמוכה | התראות Netlify על כשל deploy |
| נמוכה | גיבוי אוטומטי ב-Supabase |

---

## Phase A — הושלם (מודל סטטוס + דשבורד)

### מה בוצע

| אזור | פירוט |
|------|--------|
| DB | מיגרציה `20260519140000_phase_a_potential_status.sql` — enum חדש: `new`, `potential`, `high`, `paid`, `refused`, `not_interested`; מיפוי מערכים ישנים |
| סטטוסים פעילים | `new` (חדש), `potential` (פוטנציאל), `high` (גבוה) — מוצגים ב-`/potentials` כברירת מחדל |
| סטטוסים סגורים | `paid`, `refused`, `not_interested` — מסנן "ארכיון"; איש קשר נשאר במאגר |
| ייבוא / ידני | ברירת מחדל `new` |
| דשבורד | מאגר, פעילים לפי סטטוס, גבוה, שילמו, סכומים, חד־פעמי/מחזורי, גיוס ונגבה החודש, פער ליעד (`NEXT_PUBLIC_MONTHLY_TARGET_ILS`) |
| UI | `/contacts` — כל אנשי הקשר; קישור מ-`/potentials` |
| תשלום | הזנת תשלום מעדכנת סטטוס ל-`paid` |

**פעולה נדרשת:** אחרי `supabase link` — `supabase db push`

---

## Phase B — הושלם (תכונות ליבה)

### מה בוצע

| אזור | פירוט |
|------|--------|
| DB | מיגרציה `20260519150000_phase_b_responsible_payment_method.sql` — `responsibleContactId`, enum `payment_method`, שדות ב-`donations` ו-`donation_plans` |
| הוספה ידנית | `/contacts/add` — שם פרטי, שם משפחה (אופציונלי), טלפון → איש קשר + פוטנציאל `new`; קישור בתפריט |
| כפילויות | זיהוי לפי טלפון (ייבוא + הוספה ידנית) עם הודעה וקישור לכרטיס קיים |
| אחראי | בחירה בכרטיס `/potentials/[id]`; עמודה ברשימות פוטנציאלים ואנשי קשר |
| תשלום | סכום חובה, חד־פעמי/מחזורי, אמצעי תשלום (אשראי / בנק / נדרים פלוס / אחר + פירוט) |
| אנשי קשר | `/contacts` משופר עם אחראי וקישור להוספה |

**פעולה נדרשת:** אחרי `supabase link` — `supabase db push`

---

## קריטריון "מוכן לשימוש"

- [ ] התחברות ב-`/login` עם `turgnr7@gmail.com`
- [ ] ייבוא לפחות איש קשר אחד ב-`/import`
- [ ] רשימה ושינוי סטטוס ב-`/potentials`
- [ ] תשלום חד-פעמי + מחזורי ב-`/payments`
- [ ] KPI מתעדכנים ב-`/`
- [ ] כרטיס איש קשר ב-`/potentials/[id]` מציג היסטוריה ותשלומים

---

## משאבים

- [README.md](../README.md) — הרצה מקומית מול ענן
- [DEPLOY_CHECKLIST.md](../DEPLOY_CHECKLIST.md) — העלאה לאוויר
- [SMOKE_TEST.md](./SMOKE_TEST.md) — רשימת בדיקות ידניות
