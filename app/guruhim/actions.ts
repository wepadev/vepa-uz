"use server";

/**
 * O'quvchining guruh amallari.
 *
 * Admin tekshiruvi yo'q — bularni o'quvchining o'zi chaqiradi.
 * Himoya bazada: `join_group_by_code` va `request_reward`
 * `auth.uid()` ga tayanadi va shartlarni o'zi tekshiradi.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { notifyAdmin } from "@/lib/notify-admin";
import { createClient } from "@/lib/supabase/server";

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function back(
  path: string,
  message?: string,
  key: "xato" | "xabar" = "xato",
): never {
  redirect(
    message ? `${path}?${key}=${encodeURIComponent(message)}` : path,
  );
}

export async function joinGroupAction(formData: FormData) {
  const code = text(formData, "code").toUpperCase();

  if (!code) {
    back("/guruhim", "Kodni kiriting.");
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data, error } = await supabase.rpc("join_group_by_code", {
    p_code: code,
  });

  if (error) {
    back(
      "/guruhim",
      error.message.includes("topilmadi")
        ? "Bunday kod topilmadi. Ustozingizdan qayta so‘rang."
        : "Qo‘shilib bo‘lmadi. Qaytadan urinib ko‘ring.",
    );
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | { group_title: string; already: boolean }
    | null;

  revalidatePath("/guruhim");
  revalidatePath("/homework");

  back(
    "/guruhim",
    row?.already
      ? `Siz allaqachon “${row.group_title}” guruhidasiz.`
      : `“${row?.group_title ?? "Guruh"}” guruhiga qo‘shildingiz.`,
    "xabar",
  );
}

export async function requestRewardAction(formData: FormData) {
  const rewardId = Number(text(formData, "rewardId"));

  if (!Number.isInteger(rewardId) || rewardId <= 0) {
    back("/dokon", "Sovg‘a tanlanmadi.");
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { error } = await supabase.rpc("request_reward", {
    p_reward_id: rewardId,
  });

  if (error) {
    /*
     * Bazadagi xabarlar allaqachon o'zbekcha va aniq
     * ("Tanga yetarli emas: 5 ta bor, 10 ta kerak"), shuning uchun
     * ularni o'zgartirmasdan ko'rsatamiz.
     */
    back("/dokon", error.message);
  }

  /*
   * Ustozga xabar.
   *
   * So'rov admin panelda ham ko'rinadi, lekin o'qituvchi kun bo'yi
   * u yerda o'tirmaydi — Telegram xabari darhol yetib boradi.
   * Xabar ketmasa ham so'rov bekor qilinmaydi.
   */
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const { data: reward } = await supabase
    .from("crm_rewards")
    .select("title, cost_coins")
    .eq("id", rewardId)
    .maybeSingle();

  await notifyAdmin(
    "🎁 Yangi sovg‘a so‘rovi",
    [
      `O‘quvchi: ${profile?.full_name?.trim() || user.email || "noma’lum"}`,
      `Sovg‘a: ${reward?.title ?? "—"}`,
      `Narxi: ${reward?.cost_coins ?? "—"} tanga`,
      "",
      "Admin panel → Guruhlar → Sovg‘a do‘koni bo‘limida tasdiqlang.",
    ].join("\n"),
  );

  revalidatePath("/dokon");
  revalidatePath("/guruhim");

  back(
    "/dokon",
    "So‘rovingiz yuborildi. Ustoz sovg‘ani topshirganda tasdiqlaydi.",
    "xabar",
  );
}
