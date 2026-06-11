import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "./config";

// 서버 전용 service_role 클라이언트 (RLS 우회). 클라이언트 번들에 절대 import 금지.
let _admin: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (_admin) return _admin;
  _admin = createClient(env.supabaseUrl(), env.supabaseServiceKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}
