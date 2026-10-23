"use client";

import { useState } from "react";

import {
  REWARD_ICON_COUNT,
  REWARD_ICON_GROUPS,
  rewardIcon,
} from "@/lib/reward-icons";
import { cn } from "@/lib/utils";

/**
 * Sovg'a uchun ikonka tanlash.
 *
 * Ikonkalar mavzu bo'yicha guruhlangan — mukofot, o'quv qurollari,
 * shirinlik va hokazo. Bir vaqtning o'zida bittasi tanlanadi va
 * yashirin maydonga yoziladi, ya'ni oddiy forma bilan yuboriladi.
 *
 * Ro'yxat yopiq turadi: forma uzayib ketmasin. Tanlangan ikonka
 * tugmaning o'zida ko'rinib turadi.
 */
export default function RewardIconPicker({
  name = "icon",
  defaultValue,
  label = "Ikonka",
}: {
  name?: string;
  defaultValue?: string | null;
  label?: string;
}) {
  const [selected, setSelected] = useState(defaultValue ?? "gift");
  const [open, setOpen] = useState(false);

  const SelectedIcon = rewardIcon(selected);

  const selectedLabel = REWARD_ICON_GROUPS.flatMap(
    (group) => group.icons,
  ).find((item) => item.key === selected)?.label;

  return (
    <div>
      <input type="hidden" name={name} value={selected} />

      {label && (
        <p className="block text-xs font-semibold text-slate-600">
          {label}
        </p>
      )}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className={cn(
          "inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50",
          label && "mt-1",
        )}
      >
        <SelectedIcon
          className="h-5 w-5 text-mb-brand"
          strokeWidth={2}
          aria-hidden="true"
        />

        {selectedLabel ?? "Tanlang"}

        <span className="text-xs font-normal text-mb-muted">
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <div className="mt-2 max-h-72 overflow-y-auto rounded-2xl border border-mb-line bg-white p-3">
          <p className="text-[11px] text-mb-muted">
            {REWARD_ICON_COUNT} ta ikonka
          </p>

          {REWARD_ICON_GROUPS.map((group) => (
            <div key={group.title} className="mt-3 first:mt-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-mb-muted">
                {group.title}
              </p>

              <div className="mt-1.5 grid grid-cols-6 gap-1.5 sm:grid-cols-9">
                {group.icons.map((item) => {
                  const Icon = item.icon;
                  const isActive = item.key === selected;

                  return (
                    <button
                      key={item.key}
                      type="button"
                      title={item.label}
                      aria-label={item.label}
                      aria-pressed={isActive}
                      onClick={() => {
                        setSelected(item.key);
                        setOpen(false);
                      }}
                      className={cn(
                        "grid h-11 w-full place-items-center rounded-xl border transition",
                        isActive
                          ? "border-mb-brand bg-mb-tintSoft text-mb-brand"
                          : "border-slate-200 bg-white text-slate-500 hover:border-blue-300 hover:text-mb-brand",
                      )}
                    >
                      <Icon
                        className="h-5 w-5"
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
