import Link from "next/link";
import { revalidatePath } from "next/cache";
import {
  redirect,
} from "next/navigation";

import UserAccessCard from "@/components/admin/user-access-card";
import AppAlert from "@/components/ui/app-alert";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/form-state";
import Pagination from "@/components/ui/pagination";
import SubmitButton from "@/components/ui/submit-button";
import { asRpcClient } from "@/lib/supabase/rpc";

export const dynamic = "force-dynamic";

/** Bir sahifada nechta foydalanuvchi ko'rsatiladi */
const USERS_PAGE_SIZE = 25;

type PageProps = {
  searchParams: Promise<{
    q?: string | string[];
    state?: string | string[];
    page?: string | string[];
  }>;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  role: "admin" | "student";
  is_active: boolean;
  auth_provider: string | null;
  can_access_textbooks: boolean;
  can_access_lessons: boolean;
  can_access_tests: boolean;
  premium_until: string | null;
};

type PendingOrderRow = {
  id: string;
  user_id: string;
  order_number: number | string;
  final_amount_uzs: number | string;
  promo_code_snapshot: string | null;
  created_at: string;
  payment_plans:
    | {
        name: string;
        code: string;
        duration_months: number;
      }
    | Array<{
        name: string;
        code: string;
        duration_months: number;
      }>
    | null;
};

function single(
  value: string | string[] | undefined,
) {
  return Array.isArray(value)
    ? value[0]
    : value;
}

async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  if (
    profileError ||
    !profile ||
    profile.role !== "admin" ||
    profile.is_active !== true
  ) {
    redirect("/");
  }

  return {
    supabase,
    currentAdminId: user.id,
  };
}

async function updateUserAccess(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  "use server";

  const {
    currentAdminId,
  } = await requireAdmin();

  const userId = String(
    formData.get("userId") ?? "",
  ).trim();

  if (!userId) {
    return {
      status: "error",
      message:
        "Foydalanuvchi ma’lumotlari noto‘g‘ri.",
      errors: {},
    };
  }

  const isActive =
    formData.get("isActive") === "on";

  const canAccessTextbooks =
    formData.get(
      "canAccessTextbooks",
    ) === "on";

  const canAccessLessons =
    formData.get(
      "canAccessLessons",
    ) === "on";

  const canAccessTests =
    formData.get(
      "canAccessTests",
    ) === "on";

  if (
    userId === currentAdminId &&
    !isActive
  ) {
    return {
      status: "error",
      message:
        "O‘z akkauntingizni faol bo‘lmagan holatga o‘tkaza olmaysiz.",
      errors: {},
    };
  }

  const adminClient =
    createAdminClient();

  const {
    data: targetProfile,
    error: targetError,
  } = await adminClient
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .maybeSingle();

  if (
    targetError ||
    !targetProfile
  ) {
    return {
      status: "error",
      message:
        "Foydalanuvchi topilmadi.",
      errors: {},
    };
  }

  if (targetProfile.role === "admin") {
    return {
      status: "error",
      message:
        "Admin akkaunti ruxsatlarini bu sahifada o‘zgartirib bo‘lmaydi.",
      errors: {},
    };
  }

  const { error: updateError } =
    await adminClient
      .from("profiles")
      .update({
        is_active: isActive,
        can_access_textbooks:
          canAccessTextbooks,
        can_access_lessons:
          canAccessLessons,
        can_access_tests:
          canAccessTests,
      })
      .eq("id", userId);

  if (updateError) {
    return {
      status: "error",
      message:
        `Ruxsatlar saqlanmadi: ${updateError.message}`,
      errors: {},
    };
  }

  return {
    status: "success",
    message:
      "Foydalanuvchi ruxsatlari muvaffaqiyatli yangilandi.",
    errors: {},
  };
}


async function manageUserPremium(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  "use server";

  const {
    supabase,
  } = await requireAdmin();

  const userId = String(
    formData.get("userId") ?? "",
  ).trim();

  const operation = String(
    formData.get("operation") ?? "",
  ).trim();

  if (!userId) {
    return {
      status: "error",
      message:
        "Foydalanuvchi tanlanmagan.",
      errors: {},
    };
  }

  const rpcClient = asRpcClient(supabase);

  if (operation === "revoke") {
    const {
      error,
    } = await rpcClient.rpc(
      "admin_revoke_manual_premium",
      {
        p_user_id: userId,
        p_note:
          "Admin panel orqali bekor qilindi.",
      },
    );

    if (error) {
      return {
        status: "error",
        message:
          `Premium bekor qilinmadi: ${error.message}`,
        errors: {},
      };
    }

    revalidatePath("/admin/users");
    revalidatePath("/profile");
    revalidatePath("/pricing");

    return {
      status: "success",
      message:
        "Premium bekor qilindi. Foydalanuvchida bepul kontent ochiq qoladi.",
      errors: {},
    };
  }

  if (
    ![
      "monthly",
      "quarterly",
      "semiannual",
      "full",
    ].includes(operation)
  ) {
    return {
      status: "error",
      message:
        "Premium muddati notoʼgʼri.",
      errors: {},
    };
  }

  const {
    data,
    error,
  } = await rpcClient.rpc(
    "admin_grant_manual_premium",
    {
      p_user_id: userId,
      p_plan_code: operation,
      p_note:
        "Telegram orqali toʼlov admin tomonidan tasdiqlandi.",
    },
  );

  if (error) {
    return {
      status: "error",
      message:
        `Premium berilmadi: ${error.message}`,
      errors: {},
    };
  }

  const row =
    (
      Array.isArray(data)
        ? data[0]
        : data
    ) as
      | {
          premium_until:
            | string
            | null;
          matched_order:
            | boolean
            | null;
          order_number:
            | number
            | string
            | null;
        }
      | null;

  const expiry =
    row?.premium_until
      ? new Intl.DateTimeFormat(
          "uz-UZ",
          {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            timeZone:
              "Asia/Tashkent",
          },
        ).format(
          new Date(
            row.premium_until,
          ),
        )
      : "yangilandi";

  revalidatePath("/admin/users");
  revalidatePath("/profile");
  revalidatePath("/pricing");
  revalidatePath("/profile/payments");

  return {
    status: "success",
    message:
      row?.matched_order
        ? `Premium ${expiry} gacha berildi. Buyurtma #${row.order_number ?? "—"} toʼlangan deb belgilandi.`
        : `Premium ${expiry} gacha berildi. Mos pending buyurtma topilmadi, muddat qoʼlda qoʼshildi.`,
    errors: {},
  };
}

export default async function AdminUsersPage({
  searchParams,
}: PageProps) {
  const {
    currentAdminId,
  } = await requireAdmin();

  const params = await searchParams;

  const query =
    single(params.q)?.trim() ?? "";

  const selectedState =
    single(params.state) ?? "all";

  const adminClient =
    createAdminClient();

  const [
    profilesResult,
    authUsersResult,
    pendingOrdersResult,
  ] = await Promise.all([
    adminClient
      .from("profiles")
      .select(`
        id,
        full_name,
        role,
        is_active,
        auth_provider,
        can_access_textbooks,
        can_access_lessons,
        can_access_tests,
        premium_until
      `)
      .order("role", {
        ascending: true,
      })
      .order("full_name", {
        ascending: true,
        nullsFirst: false,
      }),

    adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    }),

    adminClient
      .from("payment_orders")
      .select(`
        id,
        user_id,
        order_number,
        final_amount_uzs,
        promo_code_snapshot,
        created_at,
        payment_plans (
          name,
          code,
          duration_months
        )
      `)
      .eq("status", "pending")
      .order("created_at", {
        ascending: false,
      })
      .limit(2000),
  ]);

  if (profilesResult.error) {
    throw new Error(
      `Foydalanuvchilar yuklanmadi: ${profilesResult.error.message}`,
    );
  }

  if (authUsersResult.error) {
    throw new Error(
      `Email manzillar yuklanmadi: ${authUsersResult.error.message}`,
    );
  }

  if (pendingOrdersResult.error) {
    throw new Error(
      `Kutilayotgan toʼlovlar yuklanmadi: ${pendingOrdersResult.error.message}`,
    );
  }

  const profiles =
    (profilesResult.data ??
      []) as ProfileRow[];

  const emailMap =
    new Map<string, string>();

  for (
    const authUser of
    authUsersResult.data.users
  ) {
    emailMap.set(
      authUser.id,
      authUser.email ?? "",
    );
  }


const pendingOrderMap =
  new Map<
    string,
    {
      id: string;
      orderNumber:
        | number
        | string;
      planName: string;
      planCode: string;
      finalAmountUzs:
        | number
        | string;
      promoCode: string | null;
      createdAt: string;
    }
  >();

for (
  const order of
  (
    pendingOrdersResult.data ??
    []
  ) as PendingOrderRow[]
) {
  if (
    pendingOrderMap.has(
      order.user_id,
    )
  ) {
    continue;
  }

  const plan =
    Array.isArray(
      order.payment_plans,
    )
      ? order.payment_plans[0]
      : order.payment_plans;

  pendingOrderMap.set(
    order.user_id,
    {
      id: order.id,
      orderNumber:
        order.order_number,
      planName:
        plan?.name ??
        "Premium tarif",
      planCode:
        plan?.code ?? "",
      finalAmountUzs:
        order.final_amount_uzs,
      promoCode:
        order.promo_code_snapshot,
      createdAt:
        order.created_at,
    },
  );
}

  const normalizedQuery =
    query.toLocaleLowerCase("uz-UZ");

  const filteredProfiles =
    profiles.filter((profile) => {
      const email =
        emailMap.get(profile.id) ?? "";

      const matchesQuery =
        !normalizedQuery ||
        (
          profile.full_name ?? ""
        )
          .toLocaleLowerCase("uz-UZ")
          .includes(normalizedQuery) ||
        email
          .toLocaleLowerCase("uz-UZ")
          .includes(normalizedQuery);

      const matchesState =
        selectedState === "all" ||
        (
          selectedState === "active" &&
          profile.is_active
        ) ||
        (
          selectedState === "inactive" &&
          !profile.is_active
        ) ||
        (
          selectedState === "admin" &&
          profile.role === "admin"
        ) ||
        (
          selectedState === "student" &&
          profile.role === "student"
        ) ||
        (
          selectedState === "premium" &&
          profile.premium_until !== null &&
          new Date(
            profile.premium_until,
          ).getTime() > Date.now()
        ) ||
        (
          selectedState === "free" &&
          profile.role === "student" &&
          (
            profile.premium_until === null ||
            new Date(
              profile.premium_until,
            ).getTime() <= Date.now()
          )
        );

      return (
        matchesQuery &&
        matchesState
      );
    });

  /*
   * Sahifalash.
   *
   * Email bo'yicha qidiruv auth ma'lumotidan keladi, shuning uchun
   * filtrlash xotirada bajariladi. Lekin ekranga chiqarish eng
   * qimmat qismi — har bir foydalanuvchi uchun interaktiv karta
   * chiziladi. 500 ta karta brauzerni sezilarli sekinlashtiradi,
   * shuning uchun bir sahifada 25 tasi ko'rsatiladi.
   */
  const totalFiltered = filteredProfiles.length;

  const totalPages = Math.max(
    1,
    Math.ceil(totalFiltered / USERS_PAGE_SIZE),
  );

  const currentPage = Math.min(
    Math.max(1, Number(single(params.page)) || 1),
    totalPages,
  );

  const visibleProfiles = filteredProfiles.slice(
    (currentPage - 1) * USERS_PAGE_SIZE,
    currentPage * USERS_PAGE_SIZE,
  );

  function pageHref(page: number) {
    const search = new URLSearchParams();

    if (query) search.set("q", query);
    if (selectedState !== "all") search.set("state", selectedState);
    if (page > 1) search.set("page", String(page));

    const text = search.toString();

    return text ? `/admin/users?${text}` : "/admin/users";
  }

  const activeCount =
    profiles.filter(
      (profile) =>
        profile.is_active,
    ).length;

  const adminCount =
    profiles.filter(
      (profile) =>
        profile.role === "admin",
    ).length;

  const inactiveCount =
    profiles.length - activeCount;

  const premiumCount =
    profiles.filter(
      (profile) =>
        profile.role === "student" &&
        profile.premium_until !== null &&
        new Date(
          profile.premium_until,
        ).getTime() > Date.now(),
    ).length;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-mb-line bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
            <div>
              <Link
                href="/admin"
                className="inline-flex min-h-7 items-center text-sm font-semibold text-mb-brand hover:text-mb-brandDark"
              >
                ← Admin panelga qaytish
              </Link>

              <h1 className="text-xl font-bold sm:text-2xl">
                Foydalanuvchilar
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Akkaunt, Premium muddati va
                boʼlim ruxsatlarini boshqarish
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-xl bg-blue-50 px-4 py-2 font-bold text-blue-700">
                Jami: {profiles.length}
              </span>

              <span className="rounded-xl bg-emerald-50 px-4 py-2 font-bold text-emerald-700">
                Faol: {activeCount}
              </span>

              <span className="rounded-xl bg-red-50 px-4 py-2 font-bold text-red-700">
                Faol emas: {inactiveCount}
              </span>

              <span className="rounded-xl bg-amber-50 px-4 py-2 font-bold text-amber-700">
                Premium: {premiumCount}
              </span>

              <span className="rounded-xl bg-blue-50 px-4 py-2 font-bold text-blue-700">
                Admin: {adminCount}
              </span>
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <form
          method="get"
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
        >
          <div className="grid gap-3 md:grid-cols-[1fr_230px_auto]">
            <div>
              <label
                htmlFor="users-search"
                className="text-sm font-semibold text-slate-700"
              >
                Ism yoki email orqali qidirish
              </label>

              <input
                id="users-search"
                name="q"
                defaultValue={query}
                placeholder="Masalan: Ali yoki email@gmail.com"
                className="mt-2 min-h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="users-state"
                className="text-sm font-semibold text-slate-700"
              >
                Holat
              </label>

              <select
                id="users-state"
                name="state"
                defaultValue={selectedState}
                className="mt-2 min-h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              >
                <option value="all">
                  Barchasi
                </option>

                <option value="active">
                  Faol
                </option>

                <option value="inactive">
                  Faol emas
                </option>

                <option value="student">
                  O‘quvchilar
                </option>

                <option value="admin">
                  Adminlar
                </option>

                <option value="premium">
                  Premium faol
                </option>

                <option value="free">
                  Bepul tarif
                </option>
              </select>
            </div>

            <SubmitButton

              className="min-h-12 self-end rounded-2xl bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700"
            >
              Qidirish
            </SubmitButton>
          </div>
        </form>

        {filteredProfiles.length === 0 ? (
          <AppAlert
            variant="info"
            title="Foydalanuvchi topilmadi"
            className="mt-6"
          >
            Qidiruv yoki filtr qiymatini
            o‘zgartirib ko‘ring.
          </AppAlert>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {visibleProfiles.map(
              (profile) => (
                <UserAccessCard
                  key={profile.id}
                  userId={profile.id}
                  fullName={
                    profile.full_name ?? ""
                  }
                  email={
                    emailMap.get(
                      profile.id,
                    ) ||
                    "Email topilmadi"
                  }
                  role={profile.role}
                  authProvider={
                    profile.auth_provider
                  }
                  isActive={
                    profile.is_active
                  }
                  canAccessTextbooks={
                    profile
                      .can_access_textbooks
                  }
                  canAccessLessons={
                    profile
                      .can_access_lessons
                  }
                  canAccessTests={
                    profile
                      .can_access_tests
                  }
                  premiumUntil={
                    profile
                      .premium_until
                  }
                  pendingOrder={
                    pendingOrderMap.get(
                      profile.id,
                    ) ?? null
                  }
                  isCurrentUser={
                    profile.id ===
                    currentAdminId
                  }
                  action={
                    updateUserAccess
                  }
                  premiumAction={
                    manageUserPremium
                  }
                />
              ),
            )}
          </div>
        )}

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalFiltered}
          pageSize={USERS_PAGE_SIZE}
          hrefFor={pageHref}
        />
      </section>
    </main>
  );
}
