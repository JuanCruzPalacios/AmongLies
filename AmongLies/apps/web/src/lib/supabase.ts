"use client";

import { createClient } from "@supabase/supabase-js";

// Valores públicos del proyecto (la seguridad la dan las políticas RLS).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://pyamkqingktpeexkgryb.supabase.co";
const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_XowZg_fp4JzC3aaUEbQqyQ_scBwh4y8";

export const supabase = createClient(url, publishableKey);
