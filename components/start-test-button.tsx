"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

type StartTestButtonProps = {
  label?: string;
};

/**
 * "Boshlash" tugmasi.
 *
 * Forma ichida turadi va bosilgandan keyin bloklanadi. Ikkinchisi
 * shunchaki chiroyli ko'rinish uchun emas: sekin internetda
 * foydalanuvchi javob kelmagach yana bosardi va server ikkita
 * sessiya ochishga urinib xato berardi.
 */
export default function StartTestButton({
  label = "Boshlash",
}: StartTestButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={cn(
        "mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-mb-brand px-6 font-bold text-white transition hover:bg-mb-brandDark",
        pending && "cursor-progress opacity-70",
      )}
    >
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Tayyorlanmoqda…
        </>
      ) : (
        label
      )}
    </button>
  );
}
