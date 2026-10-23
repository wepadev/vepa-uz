import { readFileSync } from "node:fs";
import { join } from "node:path";

import { createClient } from "@supabase/supabase-js";

/**
 * .env.local faylini o'qiydi.
 * Skriptlar Next.js'dan tashqarida ishlagani uchun
 * muhit o'zgaruvchilarini o'zimiz yuklaymiz.
 */
export function loadEnv(root = process.cwd()) {
  let raw = "";

  try {
    raw = readFileSync(join(root, ".env.local"), "utf8");
  } catch {
    throw new Error(
      ".env.local fayli topilmadi. Skriptni loyiha ildizidan ishga tushiring.",
    );
  }

  const env = {};

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const eq = trimmed.indexOf("=");

    if (eq === -1) {
      continue;
    }

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

/**
 * Admin huquqli Supabase mijozi.
 * SECRET_KEY RLS ni chetlab o'tadi — faqat skriptlarda ishlatiladi,
 * hech qachon brauzerga tushmaydi.
 */
export function createAdminClient() {
  const env = loadEnv();

  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error(
      ".env.local da NEXT_PUBLIC_SUPABASE_URL yoki SUPABASE_SECRET_KEY yo'q.",
    );
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
