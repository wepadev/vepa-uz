"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import AppAlert from "@/components/ui/app-alert";
import { Spinner } from "@/components/ui/spinner";
import type { FormState } from "@/lib/form-state";

type PendingOrder = {
  id: string;
  orderNumber: number | string;
  planName: string;
  planCode: string;
  finalAmountUzs: number | string;
  promoCode: string | null;
  createdAt: string;
};

type UserAccessCardProps = {
  userId: string;
  fullName: string;
  email: string;
  role: "admin" | "student";
  authProvider: string | null;
  isActive: boolean;
  canAccessTextbooks: boolean;
  canAccessLessons: boolean;
  canAccessTests: boolean;
  premiumUntil: string | null;
  pendingOrder: PendingOrder | null;
  isCurrentUser: boolean;
  action: (
    previousState: FormState,
    formData: FormData,
  ) => Promise<FormState>;
  premiumAction: (
    previousState: FormState,
    formData: FormData,
  ) => Promise<FormState>;
};

const initialState = {
  status: "idle",
  message: "",
  errors: {},
} as FormState;

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-mb-brand px-5 py-3 text-sm font-bold text-white transition hover:bg-mb-brandDark disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <Spinner size="sm" />
          Saqlanmoqda...
        </span>
      ) : (
        "Ruxsatlarni saqlaş"
      )}
    </button>
  );
}

function PremiumButton({
  operation,
  label,
  className,
}: {
  operation:
    | "monthly"
    | "quarterly"
    | "semiannual"
    | "full"
    | "revoke";
  label: string;
  className: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      name="operation"
      value={operation}
      disabled={pending}
      className={`${className} inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-bold transition disabled:cursor-wait disabled:opacity-60`}
    >
      {pending
        ? "Saqlanmoqda..."
        : label}
    </button>
  );
}

function AccessSwitch({
  name,
  label,
  description,
  defaultChecked,
  disabled = false,
}: {
  name: string;
  label: string;
  description: string;
  defaultChecked: boolean;
  disabled?: boolean;
}) {
  return (
    <label
      className={[
        "flex items-center justify-between gap-4 rounded-2xl border p-4",
        disabled
          ? "cursor-not-allowed border-slate-200 bg-slate-100 opacity-70"
          : "cursor-pointer border-slate-200 bg-white hover:bg-slate-50",
      ].join(" ")}
    >
      <span className="min-w-0">
        <span className="block text-sm font-bold text-slate-900">
          {label}
        </span>

        <span className="mt-1 block text-xs leading-5 text-slate-500">
          {description}
        </span>
      </span>

      <span className="relative shrink-0">
        <input
          type="checkbox"
          name={name}
          defaultChecked={defaultChecked}
          disabled={disabled}
          className="peer sr-only"
        />

        <span className="block h-7 w-12 rounded-full bg-slate-300 transition peer-checked:bg-mb-brand peer-disabled:bg-slate-300" />

        <span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

function formatDate(
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

function formatMoney(
  value: number | string,
) {
  return new Intl.NumberFormat(
    "uz-UZ",
  ).format(Number(value) || 0);
}

export default function UserAccessCard({
  userId,
  fullName,
  email,
  role,
  authProvider,
  isActive,
  canAccessLessons,
  canAccessTests,
  premiumUntil,
  pendingOrder,
  isCurrentUser,
  action,
  premiumAction,
}: UserAccessCardProps) {
  const [state, formAction] =
    useActionState(action, initialState);

  const [
    premiumState,
    premiumFormAction,
  ] = useActionState(
    premiumAction,
    initialState,
  );

  const isAdmin =
    role === "admin";

  const premiumTimestamp =
    premiumUntil
      ? new Date(
          premiumUntil,
        ).getTime()
      : 0;

  const isPremiumActive =
    Number.isFinite(
      premiumTimestamp,
    ) &&
    premiumTimestamp >
      Date.now();

  const daysRemaining =
    isPremiumActive
      ? Math.max(
          1,
          Math.ceil(
            (
              premiumTimestamp -
              Date.now()
            ) /
              86400000,
          ),
        )
      : 0;

  const initials = (
    fullName ||
    email ||
    "U"
  )
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) =>
      part.charAt(0).toUpperCase(),
    )
    .join("");

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div
            className={[
              "grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-sm font-bold",
              isAdmin
                ? "bg-blue-100 text-blue-700"
                : isPremiumActive
                  ? "bg-amber-100 text-amber-700"
                  : "bg-blue-100 text-blue-700",
            ].join(" ")}
          >
            {initials || "U"}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-bold text-slate-950">
                {fullName ||
                  "Ism kiritilmagan"}
              </h2>

              <span
                className={[
                  "rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide",
                  isAdmin
                    ? "bg-blue-100 text-blue-700"
                    : "bg-slate-100 text-slate-600",
                ].join(" ")}
              >
                {isAdmin
                  ? "Admin"
                  : "Öquvçi"}
              </span>

              {!isAdmin &&
                isPremiumActive && (
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                  Premium
                </span>
              )}

              {pendingOrder && (
                <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                  Tölov kutilmoqda
                </span>
              )}

              {isCurrentUser && (
                <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                  Siz
                </span>
              )}
            </div>

            <p className="mt-1 truncate text-sm text-slate-600">
              {email}
            </p>

            <p className="mt-2 text-xs font-medium text-slate-400">
              Kiriş usuli:{" "}
              {authProvider === "google"
                ? "Google"
                : authProvider === "email"
                  ? "Email"
                  : authProvider ||
                    "Nomaʼlum"}
            </p>
          </div>
        </div>
      </div>

      {isAdmin ? (
        <div className="p-5 sm:p-6">
          <AppAlert
            variant="info"
            title="Admin akkaunti"
          >
            Admin foydalanuvçi barça
            bölimlarga töliq kira oladi.
            Uning ruxsatlari bu sahifada
            özgartirilmaydi.
          </AppAlert>
        </div>
      ) : (
        <div className="space-y-5 p-5 sm:p-6">
          <section
            className={
              isPremiumActive
                ? "rounded-2xl border border-amber-200 bg-amber-50 p-4"
                : "rounded-2xl border border-slate-200 bg-slate-50 p-4"
            }
          >
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                  Premium holati
                </p>

                <h3
                  className={
                    isPremiumActive
                      ? "mt-2 text-xl font-bold text-amber-800"
                      : "mt-2 text-xl font-bold text-slate-700"
                  }
                >
                  {isPremiumActive
                    ? "Premium faol"
                    : "Bepul tarif"}
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {isPremiumActive
                    ? `${formatDate(
                        premiumUntil,
                      )} gaça — ${daysRemaining} kun qoldi`
                    : "Faqat bepul belgisi bor dars va testlar oçiq."}
                </p>
              </div>

              {pendingOrder && (
                <div className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs text-blue-800">
                  <p className="font-bold">
                    Buyurtma #
                    {pendingOrder.orderNumber}
                  </p>

                  <p className="mt-1">
                    {pendingOrder.planName}
                  </p>

                  <p className="mt-1 font-bold">
                    {formatMoney(
                      pendingOrder.finalAmountUzs,
                    )}{" "}
                    söm
                  </p>

                  {pendingOrder.promoCode && (
                    <p className="mt-1">
                      {pendingOrder.promoCode}
                    </p>
                  )}
                </div>
              )}
            </div>

            <form
              action={premiumFormAction}
              className="mt-4"
            >
              <input
                type="hidden"
                name="userId"
                value={userId}
              />

              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <PremiumButton
                  operation="monthly"
                  label="1 oy beriş"
                  className="bg-mb-brand text-white hover:bg-mb-brandDark"
                />

                <PremiumButton
                  operation="quarterly"
                  label="3 oy beriş"
                  className="bg-mb-brand text-white hover:bg-mb-brandDark"
                />

                <PremiumButton
                  operation="semiannual"
                  label="6 oy beriş"
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                />

                <PremiumButton
                  operation="full"
                  label="12 oy beriş"
                  className="bg-amber-500 text-white hover:bg-amber-600"
                />
              </div>

              {isPremiumActive && (
                <div className="mt-2">
                  <PremiumButton
                    operation="revoke"
                    label="Premiumni bekor qiliş"
                    className="w-full border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                  />
                </div>
              )}
            </form>

            {premiumState.status ===
              "error" &&
              premiumState.message && (
                <div className="mt-4">
                  <AppAlert
                    variant="error"
                    title="Premium özgarmadi"
                  >
                    {premiumState.message}
                  </AppAlert>
                </div>
              )}

            {premiumState.status ===
              "success" &&
              premiumState.message && (
                <div className="mt-4">
                  <AppAlert
                    variant="success"
                    title="Premium yangilandi"
                  >
                    {premiumState.message}
                  </AppAlert>
                </div>
              )}
          </section>

          <form
            action={formAction}
            className="space-y-4"
          >
            <input
              type="hidden"
              name="userId"
              value={userId}
            />

            <AccessSwitch
              name="isActive"
              label="Akkaunt faol"
              description={
                isCurrentUser
                  ? "Öz akkauntingizni öçira olmaysiz."
                  : "Öçirilsa, foydalanuvçi platformaga kira olmaydi."
              }
              defaultChecked={isActive}
              disabled={isCurrentUser}
            />

            {isCurrentUser && (
              <input
                type="hidden"
                name="isActive"
                value="on"
              />
            )}

            <AccessSwitch
              name="canAccessTextbooks"
              label="Darslik yeçimlari"
              description="Barça faol foydalanuvçilar uçun doim bepul."
              defaultChecked={true}
              disabled
            />

            <input
              type="hidden"
              name="canAccessTextbooks"
              value="on"
            />

            <AccessSwitch
              name="canAccessLessons"
              label="Videodarslar"
              description="Darslar bölimiga kiriş. Premium kontent muddati alohida tekşiriladi."
              defaultChecked={
                canAccessLessons
              }
            />

            <AccessSwitch
              name="canAccessTests"
              label="Testlar"
              description="Testlar bölimiga kiriş. Premium testlar muddati alohida tekşiriladi."
              defaultChecked={
                canAccessTests
              }
            />

            {state.status === "error" &&
              state.message && (
                <AppAlert
                  variant="error"
                  title="Ruxsatlar saqlanmadi"
                >
                  {state.message}
                </AppAlert>
              )}

            {state.status === "success" &&
              state.message && (
                <AppAlert
                  variant="success"
                  title="Ruxsatlar yangilandi"
                >
                  {state.message}
                </AppAlert>
              )}

            <SaveButton />
          </form>
        </div>
      )}
    </article>
  );
}
