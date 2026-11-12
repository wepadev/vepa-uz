import AuthShell from "@/components/auth-shell";
import { LoginForm } from "@/components/login-form";
import { getSafeNext } from "@/lib/safe-next";

type PageProps = {
  searchParams: Promise<{
    mode?: string | string[];
    next?: string | string[];
  }>;
};

export default async function Page({
  searchParams,
}: PageProps) {
  const params = await searchParams;

  const rawMode = Array.isArray(params.mode)
    ? params.mode[0]
    : params.mode;

  const initialMode =
    rawMode === "signup" ? "signup" : "login";

  const next = getSafeNext(
    Array.isArray(params.next) ? params.next[0] : params.next,
  );

  return (
    <AuthShell
      eyebrow="Matematika — aniq va tuşunarli"
      title="Darslar, testlar va natijalar bir joyda."
      text="Email yoki Google hisobingiz bilan kiring. Yangi bölsangiz, şu sahifaning özida röyxatdan ötasiz."
      points={[
        "Videodarsni köring",
        "Testni işlang — natija darrov çiqadi",
        "Xatolaringizni tahlil bilan takrorlang",
      ]}
    >
      <LoginForm initialMode={initialMode} next={next} />
    </AuthShell>
  );
}
