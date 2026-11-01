/**
 * Test javoblari kaliti — "Matematika 0 dan" to'plamidan.
 *
 * Har mavzuda 4 ta variant: 0 = nazariya + test, 1 = 1-test,
 * 2 = 2-test, 3 = 3-test. `answers` — har bir savolning javobi
 * ketma-ket: "A", "B", "C" yoki "D". "?" belgisi — o'sha savolning
 * kaliti PDF'da yo'q (masalan javobi yozma yoki grafik), u tekshirishda
 * hisobga olinmaydi.
 *
 * Bu fayl `scripts/answer-keys/build.py` orqali "Matematika 0 dan"
 * papkasidagi javoblar PDF'laridan yasalgan. Qo'lda tahrirlasangiz
 * ham bo'ladi, lekin PDF o'zgarsa skriptni qayta ishga tushirgan ma'qul.
 */

export type AnswerVariant = {
  /** PDF'dagi sarlavha: "1-variant", "2-variant / 1-TEST" */
  label: string;
  /** Har savolning javobi ketma-ket, masalan "CDCBDAADBCBDCBA" */
  answers: string;
};

export type AnswerTopic = {
  /** Mavzu raqami (1..89) */
  n: number;
  title: string;
  /** Doim 4 ta: nazariya, 1-test, 2-test, 3-test */
  variants: AnswerVariant[];
};

/** Test turlari — `variants` massividagi tartib bilan bir xil */
export const TEST_LABELS = [
  "Nazariya",
  "1-test",
  "2-test",
  "3-test",
] as const;

export const ANSWER_TOPICS: AnswerTopic[] = [
  {
    n: 1,
    title: "Natural sonlar va ular ustida amallar",
    variants: [
      { label: "1-variant", answers: "CDCBDAADBCBDCBA" },
      { label: "2-variant / 1-TEST", answers: "CBDDACBDCAABDCD" },
      { label: "3-variant / 2-TEST", answers: "ADBCADCBBACCDBA" },
      { label: "4-variant / 3-TEST", answers: "DACBCABDCABBDBA" },
    ],
  },
  {
    n: 2,
    title: "Böliniş belgilari",
    variants: [
      { label: "1-variant", answers: "ACBCABDBCBAD" },
      { label: "2-variant / 1-TEST", answers: "BCADCDBACDBC" },
      { label: "3-variant / 2-TEST", answers: "CADBABDCACBA" },
      { label: "4-variant / 3-TEST", answers: "BCBADCADBCAD" },
    ],
  },
  {
    n: 3,
    title: "Tub va murakkab sonlar. Böliniş belgilari 2-qism",
    variants: [
      { label: "1-variant", answers: "CBDADBADCCDBACABD" },
      { label: "2-variant / 1-TEST", answers: "CABDACBDDCBBCAADB" },
      { label: "3-variant / 2-TEST", answers: "BDCCADBBDADBACBCA" },
      { label: "4-variant / 3-TEST", answers: "CABBDACBDBCACDCAD" },
    ],
  },
  {
    n: 4,
    title: "Sonlarning natural böluvçilari soni va yiğindisi. EKUB va",
    variants: [
      { label: "1-variant", answers: "BACDCCDBABDADCD" },
      { label: "2-variant / 1-TEST", answers: "DAABBDCBDCACDBA" },
      { label: "3-variant / 2-TEST", answers: "ABDCBDBAACDCBCC" },
      { label: "4-variant / 3-TEST", answers: "DACBABBCADCCBAD" },
    ],
  },
  {
    n: 5,
    title: "Sonning natural böluvçilari soni va yiğindisi",
    variants: [
      { label: "1-variant", answers: "CABBDDACCBABDCADBACD" },
      { label: "2-variant / 1-TEST", answers: "ABDCBDCABADCABDCBDAC" },
      { label: "3-variant / 2-TEST", answers: "DACBAACBDCDBCBDACBAD" },
      { label: "4-variant / 3-TEST", answers: "ACBDADBCCBDDBAACCBDA" },
    ],
  },
  {
    n: 6,
    title: "Qoldiqli böliş",
    variants: [
      { label: "1-variant", answers: "BADACBACDDCBCADCBB" },
      { label: "2-variant / 1-TEST", answers: "DACBDCDBACDBAACABD" },
      { label: "3-variant / 2-TEST", answers: "ABDCBACBDCADCABDAC" },
      { label: "4-variant / 3-TEST", answers: "CBBCADBADACDCCBADC" },
    ],
  },
  {
    n: 7,
    title: "Oxirgi raqam",
    variants: [
      { label: "1-variant", answers: "ADCBDBCACD" },
      { label: "2-variant / 1-TEST", answers: "DBACBABDCB" },
      { label: "3-variant / 2-TEST", answers: "ADDCABDCAB" },
      { label: "4-variant / 3-TEST", answers: "CADBDCABDB" },
    ],
  },
  {
    n: 8,
    title: "Oddiy kasrlar (1-qism)",
    variants: [
      { label: "1-variant", answers: "CDBABBADCDDACCDBABDC" },
      { label: "2-variant / 1-TEST", answers: "DBCCACDDACBBDACDBAAB" },
      { label: "3-variant / 2-TEST", answers: "ABDCADCCBBADBCBADCDB" },
      { label: "4-variant / 3-TEST", answers: "DACBDACBABDCACDDBCAB" },
    ],
  },
  {
    n: 9,
    title: "Oddiy kasrlar (2-qism)",
    variants: [
      { label: "1-variant", answers: "BCADDCADCBACAB" },
      { label: "2-variant / 1-TEST", answers: "BCBDAADCABDCBD" },
      { label: "3-variant / 2-TEST", answers: "BDCCDBAACCBABD" },
      { label: "4-variant / 3-TEST", answers: "ADBDCAADCBCACB" },
    ],
  },
  {
    n: 10,
    title: "Önli kasrlar",
    variants: [
      { label: "1-variant", answers: "DCABDACCDBBADCBADBCA" },
      { label: "2-variant / 1-TEST", answers: "DCADBCABDACBAABDCDBB" },
      { label: "3-variant / 2-TEST", answers: "BDACBDCABDCAABDBCBDA" },
      { label: "4-variant / 3-TEST", answers: "DCDBCABACCAABDBCADBC" },
    ],
  },
  {
    n: 11,
    title: "Davriy kasrlar",
    variants: [
      { label: "1-variant", answers: "BADBCADACD" },
      { label: "2-variant / 1-TEST", answers: "ABDCCADBCA" },
      { label: "3-variant / 2-TEST", answers: "DACABBDCAB" },
      { label: "4-variant / 3-TEST", answers: "CBADCABDCD" },
    ],
  },
  {
    n: 12,
    title: "Ratsional sonlar",
    variants: [
      { label: "1-variant", answers: "BCADCBDDACBCADBADCAB" },
      { label: "2-variant / 1-TEST", answers: "DBCACCABDBCABDACDDAC" },
      { label: "3-variant / 2-TEST", answers: "CDBACDBCAADBCABDDCAB" },
      { label: "4-variant / 3-TEST", answers: "CDCAABDBBADBCADCABBC" },
    ],
  },
  {
    n: 13,
    title: "Nisbat, proporsiya, qism va foiz",
    variants: [
      { label: "1-variant", answers: "DBDCABACABACDCBDACBD" },
      { label: "2-variant / 1-TEST", answers: "CDBADCABDACABDDCCBAB" },
      { label: "3-variant / 2-TEST", answers: "ABDDACBDCBDCABDACBAA" },
      { label: "4-variant / 3-TEST", answers: "BDCACBBACDBCADCABDAA" },
    ],
  },
  {
    n: 14,
    title: "Daraja va uning xossalari (1-qism)",
    variants: [
      { label: "1-variant", answers: "ABACDCBDBBDACADACBDC" },
      { label: "2-variant / 1-TEST", answers: "DCABADDACBBCABBDDCAC" },
      { label: "3-variant / 2-TEST", answers: "BCADBDCABDCBAADDCABA" },
      { label: "4-variant / 3-TEST", answers: "DACDCBABDCABDACBDBBA" },
    ],
  },
  {
    n: 15,
    title: "Daraja va uning xossalari (2-qism)",
    variants: [
      { label: "1-variant", answers: "ACADBCBDCCADBA" },
      { label: "2-variant / 1-TEST", answers: "ACDCBADDCBABDC" },
      { label: "3-variant / 2-TEST", answers: "DCBBDADCACDBAC" },
      { label: "4-variant / 3-TEST", answers: "BCABDACADCDBAB" },
    ],
  },
  {
    n: 16,
    title: "Ölçov birliklar. Birhadlar va algebraik ifodalar",
    variants: [
      { label: "1-variant", answers: "DACBACCBADBDCB" },
      { label: "2-variant / 1-TEST", answers: "DCCDBACBADACBD" },
      { label: "3-variant / 2-TEST", answers: "CBADCDBACCBABD" },
      { label: "4-variant / 3-TEST", answers: "DBCADCDBDAABAC" },
    ],
  },
  {
    n: 17,
    title: "Köphadlar va ular ustida amallar",
    variants: [
      { label: "1-variant", answers: "ADCDBCADBCABAD" },
      { label: "2-variant / 1-TEST", answers: "DCABBDCAADCBCC" },
      { label: "3-variant / 2-TEST", answers: "CDADBCABADBCAC" },
      { label: "4-variant / 3-TEST", answers: "DACBCABDADBCAB" },
    ],
  },
  {
    n: 18,
    title: "Qisqa köpaytiriş formulalari 1-qism",
    variants: [
      { label: "1-variant", answers: "BCADDACBADCBABDDCABDCB" },
      { label: "2-variant / 1-TEST", answers: "BDCADCABDBCADCABBADCAB" },
      { label: "3-variant / 2-TEST", answers: "BBCACDDBACADCDBCBDACAB" },
      { label: "4-variant / 3-TEST", answers: "CABACDBCBDDAACBACDBCAD" },
    ],
  },
  {
    n: 19,
    title: "Qisqa köpaytiriş formulalari 2-qism",
    variants: [
      { label: "1-variant", answers: "CDCBDAACADBDAC" },
      { label: "2-variant / 1-TEST", answers: "ADDACCBDACBABB" },
      { label: "3-variant / 2-TEST", answers: "DAADBCBDBCACCB" },
      { label: "4-variant / 3-TEST", answers: "CBBDADCBACBACD" },
    ],
  },
  {
    n: 20,
    title: "Qisqa köpaytiriş formulalari 3-qism",
    variants: [
      { label: "1-variant", answers: "ABDCBDCABDAACC" },
      { label: "2-variant / 1-TEST", answers: "BCBDCDBACABDAC" },
      { label: "3-variant / 2-TEST", answers: "CDBCAADCBADBDC" },
      { label: "4-variant / 3-TEST", answers: "CBDAABDACBACDB" },
    ],
  },
  {
    n: 21,
    title: "Köpaytuvçilarga ajratiş 1-qism",
    variants: [
      { label: "1-variant", answers: "DBCCBADAACDBDADBCB" },
      { label: "2-variant / 1-TEST", answers: "ABDCADCADBDCBCACBA" },
      { label: "3-variant / 2-TEST", answers: "BCADCBDCADBDACBDCB" },
      { label: "4-variant / 3-TEST", answers: "CBCADCBDBADAACCBAD" },
    ],
  },
  {
    n: 22,
    title: "Köpaytuvçilarga ajratiş 2-qism",
    variants: [
      { label: "1-variant", answers: "BDACBCCADCBADBA" },
      { label: "2-variant / 1-TEST", answers: "DCBDACBABDACAAB" },
      { label: "3-variant / 2-TEST", answers: "ABDCBDACDCBDACB" },
      { label: "4-variant / 3-TEST", answers: "ACBDACADBADCBCA" },
    ],
  },
  {
    n: 23,
    title: "Algebraik kasrlar 1-qism",
    variants: [
      { label: "1-variant", answers: "ADCBAACBCADBDCCDBCBADC" },
      { label: "2-variant / 1-TEST", answers: "BCAADCDBCBADBDDCBACDBA" },
      { label: "3-variant / 2-TEST", answers: "CABDCBDACDBABDACDBACDB" },
      { label: "4-variant / 3-TEST", answers: "DBCBDADCAABACBBDADCBDC" },
    ],
  },
  {
    n: 24,
    title: "Algebraik kasrlar 2-qism",
    variants: [
      { label: "1-variant", answers: "ABDCBCCBDACDDACDBBAA" },
      { label: "2-variant / 1-TEST", answers: "BACDBADBCCDDCABACDBA" },
      { label: "3-variant / 2-TEST", answers: "CAADCBABBDBCBDCACDBA" },
      { label: "4-variant / 3-TEST", answers: "DCDBACBBCABDADCACDBA" },
    ],
  },
  {
    n: 25,
    title: "Çiziqli tenglamalar",
    variants: [
      { label: "1-variant", answers: "DCABDBAACCBDCACBABDACDBA" },
      { label: "2-variant / 1-TEST", answers: "ADBCCADDBCABDADCBCABDACD" },
      { label: "3-variant / 2-TEST", answers: "ADCBDCDBABDACBADCBADCCAB" },
      { label: "4-variant / 3-TEST", answers: "CBADBACDDCBAACBDDBACDBAC" },
    ],
  },
  {
    n: 26,
    title: "Çiziqli tenglamalar sistemasi",
    variants: [
      { label: "1-variant", answers: "ADCBDBADBACDCCA" },
      { label: "2-variant / 1-TEST", answers: "BADCBDCABDCDBAC" },
      { label: "3-variant / 2-TEST", answers: "BCABDADBDCDBCAB" },
      { label: "4-variant / 3-TEST", answers: "BADBDCDBCADCAAC" },
    ],
  },
  {
    n: 27,
    title: "Çiziqli tengsizlik va tengsizliklar sistemasi",
    variants: [
      { label: "1-variant", answers: "BACBDCCDCABDACADBADBCADC" },
      { label: "2-variant / 1-TEST", answers: "ACDACCDBACDACBBADBDADBCB" },
      { label: "3-variant / 2-TEST", answers: "CBADBDADCBDBACABDCDBACAB" },
      { label: "4-variant / 3-TEST", answers: "BDACDABACDBCDBBCCDCABDAA" },
    ],
  },
  {
    n: 28,
    title: "Tenglama va tenglamalar sistemasi orqali yeçiladigan matnli",
    variants: [
      { label: "1-variant", answers: "CBDACCAABBDCDDADBBCAA" },
      { label: "2-variant / 1-TEST", answers: "CDBADBCACBDBADDCABDAA" },
      { label: "3-variant / 2-TEST", answers: "CBADBCADBADCCDBABDAAC" },
      { label: "4-variant / 3-TEST", answers: "ADBACBACBDCCBDACDBCBD" },
    ],
  },
  {
    n: 29,
    title: "Çiziqli funksiya 1-qism",
    variants: [
      { label: "1-variant", answers: "??BADAC????BADB" },
      { label: "2-variant / 1-TEST", answers: "??DADCA????BDBC" },
      { label: "3-variant / 2-TEST", answers: "??ACBDC????AABD" },
      { label: "4-variant / 3-TEST", answers: "??ADBBC????ACDC" },
    ],
  },
  {
    n: 30,
    title: "Çiziqli funksiya 2-qism",
    variants: [
      { label: "1-variant", answers: "DCDBACBCAABBDC" },
      { label: "2-variant / 1-TEST", answers: "DBACCBADCBDACA" },
      { label: "3-variant / 2-TEST", answers: "CDBBAADACCBACB" },
      { label: "4-variant / 3-TEST", answers: "CBABDDCBACADBA" },
    ],
  },
  {
    n: 31,
    title: "Arifmetik kvadrat ildiz va uning xossalari 1-qism",
    variants: [
      { label: "1-variant", answers: "DBADCABDCABDCCBDACBD" },
      { label: "2-variant / 1-TEST", answers: "BADCADDCACBBADBACBCA" },
      { label: "3-variant / 2-TEST", answers: "DCCABADDCABADBBCACDD" },
      { label: "4-variant / 3-TEST", answers: "ADCBACDCABDCBABBADDC" },
    ],
  },
  {
    n: 32,
    title: "Arifmetik kvadrat ildiz va uning xossalari 2-qism",
    variants: [
      { label: "1-variant", answers: "ADDBBCADCDBACBA" },
      { label: "2-variant / 1-TEST", answers: "ACBDDBACABBDCAD" },
      { label: "3-variant / 2-TEST", answers: "BACBDACBDCADCBC" },
      { label: "4-variant / 3-TEST", answers: "CDBAADCDBCACBDC" },
    ],
  },
  {
    n: 33,
    title: "Ildizli ifodalar",
    variants: [
      { label: "1-variant", answers: "DCCDBADACBDBAABDCCAB" },
      { label: "2-variant / 1-TEST", answers: "CBADCCDDAABBCABADBCA" },
      { label: "3-variant / 2-TEST", answers: "CADDACBADCBBACDCBAAC" },
      { label: "4-variant / 3-TEST", answers: "CBACDBDACBACCDBADACB" },
    ],
  },
  {
    n: 34,
    title: "Kvadrat tenglamalar 1-qism",
    variants: [
      { label: "1-variant", answers: "ACBBDCBAADBACD" },
      { label: "2-variant / 1-TEST", answers: "ABDACBCABDADCD" },
      { label: "3-variant / 2-TEST", answers: "DCADBACBABBADC" },
      { label: "4-variant / 3-TEST", answers: "ADBBDCDBACDBCA" },
    ],
  },
  {
    n: 35,
    title: "Kvadrat tenglamalar 2-qism",
    variants: [
      { label: "1-variant", answers: "ABADCDBACD" },
      { label: "2-variant / 1-TEST", answers: "CDCBABDACD" },
      { label: "3-variant / 2-TEST", answers: "ACDBACDBCB" },
      { label: "4-variant / 3-TEST", answers: "DBCACCDDBA" },
    ],
  },
  {
    n: 36,
    title: "Viyet teoremasi 1-qism",
    variants: [
      { label: "1-variant", answers: "ADCBCAADDBCABD" },
      { label: "2-variant / 1-TEST", answers: "DBCABDACBCABDA" },
      { label: "3-variant / 2-TEST", answers: "ACBBDAADCBCADC" },
      { label: "4-variant / 3-TEST", answers: "CABDDCABDCBAAC" },
    ],
  },
  {
    n: 37,
    title: "Viyet teoremasi 2-qism",
    variants: [
      { label: "1-variant", answers: "ADCBADDCBDBC" },
      { label: "2-variant / 1-TEST", answers: "ADBDCADCBCAA" },
      { label: "3-variant / 2-TEST", answers: "ABDCBACDCADB" },
      { label: "4-variant / 3-TEST", answers: "CDBDACBBABDA" },
    ],
  },
  {
    n: 38,
    title: "Ratsional tenglamalar",
    variants: [
      { label: "1-variant", answers: "ABACDBCCADDACBADBBDDBB" },
      { label: "2-variant / 1-TEST", answers: "CABDCBACBDDBACBCACDCBC" },
      { label: "3-variant / 2-TEST", answers: "CAABDDCBCABDADBBCDCBAD" },
      { label: "4-variant / 3-TEST", answers: "DBCABDBADCACDACABADCBA" },
    ],
  },
  {
    n: 39,
    title: "Ikkinçi va yuqori darajali tenglamalar",
    variants: [
      { label: "1-variant", answers: "DCBDCACBDACCBAD" },
      { label: "2-variant / 1-TEST", answers: "BBCBCAADCACABCC" },
      { label: "3-variant / 2-TEST", answers: "DCBDAACABDCCDAC" },
      { label: "4-variant / 3-TEST", answers: "BAABCCBCCDDACCA" },
    ],
  },
  {
    n: 40,
    title: "Köphadlar",
    variants: [
      { label: "1-variant", answers: "BDCBACDDAABDCBCADCBA" },
      { label: "2-variant / 1-TEST", answers: "CACDBAABDCBDACDBCADA" },
      { label: "3-variant / 2-TEST", answers: "ABDACDCCADBBDBCADBAC" },
      { label: "4-variant / 3-TEST", answers: "DCBACDBBACADCACDBADD" },
    ],
  },
  {
    n: 41,
    title: "Ratsional tengsizliklar 1-qism",
    variants: [
      { label: "1-variant", answers: "CDDACBAADBDCBBACDBAC" },
      { label: "2-variant / 1-TEST", answers: "CBDACDCBAADBCACDBABD" },
      { label: "3-variant / 2-TEST", answers: "ABDCADCDBDCABDBCABAC" },
      { label: "4-variant / 3-TEST", answers: "DCDBACDBBCABADACDBAC" },
    ],
  },
  {
    n: 42,
    title: "Ratsional tengsizliklar 2-qism",
    variants: [
      { label: "1-variant", answers: "CBDCABDACCBADACB" },
      { label: "2-variant / 1-TEST", answers: "BCADBACABDACDCBD" },
      { label: "3-variant / 2-TEST", answers: "BCACDBDACBADCDBA" },
      { label: "4-variant / 3-TEST", answers: "BCADCBDACBADBBDC" },
    ],
  },
  {
    n: 43,
    title: "Kvadrat funksiya",
    variants: [
      { label: "1-variant", answers: "???CABDBCAAB??DDACCBDD" },
      { label: "2-variant / 1-TEST", answers: "???CDBABDCBA??DBACDDCA" },
      { label: "3-variant / 2-TEST", answers: "???ACBADCDDB??CAABDACB" },
      { label: "4-variant / 3-TEST", answers: "???ACDBDACBD??CABADBCA" },
    ],
  },
  {
    n: 44,
    title: "Parametrli tenglama va tengsizliklar",
    variants: [
      { label: "1-variant", answers: "BCADBCABDACCBDADDB" },
      { label: "2-variant / 1-TEST", answers: "ACDCBBDACDBCADDCAB" },
      { label: "3-variant / 2-TEST", answers: "DACBBCADCBDADBACDC" },
      { label: "4-variant / 3-TEST", answers: "CDBACBABDBCCAADBDA" },
    ],
  },
  {
    n: 45,
    title: "Modulli ifodalar va tenglamalar",
    variants: [
      { label: "1-variant", answers: "DACBDCABADCBDCBCABCADDAA" },
      { label: "2-variant / 1-TEST", answers: "CDCBABDBADACBADBCBDCACDB" },
      { label: "3-variant / 2-TEST", answers: "DCABDACBDCABDACABBCBDDAC" },
      { label: "4-variant / 3-TEST", answers: "ABDCBDDCADBBACDBACBACADB" },
    ],
  },
  {
    n: 46,
    title: "Modulli tengsizliklar",
    variants: [
      { label: "1-variant", answers: "BCADBCADACBDCABDABDBCABDA" },
      { label: "2-variant / 1-TEST", answers: "BCABDCADBADACDBDACBABDDCA" },
      { label: "3-variant / 2-TEST", answers: "DBBACDBACDBCCADACDBCABACD" },
      { label: "4-variant / 3-TEST", answers: "CAADDBCCDBACBDBADACDBCBAA" },
    ],
  },
  {
    n: 47,
    title: "Ratsional körsatkiçli daraja va uning xossalari",
    variants: [
      { label: "1-variant", answers: "ABCADCABDADBCADCBCADABDCB" },
      { label: "2-variant / 1-TEST", answers: "CCDBDAABADBBCBDCADCABCADB" },
      { label: "3-variant / 2-TEST", answers: "CDADBCABDCABDCBDADBBCDDAA" },
      { label: "4-variant / 3-TEST", answers: "DABACDCBDACABBDCBDACDACBA" },
    ],
  },
  {
    n: 48,
    title: "Irratsional tenglamalar",
    variants: [
      { label: "1-variant", answers: "BCADCBDADDACBCADBACCBDBAC" },
      { label: "2-variant / 1-TEST", answers: "BABDCABDCDBACDCABDBCADACB" },
      { label: "3-variant / 2-TEST", answers: "ABDDACBABDCBACABDCDBDCADC" },
      { label: "4-variant / 3-TEST", answers: "DCBADCBDACBABDCCAABDCBADA" },
    ],
  },
  {
    n: 49,
    title: "Irratsional tengsizliklar",
    variants: [
      { label: "1-variant", answers: "DDBACBACADCBBACBDACADBCAB" },
      { label: "2-variant / 1-TEST", answers: "CDBABCADBADCCDDACBBADCADC" },
      { label: "3-variant / 2-TEST", answers: "ABDDCDBABDACCAABBCBDCADCC" },
      { label: "4-variant / 3-TEST", answers: "ABDCBADDCADCBABDCBCADCBAD" },
    ],
  },
  {
    n: 50,
    title: "Arifmetik progressiya",
    variants: [
      { label: "1-variant", answers: "DCBABDACDDACCBCABDDCABDBA" },
      { label: "2-variant / 1-TEST", answers: "DAACBCACBDBADCDBACBDACBCC" },
      { label: "3-variant / 2-TEST", answers: "BCCADACABDCBDADBADBACCBDC" },
      { label: "4-variant / 3-TEST", answers: "BDCABDCADBACBDCBADCDBADCD" },
    ],
  },
  {
    n: 51,
    title: "Arifmetik progressiya yiğindisi",
    variants: [
      { label: "1-variant", answers: "CCAABDADCBCCBBDDBADC" },
      { label: "2-variant / 1-TEST", answers: "DADCBCACBDACBDACDBAC" },
      { label: "3-variant / 2-TEST", answers: "BBDACDBCABDACDCABDAC" },
      { label: "4-variant / 3-TEST", answers: "BDACCBBAACDBDACDBDAC" },
    ],
  },
  {
    n: 52,
    title: "Geometrik progressiya —  javoblari",
    variants: [
      { label: "1-variant", answers: "ADBACBCADCABDBADCABDCBACDB" },
      { label: "2-variant / 1-TEST", answers: "ADBBCACDBADCCBAADDCDBCABDC" },
      { label: "3-variant / 2-TEST", answers: "ADBACBCADACBCADDBCBDCABDBA" },
      { label: "4-variant / 3-TEST", answers: "DBBDCAACBDCDBACDBACBDCAABD" },
    ],
  },
  {
    n: 53,
    title: "Matnli masalalar 1-qism —  javoblari",
    variants: [
      { label: "1-variant", answers: "CCDBBADCDBADACBCACBDAD" },
      { label: "2-variant / 1-TEST", answers: "CADACDBBADBCADBCCBABDC" },
      { label: "3-variant / 2-TEST", answers: "CADBADBCBAACDBDCAABDCB" },
      { label: "4-variant / 3-TEST", answers: "ACBADACBDCBDCBADACDBCA" },
    ],
  },
  {
    n: 54,
    title: "Matnli masalalar 2-qism —  javoblari",
    variants: [
      { label: "1-variant", answers: "BDCDBCAADCDBACBBACDBACBD" },
      { label: "2-variant / 1-TEST", answers: "CCABDACDBABDAABDCCBADCAD" },
      { label: "3-variant / 2-TEST", answers: "AABADCBDCCDBACCADBDDCBCA" },
      { label: "4-variant / 3-TEST", answers: "BABDACBDCACDCBADACDBCABD" },
    ],
  },
  {
    n: 55,
    title: "Funksiya (1-qism) —  javoblari",
    variants: [
      { label: "1-variant", answers: "BDACBDACBCADCABACDBADCABBDCADC" },
      { label: "2-variant / 1-TEST", answers: "CDDBADCBADCBACCDBACBADAACBDACD" },
      { label: "3-variant / 2-TEST", answers: "BABDCBADCADCADCBABDACDCBDACABD" },
      { label: "4-variant / 3-TEST", answers: "CABDCBDACDBADBCADACCBDBADBBDAC" },
    ],
  },
  {
    n: 56,
    title: "Funksiya (2-qism)",
    variants: [
      { label: "1-variant", answers: "DACBBACBCCADDCBADBDDACBAA" },
      { label: "2-variant", answers: "DACBDACDBAABDCBACCCABDADB" },
      { label: "3-variant", answers: "DACCBDBADACDCBBACDACDBABB" },
      { label: "4-variant", answers: "CBDBAADACDDBCACDBDDBACABD" },
    ],
  },
  {
    n: 57,
    title: "Funksiya (3-qism) —  javoblari",
    variants: [
      { label: "1-variant", answers: "BDACCBADDCBABDCBCAAD" },
      { label: "2-variant / 1-TEST", answers: "ADBBACCBADDCBDDCABAC" },
      { label: "3-variant / 2-TEST", answers: "CBDDAABDCACBCAACBBDA" },
      { label: "4-variant / 3-TEST", answers: "CBBCADBAADBCADBDCADC" },
    ],
  },
  {
    n: 58,
    title: "Funksiya (4-qism) —  javoblari",
    variants: [
      { label: "1-variant", answers: "AACDBBDCDBCABDC" },
      { label: "2-variant / 1-TEST", answers: "DCABBAACBDCCADD" },
      { label: "3-variant / 2-TEST", answers: "BCABDCAADCABDCC" },
      { label: "4-variant / 3-TEST", answers: "CADBCADCDBABDCB" },
    ],
  },
  {
    n: 59,
    title: "Körsatkiçli tenglama -  javoblari",
    variants: [
      { label: "1-variant", answers: "ACADCDBDDAABACCBDCBBADBCAABDDC" },
      { label: "2-variant / 1-TEST", answers: "BDCCABDAADBACBACDCBBDACCDBADCA" },
      { label: "3-variant / 2-TEST", answers: "DCDBADBACBDACBACDBDACCAABBADCB" },
      { label: "4-variant / 3-TEST", answers: "BDBACDDBACBACBDCDBAACCDCADBACD" },
    ],
  },
  {
    n: 60,
    title: "Körsatkiçli tengsizlik",
    variants: [
      { label: "1-variant", answers: "ABACBDCDDACDCBABBDAC" },
      { label: "2-variant / 1-TEST", answers: "ADBDCABACBCCADBDCBAD" },
      { label: "3-variant / 2-TEST", answers: "AADBCBDCBDACABDACCBB" },
      { label: "4-variant / 3-TEST", answers: "DCABDDBACABACCABDACB" },
    ],
  },
  {
    n: 61,
    title: "Logarifmlar",
    variants: [
      { label: "1-variant", answers: "CADBCADCABDADBCBDCBABDCADBADCB" },
      { label: "2-variant / 1-TEST", answers: "BADCBDCAACDBCADBCABDBACDDCADBB" },
      { label: "3-variant / 2-TEST", answers: "BADCCDBBDACBADBDCCADBACBADBDCA" },
      { label: "4-variant / 3-TEST", answers: "CBDADBADBCABDCACBDACDBACBDACDB" },
    ],
  },
  {
    n: 62,
    title: "Logarifmik şakl almaştirişlar",
    variants: [
      { label: "1-variant", answers: "BACBADDCBDDBACDCAA" },
      { label: "2-variant / 1-TEST", answers: "CBDDCABDAACBCACDBA" },
      { label: "3-variant / 2-TEST", answers: "DACDBCABDBACBACBCC" },
      { label: "4-variant / 3-TEST", answers: "BCADBCADBCCADBADBA" },
    ],
  },
  {
    n: 63,
    title: "Logarifmik funksiya va uning xossalari",
    variants: [
      { label: "1-variant", answers: "ACBDACBDBACDABDCADBCACBDA" },
      { label: "2-variant", answers: "CBDACBDADCABCDBACBDACADBC" },
      { label: "3-variant", answers: "BDACDACBADBCDACBDCABDBCAD" },
      { label: "4-variant", answers: "DACBCDACCBDABCADBACDBDACB" },
    ],
  },
  {
    n: 64,
    title: "Logarifmik tenglamalar",
    variants: [
      { label: "1-variant", answers: "BDAACABDDACDBCADDBCDCAABDBCCDABCB" },
      { label: "2-variant / 1-TEST", answers: "CCADBACBDACABBDDADCBCCDCDABDDABAB" },
      { label: "3-variant / 2-TEST", answers: "ABBCACDDCDBDDCDCABABABDDAACCBCCBA" },
      { label: "4-variant / 3-TEST", answers: "CDABBDCCDAABAABBCCACDBCDADACBBDDB" },
    ],
  },
  {
    n: 65,
    title: "Logarifmik tengsizliklar – javoblar kaliti",
    variants: [
      { label: "1-variant", answers: "CDBCBBCADAADCCBCABBDDAABADD" },
      { label: "1-TEST / 2-variant", answers: "BADCDADCBABCDCDABABCDBCABCD" },
      { label: "2-TEST / 3-variant", answers: "CBADAABABDBDCBCADADBABCCDDC" },
      { label: "3-TEST / 4-variant", answers: "CBDDBADDCCDAABBCBCADABADCBC" },
    ],
  },
  {
    n: 66,
    title: "Trigonometriya. Asosiy tuşunçalar",
    variants: [
      { label: "1-variant", answers: "BBDCADBBDCACDC" },
      { label: "1-TEST", answers: "ACBCADBDABBDAD" },
      { label: "2-TEST", answers: "DABAADCDACBBDC" },
      { label: "3-TEST", answers: "DDBCACBDACDAAB" },
    ],
  },
  {
    n: 67,
    title: "Trigonometrik funksiya qiymatlari",
    variants: [
      { label: "1-variant", answers: "BBDBCCADABDCDBBDBADBADCDBAACBD" },
      { label: "1-TEST", answers: "BDACDBADCACCBDADCDBADBADAACBCA" },
      { label: "2-TEST", answers: "DBABDCDACDADBCABBDCDBCABBCABDA" },
      { label: "3-TEST", answers: "CCBBDBACBDCADCADCCDBACDABBCADB" },
    ],
  },
  {
    n: 68,
    title: "Asosiy trigonometrik ayniyatlar",
    variants: [
      { label: "1-variant", answers: "DBCAADCDBDADCABDAACDBACCABACAD" },
      { label: "1-TEST", answers: "DBABBCBBDCABACBDAACDACCDBDCABA" },
      { label: "2-TEST", answers: "CAABBCADABADBDCCDBADABADACADDC" },
      { label: "3-TEST", answers: "CCADCDACBDBBAADABDBACDCAADBADC" },
    ],
  },
  {
    n: 69,
    title: "Keltiriş formulalari.           Sinuslar va kosinuslar teoremasi",
    variants: [
      { label: "1-variant", answers: "BDABACDCCDCADCABBCABACDBCBBABD" },
      { label: "1-TEST / 2-variant", answers: "CADABDBBDBCBDCACDCADCDBADABADB" },
      { label: "2-TEST / 3-variant", answers: "BDBBDBCCABADCACDACDBDCADCACDBB" },
      { label: "3-TEST / 4-variant", answers: "ABACABBACBDBBCADCABDDADBCABDCD" },
    ],
  },
  {
    n: 70,
    title: "Qöşiş formulalari",
    variants: [
      { label: "1-variant", answers: "CACDABAACADABDBADCDBCCBCCADBCB" },
      { label: "1-TEST / 2-variant", answers: "DABAADBDABADABACBDADCCBDADCCBC" },
      { label: "2-TEST / 3-variant", answers: "ABADCADDBABDCDBAACDBACABDADCCD" },
      { label: "3-TEST / 4-variant", answers: "BCBDABACABDDCACBDDCABDACBBCACB" },
    ],
  },
  {
    n: 71,
    title: "Ikkilangan burçak formulalari",
    variants: [
      { label: "1-variant", answers: "DACABDADBADDCADBCACBDCCBCADABD" },
      { label: "1-TEST / 2-variant", answers: "ACADCABADBDCABDCDBCABDCABBDBAC" },
      { label: "2-TEST / 3-variant", answers: "BCACDCABDADBDCDABACADACCABDBAB" },
      { label: "3-TEST / 4-variant", answers: "CADACBDBABBACDBDDCDABACCDADCAB" },
    ],
  },
  {
    n: 72,
    title: "Yiğindi va köpaytma uçun formulalar",
    variants: [
      { label: "1-variant", answers: "ACABDACBBACCDADBDABDADCDBBCBDC" },
      { label: "1-TEST / 2-variant", answers: "BDADCADABDADCABBCBDCCABACCABAC" },
      { label: "2-TEST / 3-variant", answers: "DBCCDBADBDCADDABADACDBCACDABBA" },
      { label: "3-TEST / 4-variant", answers: "ACDBADBDCADBCACDACBDBBCCAABDAC" },
    ],
  },
  {
    n: 73,
    title: "Yarim burçak formulalari",
    variants: [
      { label: "1-variant", answers: "ACBBAACADCDDBADCABDA" },
      { label: "1-TEST / 2-variant", answers: "CDACCABAADCCBDBCADBD" },
      { label: "2-TEST / 3-variant", answers: "BCABDBBCBBDCABADCDDA" },
      { label: "3-TEST / 4-variant", answers: "DDCABACADBBACCABADCD" },
    ],
  },
  {
    n: 74,
    title: "Teskari trigonometrik funksiyalar",
    variants: [
      { label: "1-variant", answers: "BCBDCDABADCDBABDBCAACBDAADDBCB" },
      { label: "1-TEST / 2-variant", answers: "CABACBBDCDABADBACADCAACCBDCADC" },
      { label: "2-TEST / 3-variant", answers: "ACABACBDDBCBDBBDCDBCBDABADCDDA" },
      { label: "3-TEST / 4-variant", answers: "DACCDBDCABDBCABDACCACDBABDCADA" },
    ],
  },
  {
    n: 75,
    title: "Trigonometrik funksiyalar va ularning xossalari",
    variants: [
      { label: "1-variant", answers: "CBDABACABDDAABBDCDACDBCBDACDAD" },
      { label: "1-TEST / 2-variant", answers: "DADBABDCADACDBCACDABADBCBDCDBC" },
      { label: "2-TEST / 3-variant", answers: "ABACBDDCCDBCACDBCADABDDBCADCAB" },
      { label: "3-TEST / 4-variant", answers: "BADCDACABBCADACADCDBDADBCACBBC" },
    ],
  },
  {
    n: 76,
    title: "Trigonometrik tenglamalar (1-qism)",
    variants: [
      { label: "1-variant", answers: "DBBCADACDBCBDABADABBDCCADABACD" },
      { label: "1-TEST / 2-variant", answers: "ACADBBDABADACDABACBBDCCABDBCAC" },
      { label: "2-TEST / 3-variant", answers: "BACDACBDBCBDADCACDBABDABAACBBD" },
      { label: "3-TEST / 4-variant", answers: "CBCABACDABDBADCACDACBCCDABDDAB" },
    ],
  },
  {
    n: 77,
    title: "Trigonometrik tenglamalar (2-qism)",
    variants: [
      { label: "1-variant", answers: "CBDBACBBABDACABDCADAACDABBD" },
      { label: "1-TEST / 2-variant", answers: "DACBCABDCADABDDBDCDACBDCCAC" },
      { label: "2-TEST / 3-variant", answers: "ACADBBDCDABBDCDACDBBDCADBCA" },
      { label: "3-TEST / 4-variant", answers: "BCBDACABBDCDBCCAACADACABACD" },
    ],
  },
  {
    n: 78,
    title: "Trigonometrik tengsizliklar",
    variants: [
      { label: "1-variant", answers: "DADCDBBDBCBBADCDBACABDAC" },
      { label: "1-TEST / 2-variant", answers: "ADDBADACCDBDCCDBADABACBC" },
      { label: "2-TEST / 3-variant", answers: "CBCADBDACCDBBABDAABACBDA" },
      { label: "3-TEST / 4-variant", answers: "BDACBBDADBACAADBACDBCCDC" },
    ],
  },
  {
    n: 79,
    title: "Hosila (1-qism)",
    variants: [
      { label: "1-variant", answers: "ADBACDDBCABADDCABACA" },
      { label: "1-TEST / 2-variant", answers: "CBDBADCACBBAADCDACAD" },
      { label: "2-TEST / 3-variant", answers: "BCABAADCDACBBDAACDBC" },
      { label: "3-TEST / 4-variant", answers: "DADCADBDCCADCABDDBAB" },
    ],
  },
  {
    n: 80,
    title: "Hosila (2-qism)",
    variants: [
      { label: "1-variant", answers: "ADABDCDACBDADCCADBAB" },
      { label: "1-TEST / 2-variant", answers: "CBBCADBCAADACDABDBBA" },
      { label: "2-TEST / 3-variant", answers: "BAACABACDCCBDAADBCBD" },
      { label: "3-TEST / 4-variant", answers: "DCDADCACBDAACBBDBADD" },
    ],
  },
  {
    n: 81,
    title: "Murakkab funksiya hosilasi",
    variants: [
      { label: "1-variant", answers: "ADBACCCDBCBDDADBABDABADABBCCCA" },
      { label: "1-TEST / 2-variant", answers: "DBDBBDBDCCDABACAAACBAADABCBDCC" },
      { label: "2-TEST / 3-variant", answers: "BACABCACAACADBDBBDDDBCBADCACBD" },
      { label: "3-TEST / 4-variant", answers: "BBDAADCACCBBAADBADBDBDCCDABCCA" },
    ],
  },
  {
    n: 82,
    title: "Funksiyani tekşiriş",
    variants: [
      { label: "1-variant", answers: "ACDADCDADABBADCBAACBBDBDCBABCC" },
      { label: "1-TEST / 2-variant", answers: "BADCAADCDCBADCCBCBCDAABDBDDCBA" },
      { label: "2-TEST / 3-variant", answers: "BADDCDADACABADCBDBDBAACCACCBBC" },
      { label: "3-TEST / 4-variant", answers: "CDADCDBBABDCCBAABBDABCDCACDADB" },
    ],
  },
  {
    n: 83,
    title: "Hosilaning geometrik va mexanik ma’nosi",
    variants: [
      { label: "1-variant", answers: "ABCDABCDBCCABAABCDBDDACBDBADCA" },
      { label: "1-TEST / 2-variant", answers: "BCBDAADADAACBCDBABBCCABCDCADDB" },
      { label: "2-TEST / 3-variant", answers: "BBAACDDCDACBADCBDBDDCACAACBABB" },
      { label: "3-TEST / 4-variant", answers: "ABBDDACADCCBBAACABDBCDADCBDABC" },
    ],
  },
  {
    n: 84,
    title: "Boşlanğiç funksiya va integral (1-qism)",
    variants: [
      { label: "1-variant", answers: "BDACCBBACDAABCDAABBDDCCDA" },
      { label: "1-TEST / 2-variant", answers: "DABAADBCADABABBCCBCDBCDDC" },
      { label: "2-TEST / 3-variant", answers: "CDCBCDDCCBAADBDBDCAABABAC" },
      { label: "3-TEST / 4-variant", answers: "DACCBADCAADABDDBBCADBCBCD" },
    ],
  },
  {
    n: 85,
    title: "Boşlanğiç funksiya va integral (2-qism)",
    variants: [
      { label: "1-variant", answers: "BCADBCBCCBCAADAADBADBADCCABDBD" },
      { label: "1-TEST / 2-variant", answers: "CCABDDBADACDBBCCADADBCBABCCADD" },
      { label: "2-TEST / 3-variant", answers: "BCAABDDCBBAABDDCACBABCCACDADCD" },
      { label: "3-TEST / 4-variant", answers: "BBCDDACDACCADADABDDCBBDBACABCB" },
    ],
  },
  {
    n: 86,
    title: "Aniq integral va egri çiziqli trapetsiya yuzi",
    variants: [
      { label: "1-variant", answers: "AACABBABADBDDCBDABDCBCCBCDACDA" },
      { label: "1-TEST / 2-variant", answers: "DBCAACCBDDCAABDADBCACDCBCABDDB" },
      { label: "2-TEST / 3-variant", answers: "AADBBACADACBDADBDCCBDCAACCDBCB" },
      { label: "3-TEST / 4-variant", answers: "ADDBDBCBDACCABBCADCADCBCAADDBB" },
    ],
  },
  {
    n: 87,
    title: "Kombinatorika",
    variants: [
      { label: "1-variant", answers: "DADACCDAACACBBADDBBCBADCB" },
      { label: "1-TEST / 2-variant", answers: "ABCDADACAABCBDCBDACBDBDBC" },
      { label: "2-TEST / 3-variant", answers: "DCBABADBCACABDBCCAADCCBDD" },
      { label: "3-TEST / 4-variant", answers: "ADDACDBCCBCABBDDCBAADACDB" },
    ],
  },
  {
    n: 88,
    title: "Kombinatorika va Nyuton binomi",
    variants: [
      { label: "1-variant", answers: "DBDAACBACBBDBCDCBDADBACACCBDAA" },
      { label: "1-TEST / 2-variant", answers: "BCCAACCBCDBDACBBCCDABADDBBDDAA" },
      { label: "2-TEST / 3-variant", answers: "BBACBBCCDDCAADDCCBCDABCDADDABA" },
      { label: "3-TEST / 4-variant", answers: "DBCADDAADACBACCDBDCADBABCCABBD" },
    ],
  },
  {
    n: 89,
    title: "Töplamlar va ehtimollar nazariyasi",
    variants: [
      { label: "1-variant", answers: "ACDACCBADDACDBBABBCDABACBBDDCA" },
      { label: "1-TEST / 2-variant", answers: "BDACCDBBACDBDCACBCADADACDBABBC" },
      { label: "2-TEST / 3-variant", answers: "BADDABACCACDBCBCADADDBCBDACBDC" },
      { label: "3-TEST / 4-variant", answers: "AABADABDAADBDDCCACDABCBDCDBCCB" },
    ],
  },
];

/** Mavzuni raqami bo'yicha topish */
export function findAnswerTopic(n: number): AnswerTopic | null {
  return ANSWER_TOPICS.find((topic) => topic.n === n) ?? null;
}
