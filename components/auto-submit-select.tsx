"use client";

import type { SelectHTMLAttributes } from "react";

/**
 * Tanlanganda formani özi yuboradigan `<select>`.
 *
 * Alohida "Köriş" tugmasini bosiş şart emas. JavaScript öçiq bölsa
 * forma içidagi `<noscript>` tugmasi işlaydi.
 */
export default function AutoSubmitSelect(
  props: SelectHTMLAttributes<HTMLSelectElement>,
) {
  return (
    <select
      {...props}
      onChange={(event) => {
        props.onChange?.(event);
        event.currentTarget.form?.requestSubmit();
      }}
    />
  );
}
