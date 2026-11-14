import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { telegramFullName, type TelegramUser } from "@/lib/telegram/init-data";

/*
 * Telegram hisobini saytdagi foydalanuvçiga bog'laş va uning nomidan
 * sessiya oçiş. Hammasi admin kaliti (service role) bilan, faqat
 * imzosi tekşirilgan initData'dan keyin çaqiriladi.
 *
 * Bog'lanişlar `telegram_accounts` jadvalida (db/44-telegram.sql):
 * bitta Telegram ↔ bitta hisob.
 */

type Admin = SupabaseClient;

/** Faqat Telegram orqali yaratilgan hisob uçun email (xat yuborilmaydi) */
export function telegramEmail(telegramId: number) {
  return `tg${telegramId}@telegram.vepa.uz`;
}

export async function findLinkedUser(admin: Admin, telegramId: number) {
  const { data, error } = await admin
    .from("telegram_accounts")
    .select("user_id")
    .eq("telegram_id", telegramId)
    .maybeSingle();

  if (error) throw error;
  return (data?.user_id as string | undefined) ?? null;
}

/** Telegram'ni hisobga bog'laydi; eski bog'lanişlar (ikkala tomonda) olinadi */
export async function linkTelegram(
  admin: Admin,
  user: TelegramUser,
  userId: string,
) {
  const { error: deleteError } = await admin
    .from("telegram_accounts")
    .delete()
    .or(`telegram_id.eq.${user.id},user_id.eq.${userId}`);

  if (deleteError) throw deleteError;

  const { error } = await admin.from("telegram_accounts").insert({
    telegram_id: user.id,
    user_id: userId,
    username: user.username ?? null,
    first_name: telegramFullName(user),
  });

  if (error) throw error;
}

export async function touchTelegram(admin: Admin, user: TelegramUser) {
  await admin
    .from("telegram_accounts")
    .update({
      username: user.username ?? null,
      first_name: telegramFullName(user),
      last_seen_at: new Date().toISOString(),
    })
    .eq("telegram_id", user.id);
}

async function ensureProfile(admin: Admin, userId: string, fullName: string) {
  const { data: existing, error: checkError } = await admin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (checkError) throw checkError;
  if (existing) return;

  const row = {
    id: userId,
    full_name: fullName,
    role: "student",
    is_active: true,
    auth_provider: "telegram",
    can_access_textbooks: true,
    can_access_lessons: true,
    can_access_tests: true,
  };

  const { error } = await admin.from("profiles").insert(row);

  // auth_provider ustunida eski CHECK ("email" | "google") bölsa
  if (error?.code === "23514") {
    const retry = await admin
      .from("profiles")
      .insert({ ...row, auth_provider: "email" });
    if (retry.error) throw retry.error;
    return;
  }

  if (error && error.code !== "23505") throw error;
}

/** Yangi hisob (faqat Telegram bilan). Email band bölsa öşa hisob olinadi. */
export async function createTelegramUser(admin: Admin, user: TelegramUser) {
  const email = telegramEmail(user.id);
  const fullName = telegramFullName(user);

  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      telegram_id: user.id,
      telegram_username: user.username ?? null,
    },
    app_metadata: { provider: "telegram" },
  });

  let userId = data?.user?.id ?? null;

  if (!userId) {
    // Avval yaratilgan, lekin bog'laniş öçirilgan hisob
    const link = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    userId = link.data?.user?.id ?? null;
    if (!userId) throw error ?? link.error ?? new Error("Hisob yaratilmadi");
  }

  await ensureProfile(admin, userId, fullName);
  return userId;
}

/**
 * Foydalanuvçi nomidan sessiya oçadi: admin bir martalik kiriş kodi
 * yasaydi (xat yuborilmaydi) va server uni darrov tasdiqlaydi.
 * Natijada odatdagi Supabase cookie'lari qöyiladi.
 */
export async function signInAs(admin: Admin, userId: string) {
  const { data: found, error: userError } =
    await admin.auth.admin.getUserById(userId);

  const email = found?.user?.email;
  if (userError || !email) {
    throw userError ?? new Error("Hisobda email yöq");
  }

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) throw error ?? new Error("Kiriş kodi yasalmadi");

  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: tokenHash,
  });

  if (verifyError) throw verifyError;
}
