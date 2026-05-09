# Kolel Payments Tracker

מערכת WEB לניהול אנשי קשר, פוטנציאל תשלום, הזנת תרומות ודשבורד KPI.

## סטאק טכנולוגי

- Frontend: `Next.js (App Router) + TypeScript + Tailwind`
- Backend: `Supabase (Auth + Postgres + RLS)`
- Deploy: `Netlify`

## מה קיים בפרויקט

- `web/` אפליקציית Next.js מלאה
- `supabase/migrations/` סכמת DB מלאה עם RLS לאדמין יחיד
- `supabase/seed.sql` נתוני דמה מגוונים
- `netlify.toml` קונפיג בילד בסיסי ל-Next.js

## הרצה לוקאלית על Windows (צעד-אחר-צעד)

### 1) דרישות

1. התקן `Node.js 20+`
2. התקן `npm`
3. התקן `Supabase CLI`
4. (אופציונלי) התקן `Netlify CLI`

### 2) הכנת משתני סביבה

1. מהרוט של הפרויקט (`c:\Repos\Kolel`) הרץ:

```powershell
copy .env.local.example .env.local
```

2. עדכן את ערכי ה-keys ב-`.env.local` לפי פלט `supabase start`.

### 3) התקנת תלויות לאפליקציית WEB

```powershell
cd c:\Repos\Kolel\web
npm install
```

### 4) הכנת Supabase מקומי

```powershell
cd c:\Repos\Kolel
supabase db reset --local
```

הפקודה מריצה את כל ה-`migrations` ואת `supabase/seed.sql`.

### 5) יצירת משתמש אדמין ב-Auth

צור משתמש עם אימייל שקיים ב-`app_admins` (ברירת מחדל: `turgnr7@gmail.com`):

```powershell
supabase auth users create --email turgnr7@gmail.com --password Admin123!
```

אם הפקודה לא זמינה בגרסה שלך, ניתן ליצור דרך Supabase Studio המקומי.

### 6) הרצת האפליקציה

```powershell
cd c:\Repos\Kolel\web
npm run dev
```

פתח בדפדפן: `http://localhost:3000`

### 7) בדיקות בסיסיות

```powershell
cd c:\Repos\Kolel\web
npm run typecheck
npm run build
```

## מסכים עיקריים

- `/login` התחברות אדמין
- `/import` ייבוא אנשי קשר (Browser Contacts API + CSV/VCF fallback)
- `/potentials` ניהול פוטנציאלים עם פילטרים ושינוי סטטוס
- `/potentials/[id]` כרטיס איש קשר (פרטים + היסטוריית סטטוסים + תשלומים)
- `/payments` הזנת תשלום ידנית (חד-פעמי/מחזורי)
- `/` דשבורד KPI

## Netlify

`netlify.toml` מוגדר עם:
- `base = "web"`
- build command: `npm run build`
- plugin: `@netlify/plugin-nextjs`

יש להגדיר ב-Netlify Environment Variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
