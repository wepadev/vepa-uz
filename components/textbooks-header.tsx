import PageHeader from "@/components/ui/page-header";

/**
 * Darslik yechimlari bo'limining sarlavhasi.
 *
 * Endi u umumiy `PageHeader` ustiga qurilgan — sayt bo'ylab
 * sarlavha bitta joyda belgilanadi. Bu fayl faqat eski
 * chaqiruvlar buzilmasligi uchun qoldi.
 */
export default function TextbooksHeader(props: {
  backHref: string;
  backLabel: string;
  title: string;
  subtitle?: string | null;
  chips?: string[];
}) {
  return <PageHeader {...props} />;
}
