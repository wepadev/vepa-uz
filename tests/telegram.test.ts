import assert from "node:assert/strict";
import { test } from "node:test";

import { signInitData, verifyInitData } from "../lib/telegram/init-data.ts";
import {
  createLinkToken,
  LINK_TOKEN_TTL,
  pathStartParam,
  readLinkToken,
  readPathStartParam,
} from "../lib/telegram/start-param.ts";

const TOKEN = "123456:SINOV-tokeni";
const NOW = 1_800_000_000;

function makeInitData(fields: Record<string, string>, token = TOKEN) {
  const params = new URLSearchParams(fields);
  params.set("hash", signInitData(params, token));
  return params.toString();
}

const user = JSON.stringify({ id: 777, first_name: "Ali", username: "ali" });

test("töğri initData qabul qilinadi", () => {
  const data = makeInitData({
    auth_date: String(NOW - 60),
    user,
    start_param: "p_L21vY2s",
    query_id: "AAE",
  });
  const result = verifyInitData(data, TOKEN, NOW);
  assert.equal(result?.user.id, 777);
  assert.equal(result?.startParam, "p_L21vY2s");
});

test("özgartirilgan initData rad etiladi", () => {
  const data = makeInitData({ auth_date: String(NOW), user });
  const forged = data.replace("777", "778");
  assert.equal(verifyInitData(forged, TOKEN, NOW), null);
});

test("boşqa bot tokeni bilan imzolangan initData rad etiladi", () => {
  const data = makeInitData({ auth_date: String(NOW), user }, "999:boshqa");
  assert.equal(verifyInitData(data, TOKEN, NOW), null);
});

test("eskirgan initData rad etiladi", () => {
  const data = makeInitData({ auth_date: String(NOW - 2 * 86400), user });
  assert.equal(verifyInitData(data, TOKEN, NOW), null);
});

test("sahifa parametri: ički yöl ötadi, tashqi manzil ötmaydi", () => {
  assert.equal(readPathStartParam(pathStartParam("/mock?x=1")), "/mock?x=1");
  assert.equal(readPathStartParam(pathStartParam("//evil.com")), null);
  assert.equal(readPathStartParam("p_" + Buffer.from("https://evil.com").toString("base64url")), null);
  assert.equal(readPathStartParam("boshqa"), null);
  assert.match(pathStartParam("/tests/take?id=5") ?? "", /^[A-Za-z0-9_-]+$/);
});

test("ulaş kodi: öz kodi o'qiladi, soxta va eskirgani yöq", () => {
  const id = "0f8fad5b-d9cb-469f-a165-70867728950e";
  const secret = "sinov";
  const token = createLinkToken(id, secret, NOW);

  assert.match(token, /^[A-Za-z0-9_-]{1,64}$/);
  assert.equal(readLinkToken(token, secret, NOW + 10), id);
  assert.equal(readLinkToken(token, "boshqa", NOW), null);
  assert.equal(readLinkToken(token, secret, NOW + LINK_TOKEN_TTL + 1), null);

  const other = token.replace("0f8fad5b", "0f8fad5c");
  assert.equal(readLinkToken(other, secret, NOW), null);
});
