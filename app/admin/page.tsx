import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  ClipboardCheck,
  Database,
  ListChecks,
  MonitorPlay,
  Timer,
  TrendingUp,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import { accents, type Accent } from "@/components/ui/section-visual";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Boshqaruv paneli — admin panelining yagona kirish nuqtasi.
 *
 * Yuqoridagi menyu olib tashlangani uchun barcha bo'limlar aynan
 * shu kartalar orqali ochiladi. Shuning uchun ro'yxat to'liq va
 * tartibi barqaror: har safar bir xil joyda turadi.
 *
 * Kartalar ma'nosiga qarab guruhlangan, har guruhning o'z ohangi
 * bor (components/ui/section-visual.ts). Rang faqat ikonka
 * plitkasida — tugma va havola doim brend ko'kida qoladi.
 */
type DashboardCard = {
  title: string;
  description: string;
  href: string;
  /* null — bu bo'limda sanaladigan narsa yo'q (taymer, analitika) */
  count: number | null;
  icon: LucideIcon;
};

type DashboardGroup = {
  title: string;
  hint: string;
  tone: Accent;
  cards: DashboardCard[];
};

async function getAdminName() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

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

function AdminCard({ card, tone }: { card: DashboardCard; tone: Accent }) {
  const Icon = card.icon;

  return (
    <Link
      href={card.href}
      className="group flex h-full flex-col rounded-2xl border border-mb-line bg-white p-5 shadow-sm transition hover:border-mb-brand hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${accents[tone].tile}`}
        >
          <Icon className="h-6 w-6" strokeWidth={1.9} aria-hidden="true" />
        </span>

        {card.count !== null && (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            {card.count} ta
          </span>
        )}
      </div>

      <h3 className="mt-4 text-lg font-bold text-mb-ink">{card.title}</h3>

      <p className="mt-1.5 flex-1 text-sm leading-6 text-mb-muted">
        {card.description}
      </p>

      <span className="mt-4 text-sm font-semibold text-mb-brand">
        Boshqarish →
      </span>
    </Link>
  );
}

export default async function AdminPage() {
  const fullName = await getAdminName();
  const adminClient = createAdminClient();

  const [
    testsResult,
    profilesResult,
    textbooksResult,
    lessonsResult,
    groupsResult,
    attemptsResult,
    crmGroupsResult,
  ] = await Promise.all([
    adminClient.from("tests").select("*", { count: "exact", head: true }),

    adminClient.from("profiles").select("*", { count: "exact", head: true }),

    adminClient.from("textbooks").select("*", { count: "exact", head: true }),

    adminClient.from("lessons").select("*", { count: "exact", head: true }),

    adminClient
      .from("study_groups")
      .select("*", { count: "exact", head: true }),

    adminClient.from("attempts").select("*", { count: "exact", head: true }),

    /*
     * db/17 hali ishga tushirilmagan bo'lsa xato qaytadi — sahifa
     * baribir ochiladi, karta shunchaki 0 ko'rsatadi.
     */
    adminClient.from("crm_groups").select("*", { count: "exact", head: true }),
  ]);

  const loadError =
    testsResult.error ||
    profilesResult.error ||
    textbooksResult.error ||
    lessonsResult.error ||
    groupsResult.error ||
    attemptsResult.error;

  /*
   * Guruhlar tartibi ataylab qat'iy: kundalik ish yuqorida, kamdan
   * kam ochiladigan xizmat bo'limlari pastda.
   */
  const groups: DashboardGroup[] = [
    {
      title: "O‘quvchilar va guruhlar",
      hint: "Kundalik ish: davomat, ball, akkauntlar",
      tone: "people",
      cards: [
        {
          title: "Guruhlar",
          description:
            "Uy vazifasi, davomat, ball va sovg‘a do‘koni — har bir guruh bitta joyda.",
          href: "/admin/crm",
          count: crmGroupsResult.count ?? groupsResult.count ?? 0,
          icon: UsersRound,
        },
        {
          title: "Foydalanuvchilar",
          description:
            "O‘quvchilar, akkaunt holati va bo‘limlarga kirish ruxsatlari.",
          href: "/admin/users",
          count: profilesResult.count ?? 0,
          icon: Users,
        },
      ],
    },
    {
      title: "Testlar va imtihon",
      hint: "Test yaratish, tekshirish va imtihon o‘tkazish",
      tone: "tests",
      cards: [
        {
          title: "Test tekshirish",
          description:
            "Mavzu va testni tanlab, belgilangan javoblarni ketma-ket tekshirish.",
          href: "/admin/test-tekshirish",
          count: null,
          icon: ListChecks,
        },
        {
          title: "Imtihon taymeri",
          description:
            "Elektron doska uchun katta countdown taymer — sekundigacha.",
          href: "/admin/taymer",
          count: null,
          icon: Timer,
        },
        {
          title: "Testlar",
          description:
            "Yo‘nalish, bo‘lim, mavzu va test yaratish; savollarni kiritish.",
          href: "/admin/tests",
          count: testsResult.count ?? 0,
          icon: ClipboardCheck,
        },
      ],
    },
    {
      title: "O‘quv materiallari",
      hint: "O‘quvchi o‘qiydigan va ko‘radigan hamma narsa",
      tone: "content",
      cards: [
        {
          title: "Darslik yechimlari",
          description:
            "Darsliklar, mavzular, misollar va ularning videoyechimlari.",
          href: "/admin/textbooks",
          count: textbooksResult.count ?? 0,
          icon: BookOpen,
        },
        {
          title: "Videodarslar",
          description:
            "Dars bo‘limlari, videolar va ularga biriktirilgan testlar.",
          href: "/admin/lessons",
          count: lessonsResult.count ?? 0,
          icon: MonitorPlay,
        },
      ],
    },
    {
      title: "Natija va tahlil",
      hint: "Nima ishladi, nima ishlamadi",
      tone: "insight",
      cards: [
        {
          title: "Natijalar",
          description:
            "O‘quvchilarning test natijalari, javoblari va urinishlari.",
          href: "/admin/results",
          count: attemptsResult.count ?? 0,
          icon: BarChart3,
        },
        {
          title: "Analitika",
          description:
            "Qaysi mavzu qiyin, qaysi savol ko‘p xato qilinadi — raqamlarda.",
          href: "/admin/analytics",
          count: null,
          icon: TrendingUp,
        },
      ],
    },
    {
      title: "Tizim",
      hint: "Kamdan kam kerak bo‘ladi",
      tone: "system",
      cards: [
        {
          title: "Texnik xizmat",
          description:
            "Bazani chiqindidan tozalash va jadvallar hajmini ko‘rish.",
          href: "/admin/xizmat",
          count: null,
          icon: Database,
        },
      ],
    },
  ];

  return (
    <main className="min-h-screen bg-mb-page text-mb-ink">
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-9">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">
              Salom, {fullName}
            </h1>

            <p className="mt-1.5 text-sm text-mb-muted">
              Qaysi bo‘limdan boshlaymiz?
            </p>
          </div>

          <Link
            href="/profile"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Profil
          </Link>
        </div>

        {loadError && (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            Ayrim sonlar yuklanmadi. Boshqaruv bo‘limlari ishlashda davom
            etadi.
          </div>
        )}

        <div className="mt-7 space-y-8">
          {groups.map((group) => (
            <section key={group.title}>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2
                  className={`rounded-lg px-2 py-0.5 text-[13px] font-bold uppercase tracking-wide ${accents[group.tone].softBox}`}
                >
                  {group.title}
                </h2>

                <p className="text-sm text-mb-muted">{group.hint}</p>
              </div>

              <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {group.cards.map((card) => (
                  <AdminCard key={card.href} card={card} tone={group.tone} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}
