import PdfInkEditor from "@/components/admin/pdf-ink/pdf-ink-editor";
import { requireAdmin } from "@/lib/require-admin";

export const metadata = {
  title: "PDF yozuv",
};

/**
 * PDF ustida qo'lda yozish (Nebo kabi) — faqat admin uchun.
 *
 * Sahifaning o'zi bo'sh qobiq: PDF ochish, yozish va saqlash
 * butunlay brauzerda bo'ladi, server faqat kim kirganini tekshiradi.
 */
export default async function PdfInkPage() {
  await requireAdmin();

  return (
    <main className="min-h-screen bg-mb-page text-mb-ink">
      <PdfInkEditor />
    </main>
  );
}
