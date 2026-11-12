import { notFound, redirect } from "next/navigation";

import AppAlert from "@/components/ui/app-alert";
import PrintResultButton from "@/components/admin/print-result-button";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createClient } from "@/lib/supabase/server";
import BackLink from "@/components/ui/back-link";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Guruh hisoboti — çop etiş",
  description:
    "Ota-onalar yiğilişiga tayyor hisobot: umumiy varaq va har bir öquvçi uçun alohida varaq.",
};

type PageProps = {
  searchParams: Promise<{
    groupId?: string | string[];
  }>;
};

type DetailRow = {
  user_id: string;
  full_name: string;
  assignment_id: number;
  test_title: string;
  due_at: string;
  is_active: boolean;
  percentage: number | string | null;
  completed_at: string | null;
};

type StudentSheet = {
  userId: string;
  fullName: string;
  rows: DetailRow[];
  assignedCount: number;
  completedCount: number;
  averagePercent: number;
};

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Tashkent",
  }).format(new Date(value));
}

/** Baho: 90+ a'lo, 70+ yaxshi, 50+ qoniqarli */
function gradeLabel(percent: number) {
  if (percent >= 90) return "a’lo";
  if (percent >= 70) return "yaxşi";
  if (percent >= 50) return "qoniqarli";
  return "past";
}

export default async function GroupReportPrintPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const groupId = Number(single(params.groupId));

  if (!Number.isInteger(groupId) || groupId <= 0) {
    notFound();
  }

  const supabase = await createClient();

  const user = await getCurrentUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin" || profile.is_active !== true) {
    redirect("/");
  }

  const { data: group } = await supabase
    .from("study_groups")
    .select("id, title")
    .eq("id", groupId)
    .maybeSingle();

  if (!group) notFound();

  const detailResult = await supabase.rpc("group_report_details", {
    p_group_id: groupId,
  });

  /* db/16 hali ishga tushirilmagan bo'lsa sahifa buzilmasin */
  const migrationMissing = Boolean(detailResult.error);

  const rows = (detailResult.data ?? []) as DetailRow[];

  /*
   * Bitta ro'yxatni o'quvchilar bo'yicha guruhlaymiz.
   * SQL tomonda ism bo'yicha tartiblangan, shuning uchun tartib
   * saqlanadi.
   */
  const sheets: StudentSheet[] = [];
  const byUser = new Map<string, StudentSheet>();

  for (const row of rows) {
    let sheet = byUser.get(row.user_id);

    if (!sheet) {
      sheet = {
        userId: row.user_id,
        fullName: row.full_name,
        rows: [],
        assignedCount: 0,
        completedCount: 0,
        averagePercent: 0,
      };

      byUser.set(row.user_id, sheet);
      sheets.push(sheet);
    }

    sheet.rows.push(row);
    sheet.assignedCount += 1;

    if (row.completed_at) {
      sheet.completedCount += 1;
    }
  }

  for (const sheet of sheets) {
    const done = sheet.rows.filter((row) => row.completed_at);

    sheet.averagePercent =
      done.length > 0
        ? Math.round(
            done.reduce(
              (sum, row) => sum + Number(row.percentage ?? 0),
              0,
            ) / done.length,
          )
        : 0;
  }

  const totalAssigned = sheets.reduce(
    (sum, sheet) => sum + sheet.assignedCount,
    0,
  );

  const totalCompleted = sheets.reduce(
    (sum, sheet) => sum + sheet.completedCount,
    0,
  );

  const completionRate =
    totalAssigned > 0
      ? Math.round((totalCompleted / totalAssigned) * 100)
      : 0;

  const activeSheets = sheets.filter((sheet) => sheet.completedCount > 0);

  const groupAverage =
    activeSheets.length > 0
      ? Math.round(
          activeSheets.reduce(
            (sum, sheet) => sum + sheet.averagePercent,
            0,
          ) / activeSheets.length,
        )
      : 0;

  const printedAt = formatDate(new Date().toISOString());

  return (
    <main className="hisobot-chop min-h-screen bg-slate-50 text-slate-900 print:bg-white">
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 14mm;
          }

          html,
          body {
            background: #ffffff !important;
          }

          /* Admin menyusi va tugmalar qoğozga tuşmasin */
          .sticky:has(nav[aria-label="Administrator menyusi"]) {
            display: none !important;
          }

          .hisobot-çop .çop-yaşir {
            display: none !important;
          }

          .hisobot-çop .varaq {
            break-inside: avoid;
            box-shadow: none !important;
            border-color: #cbd5e1 !important;
          }

          /* Har bir öquvçi yangi varaqdan boşlanadi */
          .hisobot-çop .yangi-varaq {
            break-before: page;
          }

          .hisobot-çop table {
            font-size: 11pt;
          }
        }
      `}</style>

      <section className="mx-auto max-w-4xl px-3 py-6 sm:px-6 sm:py-10 print:max-w-none print:px-0 print:py-0">
        <div className="chop-yashir flex flex-wrap items-center justify-between gap-3">
          <BackLink
            href={`/admin/groups/report?groupId=${groupId}`}
            label="Hisobot"
            className="mb-2"
          />

          <PrintResultButton />
        </div>

        {migrationMissing && (
          <AppAlert
            variant="warning"
            title="Hisobot tayyor emas"
            className="chop-yashir mt-5"
          >
            Supabase’da <b>db/16-hisobot-tafsiloti.sql</b> faylini işga
            tuşiring — şundan keyin varaqlar töladi.
          </AppAlert>
        )}

        <p className="chop-yashir mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-800">
          <b>Çop etiş / PDF</b> tugmasini bosing. Oçilgan oynada
          printer örniga <b>«PDF sifatida saqlaş»</b> ni tanlasangiz
          fayl yuklab olinadi. Birinçi varaq — umumiy jadval, keyin
          har bir öquvçiga alohida varaq.
        </p>

        {/* ============ 1-varaq: umumiy ============ */}
        <article className="varaq mt-6 rounded-2xl border border-mb-line bg-white p-5 print:mt-0 print:rounded-none print:p-0 print:shadow-none">
          <header className="border-b border-slate-200 pb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-mb-brand">
              Vepa Ustoz · vepa.uz
            </p>

            <h1 className="text-xl font-bold sm:text-2xl">
              {group.title} — öquv hisoboti
            </h1>

            <p className="mt-1 text-sm text-mb-muted">
              Tayyorlandi: {printedAt} · {sheets.length} ta öquvçi
            </p>
          </header>

          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl border border-mb-line px-3 py-3">
              <p className="text-xs font-semibold text-mb-muted">
                Berilgan vazifa
              </p>
              <p className="mt-1 text-xl font-bold">{totalAssigned}</p>
            </div>

            <div className="rounded-xl border border-mb-line px-3 py-3">
              <p className="text-xs font-semibold text-mb-muted">
                Bajarilgan
              </p>
              <p className="mt-1 text-xl font-bold text-emerald-600">
                {completionRate}%
              </p>
            </div>

            <div className="rounded-xl border border-mb-line px-3 py-3">
              <p className="text-xs font-semibold text-mb-muted">
                Guruh örtaçasi
              </p>
              <p className="mt-1 text-xl font-bold text-mb-brand">
                {groupAverage}%
              </p>
            </div>
          </div>

          {sheets.length === 0 ? (
            <AppAlert variant="info" title="Ma’lumot yöq" className="mt-5">
              Guruhda öquvçi yöq yoki hali vazifa berilmagan.
            </AppAlert>
          ) : (
            <table className="mt-5 w-full text-left text-sm">
              <thead className="border-b border-slate-300 text-xs uppercase tracking-wide text-mb-muted">
                <tr>
                  <th className="py-2 pr-2 font-semibold">№</th>
                  <th className="py-2 pr-2 font-semibold">Öquvçi</th>
                  <th className="py-2 pr-2 text-center font-semibold">
                    Bajardi
                  </th>
                  <th className="py-2 text-right font-semibold">
                    Örtaça
                  </th>
                </tr>
              </thead>

              <tbody>
                {sheets.map((sheet, index) => (
                  <tr
                    key={sheet.userId}
                    className="border-b border-slate-100"
                  >
                    <td className="py-2 pr-2 text-mb-muted">
                      {index + 1}
                    </td>

                    <td className="py-2 pr-2 font-semibold">
                      {sheet.fullName}
                    </td>

                    <td className="py-2 pr-2 text-center">
                      {sheet.completedCount}/{sheet.assignedCount}
                    </td>

                    <td className="py-2 text-right font-bold">
                      {sheet.completedCount > 0
                        ? `${sheet.averagePercent}%`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>

        {/* ============ Har bir o'quvchiga alohida varaq ============ */}
        {sheets.map((sheet) => (
          <article
            key={sheet.userId}
            className="varaq yangi-varaq mt-6 rounded-2xl border border-mb-line bg-white p-5 print:rounded-none print:p-0 print:shadow-none"
          >
            <header className="border-b border-slate-200 pb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-mb-brand">
                Vepa Ustoz · {group.title}
              </p>

              <h2 className="mt-2 text-xl font-bold">
                {sheet.fullName}
              </h2>

              <p className="mt-1 text-sm text-mb-muted">
                {printedAt} holatiga köra
              </p>
            </header>

            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl border border-mb-line px-3 py-3">
                <p className="text-xs font-semibold text-mb-muted">
                  Vazifa
                </p>
                <p className="mt-1 text-xl font-bold">
                  {sheet.assignedCount}
                </p>
              </div>

              <div className="rounded-xl border border-mb-line px-3 py-3">
                <p className="text-xs font-semibold text-mb-muted">
                  Bajardi
                </p>
                <p className="mt-1 text-xl font-bold text-emerald-600">
                  {sheet.completedCount}
                </p>
              </div>

              <div className="rounded-xl border border-mb-line px-3 py-3">
                <p className="text-xs font-semibold text-mb-muted">
                  Örtaça
                </p>
                <p className="mt-1 text-xl font-bold text-mb-brand">
                  {sheet.completedCount > 0
                    ? `${sheet.averagePercent}%`
                    : "—"}
                </p>
              </div>
            </div>

            <table className="mt-5 w-full text-left text-sm">
              <thead className="border-b border-slate-300 text-xs uppercase tracking-wide text-mb-muted">
                <tr>
                  <th className="py-2 pr-2 font-semibold">Vazifa</th>
                  <th className="py-2 pr-2 font-semibold">Muddat</th>
                  <th className="py-2 text-right font-semibold">
                    Natija
                  </th>
                </tr>
              </thead>

              <tbody>
                {sheet.rows.map((row) => {
                  const percent = Math.round(Number(row.percentage ?? 0));

                  return (
                    <tr
                      key={row.assignment_id}
                      className="border-b border-slate-100"
                    >
                      <td className="py-2 pr-2 font-medium">
                        {row.test_title}
                      </td>

                      <td className="py-2 pr-2 text-mb-muted">
                        {formatDate(row.due_at)}
                      </td>

                      <td className="py-2 text-right">
                        {row.completed_at ? (
                          <span className="font-bold">
                            {percent}%{" "}
                            <span className="font-normal text-mb-muted">
                              ({gradeLabel(percent)})
                            </span>
                          </span>
                        ) : (
                          <span className="font-semibold text-red-600">
                            işlamadi
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Ota-ona uchun izoh joyi */}
            <div className="mt-6 border-t border-dashed border-slate-300 pt-4">
              <p className="text-xs font-semibold text-mb-muted">
                Öqituvçi izohi
              </p>

              <div className="mt-2 h-16 rounded-lg border border-dashed border-slate-300" />

              <div className="mt-5 flex justify-between text-xs text-mb-muted">
                <span>Öqituvçi imzosi: ____________</span>
                <span>Ota-ona imzosi: ____________</span>
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
