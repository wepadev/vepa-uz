import Link from "next/link";
import { redirect } from "next/navigation";
import { ShoppingBag } from "@/components/ui/icons";

import AppAlert from "@/components/ui/app-alert";
import EmptyState from "@/components/ui/empty-state";
import { GlyphTile } from "@/components/ui/glyph";
import { RowLink, RowList, Tag } from "@/components/ui/row";
import { btnAccent } from "@/lib/ui";
import JoinGroupButton from "@/components/join-group-button";
import LessonHistory, {
  type LessonHistoryRow,
} from "@/components/lesson-history";
import PageHeader from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

import { joinGroupAction } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Guruhim",
  description:
    "Ballaringiz, tangalaringiz, dars tarixi va guruh reytingi.",
};

type PageProps = {
  searchParams: Promise<{
    guruh?: string | string[];
    xato?: string | string[];
    xabar?: string | string[];
  }>;
};

type GroupRow = {
  crm_group_id: number;
  study_group_id: number | null;
  title: string;
  my_points: number;
  my_coins: number;
  my_rank: number;
  member_count: number;
  lesson_count: number;
};

type HistoryRow = LessonHistoryRow;

type LeaderRow = {
  student_id: number;
  full_name: string;
  points: number;
  coins: number;
  place: number;
  is_me: boolean;
};

type AssignmentRow = {
  assignment_id: number;
  group_id: number;
  test_title: string;
  due_at: string;
  is_overdue: boolean;
  completed_at: string | null;
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
    timeZone: "Asia/Tashkent",
  }).format(new Date(value));
}

export default async function MyGroupPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const errorMessage = single(params.xato);
  const infoMessage = single(params.xabar);

  const supabase = await createClient();

  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/login");
  }

  /* Onlayn vazifalardan tanga yig'amiz, keyin balansni o'qiymiz */
  const awardResult = await supabase.rpc("award_online_coins");

  const migrationMissing = Boolean(awardResult.error);

  const [groupResult, balanceResult] = migrationMissing
    ? [{ data: null }, { data: null }]
    : await Promise.all([
        supabase.rpc("my_groups"),
        supabase.rpc("my_coin_balance"),
      ]);

  const groups = (groupResult.data ?? []) as GroupRow[];

  const balance = (
    Array.isArray(balanceResult.data)
      ? balanceResult.data[0]
      : balanceResult.data
  ) as { available_coins: number | string } | null;

  const availableCoins = toNumber(balance?.available_coins);

  /* Qaysi guruh ochilgan — birinchisi standart */
  const requested = Number(single(params.guruh));

  const active =
    groups.find((row) => row.crm_group_id === requested) ??
    groups[0] ??
    null;

  let history: HistoryRow[] = [];
  let leaderboard: LeaderRow[] = [];
  let assignments: AssignmentRow[] = [];

  if (active) {
    const [historyResult, leaderResult, assignmentResult] =
      await Promise.all([
        supabase.rpc("my_lesson_history", {
          p_group_id: active.crm_group_id,
        }),

        supabase.rpc("my_group_leaderboard", {
          p_group_id: active.crm_group_id,
        }),

        supabase.rpc("my_assignments"),
      ]);

    history = (historyResult.data ?? []) as HistoryRow[];
    leaderboard = (leaderResult.data ?? []) as LeaderRow[];

    /*
     * Uy vazifasi faqat shu guruhga tegishlisi va hali
     * bajarilmagani ko'rsatiladi. Bo'lmasa bo'lim umuman
     * chiqmaydi — bo'sh sarlavha ekranni band qilmasin.
     */
    assignments = ((assignmentResult.data ?? []) as AssignmentRow[]).filter(
      (row) =>
        !row.completed_at &&
        !row.is_overdue &&
        active.study_group_id !== null &&
        Number(row.group_id) === Number(active.study_group_id),
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <PageHeader
        backHref="/"
        backLabel="Boş sahifa"
        glyph="group"
        title="Guruhim"
        width="3xl"
        subtitle={active?.title ?? null}
      />

      <section className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-8">

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

        {/* Guruhga qo'shilmagan holat */}
        {!migrationMissing && groups.length === 0 && (
          <EmptyState
            glyph="group"
            title="Hali guruhga qöşilmagansiz"
            action={
              <div className="w-full max-w-md text-left">
                <JoinGroupButton
                  action={joinGroupAction}
                  label="Kodni kiritiş"
                />
              </div>
            }
          >
            Ustozingiz bergan 6 belgili kodni kiriting. Şundan keyin uy
            vazifalari, ballaringiz va tangalaringiz şu yerda körinadi.
          </EmptyState>
        )}

        {active && (
          <>
            {/* Tanga va do'kon */}
            <div className="flex items-center gap-4 rounded-2xl border border-mb-line bg-white p-4">
              <GlyphTile name="shop" size="md" />

              <div className="min-w-0 flex-1">
                <p className="eyebrow">Sizdagi tangalar</p>

                <p className="num mt-0.5 text-3xl font-extrabold leading-none text-mb-ink">
                  {availableCoins}
                </p>
              </div>

              <Link href="/dokon" className={btnAccent}>
                <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                Dökon
              </Link>
            </div>

            {/* Guruh tanlash — bir nechta guruhda bo'lsa */}
            {groups.length > 1 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {groups.map((row) => (
                  <Link
                    key={row.crm_group_id}
                    href={`/guruhim?guruh=${row.crm_group_id}`}
                    className={cn(
                      "inline-flex min-h-10 items-center rounded-xl border px-4 text-sm font-semibold transition",
                      row.crm_group_id === active.crm_group_id
                        ? "border-mb-brand bg-mb-tintSoft text-mb-brand"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                    )}
                  >
                    {row.title}
                  </Link>
                ))}
              </div>
            )}

            {/* Mening o'rnim */}
            <dl className="num mt-3 grid grid-cols-3 gap-2 text-center">
              {[
                ["Örningiz", `${active.my_rank}/${active.member_count}`],
                ["Ballaringiz", String(active.my_points)],
                ["Yiğgan tanga", String(active.my_coins)],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-mb-line bg-white px-2 py-3"
                >
                  <dt className="text-xs font-semibold text-mb-muted">
                    {label}
                  </dt>
                  <dd className="mt-0.5 text-xl font-extrabold text-mb-ink">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>

            {/* Uy vazifasi — faqat bo'lsa */}
            {assignments.length > 0 && (
              <>
                <h2 className="eyebrow mt-7">Bajarilmagan uy vazifalari</h2>

                <RowList className="mt-3">
                  {assignments.map((row) => (
                    <RowLink
                      key={row.assignment_id}
                      href="/homework"
                      lead={<GlyphTile name="homework" size="sm" />}
                      title={row.test_title}
                      meta={`Muddat: ${formatDate(row.due_at)}`}
                    />
                  ))}
                </RowList>
              </>
            )}

            {/* Guruh reytingi */}
            <h2 className="eyebrow mt-7">Guruh reytingi</h2>

            <div className="mt-3 overflow-hidden rounded-2xl border border-mb-line bg-white">
              {leaderboard.map((row, index) => (
                <div
                  key={row.student_id}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3",
                    index > 0 && "border-t border-mb-line",
                    row.is_me && "bg-mb-tintSoft",
                  )}
                >
                  <span
                    className={cn(
                      "num grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-bold",
                      row.place === 1
                        ? "bg-vp-accent text-vp-on-accent"
                        : row.place <= 3
                          ? "bg-mb-tint text-mb-brandDark"
                          : "bg-slate-100 text-slate-600",
                    )}
                  >
                    {row.place}
                  </span>

                  <p className="flex min-w-0 flex-1 items-center gap-2 text-[15px] font-bold text-mb-ink">
                    <span className="truncate">{row.full_name}</span>

                    {row.is_me && <Tag tone="brand">Siz</Tag>}
                  </p>

                  <div className="shrink-0 text-right">
                    <p className="num whitespace-nowrap text-[15px] font-extrabold text-mb-ink">
                      {row.points} ball
                    </p>

                    <p className="num whitespace-nowrap text-[13px] text-mb-muted">
                      {row.coins} tanga
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Dars tarixim */}
            <h2 className="eyebrow mt-7">Dars tarixim</h2>

            {history.length === 0 ? (
              <EmptyState title="Hali dars yöq" className="mt-3">
                Ustoz dars varaqasini töldirgaç, ballaringiz şu yerda paydo
                böladi.
              </EmptyState>
            ) : (
              <div className="mt-3">
                <LessonHistory rows={history} />
              </div>
            )}

            {/* Boshqa guruhga qo'shilish */}
            <div className="mt-6">
              <JoinGroupButton action={joinGroupAction} />
            </div>
          </>
        )}
      </section>
    </main>
  );
}
