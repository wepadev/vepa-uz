import Link from "next/link";

type PageProps = {
  searchParams: Promise<{
    section?: string | string[];
  }>;
};

const sectionContent = {
  tests: {
    label: "Testlar",
    title: "Testlarga kiriş yopiq",
    description:
      "Sizning akkauntingiz uçun umumiy testlar bölimiga kiriş ruxsati hozirça yoqilmagan.",
  },
  lessons: {
    label: "Videodarslar",
    title: "Videodarslarga kiriş yopiq",
    description:
      "Sizning akkauntingiz uçun videodarslar va ularga biriktirilgan testlarga kiriş ruxsati hozirça yoqilmagan.",
  },
  textbooks: {
    label: "Darslik yeçimlari",
    title: "Darslik yeçimlariga kiriş yopiq",
    description:
      "Sizning akkauntingiz uçun maktab va maşhur darslik yeçimlariga kiriş ruxsati hozirça yoqilmagan.",
  },
} as const;

export default async function AccessDeniedPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;

  const rawSection = Array.isArray(
    params.section,
  )
    ? params.section[0]
    : params.section;

  const section =
    rawSection === "tests" ||
    rawSection === "lessons" ||
    rawSection === "textbooks"
      ? rawSection
      : "tests";

  const content =
    sectionContent[section];

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4 py-10 text-slate-900">
      <section className="w-full max-w-xl rounded-3xl border border-amber-200 bg-white p-6 text-center shadow-xl shadow-slate-200/60 sm:p-9">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-amber-100 text-2xl font-bold text-amber-700">
          !
        </div>

        <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-amber-600">
          {content.label}
        </p>

        <h1 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">
          {content.title}
        </h1>

        <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-slate-600 sm:text-base">
          {content.description}
        </p>

        <div className="mt-7 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-800">
          Kiriş ruxsatini platforma administratori
          yoqadi. Ruxsat berilgaç, sahifani qayta
          oçişingiz mumkin.
        </div>

        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <Link
            href="/"
            className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700"
          >
            Boş sahifaga qaytiş
          </Link>

          <Link
            href="/profile"
            className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-700 hover:bg-slate-50"
          >
            Profilni oçiş
          </Link>
        </div>
      </section>
    </main>
  );
}
