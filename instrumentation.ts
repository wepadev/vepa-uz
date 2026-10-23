import { reportError } from "@/lib/report-error";

/**
 * Server tomonidagi xatolarni ushlaydi.
 *
 * Next.js bu ilgakni server komponent, server action va API yo'llarida
 * xato yuz berganda chaqiradi. Ilgari bunday xatolar faqat Vercel
 * loglarida qolardi va siz ularni faqat o'quvchi aytganda bilardingiz.
 */
export async function onRequestError(
  error: unknown,
  request: {
    path?: string;
    method?: string;
  },
  context: {
    routerKind?: string;
    routePath?: string;
    renderSource?: string;
  },
) {
  const err = error as Error & { digest?: string };

  await reportError({
    where: "server",
    message: err?.message ?? String(error),
    digest: err?.digest ?? null,
    url: request?.path ?? context?.routePath ?? null,
    detail: err?.stack ? err.stack.split("\n").slice(0, 6).join("\n") : null,
  });
}
