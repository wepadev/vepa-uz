import AuthShell from "@/components/auth-shell";
import { ForgotPasswordForm } from "@/components/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      eyebrow="Akkaunt xavfsizligi"
      title="Parolingizni tiklang."
      text="Email manzilingizni kiriting — yangi parol örnatiş uçun havola yuboramiz."
      points={[
        "Emailingizga tiklaş havolasi keladi",
        "Havola orqali yangi parol örnatasiz",
        "Yangi parol bilan qayta kirasiz",
      ]}
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
