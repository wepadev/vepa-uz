/*
 * Natija, reyting va profil sahifalaridagi umumiy yordamchilar.
 */

export function getSingleValue(
  value: string | string[] | undefined,
) {
  return Array.isArray(value)
    ? value[0]
    : value;
}

export function toNumber(
  value:
    | number
    | string
    | null
    | undefined,
) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
}

export function formatDate(
  value: string | null,
) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "uz-UZ",
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Tashkent",
    },
  ).format(new Date(value));
}
