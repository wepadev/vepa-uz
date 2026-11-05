import Link from "next/link";

import AdminTabs from "@/components/admin/admin-tabs";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/supabase/current-user";
import { createClient } from "@/lib/supabase/server";
import SubmitButton from "@/components/ui/submit-button";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    q?: string | string[];
    sort?: string | string[];
  }>;
};

type AdminSummaryRpcRow = {
  started_count: number | string;
  completed_count: number | string;
  unique_students: number | string;
  average_percentage: number | string;
  excellent_attempts: number | string;
};

type AdminTestAnalyticsRpcRow = {
  test_id: number | string;
  title: string;
  started_count: number | string;
  completed_count: number | string;
  unique_students: number | string;
  average_percentage: number | string;
  highest_percentage: number | string;
  excellent_count: number | string;
  completion_rate: number | string;
  difficulty_score: number | string;
  total_rows: number | string;
};

type AdminStudentAnalyticsRpcRow = {
  user_id: string;
  full_name: string;
  is_active: boolean;
  completed_count: number | string;
  average_percentage: number | string;
  highest_percentage: number | string;
  excellent_count: number | string;
  last_completed_at: string | null;
};

type TestAnalytics = {
  testId: number;
  title: string;
  startedCount: number;
  completedCount: number;
  uniqueStudents: number;
  averagePercentage: number;
  highestPercentage: number;
  excellentCount: number;
  completionRate: number;
  difficultyScore: number;
};

type StudentAnalytics = {
  userId: string;
  fullName: string;
  isActive: boolean;
  completedCount: number;
  averagePercentage: number;
  highestPercentage: number;
  excellentCount: number;
  lastCompletedAt: string | null;
};

type SortValue =
  | "attempts"
  | "average_desc"
  | "average_asc"
  | "title";

function single(
  value: string | string[] | undefined,
) {
  return Array.isArray(value)
    ? value[0]
    : value;
}

function numberValue(
  value: unknown,
) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
}

function percentageText(
  value: number,
) {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(1);
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
      timeZone: "Asia/Tashkent",
    },
  ).format(new Date(value));
}

function resultColor(
  value: number,
) {
  if (value >= 90) {
    return "text-emerald-600";
  }

  if (value >= 70) {
    return "text-blue-600";
  }

  if (value >= 50) {
    return "text-amber-600";
  }

  return "text-red-600";
}

function resultBackground(
  value: number,
) {
  if (value >= 90) {
    return "bg-emerald-500";
  }

  if (value >= 70) {
    return "bg-blue-500";
  }

  if (value >= 50) {
    return "bg-amber-500";
  }

  return "bg-red-500";
}

function mapTestAnalytics(
  row: AdminTestAnalyticsRpcRow,
): TestAnalytics {
  return {
    testId:
      numberValue(row.test_id),
    title: row.title,
    startedCount:
      numberValue(
        row.started_count,
      ),
    completedCount:
      numberValue(
        row.completed_count,
      ),
    uniqueStudents:
      numberValue(
        row.unique_students,
      ),
    averagePercentage:
      numberValue(
        row.average_percentage,
      ),
    highestPercentage:
      numberValue(
        row.highest_percentage,
      ),
    excellentCount:
      numberValue(
        row.excellent_count,
      ),
    completionRate:
      numberValue(
        row.completion_rate,
      ),
    difficultyScore:
      numberValue(
        row.difficulty_score,
      ),
  };
}

function mapStudentAnalytics(
  row: AdminStudentAnalyticsRpcRow,
): StudentAnalytics {
  return {
    userId: row.user_id,
    fullName:
      row.full_name?.trim() ||
      "Ism kiritilmagan",
    isActive:
      row.is_active === true,
    completedCount:
      numberValue(
        row.completed_count,
      ),
    averagePercentage:
      numberValue(
        row.average_percentage,
      ),
    highestPercentage:
      numberValue(
        row.highest_percentage,
      ),
    excellentCount:
      numberValue(
        row.excellent_count,
      ),
    lastCompletedAt:
      row.last_completed_at,
  };
}

async function requireAdmin() {
  const supabase =
    await createClient();

  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/login");
  }

  const {
    data: profile,
    error,
  } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (
    error ||
    !profile ||
    profile.role !== "admin" ||
    profile.is_active !== true
  ) {
    redirect("/");
  }

  return supabase;
}

export default async function AdminAnalyticsPage({
  searchParams,
}: PageProps) {
  const supabase =
    await requireAdmin();

  const params = await searchParams;

  const query =
    (
      single(params.q) ?? ""
    ).trim();

  const requestedSort =
    single(params.sort);

  const selectedSort: SortValue =
    requestedSort ===
      "average_desc" ||
    requestedSort ===
      "average_asc" ||
    requestedSort === "title"
      ? requestedSort
      : "attempts";

  const [
    summaryResult,
    testAnalyticsResult,
    hardestTestsResult,
    topStudentsResult,
  ] = await Promise.all([
    supabase.rpc(
      "admin_get_analytics_summary",
    ),

    supabase.rpc(
      "admin_get_test_analytics",
      {
        p_query:
          query || null,
        p_sort:
          selectedSort,
        p_limit: 1000,
        p_offset: 0,
      },
    ),

    supabase.rpc(
      "admin_get_test_analytics",
      {
        p_query: null,
        p_sort: "average_asc",
        p_limit: 5,
        p_offset: 0,
      },
    ),

    supabase.rpc(
      "admin_get_top_students",
      {
        p_limit: 10,
      },
    ),
  ]);

  if (summaryResult.error) {
    throw new Error(
      `Umumiy analitika yuklanmadi: ${summaryResult.error.message}`,
    );
  }

  if (testAnalyticsResult.error) {
    throw new Error(
      `Testlar analitikasi yuklanmadi: ${testAnalyticsResult.error.message}`,
    );
  }

  if (hardestTestsResult.error) {
    throw new Error(
      `Qiyin testlar yuklanmadi: ${hardestTestsResult.error.message}`,
    );
  }

  if (topStudentsResult.error) {
    throw new Error(
      `Öquvçilar analitikasi yuklanmadi: ${topStudentsResult.error.message}`,
    );
  }

  const summary =
    (
      summaryResult.data ??
      []
    )[0] as
      | AdminSummaryRpcRow
      | undefined;

  const attempts = {
    length:
      numberValue(
        summary?.started_count,
      ),
  };

  const completedAttempts = {
    length:
      numberValue(
        summary?.completed_count,
      ),
  };

  const uniqueStudents =
    numberValue(
      summary?.unique_students,
    );

  const averagePercentage =
    numberValue(
      summary?.average_percentage,
    );

  const excellentAttempts =
    numberValue(
      summary?.excellent_attempts,
    );

  const filteredTestAnalytics =
    (
      (
        testAnalyticsResult.data ??
        []
      ) as AdminTestAnalyticsRpcRow[]
    ).map(mapTestAnalytics);

  const hardestTests =
    (
      (
        hardestTestsResult.data ??
        []
      ) as AdminTestAnalyticsRpcRow[]
    )
      .map(mapTestAnalytics)
      .filter(
        (item) =>
          item.completedCount > 0,
      );

  const topStudents =
    (
      (
        topStudentsResult.data ??
        []
      ) as AdminStudentAnalyticsRpcRow[]
    ).map(mapStudentAnalytics);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-10">
        <Link
          href="/admin"
          className="inline-flex min-h-7 items-center text-sm font-semibold text-mb-brand hover:text-mb-brandDark"
        >
          ← Admin panelga qaytiş
        </Link>

        <h1 className="text-xl font-bold sm:text-2xl">Natijalar</h1>

        <AdminTabs
          className="mt-2"
          active="/admin/analytics"
          tabs={[
            { href: "/admin/results", label: "Barça natijalar" },
            { href: "/admin/analytics", label: "Tahlil" },
          ]}
        />

        <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-500">
          Barça urinişlar asosida testlarning qiyinligi, yakunlaniş
          darajasi va öquvçilar reytingi.
        </p>

        <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">
              Tugallangan urinişlar
            </p>

            <p className="mt-2 text-3xl font-bold text-red-600">
              {completedAttempts.length}
            </p>

            <p className="mt-2 text-xs text-slate-400">
              Jami boşlangan:{" "}
              {attempts.length}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">
              Faol öquvçilar
            </p>

            <p className="mt-2 text-3xl font-bold text-blue-600">
              {uniqueStudents}
            </p>

            <p className="mt-2 text-xs text-slate-400">
              Kamida 1 ta testni
              tugallagan
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">
              Örtaça natija
            </p>

            <p
              className={`mt-2 text-3xl font-bold ${resultColor(
                averagePercentage,
              )}`}
            >
              {percentageText(
                averagePercentage,
              )}
              %
            </p>

            <p className="mt-2 text-xs text-slate-400">
              Barça tugallangan
              urinişlar
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">
              90% va undan yuqori
            </p>

            <p className="mt-2 text-3xl font-bold text-emerald-600">
              {excellentAttempts}
            </p>

            <p className="mt-2 text-xs text-slate-400">
              Yuqori natijali
              urinişlar
            </p>
          </article>
        </div>

        <div className="mt-9 grid gap-6 xl:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-950">
                  Eng qiyin testlar
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Örtaça natijasi eng
                  past 5 ta test
                </p>
              </div>
            </div>

            {hardestTests.length === 0 ? (
              <p className="mt-6 rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                Tahlil qiliş uçun
                tugallangan uriniş yöq.
              </p>
            ) : (
              <div className="mt-5 space-y-4">
                {hardestTests.map(
                  (item, index) => (
                    <div
                      key={item.testId}
                      className="rounded-2xl border border-slate-200 p-4"
                    >
                      <div className="flex items-start gap-3">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-red-50 text-sm font-bold text-red-600">
                          {index + 1}
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <Link
                              href={`/admin/results?testId=${item.testId}&status=completed`}
                              className="font-bold text-slate-900 hover:text-blue-600"
                            >
                              {item.title}
                            </Link>

                            <span
                              className={`font-bold ${resultColor(
                                item.averagePercentage,
                              )}`}
                            >
                              {percentageText(
                                item.averagePercentage,
                              )}
                              %
                            </span>
                          </div>

                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full ${resultBackground(
                                item.averagePercentage,
                              )}`}
                              style={{
                                width: `${Math.max(
                                  3,
                                  Math.min(
                                    100,
                                    item.averagePercentage,
                                  ),
                                )}%`,
                              }}
                            />
                          </div>

                          <p className="mt-2 text-xs text-slate-500">
                            {item.completedCount}{" "}
                            ta tugallangan
                            uriniş · eng yuqori{" "}
                            {percentageText(
                              item.highestPercentage,
                            )}
                            %
                          </p>
                        </div>
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div>
              <h2 className="text-xl font-bold text-slate-950">
                Öquvçilar reytingi
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Örtaça natija böyiça
                eng yaxşi 10 öquvçi
              </p>
            </div>

            {topStudents.length === 0 ? (
              <p className="mt-6 rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                Reyting uçun
                tugallangan uriniş yöq.
              </p>
            ) : (
              <div className="mt-5 space-y-3">
                {topStudents.map(
                  (student, index) => (
                    <Link
                      key={student.userId}
                      href={`/admin/results?q=${encodeURIComponent(
                        student.fullName,
                      )}&status=completed`}
                      className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 transition hover:border-blue-300 hover:bg-blue-50/40"
                    >
                      <span
                        className={
                          index === 0
                            ? "grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-100 font-bold text-amber-700"
                            : index === 1
                              ? "grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-200 font-bold text-slate-700"
                              : index === 2
                                ? "grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-100 font-bold text-amber-700"
                                : "grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 font-bold text-blue-700"
                        }
                      >
                        {index + 1}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-bold text-slate-900">
                            {student.fullName}
                          </p>

                          {!student.isActive && (
                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">
                              Bloklangan
                            </span>
                          )}
                        </div>

                        <p className="mt-1 text-xs text-slate-500">
                          {student.completedCount}{" "}
                          ta test ·{" "}
                          {student.excellentCount}{" "}
                          ta 90%+
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <p
                          className={`text-lg font-bold ${resultColor(
                            student.averagePercentage,
                          )}`}
                        >
                          {percentageText(
                            student.averagePercentage,
                          )}
                          %
                        </p>

                        <p className="text-[11px] text-slate-400">
                          eng yuqori{" "}
                          {percentageText(
                            student.highestPercentage,
                          )}
                          %
                        </p>
                      </div>
                    </Link>
                  ),
                )}
              </div>
            )}
          </section>
        </div>

        <section className="mt-9">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <h2 className="text-2xl font-bold text-slate-950">
                Testlar kesimida
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Har bir testning
                urinişlari, örtaça
                natijasi va yakunlaniş
                darajasi
              </p>
            </div>

            <form
              method="get"
              className="grid gap-3 sm:grid-cols-[minmax(220px,1fr)_210px_auto]"
            >
              <input
                name="q"
                defaultValue={
                  single(params.q) ?? ""
                }
                placeholder="Test nomini qidiriş"
                className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />

              <select
                name="sort"
                defaultValue={
                  selectedSort
                }
                className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              >
                <option value="attempts">
                  Eng köp işlangan
                </option>

                <option value="average_desc">
                  Natija: yuqoridan
                </option>

                <option value="average_asc">
                  Natija: pastdan
                </option>

                <option value="title">
                  Test nomi
                </option>
              </select>

              <SubmitButton
                className="min-h-11 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-700"
              >
                Qöllaş
              </SubmitButton>
            </form>
          </div>

          {filteredTestAnalytics.length ===
          0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
              <p className="font-bold text-slate-800">
                Mos test topilmadi
              </p>

              <p className="mt-2 text-sm text-slate-500">
                Qidiruv sözini
                özgartirib köring.
              </p>
            </div>
          ) : (
            <div className="mt-5 overflow-hidden rounded-2xl border border-mb-line bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1050px] text-left">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-4 font-bold">
                        Test
                      </th>

                      <th className="px-5 py-4 text-center font-bold">
                        Boşlangan
                      </th>

                      <th className="px-5 py-4 text-center font-bold">
                        Tugallangan
                      </th>

                      <th className="px-5 py-4 text-center font-bold">
                        Öquvçilar
                      </th>

                      <th className="px-5 py-4 text-center font-bold">
                        Örtaça
                      </th>

                      <th className="px-5 py-4 text-center font-bold">
                        Eng yuqori
                      </th>

                      <th className="px-5 py-4 text-center font-bold">
                        90%+
                      </th>

                      <th className="px-5 py-4 text-center font-bold">
                        Yakunlaş
                      </th>

                      <th className="px-5 py-4 font-bold">
                        Amal
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {filteredTestAnalytics.map(
                      (item) => (
                        <tr
                          key={item.testId}
                          className="hover:bg-slate-50"
                        >
                          <td className="max-w-[300px] px-5 py-4">
                            <p className="font-bold text-slate-900">
                              {item.title}
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                              Qiyinlik
                              körsatkiçi:{" "}
                              {percentageText(
                                item.difficultyScore,
                              )}
                              %
                            </p>
                          </td>

                          <td className="px-5 py-4 text-center font-semibold text-slate-700">
                            {
                              item.startedCount
                            }
                          </td>

                          <td className="px-5 py-4 text-center font-semibold text-slate-700">
                            {
                              item.completedCount
                            }
                          </td>

                          <td className="px-5 py-4 text-center font-semibold text-slate-700">
                            {
                              item.uniqueStudents
                            }
                          </td>

                          <td
                            className={`px-5 py-4 text-center font-bold ${resultColor(
                              item.averagePercentage,
                            )}`}
                          >
                            {item.completedCount >
                            0
                              ? `${percentageText(
                                  item.averagePercentage,
                                )}%`
                              : "—"}
                          </td>

                          <td className="px-5 py-4 text-center font-bold text-slate-800">
                            {item.completedCount >
                            0
                              ? `${percentageText(
                                  item.highestPercentage,
                                )}%`
                              : "—"}
                          </td>

                          <td className="px-5 py-4 text-center font-bold text-emerald-600">
                            {
                              item.excellentCount
                            }
                          </td>

                          <td className="px-5 py-4 text-center">
                            <span
                              className={
                                item.completionRate >=
                                80
                                  ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700"
                                  : item.completionRate >=
                                      50
                                    ? "rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700"
                                    : "rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700"
                              }
                            >
                              {item.startedCount >
                              0
                                ? `${percentageText(
                                    item.completionRate,
                                  )}%`
                                : "—"}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <Link
                              href={`/admin/results?testId=${item.testId}`}
                              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-100"
                            >
                              Urinişlar
                            </Link>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {topStudents.length > 0 && (
          <section className="mt-9 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-xl font-bold text-slate-950">
              Reyting haqida
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Reyting öquvçining
              tugallangan testlaridagi
              örtaça foizi böyiça
              tuziladi. Natijalar teng
              bölsa, eng yuqori foiz va
              tugallangan testlar soni
              hisobga olinadi. Oxirgi
              natija sanasi:{" "}
              {formatDate(
                topStudents[0]
                  .lastCompletedAt,
              )}.
            </p>
          </section>
        )}
      </section>
    </main>
  );
}

