import { Lock } from "lucide-react";
import Link from "next/link";

type PageProps = {
  searchParams: Promise<{
    section?: string;
    reason?: string;
  }>;
};

function getSectionInformation(
  section?: string,
) {
  if (section === "tests") {
    return {
      title: "Testlarga ruxsat kerak",
      description:
        "Onlayn testlardan foydalaniş uçun administrator ruxsati kerak.",
    };
  }

  if (section === "lessons") {
    return {
      title: "Darslarga ruxsat kerak",
      description:
        "Videodarslar va nazariy materiallardan foydalaniş uçun administrator ruxsati kerak.",
    };
  }

  if (section === "textbooks") {
    return {
      title:
        "Darslik yeçimlariga ruxsat kerak",
      description:
        "Darslik yeçimlaridan foydalaniş uçun administrator ruxsati kerak.",
    };
  }

  return {
    title: "Bu bölimga ruxsat kerak",
    description:
      "Mazkur bölimdan foydalaniş uçun administrator ruxsati talab qilinadi.",
  };
}

export default async function AccessRequiredPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;

  const isInactive =
    params.reason === "inactive";

  const information =
    getSectionInformation(
      params.section,
    );

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12 text-slate-900">
      <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
          <Lock className="h-8 w-8" strokeWidth={2} aria-hidden="true" />
        </div>

        <h1 className="mt-6 text-3xl font-bold">
          {isInactive
            ? "Hisob faol emas"
            : information.title}
        </h1>

        <p className="mt-4 leading-7 text-slate-600">
          {isInactive
            ? "Hisobingiz administrator tomonidan vaqtinça bloklangan. Saytdan foydalaniş uçun administrator bilan boğlaning."
            : information.description}
        </p>

        {!isInactive && (
          <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-left">
            <p className="font-semibold text-blue-900">
              Qanday ruxsat olinadi?
            </p>

            <p className="mt-2 text-sm leading-6 text-blue-700">
              Administrator
              foydalanuvçilar bölimidan
              hisobingizga uşbu bölim
              uçun ruxsat beradi. Ruxsat
              berilgaç, sahifani qayta
              oçişingiz mumkin.
            </p>
          </div>
        )}

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="rounded-xl bg-mb-brand px-6 py-3 font-semibold text-white transition hover:bg-mb-brandDark"
          >
            Boş sahifaga qaytiş
          </Link>

          {!isInactive && (
            <Link
              href="/textbooks"
              className="rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Darslik yeçimlari
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}