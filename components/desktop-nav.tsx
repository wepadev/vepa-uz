"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";

import {
  authHref,
  isActivePath,
  isNavHidden,
  menuSections,
  primaryLinks,
  type NavUser,
} from "@/components/nav-links";
import BrandMark from "@/components/ui/brand-mark";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type DesktopNavProps = NavUser & {
  fullName: string;
  signOut: () => Promise<void>;
};

/**
 * Kompyuterdagi tepadagi menyu.
 *
 * Telefonda pastki tab bar bor, kompyuterda esa ilgari hech narsa
 * yo'q edi — faqat "Orqaga" havolasi. Bu panel `md` dan katta
 * ekranda chiqadi va sahifa bilan birga yuqoriga suriladi:
 * sahifalarning o'z sarlavhasi (PageHeader) tepada yopishib qoladi.
 */
export default function DesktopNav({
  isAuthenticated,
  isAdmin,
  isInGroup,
  fullName,
  signOut,
}: DesktopNavProps) {
  const pathname = usePathname() ?? "/";

  if (isNavHidden(pathname)) return null;

  const user = { isAuthenticated, isAdmin, isInGroup };
  const links = primaryLinks(user);
  const sections = menuSections(user);

  const linkClass = (active: boolean) =>
    cn(
      "inline-flex min-h-10 items-center rounded-xl px-3 text-sm font-semibold transition-colors",
      active
        ? "bg-mb-tint text-mb-brandDark"
        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
    );

  return (
    <nav
      aria-label="Asosiy navigatsiya"
      className="hidden border-b border-slate-200 bg-white md:block"
    >
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-6 py-2">
        <Link href="/" className="mr-3 flex shrink-0 items-center gap-2.5">
          <BrandMark size={36} className="h-9 w-9" />
          <span className="text-lg font-bold text-slate-900">Vepa Ustoz</span>
        </Link>

        {links.map((link) => {
          const active = isActivePath(pathname, link.match ?? link.href);

          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={linkClass(active)}
            >
              {link.label}
            </Link>
          );
        })}

        {isAuthenticated && (
          <DropdownMenu>
            <DropdownMenuTrigger className={cn(linkClass(false), "gap-1")}>
              Yana
              <ChevronDown className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
            </DropdownMenuTrigger>

            <DropdownMenuContent align="start" className="w-64">
              {sections.map((section, index) => (
                <div key={section.title}>
                  {index > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuLabel className="text-xs text-slate-400">
                    {section.title}
                  </DropdownMenuLabel>

                  {section.links.map((item) => (
                    <DropdownMenuItem key={item.href} asChild>
                      <Link href={item.href} className="flex flex-col items-start gap-0.5">
                        <span className="font-semibold">{item.label}</span>
                        <span className="text-xs text-slate-500">{item.hint}</span>
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {isAuthenticated ? (
            <>
              {isAdmin && (
                <Link
                  href="/admin"
                  className="inline-flex min-h-10 items-center rounded-xl border border-blue-200 bg-blue-50 px-3 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                >
                  Admin
                </Link>
              )}

              <Link
                href="/profile"
                className="inline-flex min-h-10 max-w-44 items-center truncate rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                {fullName}
              </Link>

              <form action={signOut}>
                <button
                  type="submit"
                  className="inline-flex min-h-10 items-center rounded-xl px-3 text-sm font-semibold text-slate-500 hover:text-slate-800"
                >
                  Chiqish
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/pricing" className={linkClass(pathname === "/pricing")}>
                Premium
              </Link>

              <Link
                href={pathname === "/" ? "/auth/login" : authHref(user, pathname)}
                className="inline-flex min-h-10 items-center rounded-xl bg-mb-brand px-4 text-sm font-semibold text-white hover:bg-mb-brandDark"
              >
                Kirish
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
