import {
  type NextRequest,
  NextResponse,
} from "next/server";

import { getSafeNext } from "@/lib/safe-next";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function getFullName(user: {
  email?: string;
  user_metadata?: Record<string, unknown>;
}) {
  const metadata = user.user_metadata ?? {};

  const fullName =
    typeof metadata.full_name === "string"
      ? metadata.full_name.trim()
      : "";

  const name =
    typeof metadata.name === "string"
      ? metadata.name.trim()
      : "";

  return (
    fullName ||
    name ||
    user.email?.split("@")[0] ||
    "Öquvçi"
  );
}

function getAuthProvider(user: {
  app_metadata?: {
    provider?: unknown;
  };
}) {
  const provider =
    typeof user.app_metadata?.provider ===
    "string"
      ? user.app_metadata.provider
      : "email";

  return provider === "google"
    ? "google"
    : "email";
}

export async function GET(
  request: NextRequest,
) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const code =
    requestUrl.searchParams.get("code");
  const next = getSafeNext(
    requestUrl.searchParams.get("next"),
  );

  if (!code) {
    return NextResponse.redirect(
      new URL(
        "/auth/login?error=auth_code_missing",
        origin,
      ),
    );
  }

  const supabase = await createClient();

  const {
    data: sessionData,
    error: exchangeError,
  } =
    await supabase.auth.exchangeCodeForSession(
      code,
    );

  if (
    exchangeError ||
    !sessionData.user
  ) {
    console.error(
      "Auth code exchange xatosi:",
      exchangeError,
    );

    const errorPath =
      next === "/auth/update-password"
        ? "/auth/forgot-password?error=recovery_link_invalid"
        : "/auth/login?error=auth_failed";

    return NextResponse.redirect(
      new URL(errorPath, origin),
    );
  }

  const user = sessionData.user;

  /*
   * Database trigger odatda profilni avtomatik
   * yaratadi. Quyidagi qism eski foydalanuvchilar
   * yoki trigger ishlamagan holat uchun zaxira.
   */
  const adminSupabase =
    createAdminClient();

  const {
    data: existingProfile,
    error: profileCheckError,
  } = await adminSupabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileCheckError) {
    console.error(
      "Profilni tekşirişda xato:",
      profileCheckError,
    );

    await supabase.auth.signOut();

    return NextResponse.redirect(
      new URL(
        "/auth/login?error=profile_check_failed",
        origin,
      ),
    );
  }

  if (!existingProfile) {
    const {
      error: profileInsertError,
    } = await adminSupabase
      .from("profiles")
      .insert({
        id: user.id,
        full_name: getFullName(user),
        role: "student",
        is_active: true,
        auth_provider:
          getAuthProvider(user),
        can_access_textbooks: true,
        can_access_lessons: true,
        can_access_tests: true,
      });

    if (profileInsertError) {
      console.error(
        "Profil yaratişda xato:",
        profileInsertError,
      );

      await supabase.auth.signOut();

      return NextResponse.redirect(
        new URL(
          "/auth/login?error=profile_creation_failed",
          origin,
        ),
      );
    }
  }

  return NextResponse.redirect(
    new URL(next, origin),
  );
}