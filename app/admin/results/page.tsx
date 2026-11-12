import Link from "next/link";

import AdminTabs from "@/components/admin/admin-tabs";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/supabase/current-user";
import { createClient } from "@/lib/supabase/server";
import SubmitButton from "@/components/ui/submit-button";
import PageHeader, { headerButton } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type PageProps = {
  searchParams: Promise<{
    q?: string | string[];
    status?: string | string[];
    testId?: string | string[];
    sort?: string | string[];
    dateFrom?: string | string[];
    dateTo?: string | string[];
    page?: string | string[];
  }>;
};

type ResultStatus =
  | "all"
  | "completed"
  | "in_progress";

type ResultSort =
  | "newest"
  | "oldest"
  | "highest"
  | "lowest";

type AdminResultRpcRow = {
  attempt_id: string;
  user_id: string;
  test_id: number | string;
  score: number | string;
  total_questions: number | string;
  percentage: number | string;
  started_at: string;
  completed_at: string | null;
  full_name: string;
  email: string;
  user_is_active: boolean;
  user_role: string;
  test_title: string;
};

type AdminSummaryRpcRow = {
  filtered_count: number | string;
  started_count: number | string;
  completed_count: number | string;
  unique_students: number | string;
  average_percentage: number | string;
  highest_percentage: number | string;
};

type AdminTestRpcRow = {
  test_id: number | string;
  title: string;
};

type FilterValues = {
  q: string;
  status: ResultStatus;
  testId: number;
  sort: ResultSort;
  dateFrom: string;
  dateTo: string;
};

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

function normalizeDate(
  value: string | undefined,
) {
  if (
    value &&
    /^\d{4}-\d{2}-\d{2}$/.test(
      value,
    )
  ) {
    return value;
  }

  return "";
}

function formatDate(
  value: string | null,
) {
  if (!value) {
    return "Tugallanmagan";
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

function formatPercentage(
  value: number | string,
) {
  const percentage =
    numberValue(value);

  return Number.isInteger(percentage)
    ? String(percentage)
    : percentage.toFixed(1);
}

function buildPageHref(
  page: number,
  filters: FilterValues,
) {
  const query =
    new URLSearchParams();

  if (filters.q) {
    query.set("q", filters.q);
  }

  if (filters.status !== "all") {
    query.set(
      "status",
      filters.status,
    );
  }

  if (filters.testId > 0) {
    query.set(
      "testId",
      String(filters.testId),
    );
  }

  if (filters.sort !== "newest") {
    query.set(
      "sort",
      filters.sort,
    );
  }

  if (filters.dateFrom) {
    query.set(
      "dateFrom",
      filters.dateFrom,
    );
  }

  if (filters.dateTo) {
    query.set(
      "dateTo",
      filters.dateTo,
    );
  }

  if (page > 1) {
    query.set(
      "page",
      String(page),
    );
  }

  const serialized =
    query.toString();

  return serialized
    ? `/admin/results?${serialized}`
    : "/admin/results";
}

function getPageNumbers(
  currentPage: number,
  totalPages: number,
) {
  const values = new Set<number>();

  values.add(1);
  values.add(totalPages);

  for (
    let page =
      currentPage - 2;
    page <= currentPage + 2;
    page += 1
  ) {
    if (
      page >= 1 &&
      page <= totalPages
    ) {
      values.add(page);
    }
  }

  return [...values].sort(
    (first, second) =>
      first - second,
  );
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

export default async function AdminResultsPage({
  searchParams,
}: PageProps) {
  const supabase =
    await requireAdmin();

  const params = await searchParams;

  const searchText =
    (
      single(params.q) ?? ""
    ).trim();

  const rawStatus =
    single(params.status);

  const status: ResultStatus =
    rawStatus === "completed" ||
    rawStatus === "in_progress"
      ? rawStatus
      : "all";

  const rawTestId =
    Number(
      single(params.testId),
    );

  const selectedTestId =
    Number.isInteger(rawTestId) &&
    rawTestId > 0
      ? rawTestId
      : 0;

  const rawSort =
    single(params.sort);

  const sort: ResultSort =
    rawSort === "oldest" ||
    rawSort === "highest" ||
    rawSort === "lowest"
      ? rawSort
      : "newest";

  const dateFrom =
    normalizeDate(
      single(params.dateFrom),
    );

  const dateTo =
    normalizeDate(
      single(params.dateTo),
    );

  const rawPage =
    Number(
      single(params.page),
    );

  const currentPage =
    Number.isInteger(rawPage) &&
    rawPage > 0
      ? rawPage
      : 1;

  const filters: FilterValues = {
    q: searchText,
    status,
    testId: selectedTestId,
    sort,
    dateFrom,
    dateTo,
  };

  const rpcFilters = {
    p_query:
      searchText || null,
    p_status: status,
    p_test_id:
      selectedTestId > 0
        ? selectedTestId
        : null,
    p_date_from:
      dateFrom || null,
    p_date_to:
      dateTo || null,
  };

  const [
    summaryResult,
    testsResult,
  ] = await Promise.all([
    supabase.rpc(
      "admin_get_results_summary",
      rpcFilters,
    ),

    supabase.rpc(
      "admin_get_result_tests",
    ),
  ]);

  if (summaryResult.error) {
    throw new Error(
      `Natijalar statistikasi yuklanmadi: ${summaryResult.error.message}`,
    );
  }

  if (testsResult.error) {
    throw new Error(
      `Testlar yuklanmadi: ${testsResult.error.message}`,
    );
  }

  const summary =
    (
      summaryResult.data ??
      []
    )[0] as
      | AdminSummaryRpcRow
      | undefined;

  const totalRows =
    numberValue(
      summary?.filtered_count,
    );

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        totalRows / PAGE_SIZE,
      ),
    );

  if (
    totalRows > 0 &&
    currentPage > totalPages
  ) {
    redirect(
      buildPageHref(
        totalPages,
        filters,
      ),
    );
  }

  const {
    data: resultsData,
    error: resultsError,
  } = await supabase.rpc(
    "admin_get_results",
    {
      ...rpcFilters,
      p_sort: sort,
      p_limit: PAGE_SIZE,
      p_offset:
        (currentPage - 1) *
        PAGE_SIZE,
    },
  );

  if (resultsError) {
    throw new Error(
      `Natijalar yuklanmadi: ${resultsError.message}`,
    );
  }

  const results =
    (
      resultsData ??
      []
    ) as AdminResultRpcRow[];

  const tests =
    (
      testsResult.data ??
      []
    ) as AdminTestRpcRow[];

  const completedCount =
    numberValue(
      summary?.completed_count,
    );

  const uniqueStudents =
    numberValue(
      summary?.unique_students,
    );

  const averagePercentage =
    numberValue(
      summary?.average_percentage,
    );

  const highestPercentage =
    numberValue(
      summary?.highest_percentage,
    );

  const firstVisible =
    totalRows > 0
      ? (currentPage - 1) *
          PAGE_SIZE +
        1
      : 0;

  const lastVisible =
    Math.min(
      currentPage * PAGE_SIZE,
      totalRows,
    );

  const filtersActive =
    Boolean(searchText) ||
    status !== "all" ||
    selectedTestId > 0 ||
    sort !== "newest" ||
    Boolean(dateFrom) ||
    Boolean(dateTo);

  const pageNumbers =
    getPageNumbers(
      currentPage,
      totalPages,
    );

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <PageHeader
        sticky={false}
        backHref="/admin"
        backLabel="Admin panel"
        title="Natijalar"
        width="7xl"
        action={
          <Link href="/admin/tests" className={headerButton}>
            Testlar
          </Link>
        }
      >
        <AdminTabs
          active="/admin/results"
          tabs={[
            { href: "/admin/results", label: "Barça natijalar" },
            { href: "/admin/analytics", label: "Tahlil" },
          ]}
        />
      </PageHeader>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-semibold text-slate-500">
              Tugallangan urinişlar
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-950">
              {completedCount}
            </p>

            <p className="mt-2 text-xs text-slate-400">
              Mos natijalar:{" "}
              {totalRows}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-semibold text-slate-500">
              Öquvçilar
            </p>

            <p className="mt-2 text-3xl font-bold text-mb-brand">
              {uniqueStudents}
            </p>

            <p className="mt-2 text-xs text-slate-400">
              Tugallangan natijalar
              böyiça
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-semibold text-slate-500">
              Örtaça natija
            </p>

            <p className="mt-2 text-3xl font-bold text-mb-brand">
              {formatPercentage(
                averagePercentage,
              )}
              %
            </p>

            <p className="mt-2 text-xs text-slate-400">
              Joriy filtr böyiça
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-semibold text-slate-500">
              Eng yuqori natija
            </p>

            <p className="mt-2 text-3xl font-bold text-emerald-600">
              {formatPercentage(
                highestPercentage,
              )}
              %
            </p>

            <p className="mt-2 text-xs text-slate-400">
              Joriy filtr böyiça
            </p>
          </article>
        </div>

        <form
          method="get"
          className="mt-7 rounded-2xl border border-slate-200 bg-white p-5"
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="md:col-span-2">
              <label
                htmlFor="results-q"
                className="text-sm font-bold text-slate-700"
              >
                Qidiriş
              </label>

              <input
                id="results-q"
                name="q"
                type="search"
                defaultValue={
                  single(params.q) ?? ""
                }
                placeholder="Ism, email yoki test nomi"
                className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-mb-brand focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor="results-test"
                className="text-sm font-bold text-slate-700"
              >
                Test
              </label>

              <select
                id="results-test"
                name="testId"
                defaultValue={
                  selectedTestId > 0
                    ? String(
                        selectedTestId,
                      )
                    : "all"
                }
                className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-mb-brand focus:ring-4 focus:ring-blue-100"
              >
                <option value="all">
                  Barça testlar
                </option>

                {tests.map((test) => (
                  <option
                    key={test.test_id}
                    value={test.test_id}
                  >
                    {test.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="results-status"
                className="text-sm font-bold text-slate-700"
              >
                Holati
              </label>

              <select
                id="results-status"
                name="status"
                defaultValue={status}
                className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-mb-brand focus:ring-4 focus:ring-blue-100"
              >
                <option value="all">
                  Barçasi
                </option>

                <option value="completed">
                  Tugallangan
                </option>

                <option value="in_progress">
                  Jarayonda
                </option>
              </select>
            </div>

            <div>
              <label
                htmlFor="results-sort"
                className="text-sm font-bold text-slate-700"
              >
                Saralaş
              </label>

              <select
                id="results-sort"
                name="sort"
                defaultValue={sort}
                className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-mb-brand focus:ring-4 focus:ring-blue-100"
              >
                <option value="newest">
                  Eng yangi
                </option>

                <option value="oldest">
                  Eng eski
                </option>

                <option value="highest">
                  Eng yuqori foiz
                </option>

                <option value="lowest">
                  Eng past foiz
                </option>
              </select>
            </div>

            <div>
              <label
                htmlFor="results-date-from"
                className="text-sm font-bold text-slate-700"
              >
                Boşlaniş sanasi
              </label>

              <input
                id="results-date-from"
                name="dateFrom"
                type="date"
                defaultValue={dateFrom}
                className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-mb-brand focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="results-date-to"
                className="text-sm font-bold text-slate-700"
              >
                Tugaş sanasi
              </label>

              <input
                id="results-date-to"
                name="dateTo"
                type="date"
                defaultValue={dateTo}
                className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-mb-brand focus:ring-4 focus:ring-blue-100"
              />
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
            {filtersActive && (
              <Link
                href="/admin/results"
                className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-300 bg-white px-6 py-3 font-bold text-slate-700 hover:bg-slate-50"
              >
                Filtrlarni tozalaş
              </Link>
            )}

            <SubmitButton
              className="min-h-12 rounded-xl bg-mb-brand px-7 py-3 font-bold text-white hover:bg-mb-brandDark"
            >
              Qöllaş
            </SubmitButton>
          </div>
        </form>

        <div className="mt-7">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold">
                Natijalar
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {totalRows} ta natijadan{" "}
                {firstVisible}–{lastVisible}
                tasi körsatilmoqda
              </p>
            </div>

            <p className="text-sm font-bold text-slate-500">
              {currentPage}/{totalPages}
              -sahifa
            </p>
          </div>

          {results.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
              <h3 className="text-lg font-bold">
                Natija topilmadi
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Qidiruv yoki filtr
                qiymatlarini özgartiring.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-mb-line bg-white">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1240px] text-left">
                  <thead className="border-b border-slate-200 bg-slate-50 text-sm text-slate-600">
                    <tr>
                      <th className="px-5 py-4 font-bold">
                        Öquvçi
                      </th>

                      <th className="px-5 py-4 font-bold">
                        Test
                      </th>

                      <th className="px-5 py-4 font-bold">
                        Natija
                      </th>

                      <th className="px-5 py-4 font-bold">
                        Foiz
                      </th>

                      <th className="px-5 py-4 font-bold">
                        Holati
                      </th>

                      <th className="px-5 py-4 font-bold">
                        Sana
                      </th>

                      <th className="px-5 py-4 font-bold">
                        Amal
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {results.map(
                      (result) => {
                        const percentage =
                          numberValue(
                            result.percentage,
                          );

                        return (
                          <tr
                            key={
                              result.attempt_id
                            }
                            className="hover:bg-slate-50"
                          >
                            <td className="px-5 py-4">
                              <p className="font-bold text-slate-950">
                                {
                                  result.full_name
                                }
                              </p>

                              <p className="mt-1 text-xs text-slate-500">
                                {result.email}
                              </p>

                              <div className="mt-2 flex flex-wrap gap-2">
                                {!result.user_is_active && (
                                  <span className="inline-flex rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-bold text-red-700">
                                    Faol emas
                                  </span>
                                )}

                                {result.user_role ===
                                  "admin" && (
                                  <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                                    Administrator
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              <p className="font-semibold text-slate-800">
                                {
                                  result.test_title
                                }
                              </p>
                            </td>

                            <td className="px-5 py-4">
                              <span className="font-bold">
                                {result.score}
                              </span>

                              <span className="text-slate-500">
                                {" "}
                                /{" "}
                                {
                                  result.total_questions
                                }
                              </span>
                            </td>

                            <td className="px-5 py-4">
                              <span
                                className={
                                  percentage >= 80
                                    ? "font-bold text-emerald-600"
                                    : percentage >= 60
                                      ? "font-bold text-mb-brand"
                                      : "font-bold text-red-600"
                                }
                              >
                                {formatPercentage(
                                  result.percentage,
                                )}
                                %
                              </span>
                            </td>

                            <td className="px-5 py-4">
                              {result.completed_at ? (
                                <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700">
                                  Tugallangan
                                </span>
                              ) : (
                                <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-700">
                                  Jarayonda
                                </span>
                              )}
                            </td>

                            <td className="px-5 py-4 text-sm text-slate-600">
                              {formatDate(
                                result.completed_at ??
                                  result.started_at,
                              )}
                            </td>

                            <td className="px-5 py-4">
                              <Link
                                href={`/admin/results/view?attemptId=${result.attempt_id}`}
                                className="inline-flex min-h-10 items-center justify-center rounded-xl bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-100"
                              >
                                Batafsil
                              </Link>
                            </td>
                          </tr>
                        );
                      },
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {totalPages > 1 && (
            <nav
              aria-label="Natijalar sahifalari"
              className="mt-6 flex flex-wrap items-center justify-center gap-2"
            >
              {currentPage > 1 ? (
                <Link
                  href={buildPageHref(
                    currentPage - 1,
                    filters,
                  )}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  Oldingi
                </Link>
              ) : (
                <span className="inline-flex min-h-11 cursor-not-allowed items-center justify-center rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-bold text-slate-400">
                  Oldingi
                </span>
              )}

              {pageNumbers.map(
                (pageNumber, index) => {
                  const previous =
                    pageNumbers[
                      index - 1
                    ];

                  const showGap =
                    previous !== undefined &&
                    pageNumber -
                      previous >
                      1;

                  return (
                    <span
                      key={pageNumber}
                      className="contents"
                    >
                      {showGap && (
                        <span className="px-1 text-slate-400">
                          …
                        </span>
                      )}

                      <Link
                        href={buildPageHref(
                          pageNumber,
                          filters,
                        )}
                        aria-current={
                          pageNumber ===
                          currentPage
                            ? "page"
                            : undefined
                        }
                        className={
                          pageNumber ===
                          currentPage
                            ? "inline-flex h-11 min-w-11 items-center justify-center rounded-xl bg-mb-brand px-3 text-sm font-bold text-white"
                            : "inline-flex h-11 min-w-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                        }
                      >
                        {pageNumber}
                      </Link>
                    </span>
                  );
                },
              )}

              {currentPage <
              totalPages ? (
                <Link
                  href={buildPageHref(
                    currentPage + 1,
                    filters,
                  )}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  Keyingi
                </Link>
              ) : (
                <span className="inline-flex min-h-11 cursor-not-allowed items-center justify-center rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-bold text-slate-400">
                  Keyingi
                </span>
              )}
            </nav>
          )}
        </div>
      </section>
    </main>
  );
}
