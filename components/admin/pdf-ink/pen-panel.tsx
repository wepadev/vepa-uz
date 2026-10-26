"use client";

import { useEffect, useRef, useState } from "react";
import { Brush, Pen, PenTool, RotateCcw, type LucideIcon } from "lucide-react";

import { simplifyStroke, type PenKind, type Stroke } from "@/lib/pdf-ink";
import { cn } from "@/lib/utils";

import { paintStroke } from "./ink-page";

export const PEN_KINDS: { kind: PenKind; label: string; icon: LucideIcon }[] = [
  { kind: "felt", label: "Flomaster", icon: Pen },
  { kind: "fountain", label: "Pero", icon: PenTool },
  { kind: "brush", label: "Mo‘yqalam", icon: Brush },
];

/** Qalam o'lchamlari, punktda — Nebo'dagi kabi oltita */
export const PEN_SIZES = [0.7, 1.1, 1.6, 2.3, 3.2, 4.5];

type PenPanelProps = {
  pen: PenKind;
  size: number;
  color: string;
  onPen: (pen: PenKind) => void;
  onSize: (size: number) => void;
  /** Stabilizatsiya, 0..1 — har qalamda alohida */
  smooth: number;
  onSmooth: (smooth: number) => void;
  onClose: () => void;
};

/** Sinov maydonidagi chizgilar shu masshtabda — kichik o'lcham ham ko'rinsin */
const PREVIEW_SCALE = 1.6;

/**
 * Qalam oynasi: tur, o'lcham va sinab ko'rish maydoni.
 *
 * Sinov maydonidagi yozuv hujjatga tushmaydi — faqat tanlangan
 * qalam qanday yozishini ko'rish uchun.
 */
export default function PenPanel({
  pen,
  size,
  color,
  onPen,
  onSize,
  smooth,
  onSmooth,
  onClose,
}: PenPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef<{ id: number; points: number[]; pressures: number[] | null } | null>(
    null,
  );
  const [strokes, setStrokes] = useState<Stroke[]>([]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function makeStroke(points: number[], pressures: number[] | null): Stroke {
    return {
      tool: "pen",
      pen,
      color: color.toUpperCase() === "#FFFFFF" ? "#151A23" : color,
      width: size,
      smooth,
      points,
      ...(pressures ? { pressures } : {}),
    };
  }

  function redraw(extra?: Stroke, complete = true) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(canvas.clientWidth * ratio);
    const h = Math.round(canvas.clientHeight * ratio);
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    for (const stroke of strokes) {
      paintStroke(ctx, { ...stroke, pen, width: size, smooth }, PREVIEW_SCALE * ratio);
    }
    if (extra) paintStroke(ctx, extra, PREVIEW_SCALE * ratio, complete);
  }

  /* Qalam turi, o'lchami yoki stabilizatsiyasi o'zgarsa, sinov yozuvi ham yangi qalamda ko'rinadi */
  useEffect(redraw);

  function point(event: { clientX: number; clientY: number }) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return [
      (event.clientX - rect.left) / PREVIEW_SCALE,
      (event.clientY - rect.top) / PREVIEW_SCALE,
    ];
  }

  function pressure(event: { pressure: number }) {
    return event.pressure > 0 ? Math.round(event.pressure * 100) / 100 : 0.5;
  }

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} aria-hidden="true" />

      <div
        role="dialog"
        aria-label="Qalam"
        className="absolute left-2 top-full z-40 mt-1 w-[min(22rem,calc(100vw-1rem))] rounded-2xl border border-mb-line bg-white p-4 shadow-xl"
      >
        <p className="text-center text-base font-bold text-mb-ink">Qalam</p>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {PEN_KINDS.map(({ kind, label, icon: Icon }) => (
            <button
              key={kind}
              type="button"
              aria-pressed={pen === kind}
              onClick={() => onPen(kind)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-sm font-medium transition",
                pen === kind ? "bg-mb-tint text-mb-brandDark" : "text-slate-700 hover:bg-slate-100",
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between px-1">
          {PEN_SIZES.map((value, i) => (
            <button
              key={value}
              type="button"
              aria-label={`O‘lcham ${i + 1}`}
              aria-pressed={value === size}
              onClick={() => onSize(value)}
              className={cn(
                "grid h-10 w-10 place-items-center rounded-full transition",
                value === size ? "bg-mb-tint" : "hover:bg-slate-100",
              )}
            >
              <span
                className={cn("rounded-full", value === size ? "bg-mb-ink" : "bg-slate-400")}
                style={{ width: 3 + i * 3, height: 3 + i * 3 }}
              />
            </button>
          ))}
        </div>

        <div className="mt-3 px-1">
          <div className="flex items-center justify-between text-sm">
            <label htmlFor="pen-smooth" className="font-semibold text-mb-ink">
              Stabilizatsiya
            </label>
            <span className="tabular-nums text-mb-muted">{Math.round(smooth * 100)}%</span>
          </div>
          <input
            id="pen-smooth"
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(smooth * 100)}
            onChange={(event) => onSmooth(Number(event.target.value) / 100)}
            className="mt-1 w-full accent-mb-brand"
          />
          <div className="flex justify-between text-xs text-mb-muted">
            <span>Tez, aynan qo‘ldek</span>
            <span>Silliq</span>
          </div>
        </div>

        <div className="relative mt-3 overflow-hidden rounded-xl border-2 border-mb-line" style={{ backgroundColor: "#ffffff" }}>
          <canvas
            ref={canvasRef}
            className="block h-44 w-full"
            style={{ touchAction: "none", cursor: "crosshair" }}
            onPointerDown={(event) => {
              if (event.pointerType === "mouse" && event.button !== 0) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              const [x, y] = point(event);
              drawingRef.current = {
                id: event.pointerId,
                points: [x, y],
                pressures: event.pointerType === "pen" ? [pressure(event)] : null,
              };
              redraw(makeStroke([x, y], drawingRef.current.pressures), false);
            }}
            onPointerMove={(event) => {
              const drawing = drawingRef.current;
              if (!drawing || drawing.id !== event.pointerId) return;
              const samples = event.nativeEvent.getCoalescedEvents?.() ?? [];
              for (const sample of samples.length > 0 ? samples : [event.nativeEvent]) {
                const [x, y] = point(sample);
                drawing.points.push(x, y);
                drawing.pressures?.push(pressure(sample));
              }
              redraw(makeStroke(drawing.points, drawing.pressures), false);
            }}
            onPointerUp={() => {
              const drawing = drawingRef.current;
              drawingRef.current = null;
              if (!drawing) return;
              const simple = simplifyStroke(drawing.points, drawing.pressures ?? undefined, 0.3);
              setStrokes((list) => [
                ...list.slice(-20),
                makeStroke(simple.points, simple.pressures ?? null),
              ]);
            }}
            onPointerCancel={() => {
              drawingRef.current = null;
              redraw();
            }}
          />

          {strokes.length === 0 ? (
            <span className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-sm text-slate-400">
              Shu yerda sinab ko‘ring
            </span>
          ) : (
            <button
              type="button"
              aria-label="Sinov yozuvini tozalash"
              title="Tozalash"
              onClick={() => setStrokes([])}
              className="absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </>
  );
}
