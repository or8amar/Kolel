# Deploy Checklist — Kolel Payments Tracker

רשימה מינימלית להעלאת המערכת לאוויר.  
**סביבה אחת:** Supabase Cloud + Netlify מענף `main`. אין Supabase מקומי ב-Docker.

סדר: Supabase → משתני סביבה מקומיים → בדיקה מקומית → Git → Netlify → Smoke test.

---

## שלב 0 — הכנה (Windows)

- [ ] Node.js 20+
- [ ] Git
- [ ] [Supabase CLI](https://supabase.com/docs/guides/cli) (ל-`link` + `db push` בלבד)
- [ ] בילד מקומי:
  ```powershell
  cd c:\Repos\Kolel\web
  npm install
  npm run typecheck
  npm run build
  ```

---

## שלב 1 — Supabase Cloud

### 1.1 פרויקט

- [ ] [supabase.com](https://supabase.com) → פרויקט חדש (Region: Frankfurt או קרוב)
- [ ] שמור סיסמת DB במקום בטוח
- [ ] המתן לסיום provisioning

### 1.2 מפתחות API

מ-**Project Settings → API**:

- [ ] `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `anon` `public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 1.3 סכמה (migrations)

```powershell
supabase login
cd c:\Repos\Kolel
supabase link --project-ref <PROJECT_REF>
supabase db push
```

`PROJECT_REF` = **Project Settings → General → Reference ID**

- [ ] ב-**Table Editor** קיימות: `contacts`, `payment_potentials`, `donations`, `donation_plans`, `status_history`, `app_admins`

### 1.4 אדמין

- [x] אימייל ב-migration: `turgnr7@gmail.com` (`202605080001_seed_admin.sql`)
- [ ] אחרי `db push` — שורה ב-`app_admins`
- [ ] **Authentication → Users → Add user**:
  - אימייל: `turgnr7@gmail.com`
  - סיסמה חזקה
  - **Auto Confirm User**

### 1.5 Auth URLs (אחרי שיש URL מ-Netlify)

- [ ] **Authentication → URL Configuration**:
  - `Site URL` = `https://<your-site>.netlify.app`
  - `Redirect URLs`: אותו URL + `http://localhost:3000` (לפיתוח)

### 1.6 Seed (לא מומלץ בפרודקשן)

רק לניסויים בענן נפרד:

```powershell
supabase db seed --file supabase/seed.sql
```

---

## שלב 2 — פיתוח מקומי מול הענן

```powershell
cd c:\Repos\Kolel\web
copy .env.local.example .env.local
```

- [ ] מילוי `.env.local` בערכי הענן (לא `127.0.0.1`)
- [ ] `npm run dev` → `http://localhost:3000/login` → התחברות מצליחה
- [ ] `.env.local` **לא** ב-Git (בדוק `.gitignore`)

---

## שלב 3 — Git & GitHub

- [ ] רפו ב-GitHub, ענף `main`
- [ ] `git push -u origin main`
- [ ] אין צורך בענף `develop` — `main` הוא פרודקשן

---

## שלב 4 — Netlify

### 4.1 חיבור

- [ ] [app.netlify.com](https://app.netlify.com) → Import from Git → רפו Kolel
- [ ] **Production branch:** `main`
- [ ] Build (מ-`netlify.toml`): base `web`, `npm run build`

### 4.2 משתני סביבה

**Site settings → Environment variables** (Production):

- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`

(אותם ערכים כמו ב-`.env.local`)

### 4.3 Deploy

- [ ] Deploy ראשון מוצלח
- [ ] העתק URL: `https://<site>.netlify.app`
- [ ] עדכן Auth URLs ב-Supabase (שלב 1.5)

### 4.4 (אופציונלי) דומיין מותאם

- [ ] Domain settings → custom domain → עדכן Supabase Site URL

---

## שלב 5 — Smoke test

- [ ] מקומי: [docs/SMOKE_TEST.md](docs/SMOKE_TEST.md)
- [ ] פרודקשן: אותה רשימה מול URL של Netlify

---

## שלב 6 — תחזוקה

- [ ] גיבוי אוטומטי: Supabase → Database → Backups
- [ ] התראות Netlify על כשל deploy
- [ ] לכל שינוי schema: `supabase db push` ואז `git push` ל-`main`

### זרימת עבודה שוטפת

1. `git pull origin main`
2. פיתוח ב-`web/`
3. `npm run typecheck && npm run build`
4. `git push origin main` → Deploy אוטומטי

---

## משאבים

- [docs/WORK_PLAN.md](docs/WORK_PLAN.md)
- [docs/SMOKE_TEST.md](docs/SMOKE_TEST.md)
- [README.md](README.md)
- Supabase: https://supabase.com/dashboard
- Netlify: https://app.netlify.com
