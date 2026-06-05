import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../types/supabase";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured =
  Boolean(supabaseUrl) &&
  Boolean(supabaseAnonKey) &&
  !supabaseUrl!.includes("your-project-ref") &&
  !supabaseAnonKey!.includes("your-anon-key");

export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured
  ? createClient<Database>(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: "gtf_auth",
        detectSessionInUrl: false,
      },
    })
  : null;

let ensurePromise: Promise<string | null> | null = null;

// Returns the current user id, signing in anonymously on first call. Cached so
// concurrent callers share the same in-flight sign-in.
export async function ensureAnonymousUser(): Promise<string | null> {
  if (!supabase) {
    return null;
  }
  if (ensurePromise) {
    return ensurePromise;
  }
  ensurePromise = (async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session?.user) {
      return sessionData.session.user.id;
    }
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.error("[supabase] anonymous sign-in failed:", error.message);
      ensurePromise = null;
      return null;
    }
    return data.user?.id ?? null;
  })();
  return ensurePromise;
}
