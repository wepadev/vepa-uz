import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Clock, Coins, Sparkles } from "@/components/ui/icons";

import AppAlert from "@/components/ui/app-alert";
import EmptyState from "@/components/ui/empty-state";
import { GlyphTile } from "@/components/ui/glyph";
import { Tag } from "@/components/ui/row";
import { btnAccent, btnPrimary } from "@/lib/ui";
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
        <PageHeader
          backHref="/"
          backLabel="Boş sahifa"
          glyph="shop"
          title="Dökon"
          width="3xl"
        />

        <section className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-8">
          <EmptyState
            glyph="group"
            title="Dökon guruh öquvçilari uçun"
            action={
              <Link href="/guruhim" className={btnPrimary}>
                Guruhga qöşiliş
              </Link>
            }
          >
            Tangalar darsdagi ball va guruhga berilgan uy vazifalaridan
            yiğiladi. Ustozingiz bergan kod bilan guruhga qöşilsangiz dökon
            oçiladi.
          </EmptyState>
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
        glyph="shop"
        title="Dökon"
        subtitle="Tangani sovğaga almaştiring"
        width="3xl"
      />

      <section className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-8">
        {/* Tanga kartasi */}
        <div className="flex items-center gap-4 rounded-2xl border border-mb-line bg-white p-4 sm:p-5">
          <GlyphTile name="shop" size="lg" />

          <div className="min-w-0 flex-1">
            <p className="eyebrow">Sizdagi tangalar</p>

            <p className="num mt-0.5 text-4xl font-extrabold leading-none text-mb-ink">
              {available}
            </p>

            <p className="mt-2 text-sm leading-5 text-mb-muted">
              {cheapest && available < cheapest.cost_coins
                ? `Eng yaqin sovğa — “${cheapest.title}”. Yana ${
                    cheapest.cost_coins - available
                  } ta tanga kerak.`
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
          <EmptyState glyph="shop" title="Dökon hali böş" className="mt-5">
            Ustozingiz sovğa qöşganda şu yerda paydo böladi. Siz esa tanga
            yiğib turing.
          </EmptyState>
        ) : (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {rewards.map((reward) => {
              const Icon = rewardIcon(reward.icon);

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
                    "flex flex-col rounded-2xl border p-4",
                    soldOut
                      ? "border-dashed border-slate-300"
                      : affordable
                        ? "border-vp-accent bg-white shadow-[0_0_0_1px_var(--vp-accent)]"
                        : "border-mb-line bg-white",
                  )}
                >

                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "grid h-14 w-14 shrink-0 place-items-center rounded-2xl",
                        soldOut
                          ? "bg-slate-100 text-slate-400"
                          : "bg-mb-tint text-mb-brandDark",
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
                          <Tag tone="danger">oxirgi {reward.stock} ta</Tag>
                        )}
                      </div>

                      {reward.description && (
                        <p className="mt-0.5 text-xs leading-5 text-mb-muted">
                          {reward.description}
                        </p>
                      )}

                      <p className="mt-1.5">
                        <Tag tone="accent" className="text-sm">
                          <Coins className="h-4 w-4" aria-hidden="true" />
                          <span className="num">{reward.cost_coins}</span>
                        </Tag>
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
                          className={`${btnAccent} w-full`}
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
                            className="h-full rounded-full bg-vp-accent"
                            style={{ width: `${percent}%` }}
                          />
                        </div>

                        <p className="num mt-1.5 text-[13px] text-mb-muted">
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
            <h2 className="eyebrow mt-7">Olgan sovğalarim</h2>

            <div className="mt-3 overflow-hidden rounded-2xl border border-mb-line bg-white">
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
                      <p className="truncate text-[15px] font-bold text-mb-ink">
                        {row.reward_title}
                      </p>

                      <p className="mt-0.5 text-xs text-mb-muted">
                        {formatDate(row.created_at)} · {row.cost_coins}{" "}
                        tanga
                      </p>
                    </div>

                    <Tag tone={pending ? "accent" : "free"}>
                      {pending ? (
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {pending ? "Kutilmoqda" : "Olindi"}
                    </Tag>
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
