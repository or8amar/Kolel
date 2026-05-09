import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const fallbackUrl = "http://127.0.0.1:54321";
const fallbackAnon = "public-anon-key-placeholder";

export const supabase = createClient(url ?? fallbackUrl, anon ?? fallbackAnon);
