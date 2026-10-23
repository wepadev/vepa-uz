/**
 * Baza qoidalarini sinash.
 *
 * Uy vazifasi mantiqi bazada yozilgan: bir marta ishlash, muddat,
 * guruh a'zoligi. Bularni sayt tomonidan sinab bo'lmaydi — shuning
 * uchun bu yerda haqiqiy PostgreSQL ishga tushiriladi (PGlite —
 * brauzer/Node uchun mo'ljallangan to'liq Postgres).
 *
 * Ishga tushirish:
 *   npm run test:sql
 *
 * PGlite o'rnatilmagan bo'lsa, skript nima qilish kerakligini aytadi
 * va xatosiz to'xtaydi — u majburiy bog'liqlik emas.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DB_DIR = join(process.cwd(), "db");

let PGlite;

try {
  ({ PGlite } = await import("@electric-sql/pglite"));
} catch {
  console.log(
    "\n  PGlite o'rnatilmagan — baza testlari o'tkazib yuborildi.\n" +
      "  O'rnatish uchun:  npm i -D @electric-sql/pglite\n",
  );
  process.exit(0);
}

let passed = 0;
let failed = 0;

const ok = (m) => {
  passed += 1;
  console.log(`  \x1b[32m✓\x1b[0m ${m}`);
};

const bad = (m) => {
  failed += 1;
  console.log(`  \x1b[31m✗ ${m}\x1b[0m`);
};

const TEACHER = "11111111-1111-1111-1111-111111111111";
const ALI = "22222222-2222-2222-2222-222222222222";
const VALI = "33333333-3333-3333-3333-333333333333";

const db = await PGlite.create();

/* Supabase muhitini taqlid qilamiz */
await db.exec(`
  create schema if not exists auth;
  create table auth.users (id uuid primary key, email text);
  create or replace function auth.uid() returns uuid
  language sql stable as $$
    select nullif(current_setting('test.uid', true), '')::uuid
  $$;
  create role anon; create role authenticated;

  create table public.profiles (
    id uuid primary key references auth.users(id),
    full_name text, role text not null default 'student',
    is_active boolean not null default true);

  create table public.test_exam_types (
    id bigint generated always as identity primary key,
    code text, title text, is_published boolean default true);

  create table public.test_sections (
    id bigint generated always as identity primary key,
    exam_type_id bigint references public.test_exam_types(id),
    title text, order_number integer default 1,
    is_published boolean default true);

  create table public.tests (
    id bigint generated always as identity primary key,
    section_id bigint references public.test_sections(id),
    title text not null, time_limit_minutes integer default 30,
    order_number integer default 1,
    is_published boolean default true,
    created_at timestamptz default now());

  create table public.lessons (
    id bigint generated always as identity primary key,
    test_id bigint);

  create table public.question_blocks (
    id bigint generated always as identity primary key,
    test_id bigint, stimulus_text text, image_path text,
    option_a text, option_b text, option_c text, option_d text);

  create table public.questions (
    id bigint generated always as identity primary key,
    test_id bigint not null references public.tests(id),
    question_text text, image_path text,
    option_a text, option_b text, option_c text, option_d text,
    question_type text default 'multiple_choice',
    block_id bigint references public.question_blocks(id),
    part_label text);

  create table public.answer_keys (
    question_id bigint primary key references public.questions(id),
    correct_answer text, accepted_answers text[],
    solution_text text, solution_video_url text);

  create table public.user_answers (
    id bigint generated always as identity primary key,
    attempt_id uuid, question_id bigint references public.questions(id),
    selected_answer text, is_correct boolean);

  create table public.attempts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id),
    test_id bigint not null references public.tests(id),
    percentage numeric default 0,
    started_at timestamptz not null default now(),
    completed_at timestamptz);

  create table public.test_sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id),
    test_id bigint not null references public.tests(id),
    started_at timestamptz not null default now(),
    expires_at timestamptz not null,
    submitted_at timestamptz);

  grant usage on schema public to authenticated;
  grant select, insert, update, delete on all tables in schema public to authenticated;
`);

for (const [id, name, role] of [
  [TEACHER, "Vepa Ustoz", "admin"],
  [ALI, "Ali", "student"],
  [VALI, "Vali", "student"],
]) {
  await db.exec(
    `insert into auth.users (id, email) values ('${id}', '${name.toLowerCase().replace(/\s+/g, ".")}@example.com')`,
  );
  await db.exec(
    `insert into public.profiles (id, full_name, role) values ('${id}', '${name}', '${role}')`,
  );
}

await db.exec(`
  insert into public.test_exam_types (code, title, is_published)
  values ('guruh-testlari', 'Guruhlar uchun maxsus testlar', false),
         ('attestatsiya',   'Attestatsiya',                  true);

  insert into public.test_sections (exam_type_id, title) values (1, 'Toq kunlar'), (2, '1-bo''lim');

  insert into public.tests (section_id, title) values (1, 'Uy vazifasi 1'), (2, 'Katalog testi');
`);

console.log("\n\x1b[1mMigratsiyalar\x1b[0m");

for (const file of ["01-uy-vazifasi.sql", "02-vazifa-berish.sql"]) {
  try {
    await db.exec(readFileSync(join(DB_DIR, file), "utf8"));
    ok(file);
  } catch (error) {
    bad(`${file}: ${error.message}`);
    process.exit(1);
  }
}

/* Guruh, a'zo va vazifa tayyorlaymiz */
await db.exec(`set test.uid = '${TEACHER}'`);

const groupId = (
  await db.query(`select id from public.create_study_group('7-A sinf')`)
).rows[0].id;

await db.exec(`
  insert into public.study_group_members (group_id, user_id)
  values (${groupId}, '${ALI}');

  insert into public.assignments (group_id, test_id, due_at)
  select ${groupId}, id, now() + interval '2 days' from public.tests limit 1;
`);

const assignmentId = (
  await db.query(`select id from public.assignments limit 1`)
).rows[0].id;

async function asUser(uid, sql, params = []) {
  await db.exec("begin");
  await db.exec("set local role authenticated");
  await db.exec(`set local test.uid = '${uid}'`);

  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("rollback");
  }
}

console.log("\n\x1b[1mUy vazifasi qoidalari\x1b[0m");

/* 1. A'zo vazifani ocha oladi */
{
  const r = await asUser(ALI, `select public.assignment_access($1) v`, [assignmentId]);
  if (r.rows[0].v === "ok") {
    ok("guruh a'zosi vazifani ocha oladi");
  } else {
    bad(`kutilgan 'ok', olingan '${r.rows[0].v}'`);
  }
}

/* 2. Begona o'quvchi ocha olmaydi */
{
  const r = await asUser(VALI, `select public.assignment_access($1) v`, [assignmentId]);
  if (r.rows[0].v === "not_member") {
    ok("guruhda bo'lmagan o'quvchi ocha olmaydi");
  } else {
    bad(`kutilgan 'not_member', olingan '${r.rows[0].v}'`);
  }
}

/* 3. Bir marta ishlash qoidasi */
{
  await db.exec(`
    insert into public.attempts (user_id, test_id, percentage, completed_at, assignment_id)
    select '${ALI}', id, 80, now(), ${assignmentId} from public.tests limit 1
  `);

  const r = await asUser(ALI, `select public.assignment_access($1) v`, [assignmentId]);
  if (r.rows[0].v === "done") {
    ok("ishlangan vazifa ikkinchi marta ochilmaydi");
  } else {
    bad(`kutilgan 'done', olingan '${r.rows[0].v}'`);
  }
}

/* 4. Bazaning o'zi ikkinchi urinishni to'sadi */
{
  try {
    await db.exec(`
      insert into public.attempts (user_id, test_id, percentage, assignment_id)
      select '${ALI}', id, 90, ${assignmentId} from public.tests limit 1
    `);
    bad("bitta vazifaga ikkita urinish yozildi!");
  } catch {
    ok("baza ikkinchi urinishni to'sdi");
  }
}

/* 5. Muddat tugagach yopiladi */
{
  await db.exec(`update public.assignments set due_at = now() - interval '1 hour'`);

  const r = await asUser(VALI, `select public.assignment_access($1) v`, [assignmentId]);
  if (r.rows[0].v !== "ok") {
    ok("muddati o'tgan vazifa ochilmaydi");
  } else {
    bad("muddat o'tgan bo'lsa ham ochildi");
  }

  await db.exec(`update public.assignments set due_at = now() + interval '2 days'`);
}

console.log("\n\x1b[1mGuruhni o'chirish\x1b[0m");

/* 6. Guruh o'chsa natijalar qolishi kerak */
{
  await db.exec(`delete from public.study_groups where id = ${groupId}`);

  const attempts = (
    await db.query(`select count(*)::int c, count(assignment_id)::int linked from public.attempts`)
  ).rows[0];

  if (attempts.c === 1) {
    ok("o'quvchining natijasi saqlanib qoldi");
  } else {
    bad(`urinishlar soni: ${attempts.c}`);
  }

  if (attempts.linked === 0) {
    ok("urinish vazifadan uzildi");
  } else {
    bad("urinish hamon vazifaga bog'liq");
  }

  const rest = (
    await db.query(`
      select
        (select count(*)::int from public.assignments) a,
        (select count(*)::int from public.study_group_members) m
    `)
  ).rows[0];

  if (rest.a === 0 && rest.m === 0) {
    ok("vazifa va a'zolik yozuvlari tozalandi");
  } else {
    bad(`qoldi: ${rest.a} vazifa, ${rest.m} a'zolik`);
  }
}

/* ===================================================================
 * Javob qoralamasi (db/14)
 *
 * O'quvchi test ishlab turganda telefoni o'chib qolsa javoblari
 * yo'qolmasligi kerak. Bu yerda tekshiriladi: javob saqlanadimi,
 * begona odam ko'ra oladimi, test yuborilgach tozalanadimi.
 * =================================================================== */
console.log("\n\x1b[1mJavob qoralamasi\x1b[0m");

try {
  await db.exec(readFileSync(join(DB_DIR, "14-javob-qoralamasi.sql"), "utf8"));
  ok("14-javob-qoralamasi.sql");
} catch (error) {
  bad(`14-javob-qoralamasi.sql: ${error.message}`);
}

{
  /* Qoralamalar tranzaksiyadan keyin ham qolishi kerak, shuning
     uchun asUser() emas — uid ni to'g'ridan-to'g'ri o'rnatamiz */
  const as = async (uid, sql, params = []) => {
    await db.exec(`set test.uid = '${uid}'`);
    return db.query(sql, params);
  };

  const sessionId = (
    await db.query(
      `insert into public.test_sessions (user_id, test_id, expires_at)
       select $1, id, now() + interval '30 minutes' from public.tests limit 1
       returning id::text as id`,
      [ALI],
    )
  ).rows[0].id;

  const drafts = async (uid, id = sessionId) =>
    (await as(uid, `select * from public.load_answer_drafts($1)`, [id])).rows;

  await as(ALI, `select public.save_answer_draft($1, 1, 'B')`, [sessionId]);
  await as(ALI, `select public.save_answer_draft($1, 1, 'C')`, [sessionId]);

  let rows = await drafts(ALI);

  if (rows.length === 1 && rows[0].answer === "C") {
    ok("javob saqlandi, qayta belgilanganda almashdi");
  } else {
    bad(`kutilgan bitta 'C', olingan ${JSON.stringify(rows)}`);
  }

  await as(VALI, `select public.save_answer_draft($1, 2, 'A')`, [sessionId]);

  if ((await drafts(ALI)).length === 1) {
    ok("begona o'quvchi qoralama yoza olmadi");
  } else {
    bad("begona yozuv o'tib ketdi");
  }

  if ((await drafts(VALI)).length === 0) {
    ok("begona o'quvchi qoralamani o'qiy olmadi");
  } else {
    bad("begona qoralamani ko'rdi");
  }

  await as(ALI, `select public.save_answer_draft($1, 2, $2)`, [
    sessionId,
    "x".repeat(2000),
  ]);

  const long = (await drafts(ALI)).find((r) => Number(r.question_id) === 2);

  if (long?.answer.length === 500) {
    ok("juda uzun javob 500 belgigacha kesildi");
  } else {
    bad(`uzunlik: ${long?.answer.length}`);
  }

  await db.query(
    `update public.test_sessions set submitted_at = now() where id::text = $1`,
    [sessionId],
  );

  if ((await drafts(ALI)).length === 0) {
    ok("test yuborilgach qoralamalar o'chdi");
  } else {
    bad("yuborilgandan keyin ham qoldi");
  }

  await as(ALI, `select public.save_answer_draft($1, 3, 'D')`, [sessionId]);

  if ((await drafts(ALI)).length === 0) {
    ok("yopilgan sessiyaga yangi qoralama yozilmadi");
  } else {
    bad("yopilgan sessiyaga yozildi");
  }

  const expired = (
    await db.query(
      `insert into public.test_sessions (user_id, test_id, expires_at)
       select $1, id, now() - interval '1 minute' from public.tests limit 1
       returning id::text as id`,
      [ALI],
    )
  ).rows[0].id;

  await as(ALI, `select public.save_answer_draft($1, 4, 'A')`, [expired]);

  if ((await drafts(ALI, expired)).length === 0) {
    ok("muddati o'tgan sessiyaga yozilmadi");
  } else {
    bad("muddat o'tgan bo'lsa ham yozildi");
  }

  await db.exec(`set test.uid = ''`);
}

/* ===================================================================
 * Xatolarni takrorlash (db/15)
 *
 * Xato qilingan savol oraliq bilan qaytishi, to'g'ri yechilganda
 * oraliq uzayishi va begona o'quvchining aralasha olmasligi
 * tekshiriladi.
 * =================================================================== */
console.log("\n\x1b[1mXatolarni takrorlash\x1b[0m");

try {
  await db.exec(readFileSync(join(DB_DIR, "15-takrorlash.sql"), "utf8"));
  await db.exec(
    readFileSync(join(DB_DIR, "23-haftalik-takrorlash.sql"), "utf8"),
  );
  ok("15-takrorlash.sql + 23-haftalik-takrorlash.sql");
} catch (error) {
  bad(`15-takrorlash.sql: ${error.message}`);
}

{
  const as = async (uid, sql, params = []) => {
    await db.exec(`set test.uid = '${uid}'`);
    return db.query(sql, params);
  };

  await db.exec(`
    insert into public.questions (test_id, question_text, option_a, option_b, option_c, option_d)
    select id, '2+2=?', '3', '4', '5', '6' from public.tests limit 1;

    insert into public.questions (test_id, question_text, question_type)
    select id, 'Ildiz 9 = ?', 'written' from public.tests limit 1;

    insert into public.answer_keys (question_id, correct_answer, accepted_answers, solution_text)
    values
      ((select min(id) from public.questions), 'B', null, '2+2=4'),
      ((select max(id) from public.questions), '3', array['3.0'], 'Ildiz 9 = 3');
  `);

  const choiceId = (
    await db.query(`select min(id)::int id from public.questions`)
  ).rows[0].id;

  const writtenId = (
    await db.query(`select max(id)::int id from public.questions`)
  ).rows[0].id;

  /* Ali test ishladi: birinchisida xato, ikkinchisi javobsiz */
  const attemptId = (
    await db.query(
      `insert into public.attempts (user_id, test_id, completed_at)
       select $1, id, now() - interval '1 hour' from public.tests limit 1
       returning id`,
      [ALI],
    )
  ).rows[0].id;

  await db.query(
    `insert into public.user_answers (attempt_id, question_id, selected_answer, is_correct)
     values ($1, $2, 'A', false), ($1, $3, '', false)`,
    [attemptId, choiceId, writtenId],
  );

  let r = await as(ALI, `select public.collect_review_items() n`);

  if (r.rows[0].n === 2) {
    ok("xato va javobsiz savollar ro'yxatga tushdi");
  } else {
    bad(`kutilgan 2 ta, olingan ${r.rows[0].n}`);
  }

  r = await as(ALI, `select public.collect_review_items() n`);

  if (r.rows[0].n === 0) {
    ok("ikkinchi chaqiruvda takrorlanmadi");
  } else {
    bad(`yana ${r.rows[0].n} ta qo'shildi`);
  }

  r = await as(VALI, `select public.due_review_count() n`);

  if (r.rows[0].n === 0) {
    ok("begona o'quvchining ro'yxati bo'sh");
  } else {
    bad(`begonada ${r.rows[0].n} ta chiqdi`);
  }

  /*
   * Yig'ilgan savollar keyingi dushanbaga belgilanadi, ya'ni bugun
   * hali chiqmaydi — bu qoidaning o'zi. Quyidagi tekshiruvlar
   * "takrorlash kuni keldi" holatini sinaydi, shuning uchun
   * muddatni oldinga suramiz.
   */
  const notDueYet = await as(ALI, `select public.due_review_count() n`);

  if (notDueYet.rows[0].n === 0) {
    ok("xatolar darhol emas, keyingi haftaga belgilandi");
  } else {
    bad(`bugun ${notDueYet.rows[0].n} ta chiqdi`);
  }

  await db.query(
    `update public.review_items set due_at = now() where user_id = $1`,
    [ALI],
  );

  r = await as(ALI, `select * from public.due_review_questions(10)`);

  if (
    r.rows.length === 2 &&
    !Object.keys(r.rows[0]).includes("correct_answer")
  ) {
    ok("savollar keldi, to'g'ri javob yashirin qoldi");
  } else {
    bad(`${r.rows.length} ta, ustunlar: ${Object.keys(r.rows[0] ?? {})}`);
  }

  /* Muqobil javob va bosh harf farqi */
  r = await as(ALI, `select * from public.answer_review_item($1, ' 3.0 ')`, [
    writtenId,
  ]);

  if (r.rows[0]?.is_correct === true && r.rows[0]?.is_mastered === true) {
    ok("muqobil javob qabul qilindi va savol yopildi");
  } else {
    bad(JSON.stringify(r.rows[0]));
  }

  /*
   * Haftalik qoida.
   *
   * To'g'ri yechilsa savol butunlay yopiladi, xato bo'lsa keyingi
   * dushanbaga qoladi. Oraliqli bosqichlar (1-3-7-30) bekor qilindi.
   */
  await db.query(
    `update public.review_items set stage = 0, due_at = now() where question_id = $1`,
    [writtenId],
  );

  const wrongTry = await as(
    ALI,
    `select * from public.answer_review_item($1, 'xato')`,
    [writtenId],
  );

  const nextMonday = (
    await db.query(`select public.next_review_monday() d`)
  ).rows[0].d;

  if (
    wrongTry.rows[0].is_mastered === false &&
    new Date(wrongTry.rows[0].next_due_at).getTime() ===
      new Date(nextMonday).getTime()
  ) {
    ok("xato javob savolni keyingi dushanbaga qoldirdi");
  } else {
    bad(JSON.stringify(wrongTry.rows[0]));
  }

  /* Muddati kelmagani uchun bugun qaytmaydi */
  const notYet = await as(
    ALI,
    `select * from public.due_review_questions(10)`,
  );

  if (!notYet.rows.some((row) => Number(row.question_id) === writtenId)) {
    ok("keyingi haftagacha savol qayta chiqmadi");
  } else {
    bad("savol o'sha kuni yana chiqdi");
  }

  /* To'g'ri yechilsa butunlay yopiladi */
  await db.query(
    `update public.review_items set due_at = now() where question_id = $1`,
    [writtenId],
  );

  const rightTry = await as(
    ALI,
    `select * from public.answer_review_item($1, '3')`,
    [writtenId],
  );

  if (
    rightTry.rows[0].is_correct === true &&
    rightTry.rows[0].next_due_at === null &&
    rightTry.rows[0].is_mastered === true
  ) {
    ok("to'g'ri yechilgan savol butunlay yopildi");
  } else {
    bad(JSON.stringify(rightTry.rows[0]));
  }

  /* Yuqori bosqichda xato qilinsa boshidan */
  await db.query(
    `update public.review_items set stage = 3, due_at = now() where question_id = $1`,
    [choiceId],
  );

  r = await as(ALI, `select * from public.answer_review_item($1, 'Z')`, [
    choiceId,
  ]);

  if (
    r.rows[0]?.new_stage === 0 &&
    r.rows[0]?.solution_text === "2+2=4"
  ) {
    ok("xato qilinsa boshidan boshlandi, yechim ko'rsatildi");
  } else {
    bad(JSON.stringify(r.rows[0]));
  }

  /* Muddati kelmagan savolga javob berib bo'lmaydi */
  r = await as(ALI, `select * from public.answer_review_item($1, 'B')`, [
    choiceId,
  ]);

  if (r.rows.length === 0) {
    ok("muddati kelmagan savol javob qabul qilmadi");
  } else {
    bad("muddatidan oldin javob qabul qilindi");
  }

  /* Begona o'quvchi javob bera olmaydi */
  await db.query(
    `update public.review_items set stage = 0, due_at = now() where question_id = $1`,
    [choiceId],
  );

  r = await as(VALI, `select * from public.answer_review_item($1, 'B')`, [
    choiceId,
  ]);

  if (r.rows.length === 0) {
    ok("begona o'quvchi javob bera olmadi");
  } else {
    bad("begona o'quvchi javob berdi");
  }

  await db.exec(`set test.uid = ''`);
}

/* ===================================================================
 * Guruh hisoboti tafsiloti (db/16)
 *
 * Ota-onalar yig'ilishiga chiqariladigan varaq shu funksiyadan
 * to'ldiriladi. Eng nozik joyi: o'quvchi guruhga qo'shilishidan
 * oldin berilgan vazifalar unga yozilmasligi kerak.
 * =================================================================== */
console.log("\n\x1b[1mGuruh hisoboti tafsiloti\x1b[0m");

try {
  await db.exec(readFileSync(join(DB_DIR, "16-hisobot-tafsiloti.sql"), "utf8"));
  ok("16-hisobot-tafsiloti.sql");
} catch (error) {
  bad(`16-hisobot-tafsiloti.sql: ${error.message}`);
}

{
  const as = async (uid, sql, params = []) => {
    await db.exec(`set test.uid = '${uid}'`);
    return db.query(sql, params);
  };

  /* Oldingi bo'limda guruh o'chirilgan — yangisini yasaymiz */
  await db.exec(`set test.uid = '${TEACHER}'`);

  const gid = (
    await db.query(`select id from public.create_study_group('Hisobot guruhi')`)
  ).rows[0].id;

  /*
   * Ali eski a'zo, Vali keyinroq qo'shildi.
   * Birinchi vazifa Vali kelishidan oldin berilgan.
   */
  await db.query(
    `insert into public.study_group_members (group_id, user_id, joined_at)
     values ($1, $2, now() - interval '10 days'),
            ($1, $3, now() - interval '2 days')`,
    [gid, ALI, VALI],
  );

  await db.query(
    `insert into public.assignments (group_id, test_id, due_at, created_at)
     select $1, id, now() + interval '1 day', now() - interval '9 days'
     from public.tests limit 1`,
    [gid],
  );

  await db.exec(`insert into public.tests (title) values ('Ikkinchi test')`);

  await db.query(
    `insert into public.assignments (group_id, test_id, due_at, created_at)
     select $1, id, now() + interval '3 days', now() - interval '1 day'
     from public.tests order by id desc limit 1`,
    [gid],
  );

  const firstAssignment = (
    await db.query(
      `select id from public.assignments where group_id = $1 order by id asc limit 1`,
      [gid],
    )
  ).rows[0].id;

  /* Ali birinchi vazifani 80% ga ishladi */
  await db.query(
    `insert into public.attempts (user_id, test_id, percentage, completed_at, assignment_id)
     select $1, test_id, 80, now(), id from public.assignments where id = $2`,
    [ALI, firstAssignment],
  );

  let rows = (
    await as(TEACHER, `select * from public.group_report_details($1)`, [gid])
  ).rows;

  const aliRows = rows.filter((row) => row.user_id === ALI);
  const valiRows = rows.filter((row) => row.user_id === VALI);

  if (aliRows.length === 2) {
    ok("eski a'zoga ikkala vazifa ham yozildi");
  } else {
    bad(`Ali uchun ${aliRows.length} ta qator`);
  }

  if (valiRows.length === 1) {
    ok("keyin qo'shilgan o'quvchiga eski vazifa yozilmadi");
  } else {
    bad(`Vali uchun ${valiRows.length} ta qator`);
  }

  const aliDone = aliRows.find((row) => row.completed_at !== null);

  if (aliDone && Number(aliDone.percentage) === 80) {
    ok("ishlangan vazifaning foizi to'g'ri keldi");
  } else {
    bad(`olingan: ${JSON.stringify(aliDone)}`);
  }

  if (aliRows.some((row) => row.completed_at === null)) {
    ok("ishlanmagan vazifa bo'sh natija bilan qaytdi");
  } else {
    bad("ishlanmagan vazifa ko'rinmadi");
  }

  if (rows.every((row) => row.test_title)) {
    ok("test nomlari qo'shildi");
  } else {
    bad("test nomi bo'sh qatorlar bor");
  }

  /* O'qituvchi bo'lmagan odam hech narsa ko'rmasligi kerak */
  rows = (
    await as(ALI, `select * from public.group_report_details($1)`, [gid])
  ).rows;

  if (rows.length === 0) {
    ok("o'quvchi hisobotni ko'ra olmadi");
  } else {
    bad(`o'quvchiga ${rows.length} ta qator chiqdi`);
  }

  await db.exec(`set test.uid = ''`);
}

/* ===================================================================
 * Offline guruhlar CRM (db/17, db/18)
 *
 * Ball qoidaga ko'ra hisoblanishi, qoida o'zgarganda eski kunlar
 * qayta hisoblanmasligi va tanga hisobi to'g'ri yuritilishi
 * tekshiriladi.
 * =================================================================== */
console.log("\n\x1b[1mOffline guruhlar CRM\x1b[0m");

for (const file of [
  "17-crm.sql",
  "18-crm-dokon.sql",
  "19-sovga-ikonkasi.sql",
  "20-umumiy-hamyon.sql",
  "21-guruhlarni-birlashtirish.sql",
  "22-oquvchi-guruhi.sql",
  "24-bitta-kod.sql",
  "26-vazifa-balli.sql",
  "28-dars-testlari.sql",
  "29-dokon-guruh-uchun.sql",
  "30-tozalash.sql",
  "32-tanga-hisobi.sql",
]) {
  try {
    await db.exec(readFileSync(join(DB_DIR, file), "utf8"));
    ok(file);
  } catch (error) {
    bad(`${file}: ${error.message}`);
  }
}

{
  const as = async (uid, sql, params = []) => {
    await db.exec(`set test.uid = '${uid}'`);
    return db.query(sql, params);
  };

  /*
   * RLS tekshiruvi.
   *
   * Yuqoridagi `as()` jadval egasi nomidan ishlaydi va RLS ni
   * chetlab o'tadi. Shu sababli siyosatni alohida, `authenticated`
   * roli bilan sinaymiz — sayt aynan shu rol ostida ishlaydi.
   *
   * Bu tekshiruv ataylab qo'shildi: siyosat yozilmaganda guruh
   * yaratib bo'lmasligi ishlab chiqarishda ma'lum bo'lgan edi.
   */
  const asRole = async (uid, sql, params = []) => {
    await db.exec("begin");
    await db.exec("set local role authenticated");
    await db.exec(`set local test.uid = '${uid}'`);

    try {
      return await db.query(sql, params);
    } finally {
      await db.exec("rollback");
    }
  };

  try {
    await asRole(
      TEACHER,
      `insert into public.crm_groups (title) values ('RLS sinovi')`,
    );

    ok("o'qituvchi guruh yarata oldi (RLS siyosati ishlayapti)");
  } catch (error) {
    bad(`o'qituvchi guruh yarata olmadi: ${error.message}`);
  }

  try {
    await asRole(
      ALI,
      `insert into public.crm_groups (title) values ('O''quvchi guruhi')`,
    );

    bad("o'quvchi CRM guruh yaratib yubordi");
  } catch {
    ok("o'quvchiga guruh yaratish taqiqlandi");
  }

  try {
    const seen = await asRole(ALI, `select * from public.crm_groups`);

    if (seen.rows.length === 0) {
      ok("o'quvchi CRM guruhlarini ko'ra olmadi");
    } else {
      bad(`o'quvchiga ${seen.rows.length} ta guruh ko'rindi`);
    }
  } catch {
    ok("o'quvchi CRM guruhlarini ko'ra olmadi");
  }

  await as(
    TEACHER,
    `select public.ensure_group_pair(null, null, 'Toq kunlar 18:00')`,
  );

  /*
   * Guruh saytdagi yarmi bilan birga yaratiladi — sayt ham aynan
   * shunday qiladi. Nomi bo'yicha topamiz: 21-fayl eski guruhlarga
   * ham juft yasagani uchun `limit 1` noto'g'ri qatorni berardi.
   */
  const cg = (
    await db.query(
      `select id from public.crm_groups where title = 'Toq kunlar 18:00'`,
    )
  ).rows[0].id;

  await db.query(
    `insert into public.crm_students (group_id, full_name, user_id)
     values ($1, 'Alisher', $2), ($1, 'Barno', null)`,
    [cg, ALI],
  );

  const [alisher, barno] = (
    await db.query(
      `select id from public.crm_students order by full_name`,
    )
  ).rows.map((row) => row.id);

  /* Bo'sh varaq: hamma "keldi" bilan ochiladi */
  let r = await as(
    TEACHER,
    `select * from public.crm_day_sheet($1, current_date)`,
    [cg],
  );

  if (r.rows.length === 2 && r.rows[0].attendance === "keldi") {
    ok("bo'sh varaq hamma 'keldi' bilan ochildi");
  } else {
    bad(JSON.stringify(r.rows));
  }

  if (r.rows.filter((row) => row.has_account).length === 1) {
    ok("sayt hisobi bori ajratildi");
  } else {
    bad("hisob bog'lanishi noto'g'ri");
  }

  /* O'quvchi CRM ni ko'ra olmaydi */
  r = await as(
    ALI,
    `select * from public.crm_day_sheet($1, current_date)`,
    [cg],
  );

  if (r.rows.length === 0) {
    ok("o'quvchi CRM varaqasini ko'ra olmadi");
  } else {
    bad(`o'quvchiga ${r.rows.length} ta qator chiqdi`);
  }

  /* Ball qoidasi: keldi 10 + xulq 4*2 + 10 masala*2 + to'liq bonus 5 */
  r = await as(
    TEACHER,
    `select * from public.crm_calculate_points($1, 'keldi', 4::smallint, 10, 10, 0)`,
    [cg],
  );

  /* keldi 10 + xulq 4x2 + 10 masala x2 = 38 ball -> 3 tanga */
  if (r.rows[0].points === 38 && r.rows[0].coins === 3) {
    ok("ball va tanga qoidaga mos hisoblandi");
  } else {
    bad(JSON.stringify(r.rows[0]));
  }

  /* Kunni saqlash */
  const dayRows = JSON.stringify([
    {
      student_id: alisher,
      attendance: "keldi",
      behavior: 4,
      homework_done: 10,
      homework_total: 10,
      bonus: 0,
    },
    {
      student_id: barno,
      attendance: "kelmadi",
      behavior: null,
      homework_done: 0,
      homework_total: 10,
      bonus: 0,
    },
  ]);

  r = await as(
    TEACHER,
    `select public.crm_save_day($1, current_date, 'Kvadrat tenglama', $2::jsonb) n`,
    [cg, dayRows],
  );

  if (r.rows[0].n === 2) {
    ok("kunlik varaq saqlandi");
  } else {
    bad(`${r.rows[0].n} ta yozildi`);
  }

  /* Qayta saqlash takror yozuv yaratmaydi */
  await as(
    TEACHER,
    `select public.crm_save_day($1, current_date, null, $2::jsonb)`,
    [cg, dayRows],
  );

  const recordCount = (
    await db.query(`select count(*)::int c from public.crm_daily_records`)
  ).rows[0].c;

  if (recordCount === 2) {
    ok("qayta saqlanganda takror yozuv paydo bo'lmadi");
  } else {
    bad(`${recordCount} ta yozuv`);
  }

  /* O'quvchi saqlay olmaydi */
  try {
    await as(
      ALI,
      `select public.crm_save_day($1, current_date, null, '[]'::jsonb)`,
      [cg],
    );

    bad("o'quvchi kunlik varaqni saqlay oldi");
  } catch {
    ok("o'quvchiga saqlash taqiqlandi");
  }

  /* Qoida o'zgarsa o'tgan kun o'zgarmaydi */
  await db.query(
    `insert into public.crm_point_rules (group_id, present_points) values ($1, 100)`,
    [cg],
  );

  r = await as(TEACHER, `select * from public.crm_group_ranking($1)`, [cg]);

  if (r.rows[0].full_name === "Alisher" && r.rows[0].total_points === 38) {
    ok("qoida o'zgardi, o'tgan kunning bali o'zgarmadi");
  } else {
    bad(JSON.stringify(r.rows[0]));
  }

  /* Sovg'a do'koni */
  await db.query(
    `insert into public.crm_rewards (group_id, title, cost_coins, stock)
     values ($1, 'Daftar', 3, 1)`,
    [cg],
  );

  const reward = (
    await db.query(`select id from public.crm_rewards limit 1`)
  ).rows[0].id;

  await as(TEACHER, `select public.crm_redeem($1, $2, null)`, [
    alisher,
    reward,
  ]);

  r = await as(TEACHER, `select * from public.crm_student_balance($1)`, [
    alisher,
  ]);

  if (r.rows[0].earned_coins === 3 && r.rows[0].available_coins === 0) {
    ok("tanga sarflandi, balans yangilandi");
  } else {
    bad(JSON.stringify(r.rows[0]));
  }

  r = await as(TEACHER, `select * from public.crm_group_ranking($1)`, [cg]);

  if (r.rows[0].total_points === 38) {
    ok("sovg'a olingach ball kamaymadi");
  } else {
    bad(`ball: ${r.rows[0].total_points}`);
  }

  /* Zaxira tugaganda to'siladi */
  try {
    await as(TEACHER, `select public.crm_redeem($1, $2, null)`, [
      alisher,
      reward,
    ]);

    bad("tugagan sovg'a berildi");
  } catch (error) {
    if (error.message.includes("tugagan")) {
      ok("zaxira tugaganda to'sildi");
    } else {
      bad(error.message);
    }
  }

  /* Tanga yetmasa — zaxirasi cheklanmagan sovg'ada tekshiramiz */
  await db.query(
    `insert into public.crm_rewards (group_id, title, cost_coins, stock)
     values ($1, 'Ruchka', 3, null)`,
    [cg],
  );

  const pen = (
    await db.query(
      `select id from public.crm_rewards order by id desc limit 1`,
    )
  ).rows[0].id;

  try {
    await as(TEACHER, `select public.crm_redeem($1, $2, null)`, [
      barno,
      pen,
    ]);

    bad("tangasiz o'quvchiga sovg'a berildi");
  } catch (error) {
    if (error.message.includes("Tanga yetarli emas")) {
      ok("tanga yetmasa tushunarli xato qaytdi");
    } else {
      bad(error.message);
    }
  }

  /* Sovg'a ikonkasi */
  await db.query(
    `insert into public.crm_rewards (group_id, title, cost_coins, icon)
     values ($1, 'Ikonkali sovg''a', 5, 'notebook')`,
    [cg],
  );

  r = await as(TEACHER, `select * from public.crm_reward_list($1)`, [cg]);

  const withIcon = r.rows.find((row) => row.title === "Ikonkali sovg'a");

  if (withIcon?.icon === "notebook") {
    ok("sovg'a ikonkasi saqlandi va ro'yxatda qaytdi");
  } else {
    bad(`ikonka: ${withIcon?.icon}`);
  }

  if (r.rows.some((row) => row.icon === null)) {
    ok("ikonkasiz eski sovg'alar ham buzilmadi");
  } else {
    bad("ikonkasiz sovg'a topilmadi");
  }

  /* Almashtirishni bekor qilish */
  const lastRedemption = (
    await db.query(
      `select id from public.crm_redemptions order by id desc limit 1`,
    )
  ).rows[0].id;

  await as(TEACHER, `select public.crm_cancel_redemption($1)`, [
    lastRedemption,
  ]);

  r = await as(TEACHER, `select * from public.crm_student_balance($1)`, [
    alisher,
  ]);

  if (r.rows[0].available_coins === 3) {
    ok("bekor qilinganda tanga qaytdi");
  } else {
    bad(`balans: ${r.rows[0].available_coins}`);
  }

  /* ---------------- Umumiy hamyon (db/20) ---------------- */

  /* Guruhga avtomatik kod berildi */
  const code = (
    await db.query(
      `select join_code from public.crm_groups where id = $1`,
      [cg],
    )
  ).rows[0].join_code;

  if (code && code.length === 6) {
    ok("offline guruhga qo'shilish kodi berildi");
  } else {
    bad(`kod: ${code}`);
  }

  /* Vali kod bilan o'zi qo'shildi */
  let joined = await as(VALI, `select * from public.crm_join_group($1)`, [
    code.toLowerCase(),
  ]);

  if (joined.rows[0].already === false) {
    ok("o'quvchi kod bilan o'zi qo'shildi (kichik harf ham ishladi)");
  } else {
    bad(JSON.stringify(joined.rows[0]));
  }

  joined = await as(VALI, `select * from public.crm_join_group($1)`, [code]);

  if (joined.rows[0].already === true) {
    ok("ikkinchi marta takror yozuv yaratmadi");
  } else {
    bad("takror yozuv paydo bo'ldi");
  }

  try {
    await as(VALI, `select * from public.crm_join_group('XXXXXX')`);
    bad("noto'g'ri kod qabul qilindi");
  } catch {
    ok("noto'g'ri kod rad etildi");
  }

  /*
   * Onlayn uy vazifasi tangasi.
   *
   * Ali 7-A guruhida 80% olgan (yuqorida yozilgan urinish), muddat
   * hali o'tmagan -> 8 + 3 bonus = 11 tanga.
   */
  await db.exec(`update public.assignments set due_at = now() + interval '1 day'`);

  const awarded = await as(ALI, `select public.award_online_coins() n`);

  if (awarded.rows[0].n >= 1) {
    ok("onlayn uy vazifasiga tanga yozildi");
  } else {
    bad(`${awarded.rows[0].n} ta yozildi`);
  }

  const again = await as(ALI, `select public.award_online_coins() n`);

  if (again.rows[0].n === 0) {
    ok("onlayn tanga ikkinchi marta yozilmadi");
  } else {
    bad(`yana ${again.rows[0].n} ta yozildi`);
  }

  /*
   * Umumiy hamyon.
   *
   * Offline dars: 38 ball -> 3 tanga.
   * Onlayn vazifa: 80% -> 16 ball, muddatida bo'lgani uchun +5 = 21
   * ball -> 21 / 10 = 2 tanga.
   *
   * Oldingi sovg'a bekor qilingani uchun sarflangani nolga qaytgan.
   */
  const wallet = await as(ALI, `select * from public.my_coin_balance()`);

  if (
    wallet.rows[0].earned_coins === 5 &&
    wallet.rows[0].spent_coins === 0
  ) {
    ok("hamyon offline va onlayn tangani birlashtirdi (3 + 2)");
  } else {
    bad(JSON.stringify(wallet.rows[0]));
  }

  /* O'quvchi o'zi sovg'a so'raydi */
  await db.query(
    `insert into public.crm_rewards (group_id, title, cost_coins, icon)
     values (null, 'Umumiy ruchka', 5, 'pen')`,
  );

  const penReward = (
    await db.query(
      `select id from public.crm_rewards where title = 'Umumiy ruchka'`,
    )
  ).rows[0].id;

  const mine = await as(ALI, `select * from public.my_reward_list()`);

  if (mine.rows.some((row) => row.id === penReward)) {
    ok("umumiy sovg'a o'quvchiga ko'rindi");
  } else {
    bad("umumiy sovg'a ko'rinmadi");
  }

  await as(ALI, `select public.request_reward($1)`, [penReward]);

  const afterRequest = await as(
    ALI,
    `select * from public.my_coin_balance()`,
  );

  if (afterRequest.rows[0].spent_coins === 5) {
    ok("so'rov yuborilganda tanga darhol ushlab qolindi");
  } else {
    bad(JSON.stringify(afterRequest.rows[0]));
  }

  const myList = await as(ALI, `select * from public.my_redemptions()`);

  if (myList.rows[0].status === "kutilmoqda") {
    ok("so'rov 'kutilmoqda' holatida turdi");
  } else {
    bad(JSON.stringify(myList.rows[0]));
  }

  /* O'qituvchi tasdiqlaydi */
  const pendingList = await as(
    TEACHER,
    `select * from public.crm_pending_redemptions()`,
  );

  if (pendingList.rows.length === 1) {
    ok("kutayotgan so'rov o'qituvchiga ko'rindi");
  } else {
    bad(`${pendingList.rows.length} ta ko'rindi`);
  }

  await as(TEACHER, `select public.crm_confirm_redemption($1)`, [
    pendingList.rows[0].id,
  ]);

  const confirmed = await as(ALI, `select * from public.my_redemptions()`);

  if (confirmed.rows[0].status === "topshirildi") {
    ok("o'qituvchi tasdiqlagach holat o'zgardi");
  } else {
    bad(JSON.stringify(confirmed.rows[0]));
  }

  try {
    await as(ALI, `select public.crm_confirm_redemption($1)`, [
      pendingList.rows[0].id,
    ]);

    bad("o'quvchi o'zi tasdiqladi");
  } catch {
    ok("o'quvchiga tasdiqlash taqiqlandi");
  }

  /* Dublikatni birlashtirish */
  await db.query(
    `insert into public.crm_students (group_id, full_name) values ($1, 'Ali (qo''lda)')`,
    [cg],
  );

  const manual = (
    await db.query(
      `select id from public.crm_students where full_name = 'Ali (qo''lda)'`,
    )
  ).rows[0].id;

  await as(
    TEACHER,
    `select public.crm_save_day($1, current_date - 3, null, $2::jsonb)`,
    [
      cg,
      JSON.stringify([
        {
          student_id: manual,
          attendance: "keldi",
          behavior: 5,
          homework_done: 10,
          homework_total: 10,
          bonus: 0,
        },
      ]),
    ],
  );

  const aliStudent = (
    await db.query(
      `select id from public.crm_students where user_id = $1 and group_id = $2`,
      [ALI, cg],
    )
  ).rows[0].id;

  await as(TEACHER, `select public.crm_merge_students($1, $2)`, [
    aliStudent,
    manual,
  ]);

  const merged = await as(ALI, `select * from public.my_coin_balance()`);

  const stillThere = (
    await db.query(
      `select count(*)::int c from public.crm_students where id = $1`,
      [manual],
    )
  ).rows[0].c;

  /*
   * Ali: 3 (offline dars) + 2 (onlayn vazifa) = 5.
   * Qo'lda kiritilgan yozuvda bitta dars bor edi va yuqorida qoida
   * o'zgartirilgan (keldi = 100 ball) -> 130 ball = 13 tanga.
   * Jami 18.
   */
  if (merged.rows[0].earned_coins === 18 && stillThere === 0) {
    ok("dublikat birlashdi, tangalari ko'chdi (5 + 13)");
  } else {
    bad(
      `balans ${JSON.stringify(merged.rows[0])}, qolgan ${stillThere}`,
    );
  }

  /* ---------------- Guruhlarni birlashtirish (db/21) ---------------- */

  /* Har bir offline guruhga saytdagi yarmi yasaldi */
  const paired = (
    await db.query(
      `select count(*)::int c from public.crm_groups where study_group_id is null`,
    )
  ).rows[0].c;

  if (paired === 0) {
    ok("barcha guruhlar saytdagi yarmi bilan bog'landi");
  } else {
    bad(`${paired} ta guruh bog'lanmadi`);
  }

  /*
   * Guruhning ikkala yarmi bitta kodga ega bo'lishi shart.
   *
   * Ilgari har biriga alohida kod berilardi va o'qituvchi ikki xil
   * kodni ko'rardi — o'quvchiga qaysi birini aytish noaniq edi.
   */
  const codePairs = (
    await db.query(
      `select g.join_code as crm, s.join_code as site
       from public.crm_groups g
       join public.study_groups s on s.id = g.study_group_id`,
    )
  ).rows;

  if (
    codePairs.length > 0 &&
    codePairs.every((row) => row.crm === row.site)
  ) {
    ok("har bir guruhning ikkala yarmi bitta kodga ega");
  } else {
    bad(`mos kelmadi: ${JSON.stringify(codePairs)}`);
  }

  /* Yangi juftlik yaratish */
  const pair = await as(
    TEACHER,
    `select * from public.ensure_group_pair(null, null, 'Juft guruh')`,
  );

  if (pair.rows[0].crm_group_id && pair.rows[0].study_group_id) {
    ok("yangi guruh ikkala yarmi bilan yaratildi");
  } else {
    bad(JSON.stringify(pair.rows[0]));
  }

  const pairCrm = pair.rows[0].crm_group_id;
  const pairStudy = pair.rows[0].study_group_id;

  const newPairCodes = (
    await db.query(
      `select g.join_code as crm, s.join_code as site
       from public.crm_groups g
       join public.study_groups s on s.id = g.study_group_id
       where g.id = $1`,
      [pair.rows[0].crm_group_id],
    )
  ).rows[0];

  if (newPairCodes.crm === newPairCodes.site) {
    ok("yangi guruh ham bitta kod bilan yaratildi");
  } else {
    bad(JSON.stringify(newPairCodes));
  }

  /* Offline kod bilan qo'shilganda saytdagi a'zolik ham paydo bo'ladi */
  const pairCode = (
    await db.query(
      `select join_code from public.crm_groups where id = $1`,
      [pairCrm],
    )
  ).rows[0].join_code;

  await as(VALI, `select * from public.join_group_by_code($1)`, [pairCode]);

  const bothSides = (
    await db.query(
      `select
         (select count(*)::int from public.study_group_members
           where group_id = $1 and user_id = $2) as site,
         (select count(*)::int from public.crm_students
           where group_id = $3 and user_id = $2) as offline`,
      [pairStudy, VALI, pairCrm],
    )
  ).rows[0];

  if (bothSides.site === 1 && bothSides.offline === 1) {
    ok("offline kod bilan ikkala ro'yxatga ham qo'shildi");
  } else {
    bad(JSON.stringify(bothSides));
  }

  /* Saytdagi kod bilan ham xuddi shunday */
  const siteCode = (
    await db.query(
      `select join_code from public.study_groups where id = $1`,
      [pairStudy],
    )
  ).rows[0].join_code;

  await as(ALI, `select * from public.join_group_by_code($1)`, [siteCode]);

  const bothSides2 = (
    await db.query(
      `select
         (select count(*)::int from public.study_group_members
           where group_id = $1 and user_id = $2) as site,
         (select count(*)::int from public.crm_students
           where group_id = $3 and user_id = $2) as offline`,
      [pairStudy, ALI, pairCrm],
    )
  ).rows[0];

  if (bothSides2.site === 1 && bothSides2.offline === 1) {
    ok("saytdagi kod bilan ham ikkala ro'yxatga qo'shildi");
  } else {
    bad(JSON.stringify(bothSides2));
  }

  /* Ikkinchi marta takror yozuv yaratmaydi */
  await as(ALI, `select * from public.join_group_by_code($1)`, [siteCode]);

  const dupCheck = (
    await db.query(
      `select count(*)::int c from public.crm_students
        where group_id = $1 and user_id = $2`,
      [pairCrm, ALI],
    )
  ).rows[0].c;

  if (dupCheck === 1) {
    ok("qayta qo'shilganda takror yozuv paydo bo'lmadi");
  } else {
    bad(`${dupCheck} ta yozuv`);
  }

  /* Ball endi "jami berilgan" ga bog'liq emas */
  const simple = await as(
    TEACHER,
    `select * from public.crm_calculate_points($1, 'keldi', 4::smallint, 10, 0, 0)`,
    [pairCrm],
  );

  const withTotal = await as(
    TEACHER,
    `select * from public.crm_calculate_points($1, 'keldi', 4::smallint, 10, 10, 0)`,
    [pairCrm],
  );

  if (
    simple.rows[0].points === 38 &&
    simple.rows[0].points === withTotal.rows[0].points
  ) {
    ok("ball 'jami berilgan' dan mustaqil (10 + 8 + 20 = 38)");
  } else {
    bad(
      `jamisiz ${simple.rows[0].points}, jami bilan ${withTotal.rows[0].points}`,
    );
  }

  /* Nomni ikkala tomonda birga o'zgartirish */
  await as(TEACHER, `select public.rename_group_pair($1, 'Yangi nom')`, [
    pairCrm,
  ]);

  const renamed = (
    await db.query(
      `select
         (select title from public.crm_groups where id = $1) as crm,
         (select title from public.study_groups where id = $2) as site`,
      [pairCrm, pairStudy],
    )
  ).rows[0];

  if (renamed.crm === "Yangi nom" && renamed.site === "Yangi nom") {
    ok("nom ikkala tomonda birga o'zgardi");
  } else {
    bad(JSON.stringify(renamed));
  }

  /* Umumiy ro'yxat */
  const overview = await as(TEACHER, `select * from public.group_overview()`);

  const pairRow = overview.rows.find(
    (row) => row.crm_group_id === pairCrm,
  );

  if (pairRow && pairRow.student_count === 2 && pairRow.join_code) {
    ok("umumiy ro'yxat ikkala yarmini ko'rsatdi");
  } else {
    bad(JSON.stringify(pairRow));
  }

  /* ---------------- O'quvchi o'z guruhini ko'radi (db/22) ---------- */

  const myGroups = await as(ALI, `select * from public.my_groups()`);

  if (myGroups.rows.length > 0 && myGroups.rows[0].my_rank >= 1) {
    ok("o'quvchi o'z guruhlarini va o'rnini ko'rdi");
  } else {
    bad(JSON.stringify(myGroups.rows));
  }

  const firstGroup = myGroups.rows.find(
    (row) => Number(row.crm_group_id) === Number(cg),
  );

  if (firstGroup && firstGroup.my_points > 0) {
    ok("o'z ballari to'g'ri ko'rindi");
  } else {
    bad(JSON.stringify(firstGroup));
  }

  const myHistory = await as(
    ALI,
    `select * from public.my_lesson_history($1)`,
    [cg],
  );

  if (myHistory.rows.length > 0 && myHistory.rows[0].points > 0) {
    ok("o'z dars tarixi keldi");
  } else {
    bad(JSON.stringify(myHistory.rows));
  }

  /* Begona guruhning tarixini ko'ra olmaydi */
  const foreignHistory = await as(
    ALI,
    `select * from public.my_lesson_history($1)`,
    [pairCrm],
  );

  const board = await as(
    ALI,
    `select * from public.my_group_leaderboard($1)`,
    [cg],
  );

  if (board.rows.length > 0 && board.rows.some((row) => row.is_me)) {
    ok("guruh reytingi ko'rindi va o'zi belgilandi");
  } else {
    bad(JSON.stringify(board.rows));
  }

  /* Reytingda faqat ism, ball va tanga bo'lsin */
  const columns = Object.keys(board.rows[0] ?? {});

  if (
    !columns.includes("attendance") &&
    !columns.includes("behavior") &&
    !columns.includes("note")
  ) {
    ok("reytingda davomat va xulq yashirin qoldi");
  } else {
    bad(`ustunlar: ${columns}`);
  }

  /* A'zo bo'lmagan guruh reytingi bo'sh qaytadi */
  const otherBoard = await as(
    VALI,
    `select * from public.my_group_leaderboard($1)`,
    [999999],
  );

  if (otherBoard.rows.length === 0 && foreignHistory.rows.length === 0) {
    ok("begona guruh ma'lumoti qaytmadi");
  } else {
    bad(
      `reyting ${otherBoard.rows.length}, tarix ${foreignHistory.rows.length}`,
    );
  }

  /* ---------------- Vazifa balli va test tanlash (db/26) --------- */

  /*
   * Onlayn vazifa endi ball ham beradi.
   *
   * Ilgari faqat tanga berardi va guruh reytingi ball bo'yicha
   * tuzilgani uchun vazifa o'quvchining o'rniga umuman ta'sir
   * qilmasdi.
   */
  const awardRow = (
    await db.query(
      `select points, coins from public.online_coin_awards
        where user_id = $1 limit 1`,
      [ALI],
    )
  ).rows[0];

  if (awardRow && awardRow.points > 0) {
    ok("onlayn vazifa ball berdi");
  } else {
    bad(`ball: ${JSON.stringify(awardRow)}`);
  }

  /*
   * Ball aynan vazifa berilgan guruhga qo'shiladi.
   *
   * Shu guruhning o'z study_group_id siga vazifa beramiz, Ali uni
   * bajaradi va guruhdagi bali oshishi kerak.
   */
  const cgStudy = (
    await db.query(
      `select study_group_id from public.crm_groups where id = $1`,
      [cg],
    )
  ).rows[0].study_group_id;

  const before = (
    await db.query(
      `select points from public.crm_student_totals
        where user_id = $1 and group_id = $2`,
      [ALI, cg],
    )
  ).rows[0].points;

  const ownAssignment = (
    await db.query(
      `insert into public.assignments (group_id, test_id, due_at)
       select $1, id, now() + interval '1 day'
       from public.tests where title = 'Katalog testi'
       returning id`,
      [cgStudy],
    )
  ).rows[0].id;

  await db.query(
    `insert into public.attempts (user_id, test_id, assignment_id, percentage, completed_at)
     select $1, id, $2, 100, now()
     from public.tests where title = 'Katalog testi'`,
    [ALI, ownAssignment],
  );

  await as(ALI, `select public.award_online_coins()`);

  const after = (
    await db.query(
      `select points from public.crm_student_totals
        where user_id = $1 and group_id = $2`,
      [ALI, cg],
    )
  ).rows[0].points;

  /* 100% -> 20 ball, muddatida bo'lgani uchun +5 = 25 */
  if (after - before === 25) {
    ok("vazifa balli aynan o'sha guruh hisobiga qo'shildi (+25)");
  } else {
    bad(`oldin ${before}, keyin ${after}`);
  }

  /* Boshqa guruhning bali o'zgarmasligi kerak */
  const otherGroup = (
    await db.query(
      `select coalesce(sum(t.points), 0)::int as p
       from public.crm_student_totals t
       where t.user_id = $1 and t.group_id <> $2`,
      [ALI, cg],
    )
  ).rows[0].p;

  if (otherGroup === 0) {
    ok("boshqa guruhga tegishli ball qo'shilmadi");
  } else {
    bad(`boshqa guruhda ${otherGroup} ball`);
  }

  /* Vazifaga ikkala manbadan test tanlash mumkin */
  const options = await as(
    TEACHER,
    `select * from public.assignable_tests()`,
  );

  const sources = new Set(options.rows.map((row) => row.source));

  if (sources.has("guruh") && sources.has("katalog")) {
    ok("vazifaga guruh testi ham, katalog testi ham tanlanadi");
  } else {
    bad(`manbalar: ${[...sources]}`);
  }

  /* Guruh testlari ro'yxat boshida turadi */
  if (options.rows[0]?.source === "guruh") {
    ok("guruh testlari ro'yxat boshida");
  } else {
    bad(`birinchi: ${options.rows[0]?.source}`);
  }

  /* ---------------- Kunni ikki marta saqlash ---------------------- */

  /*
   * O'qituvchi bir kunni saqlab, keyin qaytib kirib yana saqlashi
   * mumkin. Ball qo'shilib ketmasligi, ustiga yozilishi kerak.
   */
  const twiceGroup = (
    await db.query(
      `insert into public.crm_groups (title, is_active)
       values ('Ikki marta saqlash', true) returning id`,
    )
  ).rows[0].id;

  const twiceStudent = (
    await db.query(
      `insert into public.crm_students (group_id, full_name, is_active)
       values ($1, 'Sinov o''quvchisi', true) returning id`,
      [twiceGroup],
    )
  ).rows[0].id;

  const twiceRows = JSON.stringify([
    {
      student_id: twiceStudent,
      attendance: "keldi",
      behavior: 5,
      homework_done: 5,
    },
  ]);

  await as(
    TEACHER,
    `select public.crm_save_day($1, '2026-04-06', 'Mavzu', $2::jsonb)`,
    [twiceGroup, twiceRows],
  );

  const firstSave = (
    await db.query(
      `select points from public.crm_student_totals where student_id = $1`,
      [twiceStudent],
    )
  ).rows[0].points;

  await as(
    TEACHER,
    `select public.crm_save_day($1, '2026-04-06', 'Mavzu', $2::jsonb)`,
    [twiceGroup, twiceRows],
  );

  const secondSave = (
    await db.query(
      `select points from public.crm_student_totals where student_id = $1`,
      [twiceStudent],
    )
  ).rows[0].points;

  const lessonCount = (
    await db.query(
      `select count(*)::int as c from public.crm_lessons
        where group_id = $1 and lesson_date = '2026-04-06'`,
      [twiceGroup],
    )
  ).rows[0].c;

  if (Number(firstSave) === Number(secondSave) && lessonCount === 1) {
    ok("kun ikki marta saqlansa ball qo'shilib ketmadi");
  } else {
    bad(
      `1-saqlash ${firstSave}, 2-saqlash ${secondSave}, dars ${lessonCount}`,
    );
  }

  await db.query(`delete from public.crm_groups where id = $1`, [twiceGroup]);

  /* ---------------- Tanga jami balldan (db/32) -------------------- */

  /*
   * "10 ball = 1 tanga" qoidasi jami balldan hisoblanishi kerak.
   * Ilgari har bir dars alohida bo'linib, qoldiq yo'qolardi:
   * 54 + 50 + 48 = 152 ball 15 emas, 14 tanga berardi.
   */
  const coinGroup = (
    await db.query(
      `insert into public.crm_groups (title, is_active)
       values ('Tanga sinovi', true) returning id`,
    )
  ).rows[0].id;

  const coinStudent = (
    await db.query(
      `insert into public.crm_students (group_id, full_name, is_active)
       values ($1, 'Qoldiqli o''quvchi', true) returning id`,
      [coinGroup],
    )
  ).rows[0].id;

  const coinLesson = async (date, points) => {
    const lesson = (
      await db.query(
        `insert into public.crm_lessons (group_id, lesson_date)
         values ($1, $2) returning id`,
        [coinGroup, date],
      )
    ).rows[0].id;

    await db.query(
      `insert into public.crm_daily_records
         (lesson_id, student_id, attendance, points, coins)
       values ($1, $2, 'keldi', $3, $3 / 10)`,
      [lesson, coinStudent, points],
    );
  };

  await coinLesson("2026-02-02", 54);
  await coinLesson("2026-02-04", 50);
  await coinLesson("2026-02-06", 48);

  const coinRow = (
    await db.query(
      `select points, coins from public.crm_student_totals
        where student_id = $1`,
      [coinStudent],
    )
  ).rows[0];

  if (Number(coinRow.points) === 152 && Number(coinRow.coins) === 15) {
    ok("tanga jami balldan hisoblandi (152 ball -> 15 tanga)");
  } else {
    bad(`ball ${coinRow.points}, tanga ${coinRow.coins}`);
  }

  const coinBalance = (
    await db.query(
      `select available_coins from public.coin_balance(null, $1)`,
      [coinStudent],
    )
  ).rows[0].available_coins;

  if (Number(coinBalance) === 15) {
    ok("hamyon balansi ham jami balldan olindi");
  } else {
    bad(`balans: ${coinBalance}`);
  }

  /*
   * Guruhning o'z qoidasi bo'lsa o'sha ishlaydi.
   *
   * Yangi guruh olinadi: eski guruhda yozib qo'yilgan tangalar bor
   * va ular ataylab kamaytirilmaydi ("qoida o'zgarsa o'tgan kunlar
   * qayta hisoblanmaydi" qoidasi).
   */
  const rareGroup = (
    await db.query(
      `insert into public.crm_groups (title, is_active)
       values ('Qimmat tanga guruhi', true) returning id`,
    )
  ).rows[0].id;

  await db.query(
    `insert into public.crm_point_rules (group_id, coins_per_points)
     values ($1, 20)`,
    [rareGroup],
  );

  const rareStudent = (
    await db.query(
      `insert into public.crm_students (group_id, full_name, is_active)
       values ($1, 'Yangi o''quvchi', true) returning id`,
      [rareGroup],
    )
  ).rows[0].id;

  const rareLesson = (
    await db.query(
      `insert into public.crm_lessons (group_id, lesson_date)
       values ($1, '2026-03-02') returning id`,
      [rareGroup],
    )
  ).rows[0].id;

  await db.query(
    `insert into public.crm_daily_records
       (lesson_id, student_id, attendance, points, coins)
     values ($1, $2, 'keldi', 152, 0)`,
    [rareLesson, rareStudent],
  );

  const customRate = (
    await db.query(
      `select coins from public.crm_student_totals where student_id = $1`,
      [rareStudent],
    )
  ).rows[0].coins;

  if (Number(customRate) === 7) {
    ok("guruhning o'z qoidasi qo'llandi (20 ball -> 1 tanga)");
  } else {
    bad(`o'z qoidasi bilan: ${customRate}`);
  }

  await db.query(`delete from public.crm_groups where id in ($1, $2)`, [
    coinGroup,
    rareGroup,
  ]);

  /* ---------------- Bazani tozalash (db/30) ----------------------- */

  /*
   * Tozalash faqat chiqindini olib tashlashi kerak. Eng muhimi:
   * tugallangan urinish va uning javoblari joyida qolsin.
   */
  const keepTestId = (
    await db.query(
      `insert into public.tests (title) values ('Tozalash sinovi')
       returning id`,
    )
  ).rows[0].id;

  const keepQuestionId = (
    await db.query(
      `insert into public.questions (test_id, question_text, option_a)
       values ($1, 'Saqlanadigan savol', 'A') returning id`,
      [keepTestId],
    )
  ).rows[0].id;

  /* Tugallangan urinish — tegilmasligi kerak */
  const keptAttempt = (
    await db.query(
      `insert into public.attempts (user_id, test_id, percentage, completed_at, started_at)
       values ($1, $2, 90, now() - interval '400 days', now() - interval '400 days')
       returning id`,
      [ALI, keepTestId],
    )
  ).rows[0].id;

  await db.query(
    `insert into public.user_answers (attempt_id, question_id, selected_answer, is_correct)
     values ($1, $2, 'A', true)`,
    [keptAttempt, keepQuestionId],
  );

  /* Tashlab ketilgan urinish — o'chishi kerak */
  const deadAttempt = (
    await db.query(
      `insert into public.attempts (user_id, test_id, percentage, completed_at, started_at)
       values ($1, $2, 0, null, now() - interval '400 days')
       returning id`,
      [ALI, keepTestId],
    )
  ).rows[0].id;

  await db.query(
    `insert into public.user_answers (attempt_id, question_id, selected_answer, is_correct)
     values ($1, $2, 'B', false)`,
    [deadAttempt, keepQuestionId],
  );

  /* Eski yopilgan sessiya — o'chadi; ochig'i — qoladi */
  await db.query(
    `insert into public.test_sessions (user_id, test_id, started_at, expires_at, submitted_at)
     values ($1, $2, now() - interval '400 days', now() - interval '399 days',
             now() - interval '399 days')`,
    [ALI, keepTestId],
  );

  const openSession = (
    await db.query(
      `insert into public.test_sessions (user_id, test_id, expires_at)
       values ($1, $2, now() + interval '30 minutes') returning id`,
      [ALI, keepTestId],
    )
  ).rows[0].id;

  /* O'quvchi tozalay olmaydi */
  try {
    await as(ALI, `select * from public.platform_cleanup(90)`);
    bad("o'quvchi bazani tozalay oldi");
  } catch {
    ok("tozalash faqat o'qituvchiga ruxsat etildi");
  }

  await as(TEACHER, `select * from public.platform_cleanup(90)`);

  const afterCleanup = (
    await db.query(
      `select
         (select count(*) from public.attempts where id = $1)      as kept,
         (select count(*) from public.user_answers
            where attempt_id = $1)                                 as kept_answers,
         (select count(*) from public.attempts where id = $2)      as dead,
         (select count(*) from public.user_answers
            where attempt_id = $2)                                 as dead_answers,
         (select count(*) from public.test_sessions where id = $3) as open_session,
         (select count(*) from public.test_sessions
            where test_id = $4 and submitted_at is not null
              and started_at < now() - interval '300 days')        as old_sessions`,
      [keptAttempt, deadAttempt, openSession, keepTestId],
    )
  ).rows[0];

  if (
    Number(afterCleanup.kept) === 1 &&
    Number(afterCleanup.kept_answers) === 1
  ) {
    ok("tugallangan natija va javoblari saqlanib qoldi");
  } else {
    bad(
      `natija: ${afterCleanup.kept}, javob: ${afterCleanup.kept_answers}`,
    );
  }

  if (
    Number(afterCleanup.dead) === 0 &&
    Number(afterCleanup.dead_answers) === 0
  ) {
    ok("tashlab ketilgan urinish tozalandi");
  } else {
    bad(
      `tashlandiq: ${afterCleanup.dead}, javob: ${afterCleanup.dead_answers}`,
    );
  }

  if (Number(afterCleanup.old_sessions) === 0) {
    ok("eski yopilgan sessiyalar tozalandi");
  } else {
    bad(`eski sessiya: ${afterCleanup.old_sessions}`);
  }

  if (Number(afterCleanup.open_session) === 1) {
    ok("ochiq sessiyaga tegilmadi");
  } else {
    bad("ochiq sessiya o'chib ketdi");
  }

  /* Sinov ma'lumotlarini tozalaymiz */
  await db.query(
    `delete from public.user_answers
      where question_id = $1`,
    [keepQuestionId],
  );

  await db.query(`delete from public.attempts where test_id = $1`, [
    keepTestId,
  ]);

  await db.query(`delete from public.test_sessions where test_id = $1`, [
    keepTestId,
  ]);

  await db.query(`delete from public.questions where test_id = $1`, [
    keepTestId,
  ]);

  await db.query(`delete from public.tests where id = $1`, [keepTestId]);

  /* ---------------- Do'kon faqat guruhda (db/29) ------------------ */

  /*
   * Tanga guruh ichidagi ishdan yig'iladi, shuning uchun guruhga
   * qo'shilmagan o'quvchiga do'kon yopiq bo'lishi kerak — havolani
   * yashirish yetarli emas, baza ham to'sishi shart.
   */
  await db.query(
    `insert into public.crm_rewards (group_id, title, cost_coins, is_active)
     values (null, 'Umumiy sovg''a', 1, true)`,
  );

  /* Sinov uchun Valini hamma guruhdan chiqaramiz */
  const valiGroups = (
    await db.query(
      `select group_id from public.study_group_members where user_id = $1`,
      [VALI],
    )
  ).rows.map((row) => row.group_id);

  const valiStudentIds = (
    await db.query(
      `select id from public.crm_students where user_id = $1`,
      [VALI],
    )
  ).rows.map((row) => row.id);

  await db.query(
    `delete from public.study_group_members where user_id = $1`,
    [VALI],
  );

  await db.query(
    `update public.crm_students set user_id = null where user_id = $1`,
    [VALI],
  );

  const outsiderList = await as(
    VALI,
    `select * from public.my_reward_list()`,
  );

  if (outsiderList.rows.length === 0) {
    ok("guruhsiz o'quvchiga sovg'alar ro'yxati bo'sh qaytdi");
  } else {
    bad(`guruhsizga ${outsiderList.rows.length} ta sovg'a ko'rindi`);
  }

  try {
    await as(
      VALI,
      `select public.request_reward(
         (select id from public.crm_rewards where title = 'Umumiy sovg''a')
       )`,
    );
    bad("guruhsiz o'quvchi sovg'a so'radi");
  } catch {
    ok("guruhsiz o'quvchining so'rovi to'sildi");
  }

  /* Guruhga qaytarganda do'kon ochiladi */
  const anyGroup = (
    await db.query(`select id from public.study_groups limit 1`)
  ).rows[0].id;

  await db.query(
    `insert into public.study_group_members (group_id, user_id)
     values ($1, $2) on conflict do nothing`,
    [anyGroup, VALI],
  );

  const memberList = await as(
    VALI,
    `select * from public.my_reward_list()`,
  );

  if (memberList.rows.length > 0) {
    ok("guruh o'quvchisiga sovg'alar ko'rindi");
  } else {
    bad("guruh a'zosiga ham sovg'a ko'rinmadi");
  }

  /* Sinovdan oldingi holatni qaytaramiz */
  await db.query(
    `delete from public.study_group_members where user_id = $1`,
    [VALI],
  );

  for (const groupId of valiGroups) {
    await db.query(
      `insert into public.study_group_members (group_id, user_id)
       values ($1, $2) on conflict do nothing`,
      [groupId, VALI],
    );
  }

  for (const studentId of valiStudentIds) {
    await db.query(
      `update public.crm_students set user_id = $1 where id = $2`,
      [VALI, studentId],
    );
  }

  await db.query(
    `delete from public.crm_rewards where title = 'Umumiy sovg''a'`,
  );

  /* ---------------- Darsga bir nechta test (db/28) --------------- */

  /*
   * Dars testi vazifa ro'yxatida chiqmasligi kerak: u dars ichida
   * ishlanadi. Endi bog'lam `lesson_tests` jadvalida.
   */
  const lessonId = (
    await db.query(
      `insert into public.lessons (test_id) values (null) returning id`,
    )
  ).rows[0].id;

  const catalogTestId = (
    await db.query(
      `select id from public.tests where title = 'Katalog testi'`,
    )
  ).rows[0].id;

  await db.query(
    `insert into public.lesson_tests (lesson_id, test_id, order_number)
     values ($1, $2, 1)`,
    [lessonId, catalogTestId],
  );

  const afterLink = await as(
    TEACHER,
    `select * from public.assignable_tests()`,
  );

  if (!afterLink.rows.some((row) => row.test_title === "Katalog testi")) {
    ok("darsga biriktirilgan test vazifaga tanlanmaydi");
  } else {
    bad("dars testi ro'yxatda qoldi");
  }

  /* Bitta darsga ikkinchi test ham biriktiriladi */
  const secondTestId = (
    await db.query(
      `insert into public.tests (title) values ('Ikkinchi dars testi')
       returning id`,
    )
  ).rows[0].id;

  await db.query(
    `insert into public.lesson_tests (lesson_id, test_id, order_number)
     values ($1, $2, 2)`,
    [lessonId, secondTestId],
  );

  const linkCount = (
    await db.query(
      `select count(*)::int as c from public.lesson_tests where lesson_id = $1`,
      [lessonId],
    )
  ).rows[0].c;

  if (linkCount === 2) {
    ok("bitta darsga ikkita test biriktirildi");
  } else {
    bad(`bog'lam soni: ${linkCount}`);
  }

  /* Test o'chsa bog'lam ham o'chadi */
  await db.query(`delete from public.tests where id = $1`, [secondTestId]);

  const afterDelete = (
    await db.query(
      `select count(*)::int as c from public.lesson_tests where lesson_id = $1`,
      [lessonId],
    )
  ).rows[0].c;

  if (afterDelete === 1) {
    ok("test o'chirilganda dars bog'lami ham o'chdi");
  } else {
    bad(`o'chirishdan keyin: ${afterDelete}`);
  }

  await db.query(`delete from public.lesson_tests where lesson_id = $1`, [
    lessonId,
  ]);

  /* O'quvchi test tanlagichni ko'ra olmaydi */
  const studentOptions = await as(
    ALI,
    `select * from public.assignable_tests()`,
  );

  if (studentOptions.rows.length === 0) {
    ok("o'quvchi vazifa test ro'yxatini ko'ra olmadi");
  } else {
    bad(`o'quvchiga ${studentOptions.rows.length} ta test ko'rindi`);
  }

  await db.exec(`delete from public.lessons`);
  await db.exec(`set test.uid = ''`);
}

/* ===================================================================
 *  Testni izsiz o'chirish (db/27)
 * =================================================================== */
console.log("\n\x1b[1mTestni o'chirish\x1b[0m");

try {
  await db.exec(readFileSync(join(DB_DIR, "27-testni-ochirish.sql"), "utf8"));
  ok("27-testni-ochirish.sql");
} catch (error) {
  bad(`27-testni-ochirish.sql: ${error.message}`);
}

{
  const as = async (uid, sql, params = []) => {
    await db.exec(`set test.uid = '${uid}'`);
    return db.query(sql, params);
  };

  /* O'chirish uchun alohida test: savol, urinish, takrorlash, sessiya */
  const doomed = (
    await db.query(
      `insert into public.tests (title) values ('O''chiriladigan test')
       returning id`,
    )
  ).rows[0].id;

  const doomedQuestion = (
    await db.query(
      `insert into public.questions (test_id, question_text, option_a)
       values ($1, 'Yo''qoladigan savol', 'A') returning id`,
      [doomed],
    )
  ).rows[0].id;

  await db.query(
    `insert into public.answer_keys (question_id, correct_answer)
     values ($1, 'A')`,
    [doomedQuestion],
  );

  const doomedAttempt = (
    await db.query(
      `insert into public.attempts (user_id, test_id, percentage, completed_at)
       values ($1, $2, 40, now()) returning id`,
      [ALI, doomed],
    )
  ).rows[0].id;

  await db.query(
    `insert into public.user_answers (attempt_id, question_id, selected_answer, is_correct)
     values ($1, $2, 'B', false)`,
    [doomedAttempt, doomedQuestion],
  );

  await db.query(
    `insert into public.review_items (user_id, question_id, due_at)
     values ($1, $2, now())`,
    [ALI, doomedQuestion],
  );

  const doomedSession = (
    await db.query(
      `insert into public.test_sessions (user_id, test_id, expires_at)
       values ($1, $2, now() + interval '30 minutes')
       returning id::text as id`,
      [ALI, doomed],
    )
  ).rows[0].id;

  await db.query(
    `insert into public.test_answer_drafts (session_id, question_id, user_id, answer)
     values ($1, $2, $3, 'A')`,
    [doomedSession, doomedQuestion, ALI],
  );

  /* Boshqa testning ma'lumoti tegilmasligini tekshirish uchun sanaymiz */
  const otherBefore = (
    await db.query(
      `select count(*)::int as c from public.attempts where test_id <> $1`,
      [doomed],
    )
  ).rows[0].c;

  /* O'quvchi o'chira olmaydi */
  try {
    await as(ALI, `select public.delete_test_completely($1)`, [doomed]);
    bad("o'quvchi testni o'chira oldi");
  } catch {
    ok("o'quvchiga o'chirish ruxsat etilmadi");
  }

  const summary = (
    await as(TEACHER, `select * from public.delete_test_completely($1)`, [
      doomed,
    ])
  ).rows[0];

  if (Number(summary.removed_attempts) === 1) {
    ok("urinish o'chdi — natijalar ro'yxatida qolmaydi");
  } else {
    bad(`urinish: ${summary.removed_attempts}`);
  }

  if (Number(summary.removed_reviews) === 1) {
    ok("takrorlash ro'yxatidagi savol o'chdi");
  } else {
    bad(`takrorlash: ${summary.removed_reviews}`);
  }

  const leftovers = (
    await db.query(
      `select
         (select count(*) from public.tests where id = $1)          as t,
         (select count(*) from public.questions where test_id = $1) as q,
         (select count(*) from public.attempts where test_id = $1)  as a,
         (select count(*) from public.user_answers
            where question_id = $2)                                 as u,
         (select count(*) from public.review_items
            where question_id = $2)                                 as r,
         (select count(*) from public.test_sessions where test_id = $1) as s,
         (select count(*) from public.test_answer_drafts
            where session_id = $3)                                  as d`,
      [doomed, doomedQuestion, doomedSession],
    )
  ).rows[0];

  const dirty = Object.entries(leftovers).filter(
    ([, value]) => Number(value) !== 0,
  );

  if (dirty.length === 0) {
    ok("testdan hech qanday iz qolmadi");
  } else {
    bad(`qoldi: ${dirty.map(([key, value]) => `${key}=${value}`)}`);
  }

  /* Boshqa testlarning natijalari joyida */
  const otherAfter = (
    await db.query(
      `select count(*)::int as c from public.attempts where test_id <> $1`,
      [doomed],
    )
  ).rows[0].c;

  if (otherAfter === otherBefore) {
    ok("boshqa testlarning natijalari tegilmadi");
  } else {
    bad(`oldin ${otherBefore}, keyin ${otherAfter}`);
  }

  /*
   * Sarflangan tanga himoyasi.
   *
   * Vali vazifadan tanga oladi va o'sha tangaga sovg'a so'raydi.
   * Endi testni o'chirish balansni manfiyga tushirgan bo'lardi —
   * shuning uchun funksiya to'xtatishi kerak.
   */
  const spentTest = (
    await db.query(
      `insert into public.tests (title) values ('Tangasi sarflangan test')
       returning id`,
    )
  ).rows[0].id;

  const spentGroup = (
    await db.query(`select id from public.study_groups limit 1`)
  ).rows[0].id;

  const spentAssignment = (
    await db.query(
      `insert into public.assignments (group_id, test_id, due_at)
       values ($1, $2, now() + interval '1 day') returning id`,
      [spentGroup, spentTest],
    )
  ).rows[0].id;

  await db.query(
    `insert into public.online_coin_awards (assignment_id, user_id, coins, points)
     values ($1, $2, 6, 60)`,
    [spentAssignment, VALI],
  );

  const valiStudent = (
    await db.query(
      `select id from public.crm_students where user_id = $1 limit 1`,
      [VALI],
    )
  ).rows[0];

  const valiBalance = (
    await db.query(
      `select available_coins from public.coin_balance($1, null)`,
      [VALI],
    )
  ).rows[0].available_coins;

  await db.query(
    `insert into public.crm_redemptions
       (student_id, user_id, reward_title, cost_coins, status)
     values ($1, $2, 'Daftar', $3, 'topshirildi')`,
    [valiStudent.id, VALI, valiBalance],
  );

  try {
    await as(TEACHER, `select public.delete_test_completely($1)`, [spentTest]);
    bad("sarflangan tangali test o'chib ketdi");
  } catch {
    ok("tangasi sovg'aga sarflangan test o'chirilmadi");
  }

  await db.exec(`set test.uid = ''`);
}

console.log(
  `\n  ${passed} ta o'tdi` + (failed ? `, \x1b[31m${failed} ta xato\x1b[0m` : "") + "\n",
);

process.exit(failed ? 1 : 0);
