"use server";

/**
 * Offline guruhlar CRM bo'limining server amallari.
 *
 * Barchasi `requireAdmin()` bilan boshlanadi: server action alohida
 * POST manzili, layout uni himoya qilmaydi.
 *
 * Xatolar `throw` qilinmaydi, manzilga yoziladi — Next.js
 * production'da throw matnini yashiradi va o'qituvchi "Nimadir
 * noto'g'ri ketdi" degan umumiy oynani ko'rardi.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/require-admin";

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function number(formData: FormData, name: string) {
  const value = Number(text(formData, name));

  return Number.isFinite(value) ? value : 0;
}

/**
 * Aql bovar qilmaydigan raqamlarni to'sish.
 *
 * "3" o'rniga "30" terilib ketsa o'sha kun bir necha barobar ko'p
 * ball beradi va tanga ham shuncha ko'payadi. Chegara keng —
 * haqiqiy darsga to'sqinlik qilmaydi, lekin terish xatosini ushlaydi.
 */
function clamp(value: string, min: number, max: number) {
  const number = Number(value);

  if (!Number.isFinite(number)) return String(min);

  return String(Math.min(max, Math.max(min, Math.round(number))));
}

/**
 * Tanga balansi o'zgarganda keshni yangilash.
 *
 * Sovg'a berilgandan keyin o'quvchining tangasi kamayadi, lekin
 * guruh reytingi sahifasi keshdan kelardi va eski tanga sonini
 * ko'rsatardi. Shuning uchun tanga ko'rinadigan barcha sahifalarni
 * birga yangilaymiz. Ballarga tegmaydi — ular reytingda o'zgarmaydi.
 */
function revalidateCoinPages() {
  revalidatePath("/admin/crm");
  revalidatePath("/admin/crm/guruh");
  revalidatePath("/admin/crm/dokon");
}

/** Xabar bilan qaytish */
function back(path: string, message?: string): never {
  redirect(
    message ? `${path}${path.includes("?") ? "&" : "?"}xato=${encodeURIComponent(message)}` : path,
  );
}

/** Guruh sahifasidagi tablar — `?tab=` qiymatlari */
const GROUP_TABS = new Set(["bugun", "oquvchilar", "vazifalar", "sozlamalar"]);

/**
 * Guruh sahifasiga qaytish manzili.
 *
 * Forma qaysi tabdan yuborilgan bo'lsa, o'sha tabga qaytamiz —
 * aks holda "Saqlash"dan keyin admin birinchi tabga tashlanib,
 * qayerda turganini yo'qotardi.
 */
function groupPath(formData: FormData, groupId: number) {
  const tab = text(formData, "tab");

  return GROUP_TABS.has(tab) && tab !== "bugun"
    ? `/admin/crm/guruh?id=${groupId}&tab=${tab}`
    : `/admin/crm/guruh?id=${groupId}`;
}

/* ------------------------------------------------------------------ */
/* Guruhlar                                                            */
/* ------------------------------------------------------------------ */

export async function createCrmGroup(formData: FormData) {
  const supabase = await requireAdmin();
  const title = text(formData, "title");

  if (title.length < 2) {
    back("/admin/crm", "Guruh nomi kamida 2 ta belgidan iborat bo‘lsin.");
  }

  /*
   * Guruh ikki yarmi bilan yaratiladi: saytdagi (uy vazifasi, kod)
   * va offline (davomat, ball). O'qituvchi uchun bu bitta guruh.
   */
  const { data, error } = await supabase.rpc("ensure_group_pair", {
    p_crm_group_id: null,
    p_study_group_id: null,
    p_title: title,
  });

  if (error) {
    back("/admin/crm", `Guruh yaratilmadi: ${error.message}`);
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | { crm_group_id: number }
    | null;

  revalidatePath("/admin/crm");
  revalidatePath("/admin/groups");

  if (row?.crm_group_id) {
    redirect(`/admin/crm/guruh?id=${row.crm_group_id}`);
  }

  redirect("/admin/crm");
}

export async function updateCrmGroup(formData: FormData) {
  const supabase = await requireAdmin();
  const groupId = number(formData, "groupId");
  const title = text(formData, "title");
  const isActive = formData.get("isActive") === "1";

  const path = groupPath(formData, groupId);

  if (title.length < 2) {
    back(path, "Guruh nomi kamida 2 ta belgidan iborat bo‘lsin.");
  }

  /* Nom ikkala tomonda birga o'zgaradi */
  const { error: renameError } = await supabase.rpc("rename_group_pair", {
    p_crm_group_id: groupId,
    p_title: title,
  });

  if (renameError) {
    back(path, `Saqlanmadi: ${renameError.message}`);
  }

  const { error } = await supabase
    .from("crm_groups")
    .update({ is_active: isActive })
    .eq("id", groupId);

  if (error) {
    back(path, `Saqlanmadi: ${error.message}`);
  }

  revalidatePath("/admin/crm");
  revalidatePath("/admin/groups");
  back(path);
}

export async function deleteCrmGroup(formData: FormData) {
  const supabase = await requireAdmin();
  const groupId = number(formData, "groupId");
  const confirmTitle = text(formData, "confirmTitle");

  const path = groupPath(formData, groupId);

  const { data: group } = await supabase
    .from("crm_groups")
    .select("title")
    .eq("id", groupId)
    .maybeSingle();

  if (!group) {
    back("/admin/crm", "Guruh allaqachon o‘chirilgan.");
  }

  // Nomni aynan yozish shart — tasodifiy bosishdan himoya
  if (confirmTitle !== group.title) {
    back(
      path,
      `Tasdiqlash uchun guruh nomini aynan “${group.title}” deb yozing.`,
    );
  }

  const { error } = await supabase
    .from("crm_groups")
    .delete()
    .eq("id", groupId);

  if (error) {
    back(path, `O‘chirilmadi: ${error.message}`);
  }

  revalidatePath("/admin/crm");
  redirect("/admin/crm");
}

/* ------------------------------------------------------------------ */
/* O'quvchilar                                                         */
/* ------------------------------------------------------------------ */

export async function addCrmStudent(formData: FormData) {
  const supabase = await requireAdmin();
  const groupId = number(formData, "groupId");
  const fullName = text(formData, "fullName");
  const phone = text(formData, "phone");

  const path = groupPath(formData, groupId);

  if (fullName.length < 2) {
    back(path, "O‘quvchi ismini kiriting.");
  }

  const { error } = await supabase.from("crm_students").insert({
    group_id: groupId,
    full_name: fullName,
    phone: phone || null,
  });

  if (error) {
    back(path, `Qo‘shilmadi: ${error.message}`);
  }

  back(path);
}

export async function updateCrmStudent(formData: FormData) {
  const supabase = await requireAdmin();
  const groupId = number(formData, "groupId");
  const studentId = number(formData, "studentId");
  const fullName = text(formData, "fullName");
  const phone = text(formData, "phone");
  const email = text(formData, "email").toLowerCase();

  const path = groupPath(formData, groupId);

  if (fullName.length < 2) {
    back(path, "O‘quvchi ismini kiriting.");
  }

  /*
   * Saytdagi hisob bilan bog'lash ixtiyoriy. Email yozilsa,
   * shu emailli profilni topamiz. Topilmasa — bog'lamaymiz,
   * lekin qolgan ma'lumot baribir saqlanadi.
   */
  let userId: string | null = null;
  let linkWarning = "";

  if (email) {
    const { data: found } = await supabase.rpc("crm_find_user_by_email", {
      p_email: email,
    });

    const row = (Array.isArray(found) ? found[0] : found) as
      | { user_id: string }
      | null;

    if (row?.user_id) {
      userId = row.user_id;
    } else {
      linkWarning = `“${email}” bo‘yicha sayt hisobi topilmadi — qolgan ma’lumot saqlandi.`;
    }
  }

  const { error } = await supabase
    .from("crm_students")
    .update({
      full_name: fullName,
      phone: phone || null,
      ...(email ? { user_id: userId } : {}),
    })
    .eq("id", studentId)
    .eq("group_id", groupId);

  if (error) {
    back(path, `Saqlanmadi: ${error.message}`);
  }

  back(path, linkWarning || undefined);
}

export async function removeCrmStudent(formData: FormData) {
  const supabase = await requireAdmin();
  const groupId = number(formData, "groupId");
  const studentId = number(formData, "studentId");

  const path = groupPath(formData, groupId);

  /*
   * O'chirmaymiz, faqat faolsizlantiramiz.
   *
   * O'chirish yozuvlar bilan birga ballar tarixini ham yo'q qilardi,
   * guruh reytingi esa keyin tushunarsiz bo'lib qolardi.
   */
  const { data: student, error } = await supabase
    .from("crm_students")
    .update({ is_active: false })
    .eq("id", studentId)
    .eq("group_id", groupId)
    .select("user_id")
    .maybeSingle();

  if (error) {
    back(path, `Chiqarilmadi: ${error.message}`);
  }

  /*
   * Saytdagi a'zolikni ham uzamiz.
   *
   * Aks holda o'quvchi ro'yxatdan yashiringan bo'lardi-yu, uy
   * vazifalari unga kelaverardi — guruh ikki joyda saqlanishining
   * eng ko'p uchraydigan xatosi shu.
   */
  const userId = (student as { user_id: string | null } | null)?.user_id;

  if (userId) {
    const { data: crmGroup } = await supabase
      .from("crm_groups")
      .select("study_group_id")
      .eq("id", groupId)
      .maybeSingle();

    const studyGroupId = (
      crmGroup as { study_group_id: number | null } | null
    )?.study_group_id;

    if (studyGroupId) {
      await supabase
        .from("study_group_members")
        .delete()
        .eq("group_id", studyGroupId)
        .eq("user_id", userId);
    }
  }

  back(path);
}

/* ------------------------------------------------------------------ */
/* Ball qoidalari                                                      */
/* ------------------------------------------------------------------ */

export async function saveCrmRules(formData: FormData) {
  const supabase = await requireAdmin();
  const groupId = number(formData, "groupId");

  const path = groupPath(formData, groupId);

  const coinsPerPoints = number(formData, "coinsPerPoints");

  if (coinsPerPoints < 1) {
    back(path, "Tanga uchun kerakli ball 1 dan kam bo‘lmasin.");
  }

  const { error } = await supabase.from("crm_point_rules").upsert(
    {
      group_id: groupId,
      present_points: number(formData, "presentPoints"),
      late_points: number(formData, "latePoints"),
      excused_points: number(formData, "excusedPoints"),
      absent_points: number(formData, "absentPoints"),
      behavior_points: number(formData, "behaviorPoints"),
      homework_item_points: number(formData, "homeworkItemPoints"),
      coins_per_points: coinsPerPoints,
    },
    { onConflict: "group_id" },
  );

  if (error) {
    back(path, `Qoida saqlanmadi: ${error.message}`);
  }

  back(path);
}

/* ------------------------------------------------------------------ */
/* Kunlik varaq                                                        */
/* ------------------------------------------------------------------ */

export async function saveCrmDay(formData: FormData) {
  const supabase = await requireAdmin();

  const groupId = number(formData, "groupId");
  const date = text(formData, "date");
  const topic = text(formData, "topic");
  const studentIds = String(formData.get("studentIds") ?? "")
    .split(",")
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);

  const path = `/admin/crm/dars?guruh=${groupId}&sana=${date}`;

  if (!date) {
    back(path, "Sanani tanlang.");
  }

  /*
   * Forma maydonlari o'quvchi raqami bilan nomlangan:
   *   holat_12, xulq_12, vazifa_12, bonus_12, izoh_12
   */
  const rows = studentIds.map((id) => ({
    student_id: id,
    attendance: text(formData, `holat_${id}`) || "kelmadi",
    behavior: text(formData, `xulq_${id}`) || null,
    homework_done: clamp(text(formData, `vazifa_${id}`) || "0", 0, 300),
    /* "Jami berilgan" olib tashlandi — ball unga bog'liq emas */
    homework_total: "0",
    bonus: clamp(text(formData, `bonus_${id}`) || "0", -50, 50),
    note: text(formData, `izoh_${id}`),
  }));

  const { error } = await supabase.rpc("crm_save_day", {
    p_group_id: groupId,
    p_date: date,
    p_topic: topic || null,
    p_rows: rows,
  });

  if (error) {
    back(path, `Saqlanmadi: ${error.message}`);
  }

  revalidatePath("/admin/crm/dars");
  back(`${path}&saqlandi=1`);
}

/* ------------------------------------------------------------------ */
/* Sovg'a do'koni                                                      */
/* ------------------------------------------------------------------ */

export async function createCrmReward(formData: FormData) {
  const supabase = await requireAdmin();
  const groupId = number(formData, "groupId");
  const title = text(formData, "title");
  const cost = number(formData, "cost");
  const stockRaw = text(formData, "stock");
  const forAllGroups = formData.get("forAll") === "1";

  const path = `/admin/crm/dokon?guruh=${groupId}`;

  if (title.length < 2) {
    back(path, "Sovg‘a nomini kiriting.");
  }

  if (cost < 1) {
    back(path, "Narx kamida 1 tanga bo‘lsin.");
  }

  const { error } = await supabase.from("crm_rewards").insert({
    group_id: forAllGroups ? null : groupId,
    title,
    description: text(formData, "description") || null,
    cost_coins: cost,
    stock: stockRaw === "" ? null : Number(stockRaw),
    icon: text(formData, "icon") || null,
  });

  if (error) {
    back(path, `Sovg‘a qo‘shilmadi: ${error.message}`);
  }

  back(path);
}

/** Mavjud sovg'ani tahrirlash */
export async function updateCrmReward(formData: FormData) {
  const supabase = await requireAdmin();
  const groupId = number(formData, "groupId");
  const rewardId = number(formData, "rewardId");
  const title = text(formData, "title");
  const cost = number(formData, "cost");
  const stockRaw = text(formData, "stock");
  const forAllGroups = formData.get("forAll") === "1";

  const path = `/admin/crm/dokon?guruh=${groupId}`;

  if (!rewardId) {
    back(path, "Sovg‘a topilmadi.");
  }

  if (title.length < 2) {
    back(path, "Sovg‘a nomini kiriting.");
  }

  if (cost < 1) {
    back(path, "Narx kamida 1 tanga bo‘lsin.");
  }

  const { error } = await supabase
    .from("crm_rewards")
    .update({
      group_id: forAllGroups ? null : groupId,
      title,
      description: text(formData, "description") || null,
      cost_coins: cost,
      stock: stockRaw === "" ? null : Number(stockRaw),
      icon: text(formData, "icon") || null,
    })
    .eq("id", rewardId);

  if (error) {
    back(path, `Saqlanmadi: ${error.message}`);
  }

  back(path);
}

/**
 * Sovg'ani butunlay o'chirish.
 *
 * Almashtirish tarixi buzilmaydi: sovg'a nomi yozuvning ichiga
 * ko'chirib qo'yilgan, havola esa `on delete set null` bilan
 * bo'shatiladi. Lekin hali javob berilmagan so'rov bo'lsa
 * o'chirishga yo'l qo'yilmaydi — o'quvchining tangasi ushlab
 * turilgan, avval o'sha so'rov yopilishi kerak.
 */
export async function deleteCrmReward(formData: FormData) {
  const supabase = await requireAdmin();
  const groupId = number(formData, "groupId");
  const rewardId = number(formData, "rewardId");

  const path = `/admin/crm/dokon?guruh=${groupId}`;

  if (!rewardId) {
    back(path, "Sovg‘a topilmadi.");
  }

  if (formData.get("confirm") !== "1") {
    back(path, "O‘chirishdan oldin tasdiqlash katakchasini belgilang.");
  }

  const { data: pending, error: pendingError } = await supabase
    .from("crm_redemptions")
    .select("id")
    .eq("reward_id", rewardId)
    .eq("status", "kutilmoqda")
    .limit(1);

  if (pendingError) {
    back(path, `O‘chirilmadi: ${pendingError.message}`);
  }

  if ((pending ?? []).length > 0) {
    back(
      path,
      "Bu sovg‘aga javob berilmagan so‘rov bor. Avval uni tasdiqlang yoki bekor qiling.",
    );
  }

  const { error } = await supabase
    .from("crm_rewards")
    .delete()
    .eq("id", rewardId);

  if (error) {
    back(path, `O‘chirilmadi: ${error.message}`);
  }

  back(path);
}

export async function toggleCrmReward(formData: FormData) {
  const supabase = await requireAdmin();
  const groupId = number(formData, "groupId");
  const rewardId = number(formData, "rewardId");
  const next = formData.get("next") === "1";

  const path = `/admin/crm/dokon?guruh=${groupId}`;

  const { error } = await supabase
    .from("crm_rewards")
    .update({ is_active: next })
    .eq("id", rewardId);

  if (error) {
    back(path, `O‘zgartirilmadi: ${error.message}`);
  }

  back(path);
}

export async function redeemCrmReward(formData: FormData) {
  const supabase = await requireAdmin();
  const groupId = number(formData, "groupId");
  const studentId = number(formData, "studentId");
  const rewardId = number(formData, "rewardId");

  const path = `/admin/crm/dokon?guruh=${groupId}`;

  if (!studentId || !rewardId) {
    back(path, "O‘quvchi va sovg‘ani tanlang.");
  }

  const { error } = await supabase.rpc("crm_redeem", {
    p_student_id: studentId,
    p_reward_id: rewardId,
    p_note: text(formData, "note") || null,
  });

  if (error) {
    back(path, error.message);
  }

  revalidateCoinPages();

  back(path);
}

/** So'rovni tasdiqlash — sovg'a qo'lga topshirilganda */
export async function confirmCrmRedemption(formData: FormData) {
  const supabase = await requireAdmin();
  const groupId = number(formData, "groupId");
  const redemptionId = number(formData, "redemptionId");

  const path = groupId
    ? `/admin/crm/dokon?guruh=${groupId}`
    : "/admin/crm";

  const { error } = await supabase.rpc("crm_confirm_redemption", {
    p_id: redemptionId,
  });

  if (error) {
    back(path, `Tasdiqlanmadi: ${error.message}`);
  }

  revalidateCoinPages();

  back(path);
}

/** Ikkita yozuvni bittaga qo'shish */
export async function mergeCrmStudents(formData: FormData) {
  const supabase = await requireAdmin();
  const groupId = number(formData, "groupId");
  const keepId = number(formData, "keepId");
  const removeId = number(formData, "removeId");

  const path = groupPath(formData, groupId);

  if (!keepId || !removeId) {
    back(path, "Ikkala o‘quvchini ham tanlang.");
  }

  const { error } = await supabase.rpc("crm_merge_students", {
    p_keep_id: keepId,
    p_remove_id: removeId,
  });

  if (error) {
    back(path, error.message);
  }

  back(path);
}

export async function cancelCrmRedemption(formData: FormData) {
  const supabase = await requireAdmin();
  const groupId = number(formData, "groupId");
  const redemptionId = number(formData, "redemptionId");

  const path = `/admin/crm/dokon?guruh=${groupId}`;

  const { error } = await supabase.rpc("crm_cancel_redemption", {
    p_id: redemptionId,
  });

  if (error) {
    back(path, `Bekor qilinmadi: ${error.message}`);
  }

  revalidateCoinPages();

  back(path);
}
