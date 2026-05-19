import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Placeholders only so import/build succeed before .env.local is filled.
// Set real Supabase Cloud values in web/.env.local (see .env.local.example).
export const supabase = createClient(
  url ?? "https://YOUR_PROJECT_REF.supabase.co",
  anon ?? "your_supabase_anon_public_key",
);
