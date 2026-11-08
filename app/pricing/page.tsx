import Link from "next/link";
import { Check, Crown } from "lucide-react";

import { createPaymentOrderAction } from "@/app/pricing/actions";
import PaymentSubmitButton from "@/components/payment-submit-button";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createClient } from "@/lib/supabase/server";
import { asRpcClient } from "@/lib/supabase/rpc";
import BackLink from "@/components/ui/back-link";

export const dynamic =
  "force-dynamic";

export const metadata = {
  title: "Tariflar",
  description:
    "Premium obuna narxlari va imkoniyatlari.",
};

type PageProps = {
  searchParams: Promise<{
    error?: string | string[];
    plan?: string | string[];
    locked?: string | string[];
  }>;
};

type PlanRow = {
  plan_id: number | string;
  code: string;
  name: string;
  description: string | null;
  price_uzs: number | string;
  duration_months: number | string;
  is_full: boolean;
  sort_order: number | string;
};

type PremiumStatusRow = {
  is_admin: boolean;
  is_premium: boolean;
  premium_until: string | null;
  days_remaining: number | string;
};

function single(
  value:
    | string
    | string[]
    | undefined,
) {
  return Array.isArray(value)
    ? value[0]
    : value;
}

function toNumber(
  value: unknown,
) {
  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
}

function formatMoney(
  value: unknown,
) {
  return new Intl.NumberFormat(
    "uz-UZ",
  ).format(
    toNumber(value),
  );
}

function formatDate(
  value: string | null,
) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "uz-UZ",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone:
        "Asia/Tashkent",
    },
  ).format(new Date(value));
}

export default async function PricingPage({
  searchParams,
}: PageProps) {
  const params =
    await searchParams;

  const supabase =
    await createClient();

  const user = await getCurrentUser();

  const rpcClient = asRpcClient(supabase);

  /*
   * Tariflar sahifasi mehmonga ham ochiq. Mehmonning bazada
   * funksiya chaqirish huquqi bo'lmasligi mumkin, shuning uchun
   * tariflar ro'yxati (ochiq ma'lumot) admin mijozi orqali olinadi.
   */
  const plansClient = user
    ? rpcClient
    : asRpcClient(createAdminClient());

  const [
    plansResult,
    premiumResult,
  ] = await Promise.all([
    plansClient.rpc(
      "get_active_payment_plans",
    ),

    user
      ? rpcClient.rpc(
          "get_my_premium_status",
        )
      : Promise.resolve({
          data: [],
          error: null,
        }),
  ]);

  if (plansResult.error) {
    throw new Error(
      `Tariflar yuklanmadi: ${plansResult.error.message}`,
    );
  }

  if (premiumResult.error) {
    throw new Error(
      `Premium holati yuklanmadi: ${premiumResult.error.message}`,
    );
  }

  const plans =
    (
      plansResult.data ??
      []
    ) as PlanRow[];

  const premiumStatus = (
    (premiumResult.data ?? []) as PremiumStatusRow[]
  )[0];

  const errorMessage =
    single(params.error);

  const selectedPlan =
    single(params.plan);

  const locked =
    single(params.locked);

  const hasPremium =
    premiumStatus?.is_premium ===
    true;

  /*
   * Eng foydali tarif — oyiga hisoblaganda eng arzoni.
   * Odam qaysi birini olishni uzoq o'ylab qolmasin.
   */
  const monthlyPrice = (plan: PlanRow) => {
    const months = Math.max(1, toNumber(plan.duration_months));

    return toNumber(plan.price_uzs) / months;
  };

  const bestPlanCode = plans.length
    ? [...plans].sort(
        (a, b) => monthlyPrice(a) - monthlyPrice(b),
      )[0].code
    : null;

  const benefits = [
    "Barça premium videodarslar",
    "Barça premium testlar",
    "Reyting va natijalar tahlili",
    "Yangi testlar birinçi bölib",
  ];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2 sm:px-6 sm:py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <BackLink href="/" label="Boş sahifa" iconOnly />

            <p className="truncate text-lg font-bold">Premium</p>
          </div>

          {user && (
            <Link
              href="/profile/payments"
              className="inline-flex min-h-9 shrink-0 items-center rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Tölovlarim
            </Link>
          )}
        </div>
      </header>

      {/*
        Mobil ekranga sig'ishi uchun hamma narsa ixcham: sarlavha
        kichik, afzalliklar bitta qatorda, tariflar esa baland karta
        emas — qatorlar. Odam pastga tushirmasdan narxni ko'radi va
        darrov tugmani bosadi.
      */}
      <section className="mx-auto max-w-3xl px-3 pb-6 pt-3 sm:px-6 sm:pt-5">
        <div className="relative overflow-hidden rounded-2xl bg-mb-brand p-4 text-white shadow-lg sm:p-6">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/10"
          />

          <div className="relative">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold text-blue-100 ring-1 ring-white/20">
              <Crown
                className="h-3 w-3"
                strokeWidth={2.6}
                aria-hidden="true"
              />
              {premiumStatus?.is_admin
                ? "Administrator"
                : hasPremium
                  ? `Faol · ${toNumber(premiumStatus?.days_remaining)} kun qoldi`
                  : "Bepul tarif"}
            </p>

            <h1 className="mt-2 text-xl font-bold leading-tight sm:text-3xl">
              Hamma dars va test bir obunada
            </h1>

            <p className="mt-1.5 text-sm leading-5 text-blue-100">
              {hasPremium
                ? `${formatDate(premiumStatus?.premium_until ?? null)} gaça amal qiladi.`
                : "Bepul belgisi bor dars va testlar oçiq. Qolganini Premium oçadi."}
            </p>

            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
              {benefits.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-1 text-xs font-medium text-white"
                >
                  <Check
                    className="h-3.5 w-3.5 shrink-0 text-emerald-300"
                    strokeWidth={3}
                    aria-hidden="true"
                  />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>

        {locked && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
            Siz oçmoqçi bölgan {locked === "test" ? "test" : "dars"}{" "}
            Premium tarifga kiradi.
          </div>
        )}

        {errorMessage && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
            {errorMessage}
          </div>
        )}

        {/* Tariflar — qatorlar ko'rinishida */}
        <div className="mt-3 space-y-2">
          {plans.map((plan) => {
            const months = Math.max(1, toNumber(plan.duration_months));
            const isBest = plan.code === bestPlanCode;
            const isSelected = selectedPlan === plan.code;

            return (
              <form
                key={plan.plan_id}
                action={createPaymentOrderAction}
                className={
                  isBest
                    ? "flex items-center gap-3 rounded-2xl border-2 border-blue-400 bg-white p-3 shadow-sm"
                    : isSelected
                      ? "flex items-center gap-3 rounded-2xl border-2 border-blue-300 bg-white p-3 shadow-sm"
                      : "flex items-center gap-3 rounded-2xl border border-mb-line bg-white p-3 shadow-sm"
                }
              >
                <input type="hidden" name="planCode" value={plan.code} />

                <span
                  className={
                    isBest
                      ? "grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-mb-brand text-white"
                      : "grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600"
                  }
                >
                  <span className="text-lg font-bold leading-none">
                    {months}
                  </span>
                  <span className="text-[9px] font-bold uppercase">oy</span>
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[15px] font-bold text-mb-ink">
                      {plan.name}
                    </span>

                    {isBest && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                        Eng foydali
                      </span>
                    )}
                  </span>

                  <span className="mt-0.5 block text-lg font-bold leading-6 text-mb-ink">
                    {formatMoney(plan.price_uzs)}
                    <span className="ml-1 text-xs font-bold text-mb-muted">
                      söm
                    </span>
                  </span>

                  {months > 1 && (
                    <span className="block text-[11px] font-semibold text-emerald-700">
                      oyiga ≈ {formatMoney(Math.round(monthlyPrice(plan)))} söm
                    </span>
                  )}
                </span>

                {user ? (
                  <PaymentSubmitButton highlighted={isBest} compact />
                ) : (
                  <Link
                    href={`/auth/login?mode=signup&next=${encodeURIComponent(`/pricing?plan=${plan.code}`)}`}
                    className="inline-flex min-h-11 shrink-0 items-center rounded-xl bg-mb-brand px-4 text-sm font-bold text-white hover:bg-mb-brandDark"
                  >
                    Oliş
                  </Link>
                )}
              </form>
            );
          })}
        </div>

        <p className="mt-3 text-center text-[11px] leading-5 text-mb-muted">
          Tarifni tanlaysiz → Telegramda tölaysiz → Premium darrov
          yoqiladi.
        </p>
      </section>
    </main>
  );
}
