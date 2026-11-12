import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";

import { CheckCircle2, Send } from "@/components/ui/icons";

import {
  TELEGRAM_ADMIN_USERNAME,
  cleanUsername,
} from "@/lib/contacts";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/ui/page-header";

export const dynamic =
  "force-dynamic";

export const metadata = {
  title: "Tölov kutilmoqda",
  description:
    "Buyurtmangiz tekşirilmoqda.",
};

type PageProps = {
  searchParams: Promise<{
    orderId?: string | string[];
  }>;
};

type PlanRelation = {
  name: string;
  code: string;
  duration_months: number;
};

type OrderRow = {
  id: string;
  order_number: number | string;
  status: string;
  original_amount_uzs: number | string;
  discount_amount_uzs: number | string;
  final_amount_uzs: number | string;
  promo_code_snapshot: string | null;
  created_at: string;
  expires_at: string;
  paid_at: string | null;
  payment_plans:
    | PlanRelation
    | PlanRelation[]
    | null;
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

function formatMoney(
  value: unknown,
) {
  return new Intl.NumberFormat(
    "uz-UZ",
  ).format(Number(value) || 0);
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
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone:
        "Asia/Tashkent",
    },
  ).format(new Date(value));
}

export default async function PaymentPendingPage({
  searchParams,
}: PageProps) {
  const params =
    await searchParams;

  const orderId =
    single(params.orderId) ?? "";

  if (!orderId) {
    notFound();
  }

  const supabase =
    await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const {
    data,
    error,
  } = await (
    // Bu jadval Supabase tiplarida yo'q — tekshiruvni chetlab o'tamiz
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase as any
  )
    .from("payment_orders")
    .select(`
      id,
      order_number,
      status,
      original_amount_uzs,
      discount_amount_uzs,
      final_amount_uzs,
      promo_code_snapshot,
      created_at,
      expires_at,
      paid_at,
      payment_plans (
        name,
        code,
        duration_months
      )
    `)
    .eq("id", orderId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) {
    notFound();
  }

  const order =
    data as OrderRow;

  const plan =
    Array.isArray(
      order.payment_plans,
    )
      ? order.payment_plans[0]
      : order.payment_plans;

  /* Admin username — lib/contacts.ts dagi yagona manba */
  const username = cleanUsername(TELEGRAM_ADMIN_USERNAME);

  const fullName =
    String(
      user.user_metadata
        ?.full_name ??
      user.user_metadata?.name ??
      user.email?.split("@")[0] ??
      "Foydalanuvçi",
    ).trim();

  const telegramMessage = [
    "Assalomu alaykum!",
    "",
    "Vepa Ustoz Premium sotib olmoqçiman.",
    "",
    `Buyurtma: #${order.order_number}`,
    `Foydalanuvçi: ${fullName}`,
    `Email: ${user.email ?? "körsatilmagan"}`,
    `Tarif: ${plan?.name ?? "Premium tarif"}`,
    `Muddat: ${plan?.duration_months ?? "—"} oy`,
    `Asl narx: ${formatMoney(
      order.original_amount_uzs,
    )} söm`,
    order.promo_code_snapshot
      ? `Promo-kod: ${order.promo_code_snapshot}`
      : "Promo-kod: yöq",
    `Tölov summasi: ${formatMoney(
      order.final_amount_uzs,
    )} söm`,
    "",
    "Tölov tartibini yuboring. Tölov çekini şu çatga jönataman.",
  ].join("\n");

  const telegramHref =
    username
      ? `https://t.me/${username}?text=${encodeURIComponent(
          telegramMessage,
        )}`
      : null;

  const isPaid =
    order.status === "paid";

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <PageHeader
        backHref="/pricing"
        backLabel="Premium"
        title={`Buyurtma #${order.order_number}`}
        width="2xl"
        action={
          <span
            className={
              isPaid
                ? "rounded-md bg-vp-success-soft px-2.5 py-1 text-xs font-semibold text-vp-success"
                : "rounded-md bg-vp-accent-soft px-2.5 py-1 text-xs font-semibold text-vp-accent-strong"
            }
          >
            {isPaid ? "Tölangan" : "Kutilmoqda"}
          </span>
        }
      />

      {/*
        Bu sahifada bitta ish bor: Telegramga o'tish. Shu sababli
        summa va tugma eng tepada, tafsilotlar esa pastda —
        telefonda ham pastga tushirmasdan bosiladi.
      */}
      <section className="mx-auto max-w-2xl px-3 pb-8 pt-3 sm:px-6 sm:pt-5">
        <div
          className={
            isPaid
              ? "relative overflow-hidden rounded-2xl bg-emerald-600 p-5 text-white sm:p-6"
              : "spotlight rounded-2xl p-5 sm:p-6"
          }
        >

          <div className="relative">
            <p className="text-sm font-semibold text-white/85">
              {plan?.name ?? "Premium tarif"}
              {plan?.duration_months
                ? ` · ${plan.duration_months} oy`
                : ""}
            </p>

            <p className="mt-1 text-4xl font-bold leading-none sm:text-5xl">
              {formatMoney(order.final_amount_uzs)}
              <span className="ml-1.5 text-base font-bold text-white/85">
                söm
              </span>
            </p>

            {Number(order.discount_amount_uzs) > 0 && (
              <p className="mt-1.5 text-sm text-white/85">
                <span className="line-through">
                  {formatMoney(order.original_amount_uzs)}
                </span>{" "}
                · çegirma {formatMoney(order.discount_amount_uzs)} söm
              </p>
            )}

            {isPaid ? (
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm font-bold ring-1 ring-white/20">
                <CheckCircle2
                  className="h-4 w-4"
                  strokeWidth={2.4}
                  aria-hidden="true"
                />
                Premium yoqildi
              </p>
            ) : (
              <a
                href={telegramHref ?? "#"}
                className="press mt-4 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-white px-5 text-base font-bold text-blue-700 shadow-[inset_0_-3px_0_rgb(3_22_80/0.14)]"
              >
                <Send
                  className="h-5 w-5"
                  strokeWidth={2.2}
                  aria-hidden="true"
                />
                Telegramda tölaş
              </a>
            )}

            {!isPaid && (
              <p className="mt-2 text-center text-xs text-white/80">
                Tugma admin bilan çatni tayyor xabar bilan oçadi ·
                @{username}
              </p>
            )}
          </div>
        </div>

        {!isPaid && (
          <div className="mt-3 rounded-2xl border border-mb-line bg-white p-4">
            <p className="text-sm font-bold text-mb-ink">
              Keyingi qadamlar
            </p>

            <div className="mt-2.5 grid gap-2">
              {[
                "Tugmani bosing — çat tayyor xabar bilan oçiladi",
                "Admin yuborgan rekvizit orqali tölaysiz",
                "Çek rasmini öşa çatga taşlaysiz",
                "Admin tasdiqlaydi, Premium darrov yoqiladi",
              ].map((step, index) => (
                <p
                  key={step}
                  className="flex items-start gap-2.5 text-sm leading-6 text-mb-muted"
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-mb-tintSoft text-xs font-bold text-mb-brand">
                    {index + 1}
                  </span>
                  {step}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Tafsilotlar */}
        <div className="mt-3 overflow-hidden rounded-2xl border border-mb-line bg-white">
          {[
            {
              label: "Tarif",
              value: plan?.name ?? "Premium tarif",
            },
            {
              label: "Muddat",
              value: plan?.duration_months
                ? `${plan.duration_months} oy`
                : "—",
            },
            ...(order.promo_code_snapshot
              ? [
                  {
                    label: "Promo-kod",
                    value: order.promo_code_snapshot,
                  },
                ]
              : []),
            {
              label: "Yaratilgan",
              value: formatDate(order.created_at),
            },
            ...(isPaid
              ? [
                  {
                    label: "Tasdiqlangan",
                    value: formatDate(order.paid_at),
                  },
                ]
              : []),
          ].map((row, index) => (
            <div
              key={row.label}
              className={
                index > 0
                  ? "flex items-center justify-between gap-3 border-t border-mb-line px-4 py-2.5"
                  : "flex items-center justify-between gap-3 px-4 py-2.5"
              }
            >
              <span className="text-sm text-mb-muted">{row.label}</span>

              <span className="text-sm font-semibold text-mb-ink">
                {row.value}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link
            href="/profile/payments"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Tölovlarim
          </Link>

          <Link
            href="/profile"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-mb-brand text-sm font-semibold text-white hover:bg-mb-brandDark"
          >
            Profilim
          </Link>
        </div>
      </section>
    </main>
  );
}
