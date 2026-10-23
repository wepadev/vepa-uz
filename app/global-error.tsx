"use client";

import { useEffect } from "react";

import { sendErrorReport } from "@/lib/send-error-report";

/**
 * Eng yuqori darajadagi xato ekrani.
 *
 * app/error.tsx layout ichidagi xatolarni ushlaydi, lekin layout
 * ning o'zi buzilsa u ishlamaydi — o'sha holat uchun shu fayl.
 * Shuning uchun u <html> va <body> ni o'zi chiqaradi va hech qanday
 * umumiy uslubga tayanmaydi.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    sendErrorReport(error);
  }, [error]);

  return (
    <html lang="uz">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          background: "#f4f7fb",
          color: "#151a23",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <main
          style={{
            width: "100%",
            maxWidth: 420,
            padding: 28,
            textAlign: "center",
            background: "#fff",
            border: "1px solid #e6eaf0",
            borderRadius: 24,
            boxShadow: "0 8px 24px rgb(16 24 40 / 8%)",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#1b72f2",
            }}
          >
            Vepa Ustoz
          </p>

          <h1 style={{ margin: "14px 0 0", fontSize: 22, lineHeight: 1.35 }}>
            Saytda jiddiy xatolik
          </h1>

          <p
            style={{
              margin: "10px 0 0",
              fontSize: 14,
              lineHeight: 1.6,
              color: "#7c8798",
            }}
          >
            Xabar administratorga yuborildi. Sahifani qayta yuklab
            ko‘ring — muammo takrorlansa biroz kutib turing.
          </p>

          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 22,
              width: "100%",
              minHeight: 48,
              padding: "0 20px",
              font: "inherit",
              fontSize: 15,
              fontWeight: 700,
              color: "#fff",
              background: "#1b72f2",
              border: 0,
              borderRadius: 14,
              cursor: "pointer",
            }}
          >
            Qayta urinish
          </button>
        </main>
      </body>
    </html>
  );
}
