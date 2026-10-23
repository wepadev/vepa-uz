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
        "Onlayn testlardan foydalanish uchun administrator ruxsati kerak.",
    };
  }

  if (section === "lessons") {
    return {
      title: "Darslarga ruxsat kerak",
      description:
        "Videodarslar va nazariy materiallardan foydalanish uchun administrator ruxsati kerak.",
    };
  }

  if (section === "textbooks") {
    return {
      title:
        "Darslik yechimlariga ruxsat kerak",
      description:
        "Darslik yechimlaridan foydalanish uchun administrator ruxsati kerak.",
    };
  }

  return {
    title: "Bu bo‘limga ruxsat kerak",
    description:
      "Mazkur bo‘limdan foydalanish uchun administrator ruxsati talab qilinadi.",
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
      <section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-3xl">
          🔒
        </div>

        <h1 className="mt-6 text-3xl font-bold">
          {isInactive
            ? "Hisob faol emas"
            : information.title}
        </h1>

        <p className="mt-4 leading-7 text-slate-600">
          {isInactive
            ? "Hisobingiz administrator tomonidan vaqtincha bloklangan. Saytdan foydalanish uchun administrator bilan bog‘laning."
            : information.description}
        </p>

        {!isInactive && (
          <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-left">
            <p className="font-semibold text-blue-900">
              Qanday ruxsat olinadi?
            </p>

            <p className="mt-2 text-sm leading-6 text-blue-700">
              Administrator
              foydalanuvchilar bo‘limidan
              hisobingizga ushbu bo‘lim
              uchun ruxsat beradi. Ruxsat
              berilgach, sahifani qayta
              ochishingiz mumkin.
            </p>
          </div>
        )}

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700"
          >
            Bosh sahifaga qaytish
          </Link>

          {!isInactive && (
            <Link
              href="/textbooks"
              className="rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Darslik yechimlari
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}