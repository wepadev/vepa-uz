import { requireAdmin } from "@/lib/require-admin";
import ExamTimer from "@/components/admin/exam-timer";

export const metadata = {
  title: "Imtihon taymeri",
};

export default async function TimerPage() {
  await requireAdmin();

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-mb-line bg-white">
        <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6">
          <h1 className="text-xl font-bold text-mb-ink sm:text-2xl">
            Imtihon taymeri
          </h1>

          <p className="mt-1 text-sm text-mb-muted">
            Doskaga çiqariş uçun: muddatni tanlang, “Töliq ekran”ni
            bosing. Sahifa yangilansa ham vaqt yöqolmaydi.
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8">
        <ExamTimer />
      </section>
    </main>
  );
}
