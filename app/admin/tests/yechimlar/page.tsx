import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import ConfirmSubmitButton from "@/components/admin/confirm-submit-button";
import MathText from "@/components/math-text";
import PageHeader, { headerButton } from "@/components/ui/page-header";
import SubmitButton from "@/components/ui/submit-button";
import { requireAdmin } from "@/lib/require-admin";
import {
  loadSolutionFile,
  loadSolutionFiles,
  matchTopics,
  previewTopic,
  publishTopic,
  unpublishTopic,
  type TestPreview,
} from "@/lib/yechimlar-server";
import type { MatchedQuestion } from "@/lib/yechimlar";

export const dynamic = "force-dynamic";

/*
 * Yozma yeçimlarni nashr qiliş.
 *
 * Yeçimlar repodagi `content/yechimlar/NN.md` fayllarida. Bu sahifa
 * har bir faylni bazadagi mavzuga bog'laydi, savollarni tartib
 * böyiça juftlaydi va kalit harfini tekşiradi. "Nashr qiliş"
 * bosilgandagina yeçim bazaga yoziladi — öquvçi uni test natijasi
 * sahifasida köradi.
 */

type PageProps = {
  searchParams: Promise<{
    mavzu?: string;
    natija?: string;
  }>;
};

function revalidateSolutions() {
  revalidatePath("/admin/tests/yechimlar");
  revalidatePath("/admin/tests/manage");
  revalidatePath("/results/view");
  revalidatePath("/admin/results/view");
}

async function prepare(topic: number) {
  const supabase = await requireAdmin();
  const file = await loadSolutionFile(topic);

  if (!file) throw new Error(`${topic}-mavzu yeçim fayli topilmadi.`);

  const match = (await matchTopics(supabase, [file])).get(topic);

  if (!match) throw new Error(`${topic}-mavzu bazada topilmadi.`);

  const previews = await previewTopic(supabase, match.id, file);

  return { supabase, previews };
}

async function publishAction(formData: FormData) {
  "use server";

  const topic = Number(formData.get("topic"));
  const { supabase, previews } = await prepare(topic);
  const count = await publishTopic(supabase, previews);

  revalidateSolutions();
  redirect(`/admin/tests/yechimlar?mavzu=${topic}&natija=nashr-${count}`);
}

async function unpublishAction(formData: FormData) {
  "use server";

  const topic = Number(formData.get("topic"));
  const { supabase, previews } = await prepare(topic);

  await unpublishTopic(supabase, previews);

  revalidateSolutions();
  redirect(`/admin/tests/yechimlar?mavzu=${topic}&natija=ocirildi`);
}

/** Bölim (masalan 1-37) böyiça hammasini birdan nashr qiliş */
async function publishRangeAction(formData: FormData) {
  "use server";

  const from = Number(formData.get("from"));
  const to = Number(formData.get("to"));
  const supabase = await requireAdmin();
  const files = (await loadSolutionFiles()).filter(
    (file) => file.topic >= from && file.topic <= to,
  );
  const matches = await matchTopics(supabase, files);
  let count = 0;

  for (const file of files) {
    const match = matches.get(file.topic);

    if (!match) continue;

    count += await publishTopic(supabase, await previewTopic(supabase, match.id, file));
  }

  revalidateSolutions();
  redirect(`/admin/tests/yechimlar?natija=nashr-${count}`);
}

const RANGES = [
  { from: 1, to: 37, label: "1-qism (1-37)" },
  { from: 38, to: 65, label: "2-qism (38-65)" },
  { from: 66, to: 89, label: "3-qism (66-89)" },
];

const STATUS: Record<MatchedQuestion["status"], { label: string; className: string }> = {
  new: { label: "Yangi", className: "bg-blue-50 text-blue-700" },
  same: { label: "Nashr qilingan", className: "bg-emerald-50 text-emerald-700" },
  changed: { label: "Özgargan", className: "bg-amber-50 text-amber-700" },
  "wrong-answer": { label: "Kalit mos emas", className: "bg-red-50 text-red-700" },
  missing: { label: "Yeçim yöq", className: "bg-slate-100 text-slate-600" },
};

function countStatuses(previews: TestPreview[]) {
  const counts: Record<MatchedQuestion["status"], number> = {
    new: 0,
    same: 0,
    changed: 0,
    "wrong-answer": 0,
    missing: 0,
  };

  for (const test of previews) {
    for (const question of test.questions) counts[question.status] += 1;
  }

  return counts;
}

function Notice({ value }: { value?: string }) {
  if (!value) return null;

  const published = value.match(/^nashr-(\d+)$/);
  const text = published
    ? Number(published[1]) > 0
      ? `${published[1]} ta yeçim nashr qilindi.`
      : "Yangi yoki özgargan yeçim yöq edi — hammasi allaqaçon nashr qilingan."
    : value === "ocirildi"
      ? "Bu mavzudagi yeçimlar saytdan olib taşlandi."
      : null;

  if (!text) return null;

  return (
    <p className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
      {text}
    </p>
  );
}

async function TopicDetail({ topic, notice }: { topic: number; notice?: string }) {
  const supabase = await requireAdmin();
  const file = await loadSolutionFile(topic);

  if (!file) {
    return <p className="text-sm text-slate-600">{topic}-mavzu yeçim fayli topilmadi.</p>;
  }

  const match = (await matchTopics(supabase, [file])).get(topic);

  if (!match) {
    return (
      <p className="text-sm text-slate-600">
        «{file.title}» mavzusi bazada topilmadi. Mavzu nomini tekşiring.
      </p>
    );
  }

  const previews = await previewTopic(supabase, match.id, file);
  const counts = countStatuses(previews);
  const pending = counts.new + counts.changed;

  return (
    <div>
      <Notice value={notice} />

      <div className="rounded-2xl border border-mb-line bg-white p-5">
        <p className="text-sm text-slate-500">
          Fayl: {file.topic}. {file.title}
        </p>
        <p className="mt-1 text-lg font-bold">
          Bazada: {match.sectionTitle} → {match.title}
          {match.by === "order" && (
            <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 align-middle text-xs font-semibold text-amber-700">
              tartib raqami böyiça topildi — tekşiring
            </span>
          )}
        </p>

        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
          {(Object.keys(STATUS) as MatchedQuestion["status"][]).map((status) =>
            counts[status] > 0 ? (
              <span key={status} className={`rounded-full px-2.5 py-1 ${STATUS[status].className}`}>
                {STATUS[status].label}: {counts[status]}
              </span>
            ) : null,
          )}
        </div>

        {file.errors.length > 0 && (
          <ul className="mt-3 list-disc pl-5 text-sm text-red-700">
            {file.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <form action={publishAction}>
            <input type="hidden" name="topic" value={topic} />
            <SubmitButton
              disabled={pending === 0}
              pendingLabel="Nashr qilinyapti…"
              className="press inline-flex min-h-10 items-center rounded-xl bg-mb-brand px-4 text-sm font-bold text-white disabled:opacity-50"
            >
              {pending > 0 ? `Nashr qiliş (${pending} ta)` : "Hammasi nashr qilingan"}
            </SubmitButton>
          </form>

          {counts.same + counts.changed > 0 && (
            <form action={unpublishAction}>
              <input type="hidden" name="topic" value={topic} />
              <ConfirmSubmitButton
                title="Yeçimlarni olib taşlaysizmi?"
                description="Bu mavzudagi hamma test savollarining yozma yeçimi saytdan olib taşlanadi. Keyin qayta nashr qiliş mumkin."
                confirmLabel="Olib taşlaş"
                className="inline-flex min-h-10 items-center rounded-xl border border-red-200 px-4 text-sm font-semibold text-red-700 hover:bg-red-50"
              >
                Saytdan olib taşlaş
              </ConfirmSubmitButton>
            </form>
          )}
        </div>
      </div>

      {previews.length === 0 && (
        <p className="mt-6 text-sm text-slate-600">Bu mavzuda hali test yöq.</p>
      )}

      {previews.map((test) => (
        <section key={test.testId} className="mt-8">
          <h2 className="text-lg font-bold">
            {test.title}
            <Link
              href={`/admin/tests/manage?testId=${test.testId}`}
              className="ml-3 text-sm font-semibold text-mb-brand hover:underline"
            >
              Testni oçiş
            </Link>
          </h2>

          {test.noFile && (
            <p className="mt-2 text-sm text-red-700">
              Faylda {test.fileTest}-test uçun yeçim yöq.
            </p>
          )}

          <ol className="mt-3 space-y-3">
            {test.questions.map((question) => (
              <li
                key={question.questionId}
                className="rounded-xl border border-mb-line bg-white p-4"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-bold">{question.number}-savol</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS[question.status].className}`}
                  >
                    {STATUS[question.status].label}
                  </span>
                  {question.status === "wrong-answer" && (
                    <span className="text-xs text-red-700">
                      faylda {question.fileAnswer}, bazada {question.dbAnswer ?? "—"}
                    </span>
                  )}
                </div>

                {question.text && <MathText content={question.text} />}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

async function TopicList({ notice }: { notice?: string }) {
  const supabase = await requireAdmin();
  const files = await loadSolutionFiles();
  const matches = await matchTopics(supabase, files);

  if (files.length === 0) {
    return <p className="text-sm text-slate-600">Hali yeçim fayllari yöq.</p>;
  }

  return (
    <div>
      <Notice value={notice} />

      <div className="mb-6 rounded-2xl border border-mb-line bg-white p-5">
        <p className="text-sm text-slate-600">
          Mavzuni oçib, yeçimlarni körib çiqing va «Nashr qiliş»ni bosing. Yoki bölimni
          birdan nashr qiling — kaliti mos kelmagan savollarga tegilmaydi.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {RANGES.map((range) => (
            <form key={range.from} action={publishRangeAction}>
              <input type="hidden" name="from" value={range.from} />
              <input type="hidden" name="to" value={range.to} />
              <ConfirmSubmitButton
                title={`${range.label} nashr qilinsinmi?`}
                description="Bu mavzulardagi hamma yangi va özgargan yeçimlar saytga çiqadi. Öquvçilar ularni test natijasida köradi."
                confirmLabel="Nashr qiliş"
                className={headerButton}
              >
                {range.label} — nashr qiliş
              </ConfirmSubmitButton>
            </form>
          ))}
        </div>
      </div>

      <ul className="divide-y divide-mb-line rounded-2xl border border-mb-line bg-white">
        {files.map((file) => {
          const match = matches.get(file.topic);
          const total = [...file.tests.values()].reduce((sum, items) => sum + items.length, 0);

          return (
            <li key={file.topic}>
              <Link
                href={`/admin/tests/yechimlar?mavzu=${file.topic}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50"
              >
                <span className="w-8 shrink-0 text-right text-sm font-bold text-slate-500">
                  {file.topic}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{file.title}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {match ? `${match.sectionTitle} → ${match.title}` : "Bazada topilmadi"}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-slate-500">{total} ta yeçim</span>
                {file.errors.length > 0 && (
                  <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                    xato
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default async function SolutionsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const topic = Number(params.mavzu);
  const hasTopic = Number.isInteger(topic) && topic > 0;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <PageHeader
        sticky={false}
        backHref={hasTopic ? "/admin/tests/yechimlar" : "/admin/tests"}
        backLabel={hasTopic ? "Yeçimlar" : "Testlar"}
        title={hasTopic ? `${topic}-mavzu yeçimlari` : "Yozma yeçimlar"}
        subtitle="Öquvçi testni tugatgaç, har savolning yozma yeçimini natija sahifasida köradi."
        width="5xl"
      />

      <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {hasTopic ? (
          <TopicDetail topic={topic} notice={params.natija} />
        ) : (
          <TopicList notice={params.natija} />
        )}
      </section>
    </main>
  );
}
