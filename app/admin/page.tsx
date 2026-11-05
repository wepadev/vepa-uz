import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  Clock,
  Database,
  Gift,
  ListChecks,
  MonitorPlay,
  NotebookPen,
  Timer,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import { accents, type Accent } from "@/components/ui/section-visual";
import { remainingLabel } from "@/lib/due-label";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Boshqaruv paneli — admin panelining yagona kirish nuqtasi.
 *
 * Uch qavat:
 *   1. "Bugun" — har kuni kerak bo'ladigan narsa: faol guruhlarning
 *      dars varaqasi, muddati yaqin vazifalar, kutayotgan sovg'alar.
 *   2. To'rtta asosiy bo'lim — Guruhlar, Testlar, Darslar, Natijalar.
 *   3. "Boshqa" — kamdan kam ochiladigan asboblar, kichik havola.
 *
 * Ilgari beshta guruhda o'nta bir xil kattalikdagi karta turardi va
 * qaysi biri muhimligi ko'rinmasdi.
 */
type MainCard = {
  title: string;
  description: string;
  href: string;
  count: number | null;
  icon: LucideIcon;
  tone: Accent;
};

type ToolLink = {
  title: string;
  href: string;
  icon: LucideIcon;
};

type OverviewRow = {
  crm_group_id: number;
  title: string;
  is_active: boolean;
  student_count: number;
};

type DueRow = {
  id: number;
  due_at: string;
  group_id: number;
  tests: { title: string } | null;
  study_groups: { title: string } | null;
};

/** Bugungi sana — Toshkent vaqti bo'yicha, YYYY-MM-DD */
function todayInTashkent() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tashkent",
  }).format(new Date());
}

async function getAdminName() {
  const supabase = await createClient();

  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    profile.role !== "admin" ||
    profile.is_active !== true
  ) {
    redirect("/");
  }

  return (
    profile.full_name?.trim() || user.email?.split("@")[0] || "Administrator"
  );
}

function MainCardView({ card }: { card: MainCard }) {
  const Icon = card.icon;

  return (
    <Link
      href={card.href}
      className="group flex h-full items-start gap-4 rounded-2xl border border-mb-line bg-white p-5 shadow-sm transition hover:border-mb-brand hover:shadow-md"
    >
      <span
        className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${accents[card.tone].tile}`}
      >
        <Icon className="h-6 w-6" strokeWidth={1.9} aria-hidden="true" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="text-lg font-bold text-mb-ink">{card.title}</span>

          {card.count !== null && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
              {card.count} ta
            </span>
          )}
        </span>

        <span className="mt-1 block text-sm leading-6 text-mb-muted">
          {card.description}
        </span>
      </span>
    </Link>
  );
}

export default async function AdminPage() {
  const fullName = await getAdminName();
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const now = new Date();
  const soon = new Date(now.getTime() + 48 * 3600 * 1000);

  const [
    testsResult,
    lessonsResult,
    textbooksResult,
    attemptsResult,
    overviewResult,
    pendingResult,
    dueResult,
  ] = await Promise.all([
    adminClient.from("tests").select("*", { count: "exact", head: true }),

    adminClient.from("lessons").select("*", { count: "exact", head: true }),

    adminClient.from("textbooks").select("*", { count: "exact", head: true }),

    adminClient.from("attempts").select("*", { count: "exact", head: true }),

    /* db/17 hali ishga tushirilmagan bo'lsa bo'sh ro'yxat */
    supabase.rpc("group_overview"),

    supabase.rpc("pending_redemption_count"),

    /* Muddati 48 soat ichida tugaydigan faol vazifalar */
    adminClient
      .from("assignments")
      .select("id, due_at, group_id, tests(title), study_groups(title)")
      .eq("is_active", true)
      .gte("due_at", now.toISOString())
      .lte("due_at", soon.toISOString())
      .order("due_at", { ascending: true })
      .limit(5),
  ]);

  const activeGroups = ((overviewResult.data ?? []) as OverviewRow[]).filter(
    (group) => group.is_active,
  );
  const pendingCount = Number(pendingResult.data) || 0;
  const dueSoon = (dueResult.data ?? []) as unknown as DueRow[];
  const today = todayInTashkent();

  const mainCards: MainCard[] = [
    {
      title: "Guruhlar",
      description: "Davomat, ball, öquvçilar va uy vazifalari.",
      href: "/admin/crm",
      count: activeGroups.length,
      icon: UsersRound,
      tone: "people",
    },
    {
      title: "Testlar",
      description: "Test yaratiş va savollarni kiritiş.",
      href: "/admin/tests",
      count: testsResult.count ?? null,
      icon: ClipboardCheck,
      tone: "tests",
    },
    {
      title: "Darslar",
      description: "Videodarslar va darslik yeçimlari.",
      href: "/admin/lessons",
      count:
        lessonsResult.count !== null || textbooksResult.count !== null
          ? (lessonsResult.count ?? 0) + (textbooksResult.count ?? 0)
          : null,
      icon: MonitorPlay,
      tone: "content",
    },
    {
      title: "Natijalar",
      description: "Test natijalari va qaysi mavzu qiyinligi.",
      href: "/admin/results",
      count: attemptsResult.count ?? null,
      icon: BarChart3,
      tone: "insight",
    },
  ];

  const tools: ToolLink[] = [
    { title: "Foydalanuvçilar", href: "/admin/users", icon: Users },
    { title: "Test tekşiriş", href: "/admin/test-tekshirish", icon: ListChecks },
    { title: "Imtihon taymeri", href: "/admin/taymer", icon: Timer },
    { title: "PDF yozuv", href: "/admin/pdf-yozuv", icon: NotebookPen },
    { title: "Texnik xizmat", href: "/admin/xizmat", icon: Database },
  ];

  const nothingToday =
    activeGroups.length === 0 && dueSoon.length === 0 && pendingCount === 0;

  return (
    <main className="min-h-screen bg-mb-page text-mb-ink">
      <section className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-9">
        <div className="flex items-end justify-between gap-4">
          <h1 className="text-2xl font-bold sm:text-3xl">Salom, {fullName}</h1>

          <Link
            href="/profile"
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Profil
          </Link>
        </div>

        {/* 1. Bugun */}
        <h2 className="mt-7 text-[13px] font-bold uppercase tracking-wide text-mb-muted">
          Bugun
        </h2>

        <div className="mt-3 space-y-3">
          {pendingCount > 0 && (
            <Link
              href="/admin/crm"
              className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 transition hover:bg-amber-100"
            >
              <Gift className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden="true" />
              {pendingCount} ta sovğa sörovi tasdiqlaşni kutmoqda
            </Link>
          )}

          {activeGroups.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-mb-line bg-white shadow-sm">
              {activeGroups.map((group, index) => (
                <div
                  key={group.crm_group_id}
                  className={`flex items-center justify-between gap-3 px-4 py-3 ${index > 0 ? "border-t border-mb-line" : ""}`}
                >
                  <Link
                    href={`/admin/crm/guruh?id=${group.crm_group_id}`}
                    className="min-w-0 hover:text-mb-brand"
                  >
                    <span className="block truncate text-[15px] font-semibold">
                      {group.title}
                    </span>
                    <span className="block text-xs text-mb-muted">
                      {group.student_count} ta öquvçi
                    </span>
                  </Link>

                  <Link
                    href={`/admin/crm/dars?guruh=${group.crm_group_id}&sana=${today}`}
                    className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl bg-mb-brand px-3 text-sm font-semibold text-white transition hover:bg-mb-brandDark"
                  >
                    <CalendarDays className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                    Dars varaqasi
                  </Link>
                </div>
              ))}
            </div>
          )}

          {dueSoon.length > 0 && (
            <div className="rounded-2xl border border-mb-line bg-white px-4 py-3 shadow-sm">
              <p className="inline-flex items-center gap-2 text-sm font-semibold">
                <Clock className="h-4 w-4 text-amber-600" strokeWidth={2} aria-hidden="true" />
                Muddati yaqin vazifalar
              </p>

              <ul className="mt-2 space-y-1.5">
                {dueSoon.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/admin/assignments/view?id=${item.id}`}
                      className="flex items-center justify-between gap-3 text-sm hover:text-mb-brand"
                    >
                      <span className="min-w-0 truncate">
                        {item.tests?.title ?? "Test"}
                        {item.study_groups?.title && (
                          <span className="text-mb-muted"> · {item.study_groups.title}</span>
                        )}
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-amber-700">
                        {remainingLabel(item.due_at)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {nothingToday && (
            <p className="rounded-2xl border border-dashed border-mb-line bg-white px-4 py-3 text-sm text-mb-muted">
              Bugun uçun şoşilinç iş yöq.
            </p>
          )}
        </div>

        {/* 2. Asosiy bo'limlar */}
        <h2 className="mt-8 text-[13px] font-bold uppercase tracking-wide text-mb-muted">
          Bölimlar
        </h2>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {mainCards.map((card) => (
            <MainCardView key={card.href} card={card} />
          ))}
        </div>

        {/* 3. Boshqa asboblar */}
        <h2 className="mt-8 text-[13px] font-bold uppercase tracking-wide text-mb-muted">
          Boşqa
        </h2>

        <div className="mt-3 flex flex-wrap gap-2">
          {tools.map((tool) => {
            const Icon = tool.icon;

            return (
              <Link
                key={tool.href}
                href={tool.href}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-mb-line bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-mb-brand hover:text-mb-brand"
              >
                <Icon className="h-4 w-4 text-mb-muted" strokeWidth={2} aria-hidden="true" />
                {tool.title}
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
