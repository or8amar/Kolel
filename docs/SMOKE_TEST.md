# Smoke Test — Kolel Payments Tracker

בדיקות ידניות לאחר חיבור Supabase Cloud ומשתני סביבה.

**דרישות מוקדמות**

- [ ] `supabase db push` הושלם בהצלחה
- [ ] משתמש Auth: `turgnr7@gmail.com` (Auto Confirm)
- [ ] `web/.env.local` מכיל URL ו-anon key אמיתיים מהדשבורד (לא placeholders)
- [ ] (לפרודקשן) משתני סביבה זהים ב-Netlify + Auth URLs מעודכנים

---

## בדיקות אוטומטיות (מפתח)

הרץ מתוך `web/`:

```powershell
cd c:\Repos\Kolel\web
npm run typecheck
npm run build
```

| פקודה | תוצאה צפויה (נבדק) |
|--------|---------------------|
| `npm run typecheck` | יציאה 0, ללא שגיאות TS |
| `npm run build` | יציאה 0, 8 routes |

---

## בדיקות מקומיות (`npm run dev`)

Base URL: `http://localhost:3000`

### Auth

- [ ] `/login` — טופס נטען
- [ ] התחברות עם אימייל/סיסמה נכונים → מעבר ל-`/`
- [ ] סיסמה שגויה → הודעת שגיאה (לא קריסה)
- [ ] גישה ל-`/` ללא session → הפניה ל-`/login`
- [ ] **התנתקות** → חזרה ל-`/login`

### ייבוא (`/import`)

- [ ] הוספת איש קשר ידני → שמירה מצליחה
- [ ] (אופציונלי) ייבוא קובץ CSV קטן
- [ ] סיכום ייבוא מציג imported / skipped

### פוטנציאלים (`/potentials`)

- [ ] מופיע איש קשר שיובא
- [ ] שינוי סטטוס (למשל `contacted`) נשמר אחרי רענון

### תשלומים (`/payments`)

- [ ] תשלום **חד-פעמי** לאיש קשר → הודעת הצלחה
- [ ] תשלום **מחזורי** (תוכנית) → הודעת הצלחה

### דשבורד (`/`)

- [ ] KPI נטענים ללא שגיאת רשת אדומה
- [ ] אחרי תשלום — ערכים מתעדכנים (רענון דף)

### כרטיס (`/potentials/[id]`)

- [ ] פרטי איש קשר, סטטוס, היסטוריה, רשימת תשלומים

---

## בדיקות פרודקשן (Netlify)

חזור על אותן בדיקות מול `https://<your-site>.netlify.app`.

- [ ] `/login` עובד
- [ ] אין שגיאות CORS / Auth redirect
- [ ] אם נכשל login — ודא ב-Supabase: **Site URL** ו-**Redirect URLs** כוללים את כתובת Netlify

---

## אם אין עדיין Supabase Cloud

לא ניתן להשלים smoke חי. בצע לפי [WORK_PLAN.md](./WORK_PLAN.md) שלב 1–2, ואז חזור לרשימה זו.

**סימנים לבעיית הגדרה**

| תסמין | פתרון סביר |
|--------|-------------|
| `Invalid API key` | anon key שגוי ב-`.env.local` / Netlify |
| `Failed to fetch` / רשת | URL שגוי או פרויקט Supabase לא פעיל |
| Login תקין אבל רשימות ריקות עם שגיאה | migrations לא הועלו — `supabase db push` |
| Login נדחה | משתמש Auth לא נוצר או לא Auto Confirm |
| RLS / permission denied | אימייל Auth לא תואם ל-`app_admins` |
