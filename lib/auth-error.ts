    export function getUzbekAuthError(
  message: string | undefined,
): string {
  const error = (message ?? "").toLowerCase();

  if (
    error.includes("already registered") ||
    error.includes("already been registered") ||
    error.includes("user already exists")
  ) {
    return "Bu email orqali foydalanuvchi avval yaratilgan.";
  }

  if (
    error.includes("invalid email") ||
    error.includes("email address is invalid") ||
    error.includes("unable to validate email")
  ) {
    return "Email manzili noto‘g‘ri kiritilgan.";
  }

  if (
    error.includes("password") &&
    error.includes("least")
  ) {
    return "Parol kamida 8 ta belgidan iborat bo‘lishi kerak.";
  }

  if (
    error.includes("invalid login credentials")
  ) {
    return "Email yoki parol noto‘g‘ri.";
  }

  if (error.includes("email not confirmed")) {
    return "Email manzili hali tasdiqlanmagan.";
  }

  if (
    error.includes("rate limit") ||
    error.includes("too many requests")
  ) {
    return "Juda ko‘p urinish qilindi. Biroz kutib qayta urinib ko‘ring.";
  }

  return "Amalni bajarib bo‘lmadi. Ma’lumotlarni tekshirib qayta urinib ko‘ring.";
}