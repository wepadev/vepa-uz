import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  Coins,
  PackageOpen,
  ShoppingBag,
  Sparkles,
} from "lucide-react";

import AppAlert from "@/components/ui/app-alert";
import SubmitButton from "@/components/ui/submit-button";
import PageHeader from "@/components/ui/page-header";
import { isGroupStudent } from "@/lib/group-membership";
import { rewardIcon } from "@/lib/reward-icons";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

import { requestRewardAction } from "@/app/guruhim/actions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dökon",
  description: "Yiğgan tangalaringizni sovğaga almaştiring.",
};

type PageProps = {
  searchParams: Promise<{
    xato?: string | string[];
    xabar?: string | string[];
  }>;
};

type RewardRow = {
  id: number;
  title: string;
  description: string | null;
  cost_coins: number;
  stock: number | null;
  icon: string | null;
  group_title: string | null;
};

type RedemptionRow = {
  id: number;
  reward_title: string;
  cost_coins: number;
  status: string;
  created_at: string;
};

/*
 * Har bir sovg'a o'z rangida turadi — ro'yxat bir xil kulrang
 * bo'lib qolmasin. Rang sovg'a raqamidan olinadi, ya'ni har safar
 * bir xil: o'quvchi "yashil daftar"ni ko'z bilan eslab qoladi.
 */
const ACCENTS = [
  {
    bar: "bg-amber-400",
    tile: "bg-amber-100 text-amber-700",
    ring: "border-amber-200",
    fill: "bg-amber-400",
  },
  {
    bar: "bg-red-400",
    tile: "bg-red-100 text-red-700",
    ring: "border-red-200",
    fill: "bg-red-400",
  },
  {
    bar: "bg-blue-400",
    tile: "bg-blue-100 text-blue-700",
    ring: "border-blue-200",
    fill: "bg-blue-400",
  },
  {
    bar: "bg-blue-400",
    tile: "bg-blue-100 text-blue-700",
    ring: "border-blue-200",
    fill: "bg-blue-400",
  },
  {
    bar: "bg-emerald-400",
    tile: "bg-emerald-100 text-emerald-700",
    ring: "border-emerald-200",
    fill: "bg-emerald-400",
  },
  {
    bar: "bg-amber-400",
    tile: "bg-amber-100 text-amber-700",
    ring: "border-amber-200",
    fill: "bg-amber-400",
  },
];

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function toNumber(value: number | string | null | undefined) {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Tashkent",
  }).format(new Date(value));
}

export default async function ShopPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const errorMessage = single(params.xato);
  const infoMessage = single(params.xabar);

  const supabase = await createClient();

  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/login");
  }

  /*
   * Do'kon guruh o'quvchilari uchun.
   *
   * Tanga faqat guruh ichidagi ishdan yig'iladi (dars balli va
   * guruhga berilgan uy vazifasi), shuning uchun guruhsiz o'quvchiga
   * do'konning ma'nosi yo'q. Havolani yashirish kifoya emas —
   * manzilni qo'lda yozib kirsa ham shu ekran chiqadi.
   */
  const inGroup = await isGroupStudent(supabase, user.id);

  if (!inGroup) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <section className="mx-auto max-w-md px-3 py-10 sm:px-6">
          <Link
            href="/"
            className="inline-flex min-h-8 items-center text-sm font-semibold text-mb-brand hover:text-mb-brandDark"
          >
            ← Boş sahifa
          </Link>

          <div className="mt-4 rounded-3xl border border-mb-line bg-white px-5 py-10 text-center shadow-sm">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-amber-50 text-amber-600">
              <ShoppingBag
                className="h-8 w-8"
                strokeWidth={1.8}
                aria-hidden="true"
              />
            </span>

            <h1 className="mt-4 text-xl font-bold">
              Dökon guruh öquvçilari uçun
            </h1>

            <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-mb-muted">
              Tangalar darsdagi ball va guruhga berilgan uy
              vazifalaridan yiğiladi. Ustozingiz bergan kod bilan
              guruhga qöşilsangiz dökon oçiladi.
            </p>

            <Link
              href="/guruhim"
              className="mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl bg-mb-brand px-6 font-bold text-white transition hover:bg-mb-brandDark"
            >
              Guruhga qöşiliş
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const awardResult = await supabase.rpc("award_online_coins");

  const migrationMissing = Boolean(awardResult.error);

  const [balanceResult, rewardResult, historyResult] = migrationMissing
    ? [{ data: null }, { data: null }, { data: null }]
    : await Promise.all([
        supabase.rpc("my_coin_balance"),
        supabase.rpc("my_reward_list"),
        supabase.rpc("my_redemptions"),
      ]);

  const balance = (
    Array.isArray(balanceResult.data)
      ? balanceResult.data[0]
      : balanceResult.data
  ) as { available_coins: number | string } | null;

  const available = toNumber(balance?.available_coins);
  const rewards = (rewardResult.data ?? []) as RewardRow[];
  const history = (historyResult.data ?? []) as RedemptionRow[];

  /* Qo'l yetadigan eng arzon sovg'a — tepadagi maslahat uchun */
  const cheapest = rewards
    .filter((row) => row.stock === null || row.stock > 0)
    .reduce<RewardRow | null>(
      (best, row) =>
        !best || row.cost_coins < best.cost_coins ? row : best,
      null,
    );

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <PageHeader
        backHref="/guruhim"
        backLabel="Guruhim"
        title="Dökon"
        subtitle="Tangani sovğaga almaştiring"
      />

      <section className="mx-auto max-w-3xl px-3 py-5 sm:px-6 sm:py-8">
        {/* Tanga kartasi */}
        <div className="relative overflow-hidden rounded-3xl bg-amber-500 p-5 text-white shadow-lg sm:p-7">
          {/* Bezak doiralari */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/15"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-16 right-10 h-32 w-32 rounded-full bg-white/10"
          />

          <div className="relative">
            <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/90">
              <Sparkles
                className="h-4 w-4"
                strokeWidth={2.2}
                aria-hidden="true"
              />
              Dökon
            </p>

            <p className="mt-2 flex items-baseline gap-2">
              <Coins
                className="h-9 w-9 shrink-0 self-center"
                strokeWidth={2}
                aria-hidden="true"
              />
              <span className="text-5xl font-bold leading-none">
                {available}
              </span>
              <span className="text-lg font-bold text-white/90">tanga</span>
            </p>

            <p className="mt-3 max-w-sm text-sm leading-6 text-white/90">
              {cheapest && available < cheapest.cost_coins
                ? `Eng yaqin sovğa — “${cheapest.title}”. Yana ${
                    cheapest.cost_coins - available
                  } ta tanga yiğsangiz oldingiz.`
                : cheapest
                  ? "Tanga yetarli — pastdan sovğangizni tanlang."
                  : "Darsdagi ballaringiz va uy vazifalaringiz tangaga aylanadi."}
            </p>
          </div>
        </div>

        {migrationMissing && (
          <AppAlert
            variant="warning"
            title="Bölim tayyor emas"
            className="mt-5"
          >
            Bu bölim hali sozlanmoqda. Keyinroq qayta kiring.
          </AppAlert>
        )}

        {infoMessage && (
          <AppAlert variant="success" title="Bajarildi" className="mt-4">
            {infoMessage}
          </AppAlert>
        )}

        {errorMessage && (
          <AppAlert variant="error" title="Bajarilmadi" className="mt-4">
            {errorMessage}
          </AppAlert>
        )}

        {!migrationMissing && rewards.length === 0 ? (
          <div className="mt-5 rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center">
            <PackageOpen
              className="mx-auto h-10 w-10 text-mb-muted"
              strokeWidth={1.6}
              aria-hidden="true"
            />

            <p className="mt-3 text-lg font-bold">Dökon hali böş</p>

            <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-mb-muted">
              Ustozingiz sovğa qöşganda şu yerda paydo böladi.
              Siz esa tanga yiğib turing.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {rewards.map((reward) => {
              const Icon = rewardIcon(reward.icon);
              const accent = ACCENTS[reward.id % ACCENTS.length];

              const affordable = available >= reward.cost_coins;
              const soldOut = reward.stock !== null && reward.stock <= 0;
              const lastFew =
                reward.stock !== null && reward.stock > 0 && reward.stock <= 3;

              const percent = Math.min(
                100,
                Math.round((available / Math.max(1, reward.cost_coins)) * 100),
              );

              return (
                <div
                  key={reward.id}
                  className={cn(
                    "relative flex flex-col overflow-hidden rounded-2xl border bg-white p-4 pt-5 shadow-sm transition sm:hover:-translate-y-0.5 sm:hover:shadow-md",
                    soldOut
                      ? "border-slate-200 bg-slate-50"
                      : affordable
                        ? accent.ring
                        : "border-mb-line",
                  )}
                >
                  {/* Yuqoridagi rangli chiziq */}
                  <div
                    aria-hidden="true"
                    className={cn(
                      "absolute inset-x-0 top-0 h-1.5",
                      soldOut ? "bg-slate-200" : accent.bar,
                    )}
                  />

                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "grid h-14 w-14 shrink-0 place-items-center rounded-2xl shadow-sm",
                        soldOut
                          ? "bg-slate-100 text-slate-400"
                          : accent.tile,
                      )}
                    >
                      <Icon
                        className="h-7 w-7"
                        strokeWidth={1.9}
                        aria-hidden="true"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[15px] font-bold text-mb-ink">
                          {reward.title}
                        </p>

                        {lastFew && (
                          <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">
                            oxirgi {reward.stock} ta
                          </span>
                        )}
                      </div>

                      {reward.description && (
                        <p className="mt-0.5 text-xs leading-5 text-mb-muted">
                          {reward.description}
                        </p>
                      )}

                      <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-sm font-bold text-amber-700">
                        <Coins
                          className="h-4 w-4"
                          strokeWidth={2.2}
                          aria-hidden="true"
                        />
                        {reward.cost_coins}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3.5">
                    {soldOut ? (
                      <p className="rounded-xl bg-slate-100 px-3 py-2 text-center text-xs font-bold text-slate-500">
                        Hozirça tugagan
                      </p>
                    ) : affordable ? (
                      <form action={requestRewardAction}>
                        <input
                          type="hidden"
                          name="rewardId"
                          value={reward.id}
                        />

                        <SubmitButton
                          pendingLabel="Yuborilmoqda..."
                          className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-mb-brandDark"
                        >
                          <Sparkles
                            className="h-4 w-4"
                            strokeWidth={2.2}
                            aria-hidden="true"
                          />
                          Olaman
                        </SubmitButton>
                      </form>
                    ) : (
                      <>
                        {/* Maqsadgacha qancha qolgani */}
                        <div
                          className="h-2 overflow-hidden rounded-full bg-slate-100"
                          role="progressbar"
                          aria-valuenow={percent}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${reward.title} uçun yiğilgan tanga`}
                        >
                          <div
                            className={cn("h-full rounded-full", accent.fill)}
                            style={{ width: `${percent}%` }}
                          />
                        </div>

                        <p className="mt-1.5 text-xs font-semibold text-mb-muted">
                          {available} / {reward.cost_coins} ·{" "}
                          <span className="text-mb-ink">
                            yana {reward.cost_coins - available} ta tanga
                          </span>
                        </p>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {history.length > 0 && (
          <>
            <h2 className="mt-8 flex items-center gap-2 text-lg font-bold">
              <CheckCircle2
                className="h-5 w-5 text-mb-muted"
                strokeWidth={2}
                aria-hidden="true"
              />
              Olgan sovğalarim
            </h2>

            <div className="mt-3 overflow-hidden rounded-2xl border border-mb-line bg-white shadow-sm">
              {history.map((row, index) => {
                const pending = row.status === "kutilmoqda";

                return (
                  <div
                    key={row.id}
                    className={cn(
                      "flex items-center justify-between gap-3 px-4 py-3",
                      index > 0 && "border-t border-mb-line",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-mb-ink">
                        {row.reward_title}
                      </p>

                      <p className="mt-0.5 text-xs text-mb-muted">
                        {formatDate(row.created_at)} · {row.cost_coins}{" "}
                        tanga
                      </p>
                    </div>

                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                        pending
                          ? "bg-amber-50 text-amber-700"
                          : "bg-emerald-50 text-emerald-700",
                      )}
                    >
                      {pending ? (
                        <Clock
                          className="h-3.5 w-3.5"
                          strokeWidth={2.2}
                          aria-hidden="true"
                        />
                      ) : (
                        <CheckCircle2
                          className="h-3.5 w-3.5"
                          strokeWidth={2.2}
                          aria-hidden="true"
                        />
                      )}
                      {pending ? "Kutilmoqda" : "Olindi"}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
