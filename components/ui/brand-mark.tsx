import Image from "next/image";

import { cn } from "@/lib/utils";

type BrandMarkProps = {
  /** Rasm o'lchami (piksel) */
  size?: number;
  /** Qo'shimcha klasslar — odatda h-* w-* */
  className?: string;
  priority?: boolean;
};

/**
 * Vepa Ustoz belgisi.
 *
 * Ikkita rasm chiqariladi va CSS ularning birini yashiradi:
 *   - yorug' rejimda quyuq ko'k logo
 *   - tun rejimida yorqinlashtirilgan variant
 *
 * Nega shunday: asl logoning pastki qismi to'q ko'k (deyarli qora),
 * shuning uchun quyuq fonda ko'rinmay qolardi. Rasmni JavaScript
 * bilan almashtirsak sahifa yuklanganda logo bir zumga "sakrab"
 * ketardi — CSS bilan almashtirish esa darhol va tekis.
 */
export default function BrandMark({
  size = 40,
  className,
  priority = true,
}: BrandMarkProps) {
  return (
    <>
      <Image
        src="/logo-512.png"
        alt="Vepa Ustoz"
        width={size}
        height={size}
        priority={priority}
        className={cn("shrink-0 dark:hidden", className)}
      />

      <Image
        src="/logo-on-dark.png"
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        priority={priority}
        className={cn("hidden shrink-0 dark:block", className)}
      />
    </>
  );
}
