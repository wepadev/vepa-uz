import { notFound, redirect } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  Coins,
  Gift,
  History,
  Pencil,
  Trash2,
  Undo2,
} from "lucide-react";

import AppAlert from "@/components/ui/app-alert";
import SubmitButton from "@/components/ui/submit-button";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

import RewardIconPicker from "@/components/admin/reward-icon-picker";
import { rewardIcon } from "@/lib/reward-icons";

import {
  cancelCrmRedemption,
  confirmCrmRedemption,
  createCrmReward,
  deleteCrmReward,
  redeemCrmReward,
  toggleCrmReward,
  updateCrmReward,
} from "../actions";
import BackLink from "@/components/ui/back-link";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sovğa dökoni",
  description: "Tangalarni sovğaga almaştiriş va balanslar.",
};

type PageProps = {
  searchParams: Promise<{
    guruh?: string | string[];
    xato?: string | string[];
  }>;
};

type BalanceRow = {
  student_id: number;
  full_name: string;
  earned_coins: number;
  spent_coins: number;
  available_coins: number;
};

type RewardRow = {
  id: number;
  group_id: number | null;
  title: string;
  description: string | null;
  cost_coins: number;
  stock: number | null;
  is_active: boolean;
  icon: string | null;
};

type HistoryRow = {
  id: number;
  full_name: string;
  reward_title: string;
  cost_coins: number;
  status: string;
  note: string | null;
  created_at: string;
};

type PendingRow = {
  id: number;
  full_name: string;
  reward_title: string;
  cost_coins: number;
  group_title: string | null;
  created_at: string;
};

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tashkent",
  }).format(new Date(value));
}

export default async function CrmShopPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const groupId = Number(single(params.guruh));
  const errorMessage = single(params.xato);

  if (!Number.isInteger(groupId) || groupId <= 0) {
    notFound();
  }

  const supabase = await createClient();

  const user = await getCurrentUser();

  if (!user) redirect("/auth/login");

  const { data: group } = await supabase
    .from("crm_groups")
    .select("id, title")
    .eq("id", groupId)
    .maybeSingle();

  if (!group) notFound();

  const [balanceResult, rewardResult, historyResult, pendingResult] =
    await Promise.all([
      supabase.rpc("crm_group_balances", { p_group_id: groupId }),
      supabase.rpc("crm_reward_list", { p_group_id: groupId }),
      supabase.rpc("crm_redemption_history", { p_group_id: groupId }),
      supabase.rpc("crm_pending_redemptions"),
    ]);

  /* db/18 hali ishga tushirilmagan bo'lsa sahifa buzilmasin */
  const migrationMissing = Boolean(
    balanceResult.error || rewardResult.error,
  );

  const balances = (balanceResult.data ?? []) as BalanceRow[];
  const rewards = (rewardResult.data ?? []) as RewardRow[];
  const history = (historyResult.data ?? []) as HistoryRow[];
  const pending = (pendingResult.data ?? []) as PendingRow[];

  const activeRewards = rewards.filter((reward) => reward.is_active);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="mx-auto max-w-4xl px-3 py-6 sm:px-6 sm:py-10">
        <BackLink
          href={`/admin/crm/guruh?id=${groupId}`}
          label={group.title}
        />

        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold sm:text-3xl">
          <Coins
            className="h-6 w-6 text-amber-500"
            strokeWidth={2}
            aria-hidden="true"
          />
          Sovğa dökoni
        </h1>

        <p className="mt-2 text-sm leading-6 text-mb-muted">
          Tanga sarflanadi, ball esa kamaymaydi — reytingdagi örin
          özgarmaydi.
        </p>

        {migrationMissing && (
          <AppAlert
            variant="warning"
            title="Dökon tayyor emas"
            className="mt-5"
          >
            Supabase’da <b>db/18-crm-dokon.sql</b> faylini işga
            tuşiring.
          </AppAlert>
        )}

        {errorMessage && (
          <AppAlert variant="error" title="Bajarilmadi" className="mt-4">
            {errorMessage}
          </AppAlert>
        )}

        {/* Kutayotgan so'rovlar */}
        {pending.length > 0 && (
          <div className="mt-5 overflow-hidden rounded-2xl border border-amber-300 bg-white shadow-sm">
            <div className="border-b border-amber-200 bg-amber-50 px-4 py-3">
              <p className="inline-flex items-center gap-2 font-bold text-amber-900">
                <Clock
                  className="h-4 w-4"
                  strokeWidth={2.2}
                  aria-hidden="true"
                />
                Topşirişni kutmoqda ({pending.length})
              </p>

              <p className="mt-0.5 text-xs leading-5 text-amber-700">
                Öquvçi sovğani tanladi, tangasi uşlab qolindi.
                Qölga topşirganingizda tasdiqlang.
              </p>
            </div>

            {pending.map((row, index) => (
              <div
                key={row.id}
                className={cn(
                  "flex items-center justify-between gap-3 px-4 py-3",
                  index > 0 && "border-t border-mb-line",
                )}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-mb-ink">
                    {row.full_name} — {row.reward_title}
                  </p>

                  <p className="mt-0.5 text-xs text-mb-muted">
                    {formatDateTime(row.created_at)} · {row.cost_coins}{" "}
                    tanga
                    {row.group_title && ` · ${row.group_title}`}
                  </p>
                </div>

                <div className="flex shrink-0 gap-2">
                  <form action={confirmCrmRedemption}>
                    <input type="hidden" name="groupId" value={groupId} />
                    <input
                      type="hidden"
                      name="redemptionId"
                      value={row.id}
                    />

                    <SubmitButton className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white transition hover:bg-emerald-700">
                      <CheckCircle2
                        className="h-3.5 w-3.5"
                        strokeWidth={2.2}
                        aria-hidden="true"
                      />
                      Topşirdim
                    </SubmitButton>
                  </form>

                  <form action={cancelCrmRedemption}>
                    <input type="hidden" name="groupId" value={groupId} />
                    <input
                      type="hidden"
                      name="redemptionId"
                      value={row.id}
                    />

                    <SubmitButton
                      title="Bekor qiliş — tanga qaytadi"
                      className="min-h-10 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                    >
                      Bekor
                    </SubmitButton>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Almashtirish */}
        {activeRewards.length > 0 && balances.length > 0 && (
          <form
            action={redeemCrmReward}
            className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm"
          >
            <input type="hidden" name="groupId" value={groupId} />

            <p className="font-bold text-amber-900">
              Sovğa beriş
            </p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="studentId"
                  className="block text-xs font-semibold text-amber-900"
                >
                  Öquvçi
                </label>

                <select
                  id="studentId"
                  name="studentId"
                  required
                  className="mt-1 min-h-11 w-full rounded-xl border border-amber-300 bg-white px-3 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                >
                  <option value="">Tanlang</option>

                  {balances.map((row) => (
                    <option key={row.student_id} value={row.student_id}>
                      {row.full_name} — {row.available_coins} tanga
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="rewardId"
                  className="block text-xs font-semibold text-amber-900"
                >
                  Sovğa
                </label>

                <select
                  id="rewardId"
                  name="rewardId"
                  required
                  className="mt-1 min-h-11 w-full rounded-xl border border-amber-300 bg-white px-3 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                >
                  <option value="">Tanlang</option>

                  {activeRewards.map((reward) => (
                    <option key={reward.id} value={reward.id}>
                      {reward.title} — {reward.cost_coins} tanga
                      {reward.stock !== null && ` (${reward.stock} ta qoldi)`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <SubmitButton className="mt-3 min-h-11 rounded-xl bg-amber-600 px-5 text-sm font-bold text-white transition hover:bg-amber-700">
              Beriş
            </SubmitButton>
          </form>
        )}

        {/* Balanslar */}
        <h2 className="mt-8 text-lg font-bold">Tanga balanslari</h2>

        {balances.length === 0 ? (
          <AppAlert variant="info" title="Öquvçi yöq" className="mt-3">
            Bu guruhda faol öquvçi yöq.
          </AppAlert>
        ) : (
          <div className="mt-3 overflow-hidden rounded-2xl border border-mb-line bg-white shadow-sm">
            {balances.map((row, index) => (
              <div
                key={row.student_id}
                className={cn(
                  "flex items-center justify-between gap-3 px-4 py-3",
                  index > 0 && "border-t border-mb-line",
                )}
              >
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-mb-ink">
                    {row.full_name}
                  </p>

                  <p className="mt-0.5 text-xs text-mb-muted">
                    Yiğdi {row.earned_coins} · sarfladi{" "}
                    {row.spent_coins}
                  </p>
                </div>

                <p className="shrink-0 whitespace-nowrap text-lg font-bold text-amber-600">
                  {row.available_coins} tanga
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Sovg'alar */}
        <h2 className="mt-8 inline-flex items-center gap-2 text-lg font-bold">
          <Gift
            className="h-5 w-5 text-mb-muted"
            strokeWidth={2}
            aria-hidden="true"
          />
          Sovğalar
        </h2>

        {rewards.length > 0 && (
          <div className="mt-3 space-y-2">
            {rewards.map((reward) => {
              const Icon = rewardIcon(reward.icon);

              return (
                <div
                  key={reward.id}
                  className={cn(
                    "rounded-2xl border bg-white px-4 py-3 shadow-sm",
                    reward.is_active
                      ? "border-mb-line"
                      : "border-slate-200 opacity-60",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-mb-tintSoft text-mb-brand">
                      <Icon
                        className="h-5 w-5"
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold text-mb-ink">
                        {reward.title}

                        {reward.group_id === null && (
                          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                            barça guruhlar
                          </span>
                        )}
                      </p>

                      <p className="mt-0.5 text-xs text-mb-muted">
                        {reward.cost_coins} tanga
                        {reward.stock === null
                          ? " · çeklanmagan"
                          : ` · ${reward.stock} ta qoldi`}
                        {reward.description && ` · ${reward.description}`}
                      </p>
                    </div>

                    <form action={toggleCrmReward} className="shrink-0">
                      <input type="hidden" name="groupId" value={groupId} />
                      <input
                        type="hidden"
                        name="rewardId"
                        value={reward.id}
                      />
                      <input
                        type="hidden"
                        name="next"
                        value={reward.is_active ? "0" : "1"}
                      />

                      <SubmitButton className="min-h-10 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">
                        {reward.is_active ? "Yaşiriş" : "Qaytariş"}
                      </SubmitButton>
                    </form>
                  </div>

                  <details className="mt-2">
                    <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1.5 text-xs font-semibold text-mb-brand">
                      <Pencil
                        className="h-3.5 w-3.5"
                        strokeWidth={2.2}
                        aria-hidden="true"
                      />
                      Tahrirlaş
                    </summary>

                    <form
                      action={updateCrmReward}
                      className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3"
                    >
                      <input type="hidden" name="groupId" value={groupId} />
                      <input
                        type="hidden"
                        name="rewardId"
                        value={reward.id}
                      />

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label
                            htmlFor={`edit-title-${reward.id}`}
                            className="block text-xs font-semibold text-slate-600"
                          >
                            Nomi
                          </label>

                          <input
                            id={`edit-title-${reward.id}`}
                            name="title"
                            required
                            maxLength={80}
                            defaultValue={reward.title}
                            className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none transition focus:border-mb-brand focus:ring-4 focus:ring-blue-100"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor={`edit-cost-${reward.id}`}
                            className="block text-xs font-semibold text-slate-600"
                          >
                            Narxi (tanga)
                          </label>

                          <input
                            id={`edit-cost-${reward.id}`}
                            name="cost"
                            type="number"
                            min={1}
                            required
                            defaultValue={reward.cost_coins}
                            className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none transition focus:border-mb-brand focus:ring-4 focus:ring-blue-100"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor={`edit-stock-${reward.id}`}
                            className="block text-xs font-semibold text-slate-600"
                          >
                            Neçta bor
                          </label>

                          <input
                            id={`edit-stock-${reward.id}`}
                            name="stock"
                            type="number"
                            min={0}
                            placeholder="Böş = çeklanmagan"
                            defaultValue={reward.stock ?? ""}
                            className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none transition focus:border-mb-brand focus:ring-4 focus:ring-blue-100"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor={`edit-desc-${reward.id}`}
                            className="block text-xs font-semibold text-slate-600"
                          >
                            Izoh (ixtiyoriy)
                          </label>

                          <input
                            id={`edit-desc-${reward.id}`}
                            name="description"
                            maxLength={120}
                            defaultValue={reward.description ?? ""}
                            className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none transition focus:border-mb-brand focus:ring-4 focus:ring-blue-100"
                          />
                        </div>
                      </div>

                      <div className="mt-3">
                        <RewardIconPicker defaultValue={reward.icon} />
                      </div>

                      <label className="mt-3 flex items-center gap-2 text-sm font-medium text-slate-700">
                        <input
                          type="checkbox"
                          name="forAll"
                          value="1"
                          defaultChecked={reward.group_id === null}
                          className="h-4 w-4 accent-mb-brand"
                        />
                        Barça guruhlar uçun
                      </label>

                      <SubmitButton className="mt-3 min-h-11 rounded-xl bg-mb-brand px-5 text-sm font-semibold text-white transition hover:bg-mb-brandDark">
                        Saqlaş
                      </SubmitButton>
                    </form>

                    <form
                      action={deleteCrmReward}
                      className="mt-2 rounded-xl border border-red-200 bg-red-50/50 p-3"
                    >
                      <input type="hidden" name="groupId" value={groupId} />
                      <input
                        type="hidden"
                        name="rewardId"
                        value={reward.id}
                      />

                      <p className="text-xs leading-5 text-mb-muted">
                        Sovğani butunlay öçirsangiz röyxatdan
                        yöqoladi. Avval berilgan sovğalar tarixi
                        joyida qoladi.
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <label className="flex items-center gap-2 text-sm font-medium text-red-700">
                          <input
                            type="checkbox"
                            name="confirm"
                            value="1"
                            className="h-4 w-4 accent-red-600"
                          />
                          Ha, öçirilsin
                        </label>

                        <SubmitButton className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-red-300 bg-white px-4 text-sm font-semibold text-red-700 transition hover:bg-red-50">
                          <Trash2
                            className="h-4 w-4"
                            strokeWidth={2.2}
                            aria-hidden="true"
                          />
                          Öçiriş
                        </SubmitButton>
                      </div>
                    </form>
                  </details>
                </div>
              );
            })}
          </div>
        )}

        <form
          action={createCrmReward}
          className="mt-3 rounded-2xl border border-mb-line bg-white p-4 shadow-sm"
        >
          <input type="hidden" name="groupId" value={groupId} />

          <p className="text-sm font-semibold text-slate-700">
            Yangi sovğa
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="reward-title"
                className="block text-xs font-semibold text-slate-600"
              >
                Nomi
              </label>

              <input
                id="reward-title"
                name="title"
                required
                maxLength={80}
                placeholder="Masalan: Daftar"
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none transition focus:border-mb-brand focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="reward-cost"
                className="block text-xs font-semibold text-slate-600"
              >
                Narxi (tanga)
              </label>

              <input
                id="reward-cost"
                name="cost"
                type="number"
                min={1}
                required
                defaultValue={10}
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none transition focus:border-mb-brand focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="reward-stock"
                className="block text-xs font-semibold text-slate-600"
              >
                Neçta bor
              </label>

              <input
                id="reward-stock"
                name="stock"
                type="number"
                min={0}
                placeholder="Böş = çeklanmagan"
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none transition focus:border-mb-brand focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="reward-desc"
                className="block text-xs font-semibold text-slate-600"
              >
                Izoh (ixtiyoriy)
              </label>

              <input
                id="reward-desc"
                name="description"
                maxLength={120}
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none transition focus:border-mb-brand focus:ring-4 focus:ring-blue-100"
              />
            </div>
          </div>

          <div className="mt-3">
            <RewardIconPicker />
          </div>

          <label className="mt-3 flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              name="forAll"
              value="1"
              className="h-4 w-4 accent-mb-brand"
            />
            Barça guruhlar uçun
          </label>

          <SubmitButton className="mt-3 min-h-11 rounded-xl bg-mb-brand px-5 text-sm font-semibold text-white transition hover:bg-mb-brandDark">
            Qöşiş
          </SubmitButton>
        </form>

        {/* Tarix */}
        {history.length > 0 && (
          <>
            <h2 className="mt-8 inline-flex items-center gap-2 text-lg font-bold">
              <History
                className="h-5 w-5 text-mb-muted"
                strokeWidth={2}
                aria-hidden="true"
              />
              Oxirgi almaştirişlar
            </h2>

            <div className="mt-3 overflow-hidden rounded-2xl border border-mb-line bg-white shadow-sm">
              {history.map((row, index) => (
                <div
                  key={row.id}
                  className={cn(
                    "flex items-center justify-between gap-3 px-4 py-3",
                    index > 0 && "border-t border-mb-line",
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-mb-ink">
                      {row.full_name} — {row.reward_title}
                    </p>

                    <p className="mt-0.5 text-xs text-mb-muted">
                      {formatDateTime(row.created_at)} ·{" "}
                      {row.cost_coins} tanga ·{" "}
                      {row.status === "kutilmoqda"
                        ? "kutilmoqda"
                        : "topshirildi"}
                    </p>
                  </div>

                  <form action={cancelCrmRedemption} className="shrink-0">
                    <input type="hidden" name="groupId" value={groupId} />
                    <input
                      type="hidden"
                      name="redemptionId"
                      value={row.id}
                    />

                    <SubmitButton
                      title="Bekor qiliş — tanga qaytadi"
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                    >
                      <Undo2
                        className="h-3.5 w-3.5"
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                      Bekor
                    </SubmitButton>
                  </form>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
