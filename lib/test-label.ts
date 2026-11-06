/*
 * Test nomi va uning mavzusi.
 *
 * Testlar mavzu ichida "1-test", "2-test" deb nomlanadi. Mavzudan
 * tashqarida (videodars, natijalar, test sahifasi) faqat "1-test"
 * deyilsa qaysi mavzuniki ekani bilinmaydi — shuning uchun mavzu
 * nomi oldiga qo'shiladi: "Oddiy kasrlar (1-qism) · 1-test".
 */

type TopicRef = { title: string | null } | null;

/** `tests` dan `test_topics(title)` bilan o'qilgan qator */
export type TestWithTopic = {
  title: string;
  test_topics?: TopicRef | TopicRef[];
};

/** Supabase select'ida mavzuni olib kelish uchun */
export const TEST_TOPIC_SELECT = "test_topics(title)";

export function topicTitleOf(test: TestWithTopic | null | undefined) {
  const topic = test?.test_topics;
  const row = Array.isArray(topic) ? topic[0] : topic;
  return row?.title?.trim() || null;
}

export function testLabel(test: TestWithTopic | null | undefined) {
  if (!test) return "";

  const topicTitle = topicTitleOf(test);
  if (!topicTitle) return test.title;

  /* Eski nomlar mavzu nomini o'zi ichiga olgan bo'lishi mumkin */
  if (test.title.includes(topicTitle)) return test.title;

  return `${topicTitle} · ${test.title}`;
}
