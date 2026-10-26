"use client";

import { useRef, useState, type ReactNode } from "react";

import ConfirmDialog from "@/components/ui/confirm-dialog";

/**
 * O'chirish kabi qaytarib bo'lmaydigan amal uchun tugma.
 *
 * Bosilganda avval tasdiqlash oynasi chiqadi, "Ha" bosilgandan
 * keyingina forma yuboriladi. Ilgari bunday amallar alohida ochiladigan
 * qizil blokda turardi — "⋯" menyuga ko'chgach ham himoya qolsin.
 */
export default function ConfirmSubmitButton({
  children,
  title,
  description,
  confirmLabel = "Ha, o‘chirilsin",
  className,
}: {
  children: ReactNode;
  title: string;
  description: string;
  confirmLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(true)}
        className={className}
      >
        {children}
      </button>

      <ConfirmDialog
        open={open}
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        variant="danger"
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          buttonRef.current?.form?.requestSubmit();
        }}
      />
    </>
  );
}
