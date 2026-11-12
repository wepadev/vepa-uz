import AuthShell from "@/components/auth-shell";
import { UpdatePasswordForm } from "@/components/update-password-form";

export default function UpdatePasswordPage() {
  return (
    <AuthShell
      eyebrow="Yangi parol"
      title="Yangi parol yarating."
      text="Esda saqlaş oson, lekin boşqalar topişi qiyin bölgan parol tanlang."
      points={[
        "Kamida 8 ta belgi",
        "Katta va kiçik harflar",
        "Kamida bitta raqam",
      ]}
    >
      <UpdatePasswordForm />
    </AuthShell>
  );
}
