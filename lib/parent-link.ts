import "server-only";

import { createParentToken, readParentToken } from "@/lib/parent-token";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://vepa.uz";

/* Imzo uchun serverdagi maxfiy Supabase kaliti — u faqat serverda */
function secret() {
  const value = process.env.SUPABASE_SECRET_KEY;

  if (!value) {
    throw new Error("SUPABASE_SECRET_KEY topilmadi.");
  }

  return value;
}

/** CRM o'quvchisi uchun ota-ona hisoboti havolasi */
export function parentReportUrl(crmStudentId: number) {
  return `${siteUrl}/ota-ona/${createParentToken(crmStudentId, secret())}`;
}

export function parseParentToken(token: string) {
  return readParentToken(token, secret());
}
