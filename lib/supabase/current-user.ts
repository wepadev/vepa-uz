import "server-only";

import { cache } from "react";

import { isGroupStudent } from "@/lib/group-membership";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string | undefined;
};

export type BasicProfile = {
  full_name: string | null;
  role: string;
  is_active: boolean;
};

/**
 * Tizimga kirgan foydalanuvchi (yoki `null`).
 *
 * Tezlik uchun ikki narsa qilinadi:
 *
 * 1. `getUser()` o'rniga `getClaims()`. `getUser()` har safar
 *    Supabase Auth serveriga so'rov yuboradi (bir necha yuz ms).
 *    Loyihada imzo kalitlari asimmetrik (ES256), shuning uchun
 *    `getClaims()` tokenni serverning o'zida, ochiq kalit bilan
 *    tekshiradi — tarmoqqa chiqmaydi. proxy.ts ham shu usulni
 *    ishlatadi. Kalit simmetrik bo'lsa, kutubxona o'zi `getUser()`
 *    ga qaytadi.
 *
 * 2. React `cache()`. Bitta sahifa ochilganda menyu (SiteNav),
 *    layout va sahifaning o'zi foydalanuvchini alohida-alohida
 *    so'rardi. Endi bir so'rov ichida natija bir marta olinadi.
 */
export const getCurrentUser = cache(
  async (): Promise<CurrentUser | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();

    if (error || !data?.claims?.sub) {
      return null;
    }

    return {
      id: data.claims.sub,
      email:
        typeof data.claims.email === "string"
          ? data.claims.email
          : undefined,
    };
  },
);

/**
 * Menyu, bosh sahifa va admin tekshiruvi uchun profilning eng
 * kerakli ustunlari. Bir so'rov ichida bir marta o'qiladi.
 * Xato bo'lsa `error` qaytadi — har bir chaqiruvchi o'zi hal qiladi.
 */
export const getBasicProfile = cache(async (userId: string) => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("full_name, role, is_active")
    .eq("id", userId)
    .maybeSingle();

  return {
    profile: (data as BasicProfile | null) ?? null,
    error,
  };
});

/** O'quvchi guruhdami — menyu va bosh sahifa bir marta so'raydi */
export const getIsGroupStudent = cache(async (userId: string) => {
  const supabase = await createClient();
  return isGroupStudent(supabase, userId);
});
