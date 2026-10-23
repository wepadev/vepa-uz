import test from "node:test";
import assert from "node:assert/strict";

import { reportError } from "../lib/report-error.ts";

/**
 * Xato xabarnomasi hech qachon saytni buzmasligi kerak:
 * sozlanmagan bo'lsa jim tursin, Telegram ishlamasa xato tashlamasin.
 */

const realFetch = globalThis.fetch;
const realConsoleError = console.error;

function setup(options: { token?: string; chatId?: string } = {}) {
  const calls: string[] = [];

  globalThis.fetch = (async (url: unknown) => {
    calls.push(String(url));
    return new Response("{}", { status: 200 });
  }) as typeof fetch;

  console.error = () => {};

  delete process.env.TELEGRAM_ERROR_BOT_TOKEN;

  if (options.token) {
    process.env.TELEGRAM_BOT_TOKEN = options.token;
  } else {
    delete process.env.TELEGRAM_BOT_TOKEN;
  }

  if (options.chatId) {
    process.env.TELEGRAM_ERROR_CHAT_ID = options.chatId;
  } else {
    delete process.env.TELEGRAM_ERROR_CHAT_ID;
  }

  return calls;
}

function restore() {
  globalThis.fetch = realFetch;
  console.error = realConsoleError;
}

test("sozlanmagan bo‘lsa Telegram‘ga urinmaydi", async () => {
  const calls = setup();

  const result = await reportError({
    where: "server",
    message: `Sozlamasiz ${Math.random()}`,
  });

  assert.equal(calls.length, 0);
  assert.equal(result.delivered, false);
  assert.match(String(result.reason), /sozlanmagan/);

  restore();
});

test("sozlangan bo‘lsa xabar yuboriladi", async () => {
  const calls = setup({ token: "111:AAA", chatId: "42" });

  const result = await reportError({
    where: "server",
    message: `Yuborish ${Math.random()}`,
  });

  assert.equal(calls.length, 1);
  assert.ok(calls[0].includes("api.telegram.org/bot111:AAA/sendMessage"));
  assert.equal(result.delivered, true);

  restore();
});

test("bir xil xato qayta yuborilmaydi", async () => {
  const calls = setup({ token: "111:AAA", chatId: "42" });
  const message = `Takror ${Math.random()}`;

  await reportError({ where: "server", message });
  await reportError({ where: "server", message });
  await reportError({ where: "server", message });

  assert.equal(calls.length, 1, "faqat birinchisi ketishi kerak");

  restore();
});

test("alohida bot tokeni ustun keladi", async () => {
  const calls = setup({ token: "UMUMIY:AAA", chatId: "42" });
  process.env.TELEGRAM_ERROR_BOT_TOKEN = "ALOHIDA:BBB";

  await reportError({
    where: "server",
    message: `Alohida bot ${Math.random()}`,
  });

  assert.ok(calls[0].includes("botALOHIDA:BBB"));

  restore();
});

test("Telegram ishlamasa ham xato tashlamaydi", async () => {
  setup({ token: "111:AAA", chatId: "42" });

  globalThis.fetch = (async () => {
    throw new Error("tarmoq yo‘q");
  }) as typeof fetch;

  const result = await reportError({
    where: "server",
    message: `Tarmoqsiz ${Math.random()}`,
  });

  assert.equal(result.delivered, false);
  assert.match(String(result.reason), /Tarmoq xatosi/);

  restore();
});

test("Telegram rad etsa sababi qaytadi", async () => {
  setup({ token: "111:AAA", chatId: "42" });

  globalThis.fetch = (async () =>
    new Response('{"ok":false,"description":"chat not found"}', {
      status: 400,
    })) as typeof fetch;

  const result = await reportError({
    where: "server",
    message: `Chat topilmadi ${Math.random()}`,
  });

  assert.equal(result.delivered, false);
  assert.match(String(result.reason), /chat not found/);

  restore();
});
