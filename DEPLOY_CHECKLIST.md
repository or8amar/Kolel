# Deploy Checklist - Kolel Payments Tracker

רשימת משימות מלאה להעלאת המערכת לאוויר.
סדר הביצוע חשוב: קודם Supabase, אחר כך Git, ולבסוף Netlify.

---

## שלב 0 - הכנות מקומיות

- [ ] להתקין `Node.js 20+`
- [ ] להתקין `Git`
- [ ] להתקין `Supabase CLI`
- [ ] להתקין `Netlify CLI` (אופציונלי, אך מומלץ)
- [ ] לוודא שהפרויקט בונה לוקאלית בהצלחה:
  ```powershell
  cd c:\Repos\Kolel\web
  npm install
  npm run build
  ```

---

## שלב 1 - Supabase Cloud

### 1.1 יצירת פרויקט בענן
- [ ] להיכנס ל-[supabase.com](https://supabase.com)
- [ ] ליצור פרויקט חדש (Region: `Frankfurt` או הקרוב אליך)
- [ ] לשמור במקום בטוח את סיסמת ה-DB
- [ ] להמתין שהפרויקט יסיים provisioning

### 1.2 איסוף מפתחות
- [ ] להעתיק מ-`Project Settings → API`:
  - [ ] `Project URL` → לשמור כ-`NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `anon public` → לשמור כ-`NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] `service_role` → לשמור כ-`SUPABASE_SERVICE_ROLE_KEY` (סודי!)

### 1.3 חיבור CLI לפרויקט
- [ ] להתחבר ל-Supabase CLI:
  ```powershell
  supabase login
  ```
- [ ] לשייך את הפרויקט המקומי לפרויקט הענן:
  ```powershell
  cd c:\Repos\Kolel
  supabase link --project-ref <PROJECT_REF>
  ```
  > את `PROJECT_REF` מוצאים ב-`Project Settings → General → Reference ID`

### 1.4 העלאת הסכמה ל-Cloud
- [ ] להריץ migrations על ה-DB בענן:
  ```powershell
  supabase db push
  ```
- [ ] לוודא ב-`Table Editor` שהטבלאות נוצרו:
  - [ ] `contacts`
  - [ ] `payment_potentials`
  - [ ] `donations`
  - [ ] `donation_plans`
  - [ ] `status_history`
  - [ ] `app_admins`

### 1.5 הגדרת אדמין
- [x] אימייל אדמין נקבע: `turgnr7@gmail.com` (כבר מוגדר ב-migration `202605080001_seed_admin.sql`)
- [ ] לוודא ב-`Table Editor → app_admins` שהאימייל אכן מופיע אחרי `db push`
- [ ] ליצור משתמש Auth בענן:
  - `Authentication → Users → Add user → Create new user`
  - אימייל: `turgnr7@gmail.com`
  - סיסמה חזקה (שמור במקום בטוח)
  - לסמן `Auto Confirm User`

### 1.6 הגדרות Auth
- [ ] ב-`Authentication → URL Configuration`:
  - [ ] `Site URL` = הכתובת של Netlify (אחרי Deploy)
  - [ ] `Redirect URLs` = להוסיף את כתובת Netlify
  > אפשר לחזור לשלב הזה אחרי שיש לך URL מ-Netlify

### 1.7 (אופציונלי) Seed Data
- [ ] רק אם אתה רוצה נתוני דמה בפרודקשן (בד"כ לא):
  ```powershell
  supabase db seed --file supabase/seed.sql
  ```

---

## שלב 2 - Git & GitHub

### 2.1 הקמת רפו
- [ ] לאתחל git ולעשות commit ראשון:
  ```powershell
  cd c:\Repos\Kolel
  git init
  git add .
  git commit -m "init: payments tracker mvp"
  ```
- [ ] לוודא ש-`.env.local` לא נכנס ל-commit (חייב להיות ב-`.gitignore`)
- [ ] ליצור רפו ריק ב-GitHub
- [ ] לחבר ולדחוף:
  ```powershell
  git branch -M main
  git remote add origin <YOUR_GITHUB_REPO_URL>
  git push -u origin main
  ```

### 2.2 ענף develop
- [ ] ליצור ענף develop:
  ```powershell
  git checkout -b develop
  git push -u origin develop
  ```

### 2.3 הגנת branches (ב-GitHub)
- [ ] `Settings → Branches → Add rule` עבור `main`:
  - [ ] Require pull request before merging
  - [ ] Require status checks to pass

---

## שלב 3 - Netlify

### 3.1 חיבור הריפו
- [ ] להיכנס ל-[app.netlify.com](https://app.netlify.com)
- [ ] `Add new site → Import an existing project`
- [ ] לבחור GitHub ולהרשות גישה לרפו
- [ ] לבחור את רפו `Kolel`

### 3.2 הגדרות Build
- [ ] לוודא ש-Netlify מזהה את `netlify.toml` (אמור להיות אוטומטי):
  - Base directory: `web`
  - Build command: `npm run build`
  - Publish directory: `web/.next`
- [ ] Plugin: `@netlify/plugin-nextjs` (מותקן אוטומטית)

### 3.3 משתני סביבה
- [ ] `Site settings → Environment variables → Add variable`:
  - [ ] `NEXT_PUBLIC_SUPABASE_URL` = (מ-Supabase)
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (מ-Supabase)
  - [ ] `SUPABASE_SERVICE_ROLE_KEY` = (מ-Supabase, סודי!)
- [ ] לוודא שכל המשתנים מסומנים גם ל-Production וגם ל-Deploy previews

### 3.4 הגדרות ענפים
- [ ] `Site settings → Build & deploy → Branches and deploy contexts`:
  - [ ] Production branch: `main`
  - [ ] Branch deploys: `None` (או רק `develop` אם תרצה preview)
  - [ ] Deploy Previews: `Any pull request against your production branch`

### 3.5 Deploy ראשון
- [ ] להריץ Deploy ידני ראשון: `Deploys → Trigger deploy → Deploy site`
- [ ] לעקוב אחרי הלוג עד הצלחה
- [ ] להעתיק את ה-URL של האתר (`https://<random>.netlify.app`)

### 3.6 חיבור ה-URL חזרה ל-Supabase
- [ ] לחזור ל-Supabase:
  - [ ] `Authentication → URL Configuration → Site URL` = ה-URL מ-Netlify
  - [ ] להוסיף את אותו URL גם ל-`Redirect URLs`

### 3.7 (אופציונלי) דומיין מותאם אישית
- [ ] אם יש לך דומיין: `Domain settings → Add custom domain`
- [ ] לעדכן DNS לפי ההוראות של Netlify
- [ ] לחזור ל-Supabase ולעדכן את ה-Site URL לדומיין החדש

---

## שלב 4 - Smoke Test בפרודקשן

- [ ] להיכנס ל-URL של האתר
- [ ] להגיע ל-`/login`
- [ ] להתחבר עם משתמש האדמין
- [ ] להגיע ל-`/import` ולייבא איש קשר אחד (CSV או Browser API)
- [ ] להגיע ל-`/potentials` ולשנות סטטוס לפוטנציאל
- [ ] להגיע ל-`/payments` ולהזין תשלום חד-פעמי
- [ ] להגיע ל-`/payments` ולהזין תשלום מחזורי
- [ ] להגיע ל-`/` (Dashboard) ולוודא ש-KPI מתעדכנים
- [ ] להיכנס לכרטיס איש קשר ולוודא שמופיעות היסטוריית סטטוסים ותשלומים

---

## שלב 5 - אבטחה ותחזוקה

- [ ] לוודא ש-`.env.local` **לא** ב-Git
- [ ] לסובב את `SUPABASE_SERVICE_ROLE_KEY` אם נחשף בטעות
- [ ] להגדיר Backup אוטומטי ב-Supabase (`Database → Backups`)
- [ ] להגדיר Notifications ב-Netlify על Deploy fail (`Site settings → Build & deploy → Deploy notifications`)

---

## שלב 6 - מעבר לזרימת עבודה רגילה

מכאן והלאה, לכל פיצ'ר חדש:

1. `git checkout develop && git pull`
2. `git checkout -b feature/<name>`
3. פיתוח ובדיקה לוקאלית
4. `git push -u origin feature/<name>`
5. PR ל-`develop` → בדיקה → merge
6. PR מ-`develop` ל-`main` → merge → Deploy אוטומטי

---

## משאבים

- Supabase Dashboard: https://supabase.com/dashboard
- Netlify Dashboard: https://app.netlify.com
- README מקומי: [README.md](README.md)
- תכנית מערכת: ראה plan ב-`.cursor/plans/`
