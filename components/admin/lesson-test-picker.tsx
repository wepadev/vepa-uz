"use client";

import { useMemo, useState } from "react";

import type { LessonTestOption } from "@/lib/lesson-test-options";

/*
 * Videodarsga test tanlash.
 *
 * Testlar mavzu bo'yicha guruhlangan: sarlavhada bo'lim va mavzu,
 * ostida "1-test", "2-test". Qidiruv mavzu nomi bo'yicha ham
 * ishlaydi. Yashirilgan qatorlar sahifadan olib tashlanmaydi, faqat
 * ko'rinmaydi — belgilangan test formada baribir yuboriladi.
 */

type Props = {
  tests: LessonTestOption[];
  defaultSelected?: number[];
};

function normalize(value: string) {
  return value
    .toLocaleLowerCase("uz")
    .replace(/[ʻʼ'‘’`]/g, "")
    .replace(/ö/g, "o")
    .replace(/ğ/g, "g")
    .replace(/ş/g, "sh")
    .replace(/ç/g, "ch");
}

export default function LessonTestPicker({
  tests,
  defaultSelected = [],
}: Props) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(defaultSelected),
  );

  const groups = useMemo(() => {
    const result: Array<{ title: string; tests: LessonTestOption[] }> = [];

    for (const test of tests) {
      const last = result[result.length - 1];
      if (last && last.title === test.group) {
        last.tests.push(test);
      } else {
        result.push({ title: test.group, tests: [test] });
      }
    }

    return result;
  }, [tests]);

  const needle = normalize(query.trim());

  const selectedTests = tests.filter((test) => selected.has(test.id));

  function toggle(id: number, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  if (tests.length === 0) {
    return (
      <div className="mt-2 rounded-xl border border-slate-300 p-3 text-sm text-slate-500">
        Test topilmadi.
      </div>
    );
  }

  return (
    <div className="mt-2">
      {selectedTests.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {selectedTests.map((test) => (
            <li
              key={test.id}
              className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700"
            >
              {test.label}
            </li>
          ))}
        </ul>
      )}

      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Mavzu nomi böyiça qidiriş"
        aria-label="Testni mavzu böyiça qidiriş"
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />

      <div className="mt-2 max-h-80 overflow-y-auto rounded-xl border border-slate-300 p-2">
        {groups.map((group) => {
          const groupMatches = !needle || normalize(group.title).includes(needle);
          const visible = group.tests.filter(
            (test) =>
              groupMatches || normalize(test.label).includes(needle),
          );

          return (
            <fieldset
              key={group.title}
              className={visible.length === 0 ? "hidden" : "mb-2 last:mb-0"}
            >
              <legend className="px-2 pt-1 text-xs font-bold text-slate-600">
                {group.title}
              </legend>

              <div className="mt-1 flex flex-wrap gap-1">
                {group.tests.map((test) => {
                  const isVisible = visible.includes(test);

                  return (
                    <label
                      key={test.id}
                      title={test.label}
                      className={`${isVisible ? "flex" : "hidden"} cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm hover:bg-slate-50`}
                    >
                      <input
                        type="checkbox"
                        name="testIds"
                        value={test.id}
                        checked={selected.has(test.id)}
                        onChange={(event) =>
                          toggle(test.id, event.target.checked)
                        }
                        className="h-4 w-4 accent-blue-600"
                      />
                      {test.title}
                      {!test.isPublished && (
                        <span className="text-xs text-slate-400">(yopiq)</span>
                      )}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </div>
    </div>
  );
}
