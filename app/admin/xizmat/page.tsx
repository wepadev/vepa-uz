import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Database, Sparkles } from "lucide-react";

import AppAlert from "@/components/ui/app-alert";
import SubmitButton from "@/components/ui/submit-button";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Texnik xizmat",
  description: "Bazani tozalaş va hajmini kuzatiş.",
};

type PageProps = {
  searchParams: Promise<{
    natija?: string | string[];
    xato?: string | string[];
  }>;
};

type StorageRow = {
  table_name: string;
  row_count: number | string;
  size_text: string;
};

type CleanupRow = {
  step: string;
  removed: number | string;
};

/** Tozalash oralig'i — juda qisqa qiymat berilmasin */
const DAY_OPTIONS = [30, 90, 180, 365];

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function requireAdmin() {
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

  return supabase;
}

/**
 * Tozalashni ishga tushiradi.
 *
 * Bazadagi `platform_cleanup()` faqat chiqindini o'chiradi:
 * natijalar, testlar, darslar, guruh ballari va sovg'a tarixiga
 * umuman tegmaydi.
 */
async function runCleanup(formData: FormData) {
  "use server";

  const supabase = await requireAdmin();

  const days = Number(formData.get("days")) || 90;

  const { data, error } = await supabase.rpc("platform_cleanup", {
    p_days: days,
  });

  if (error) {
    const message =
      error.code === "PGRST202" || error.code === "42883"
        ? "Supabase’da db/30-tozalaş.sql faylini işga tuşiring."
        : error.message;

    redirect(`/admin/xizmat?xato=${encodeURIComponent(message)}`);
  }

  const rows = (data ?? []) as CleanupRow[];

  const summary = rows
    .map((row) => `${row.step}: ${Number(row.removed) || 0}`)
    .join(" · ");

  revalidatePath("/admin/xizmat");

  redirect(
    `/admin/xizmat?natija=${encodeURIComponent(summary || "Tozalandi")}`,
  );
}

export default async function AdminMaintenancePage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const result = single(params.natija);
  const errorMessage = single(params.xato);

  const supabase = await requireAdmin();

  const { data, error } = await supabase.rpc("platform_storage_report");

  const migrationMissing = Boolean(error);
  const storage = (data ?? []) as StorageRow[];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="mx-auto max-w-3xl px-3 py-6 sm:px-6 sm:py-10">
        <Link
          href="/admin"
          className="inline-flex min-h-8 items-center text-sm font-semibold text-mb-brand hover:text-mb-brandDark"
        >
          ← Admin panel
        </Link>

        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold sm:text-3xl">
          <Database
            className="h-6 w-6 text-mb-muted"
            strokeWidth={2}
            aria-hidden="true"
          />
          Texnik xizmat
        </h1>

        <p className="mt-2 text-sm leading-6 text-mb-muted">
          Iş jarayonidan qolgan çiqindini öçiradi: yopilgan
          sessiyalar, javob qoralamalari, taşlab ketilgan urinişlar
          va yopilgan takrorlaş savollari.
        </p>

        {migrationMissing && (
          <AppAlert variant="warning" title="Fayl işga tuşirilmagan" className="mt-5">
            Supabase’da <b>db/30-tozalaş.sql</b> faylini işga
            tuşiring.
          </AppAlert>
        )}

        {result && (
          <AppAlert variant="success" title="Tozalandi" className="mt-5">
            {result}
          </AppAlert>
        )}

        {errorMessage && (
          <AppAlert variant="error" title="Bajarilmadi" className="mt-5">
            {errorMessage}
          </AppAlert>
        )}

        {/* Nima o'chmaydi */}
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-bold text-emerald-900">
            Bularga tegilmaydi
          </p>

          <p className="mt-1 text-sm leading-6 text-emerald-800">
            Tugallangan urinişlar va javoblar, reyting, testlar va
            savollar, darslar, darslik yeçimlari, guruhlar, ballar,
            tangalar hamda sovğa tarixi.
          </p>
        </div>

        {/* Tozalash */}
        <form
          action={runCleanup}
          className="mt-4 rounded-2xl border border-mb-line bg-white p-4 shadow-sm sm:p-5"
        >
          <label
            htmlFor="days"
            className="text-sm font-semibold text-slate-700"
          >
            Qançadan eskisi öçsin
          </label>

          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <select
              id="days"
              name="days"
              defaultValue="90"
              className="min-h-12 flex-1 rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-mb-brand focus:ring-4 focus:ring-blue-100"
            >
              {DAY_OPTIONS.map((day) => (
                <option key={day} value={day}>
                  {day} kundan eskisi
                </option>
              ))}
            </select>

            <SubmitButton
              pendingLabel="Tozalanmoqda…"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-mb-brand px-5 font-bold text-white transition hover:bg-mb-brandDark"
            >
              <Sparkles
                className="h-4 w-4"
                strokeWidth={2.2}
                aria-hidden="true"
              />
              Tozalaş
            </SubmitButton>
          </div>

          <p className="mt-2 text-xs leading-5 text-mb-muted">
            Oyda bir marta bosiş yetarli. Bir neça marta bossangiz
            ham heç narsa buzilmaydi.
          </p>
        </form>

        {/* Hajm */}
        {storage.length > 0 && (
          <>
            <h2 className="mt-7 text-lg font-bold">Eng katta jadvallar</h2>

            <div className="mt-3 overflow-hidden rounded-2xl border border-mb-line bg-white shadow-sm">
              {storage.map((row, index) => (
                <div
                  key={row.table_name}
                  className={
                    index > 0
                      ? "flex items-center justify-between gap-3 border-t border-mb-line px-4 py-2.5"
                      : "flex items-center justify-between gap-3 px-4 py-2.5"
                  }
                >
                  <p className="min-w-0 truncate text-sm font-semibold text-mb-ink">
                    {row.table_name}
                  </p>

                  <p className="shrink-0 text-sm text-mb-muted">
                    {Number(row.row_count).toLocaleString("uz-UZ")} qator ·{" "}
                    <span className="font-semibold text-mb-ink">
                      {row.size_text}
                    </span>
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
