import Link from "next/link";
import { Check, Lock } from "@/components/ui/icons";

import { createPaymentOrderAction } from "@/app/pricing/actions";
import PaymentSubmitButton from "@/components/payment-submit-button";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createClient } from "@/lib/supabase/server";
import { asRpcClient } from "@/lib/supabase/rpc";
import PageHeader, { headerButton } from "@/components/ui/page-header";
import { Tag } from "@/components/ui/row";
import { btnGhost, btnPrimary } from "@/lib/ui";
import { cn } from "@/lib/utils";

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

  /* Bir oylik tarifga nisbatan tejaş foizi */
  const baseMonthly = plans
    .filter((plan) => Math.max(1, toNumber(plan.duration_months)) === 1)
    .map(monthlyPrice)[0];

  const savingOf = (plan: PlanRow) =>
    baseMonthly && baseMonthly > 0
      ? Math.round((1 - monthlyPrice(plan) / baseMonthly) * 100)
      : 0;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <PageHeader
        backHref="/"
        backLabel="Boş sahifa"
        glyph="premium"
        title="Premium"
        subtitle={
          premiumStatus?.is_admin
            ? "Administrator hisobi"
            : hasPremium
              ? `Faol · ${formatDate(premiumStatus?.premium_until ?? null)} gaça (${toNumber(premiumStatus?.days_remaining)} kun)`
              : "Hozir: bepul tarif"
        }
        width="3xl"
        action={
          user ? (
            <Link href="/profile/payments" className={headerButton}>
              Tölovlarim
            </Link>
          ) : null
        }
      />

      <section className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-8">
        {locked && (
          <div className="mb-3 flex items-center gap-2.5 rounded-2xl border border-vp-warning-line bg-vp-warning-soft px-4 py-3 text-sm font-semibold text-vp-warning">
            <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
            Siz oçmoqçi bölgan {locked === "test" ? "test" : "dars"} Premium
            tarifga kiradi.
          </div>
        )}

        {errorMessage && (
          <div className="mb-3 rounded-2xl border border-vp-danger-line bg-vp-danger-soft px-4 py-3 text-sm font-semibold text-vp-danger">
            {errorMessage}
          </div>
        )}

        {/* Nima olasiz */}
        <div className="rounded-2xl border border-mb-line bg-white p-4 sm:p-5">
          <h2 className="text-xl font-extrabold leading-tight text-mb-ink sm:text-2xl">
            Hamma dars va test — bitta obunada
          </h2>

          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {benefits.map((item) => (
              <li
                key={item}
                className="flex items-center gap-2.5 text-[15px] text-slate-700"
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-vp-success-soft text-vp-success">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <h2 className="eyebrow mt-6">Muddatni tanlang</h2>

        <div className="mt-3 grid gap-3">
          {plans.map((plan) => {
            const months = Math.max(1, toNumber(plan.duration_months));
            const isBest = plan.code === bestPlanCode;
            const isSelected = selectedPlan === plan.code;
            const saving = savingOf(plan);

            return (
              <form
                key={plan.plan_id}
                action={createPaymentOrderAction}
                className={cn(
                  "relative flex items-center gap-3 rounded-2xl border bg-white p-3.5",
                  isBest
                    ? "border-vp-accent shadow-[0_0_0_1px_var(--vp-accent)]"
                    : isSelected
                      ? "border-mb-brand"
                      : "border-mb-line",
                )}
              >
                <input type="hidden" name="planCode" value={plan.code} />

                <span
                  className={cn(
                    "num grid h-14 w-14 shrink-0 place-content-center rounded-xl text-center",
                    isBest
                      ? "bg-vp-accent text-vp-on-accent"
                      : "bg-slate-100 text-slate-700",
                  )}
                >
                  <span className="block text-xl font-extrabold leading-none">
                    {months}
                  </span>
                  <span className="mt-0.5 block text-[11px] font-bold leading-none">
                    oy
                  </span>
                </span>

                <span className="min-w-0 flex-1">
                  <span className="num block text-xl font-extrabold leading-6 text-mb-ink">
                    {formatMoney(plan.price_uzs)}
                    <span className="ml-1 text-sm font-semibold text-mb-muted">
                      söm
                    </span>
                  </span>

                  <span className="num mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-mb-muted">
                    {months > 1
                      ? `oyiga ≈ ${formatMoney(Math.round(monthlyPrice(plan)))} söm`
                      : plan.name}

                    {saving > 0 && <Tag tone="free">−{saving}%</Tag>}

                    {isBest && <Tag tone="accent">Eng foydali</Tag>}
                  </span>
                </span>

                {user ? (
                  <PaymentSubmitButton highlighted={isBest} compact />
                ) : (
                  <Link
                    href={`/auth/login?mode=signup&next=${encodeURIComponent(`/pricing?plan=${plan.code}`)}`}
                    className={isBest ? btnPrimary : btnGhost}
                  >
                    Oliş
                  </Link>
                )}
              </form>
            );
          })}
        </div>

        <h2 className="eyebrow mt-6">Qanday tölanadi</h2>

        <ol className="mt-3 grid gap-2 sm:grid-cols-3">
          {[
            "Muddatni tanlaysiz",
            "Telegramda tölaysiz",
            "Premium darrov yoqiladi",
          ].map((step, index) => (
            <li
              key={step}
              className="flex items-center gap-3 rounded-xl border border-mb-line bg-white px-3 py-2.5"
            >
              <span className="num grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-mb-tint text-sm font-bold text-mb-brandDark">
                {index + 1}
              </span>
              <span className="text-sm font-semibold text-slate-700">
                {step}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
