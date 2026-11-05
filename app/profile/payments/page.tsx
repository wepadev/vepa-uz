import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/supabase/current-user";
import { createClient } from "@/lib/supabase/server";
import { asRpcClient } from "@/lib/supabase/rpc";

export const dynamic =
  "force-dynamic";

export const metadata = {
  title: "Tölovlarim",
  description:
    "Tölov buyurtmalari tarixi.",
};

type PremiumStatusRow = {
  is_admin: boolean;
  is_premium: boolean;
  premium_until: string | null;
  days_remaining: number | string;
};

type PaymentRow = {
  order_id: string;
  order_number: number | string;
  plan_name: string;
  provider: string;
  status: string;
  original_amount_uzs: number | string;
  discount_amount_uzs: number | string;
  final_amount_uzs: number | string;
  promo_code: string | null;
  created_at: string;
  paid_at: string | null;
};

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

function statusLabel(
  value: string,
) {
  const labels:
    Record<string, string> = {
      pending: "Kutilmoqda",
      prepared: "Tayyorlandi",
      paid: "Tölangan",
      cancelled: "Bekor qilingan",
      failed: "Xato",
      expired: "Muddati tugagan",
      refunded: "Qaytarilgan",
    };

  return labels[value] ?? value;
}

export default async function PaymentHistoryPage() {
  const supabase =
    await createClient();

  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/login");
  }

  const rpcClient = asRpcClient(supabase);

  const [
    premiumResult,
    ordersResult,
  ] = await Promise.all([
    rpcClient.rpc(
      "get_my_premium_status",
    ),

    rpcClient.rpc(
      "get_my_payment_orders",
      {
        p_limit: 100,
      },
    ),
  ]);

  if (premiumResult.error) {
    throw new Error(
      `Premium holati yuklanmadi: ${premiumResult.error.message}`,
    );
  }

  if (ordersResult.error) {
    throw new Error(
      `Tölovlar yuklanmadi: ${ordersResult.error.message}`,
    );
  }

  const premium = (
    (premiumResult.data ?? []) as PremiumStatusRow[]
  )[0];

  const orders =
    (
      ordersResult.data ??
      []
    ) as PaymentRow[];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-mb-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-4 px-4 py-3 sm:flex-row sm:items-center sm:px-6">
          <div>
            <Link
              href="/profile"
              className="inline-flex min-h-7 items-center text-sm font-semibold text-mb-brand hover:text-mb-brandDark"
            >
              ← Profilga qaytiş
            </Link>

            <h1 className="text-xl font-bold sm:text-2xl">
              Premium va tölovlarim
            </h1>
          </div>

          <Link
            href="/pricing"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
          >
            Tariflarni köriş
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div
          className={
            premium?.is_premium
              ? "rounded-3xl border border-emerald-200 bg-emerald-50 p-6"
              : "rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          }
        >
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            Joriy holat
          </p>

          <h2 className="text-xl font-bold sm:text-2xl">
            {premium?.is_admin
              ? "Administrator"
              : premium?.is_premium
                ? "Premium faol"
                : "Bepul tarif"}
          </h2>

          {premium?.is_premium &&
            !premium.is_admin && (
            <p className="mt-2 text-sm font-bold text-emerald-700">
              {formatDate(
                premium.premium_until,
              )}{" "}
              gaça —{" "}
              {Number(
                premium.days_remaining,
              ) || 0}{" "}
              kun qoldi
            </p>
          )}
        </div>

        <div className="mt-7">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">
                Buyurtmalar tarixi
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {orders.length} ta
                buyurtma
              </p>
            </div>
          </div>

          {orders.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
              <p className="font-bold">
                Hozirça buyurtma yöq
              </p>

              <Link
                href="/pricing"
                className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 font-bold text-white hover:bg-blue-700"
              >
                Tarif tanlaş
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <article
                  key={order.order_id}
                  className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
                >
                  <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold">
                          {order.plan_name}
                        </h3>

                        <span
                          className={
                            order.status ===
                            "paid"
                              ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700"
                              : order.status ===
                                  "pending"
                                ? "rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700"
                                : "rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600"
                          }
                        >
                          {statusLabel(
                            order.status,
                          )}
                        </span>
                      </div>

                      <p className="mt-2 text-sm text-slate-500">
                        Buyurtma #
                        {order.order_number}
                        {" · "}
                        {formatDate(
                          order.created_at,
                        )}
                      </p>

                      {order.promo_code && (
                        <p className="mt-2 text-sm font-bold text-amber-700">
                          Promo-kod:{" "}
                          {order.promo_code}
                        </p>
                      )}
                    </div>

                    <div className="text-left md:text-right">
                      <p className="text-2xl font-bold text-blue-600">
                        {formatMoney(
                          order.final_amount_uzs,
                        )}{" "}
                        söm
                      </p>

                      {Number(
                        order.discount_amount_uzs,
                      ) > 0 && (
                        <p className="mt-1 text-xs font-bold text-emerald-600">
                          Çegirma:{" "}
                          {formatMoney(
                            order.discount_amount_uzs,
                          )}{" "}
                          söm
                        </p>
                      )}

                      <Link
                        href={`/payment/pending?orderId=${order.order_id}`}
                        className="mt-3 inline-flex min-h-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-100"
                      >
                        Batafsil
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
