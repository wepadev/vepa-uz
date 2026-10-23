"use client";

import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type SubmitButtonProps = Omit<
  ComponentProps<"button">,
  "type" | "children"
> & {
  children: ReactNode;
  /** Bosilgandan keyin ko'rinadigan matn (bo'sh bo'lsa asl matn qoladi) */
  pendingLabel?: ReactNode;
};

/**
 * Server action yuboradigan tugma.
 *
 * Bosilganda ichida spinner paydo bo'ladi va tugma bloklanadi —
 * shu tufayli foydalanuvchi ish ketayotganini ko'radi va bir amalni
 * ikki marta yuborib yubormaydi.
 *
 * useFormStatus faqat <form> ichidagi bola komponentda ishlaydi,
 * shuning uchun bu alohida client komponent.
 */
export default function SubmitButton({
  children,
  pendingLabel,
  className,
  disabled,
  ...rest
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      {...rest}
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending}
      className={cn(
        className,
        pending && "cursor-progress opacity-70",
      )}
    >
      {pending ? (
        <span className="inline-flex items-center justify-center gap-2">
          <Spinner size="sm" />
          {pendingLabel ?? children}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
