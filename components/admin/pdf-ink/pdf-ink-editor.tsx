"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  Download,
  Eraser,
  FilePlus,
  FileUp,
  Grid3x3,
  Hand,
  Highlighter,
  Loader2,
  Minus,
  PenLine,
  Plus,
  Redo2,
  Trash2,
  Undo2,
  X,
  type LucideIcon,
} from "lucide-react";

import AppAlert from "@/components/ui/app-alert";
import {
  blankPageMatrix,
  exportFileName,
  exportInkPdf,
  invertMatrix,
  looksLikePdf,
  strokeHit,
  type InkPage,
  type Matrix,
  type PageBackground,
  type PenKind,
  type Stroke,
} from "@/lib/pdf-ink";
import { cn } from "@/lib/utils";

import InkPageView, { type EditorTool, type PageHandlers } from "./ink-page";
import ExportPanel from "./export-panel";
import PenPanel, { PEN_KINDS, PEN_SIZES } from "./pen-panel";

/**
 * "PDF yozuv" — Nebo kabi PDF ustida qo'lda yozish.
 *
 * Ish tartibi: PDF ochiladi → qalam, marker, chiziq bilan yoziladi
 * → "PDF saqlash" yangi faylni kompyuterga yozadi. Fayl serverga
 * yuborilmaydi: hamma narsa shu brauzer oynasida.
 *
 * Qalam (stilus) sezilsa, barmoq avtomatik "surish"ga o'tadi —
 * planshetda kaft ekranga tegsa chiziq tushmaydi.
 */

const PEN_COLORS = [
  "#151A23",
  "#6B7280",
  "#D1D5DB",
  "#FFFFFF",
  "#1B72F2",
  "#E11D48",
  "#16A34A",
  "#FACC15",
];
const MARKER_COLORS = ["#FACC15", "#4ADE80", "#F472B6", "#60A5FA"];
const MARKER_WIDTHS = [8, 14, 22];

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 4;
const HISTORY_LIMIT = 100;

type History = { past: InkPage[][]; future: InkPage[][] };

let idCounter = 0;
const newId = () => `p${Date.now().toString(36)}${(idCounter += 1)}`;

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100));
}

async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  /* Worker faylini `scripts/copy-pdf-worker.mjs` public/ ga qo'yadi */
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
  return pdfjs;
}

/*
 * Internetsiz ishlash.
 *
 * Muharrir to'liq brauzerda ishlaydi, faqat sahifaning o'zi va uning
 * JS fayllari kerak. Sahifa ochilganda ularni `vepa-offline` keshiga
 * yozib qo'yamiz; internet uzilsa service worker (public/sw.js)
 * sahifani shu keshdan ochadi. Har onlayn ochilishda kesh yangilanadi,
 * eski deploy fayllari tozalanadi.
 */
const OFFLINE_CACHE = "vepa-offline";

async function prepareOffline() {
  if (!("caches" in window) || !navigator.onLine) return;

  try {
    /* pdf.js bo'lagi ham yuklansin — u faqat PDF ochilganda kerak bo'ladi */
    await loadPdfjs();

    const pageUrl = window.location.pathname;
    const response = await fetch(pageUrl, { credentials: "same-origin", cache: "no-store" });
    /* Sessiya tugagan bo'lsa login sahifasiga yo'naltiriladi — uni saqlamaymiz */
    if (!response.ok || response.redirected) return;

    const cache = await caches.open(OFFLINE_CACHE);
    await cache.put(pageUrl, response);

    const assets = new Set<string>([`${window.location.origin}/pdfjs/pdf.worker.min.mjs`]);
    for (const entry of performance.getEntriesByType("resource")) {
      const url = new URL(entry.name);
      if (url.origin === window.location.origin && url.pathname.startsWith("/_next/static/")) {
        assets.add(url.href);
      }
    }

    for (const request of await cache.keys()) {
      if (new URL(request.url).pathname !== pageUrl && !assets.has(request.url)) {
        await cache.delete(request);
      }
    }

    await Promise.all(
      [...assets].map(async (url) => {
        if (await cache.match(url)) return;
        try {
          await cache.add(url);
        } catch {
          /* Bitta fayl tushmasa ham qolganlari saqlansin */
        }
      }),
    );
  } catch {
    /* Kesh ishlamasa ham muharrir onlayn ishlayveradi */
  }
}

/** Betning (u, v) nuqtasini oynaning (vx, vy) joyiga keltirish */
function scrollToAnchor(
  scroller: HTMLElement,
  anchor: { pageId: string; u: number; v: number; vx: number; vy: number },
  zoom: number,
) {
  const node = scroller.querySelector<HTMLElement>(`[data-page-id="${anchor.pageId}"]`);
  if (!node) return;
  const box = node.getBoundingClientRect();
  const frame = scroller.getBoundingClientRect();
  scroller.scrollTo({
    left: scroller.scrollLeft + (box.left - frame.left) + anchor.u * zoom - anchor.vx,
    top: scroller.scrollTop + (box.top - frame.top) + anchor.v * zoom - anchor.vy,
  });
}

/** Faylni kompyuterga saqlash: imkon bo'lsa "Saqlash" oynasi, bo'lmasa yuklab olish */
async function saveToComputer(bytes: Uint8Array, name: string) {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });

  type SavePicker = (options: {
    suggestedName: string;
    types: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<{
    createWritable: () => Promise<{
      write: (data: Blob) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;

  const picker = (window as unknown as { showSaveFilePicker?: SavePicker })
    .showSaveFilePicker;

  if (picker) {
    try {
      const handle = await picker({
        suggestedName: name,
        types: [{ description: "PDF", accept: { "application/pdf": [".pdf"] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (error) {
      /* Foydalanuvchi oynani yopdi */
      if (error instanceof DOMException && error.name === "AbortError") {
        return false;
      }
      /* Boshqa xato — oddiy yuklab olishga o'tamiz */
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}

function ToolButton({
  icon: Icon,
  label,
  active = false,
  disabled = false,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid h-10 w-10 shrink-0 place-items-center rounded-xl transition disabled:opacity-35",
        active
          ? "bg-mb-brand text-white shadow-sm"
          : "text-slate-700 hover:bg-slate-100",
      )}
    >
      <Icon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-7 w-px shrink-0 bg-mb-line" aria-hidden="true" />;
}

export default function PdfInkEditor() {
  const [fileName, setFileName] = useState("");
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pages, setPages] = useState<InkPage[]>([]);
  /* Tarix ref'da: undo/redo bir vaqtda ikki narsani o'zgartiradi */
  const historyRef = useRef<History>({ past: [], future: [] });
  const [, setHistoryTick] = useState(0);
  const [tool, setTool] = useState<EditorTool>("pen");
  const [penColor, setPenColor] = useState(PEN_COLORS[0]);
  const [customColor, setCustomColor] = useState<string | null>(null);
  const [penKind, setPenKind] = useState<PenKind>("fountain");
  const [penPanel, setPenPanel] = useState(false);
  const [markerColor, setMarkerColor] = useState(MARKER_COLORS[0]);
  const [penWidth, setPenWidth] = useState(PEN_SIZES[2]);
  const [markerWidth, setMarkerWidth] = useState(MARKER_WIDTHS[1]);
  const [zoom, setZoom] = useState(1);
  const [penOnly, setPenOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [blankMenu, setBlankMenu] = useState(false);
  const [exportPanel, setExportPanel] = useState(false);

  const originalRef = useRef<Uint8Array | null>(null);
  const pagesRef = useRef(pages);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const eraseBaseRef = useRef<InkPage[] | null>(null);
  const eraseFrameRef = useRef(0);
  const scrollFrameRef = useRef(0);
  const erasedRef = useRef(false);
  const penSeenRef = useRef(false);
  const zoomAnchorRef = useRef<number | null>(null);
  /*
   * Barmoq/g'ildirak bilan kattalashtirgandan keyin: qaysi betning
   * qaysi nuqtasi (bet birligida) oynaning qayeriga tushishi kerak.
   * Betga bog'lanamiz, chunki betlar orasidagi bo'shliq va chetlar
   * kattalik bilan birga o'zgarmaydi — oddiy proporsiya adashardi.
   */
  const pendingScrollRef = useRef<{
    pageId: string;
    u: number;
    v: number;
    vx: number;
    vy: number;
  } | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<{
    zoom0: number;
    scale: number;
    /* Barmoqlar ostidagi nuqta, kontent koordinatasida (boshlanishdagi kattalikda) */
    ox: number;
    oy: number;
    /* Barmoqlar o'rtasi, oyna ichida: boshida va hozir */
    vx0: number;
    vy0: number;
    vx: number;
    vy: number;
    /* Barmoqlar ostidagi bet va undagi nuqta (bet birligida) */
    pageId: string | null;
    u: number;
    v: number;
  } | null>(null);
  const touchesRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ distance: number } | null>(null);
  /* Ikkinchi barmoq tekkandan oxirgisi ko'tarilguncha — sahifalar chizmaydi */
  const pinchingRef = useRef(false);
  const wheelTimerRef = useRef(0);
  const [previewZoom, setPreviewZoom] = useState<number | null>(null);

  pagesRef.current = pages;

  const isMarker = tool === "marker";
  const color = isMarker ? markerColor : penColor;
  const width = isMarker ? markerWidth : penWidth;

  /* ---------------------------- tarix ---------------------------- */

  const show = useCallback((next: InkPage[]) => {
    pagesRef.current = next;
    setPages(next);
    setDirty(true);
    setHistoryTick((tick) => tick + 1);
  }, []);

  const commit = useCallback(
    (next: InkPage[], base = pagesRef.current) => {
      const h = historyRef.current;
      historyRef.current = {
        past: [...h.past, base].slice(-HISTORY_LIMIT),
        future: [],
      };
      show(next);
    },
    [show],
  );

  const undo = useCallback(() => {
    const h = historyRef.current;
    if (h.past.length === 0) return;
    historyRef.current = {
      past: h.past.slice(0, -1),
      future: [pagesRef.current, ...h.future],
    };
    show(h.past[h.past.length - 1]);
  }, [show]);

  const redo = useCallback(() => {
    const h = historyRef.current;
    if (h.future.length === 0) return;
    historyRef.current = {
      past: [...h.past, pagesRef.current],
      future: h.future.slice(1),
    };
    show(h.future[0]);
  }, [show]);

  /* --------------------- sahifa hodisalari ---------------------- */

  const handlers = useRef<PageHandlers>({
    onStroke: () => {},
    onEraseStart: () => {},
    onErase: () => {},
    onEraseEnd: () => {},
    onPenDetected: () => {},
    isPinching: () => false,
  });

  handlers.current = {
    onStroke(pageId: string, stroke: Stroke) {
      commit(
        pagesRef.current.map((page) =>
          page.id === pageId ? { ...page, strokes: [...page.strokes, stroke] } : page,
        ),
      );
    },
    onEraseStart() {
      eraseBaseRef.current = pagesRef.current;
      erasedRef.current = false;
    },
    onErase(pageId, x, y, radius) {
      const current = pagesRef.current;
      const index = current.findIndex((page) => page.id === pageId);
      if (index < 0) return;

      const page = current[index];
      const kept = page.strokes.filter((stroke) => !strokeHit(stroke, x, y, radius));
      if (kept.length === page.strokes.length) return;

      const next = current.slice();
      next[index] = { ...page, strokes: kept };
      pagesRef.current = next;
      erasedRef.current = true;

      /*
       * O'chirg'ich sekundiga yuzlab nuqta beradi. Har biriga ekranni
       * yangilasak qotib qoladi — kadrga bir marta yangilaymiz.
       * Keyingi nuqtalar `pagesRef` dagi eng so'nggi holat bilan
       * tekshiriladi, shuning uchun hech narsa yo'qolmaydi.
       */
      if (!eraseFrameRef.current) {
        eraseFrameRef.current = requestAnimationFrame(() => {
          eraseFrameRef.current = 0;
          setPages(pagesRef.current);
        });
      }
    },
    onEraseEnd() {
      const base = eraseBaseRef.current;
      eraseBaseRef.current = null;
      if (base && erasedRef.current) {
        commit(pagesRef.current, base);
      }
    },
    isPinching() {
      return pinchingRef.current;
    },
    onPenDetected() {
      if (penSeenRef.current) return;
      penSeenRef.current = true;
      setPenOnly(true);
      setNotice("Qalam aniqlandi: endi barmoq bilan sahifa suriladi, yozilmaydi.");
    },
  };

  /* --------------------------- ochish --------------------------- */

  async function openFile(file: File) {
    setError("");
    setNotice("");

    const isPdfName = /\.pdf$/i.test(file.name) || file.type === "application/pdf";
    if (!isPdfName) {
      setError("Faqat PDF fayl oçiladi.");
      return;
    }

    if (dirty && !window.confirm("Saqlanmagan yozuvlar öçib ketadi. Yangi PDF oçilsinmi?")) {
      return;
    }

    setLoading(true);

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!looksLikePdf(bytes)) {
        throw new Error("not-pdf");
      }

      const pdfjs = await loadPdfjs();
      /* pdf.js baytlarni worker'ga o'tkazib yuboradi — eksport uchun nusxa qoldiramiz */
      const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;

      const loaded: InkPage[] = [];
      for (let i = 0; i < doc.numPages; i += 1) {
        const page = await doc.getPage(i + 1);
        const viewport = page.getViewport({ scale: 1 });
        loaded.push({
          id: newId(),
          source: i,
          width: viewport.width,
          height: viewport.height,
          toPdf: invertMatrix(viewport.transform as Matrix),
          background: "blank",
          strokes: [],
        });
      }

      originalRef.current = bytes;
      pagesRef.current = loaded;
      setPdf(doc);
      setPages(loaded);
      historyRef.current = { past: [], future: [] };
      setFileName(file.name);
      setDirty(false);
      setCurrentPage(0);

      /* Sahifa kengligi oynaga sig'sin */
      const box = scrollRef.current?.clientWidth ?? window.innerWidth;
      const widest = Math.max(...loaded.map((page) => page.width), 1);
      setZoom(clampZoom(Math.min(1.6, (box - 32) / widest)));
      scrollRef.current?.scrollTo({ top: 0, left: 0 });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "";
      setError(
        message === "not-pdf"
          ? "Bu fayl PDF emas yoki buzilgan."
          : /password/i.test(message)
            ? "PDF parol bilan himoyalangan. Avval parolsiz nusxasini oling."
            : "PDF oçilmadi. Fayl buzilgan bölişi mumkin.",
      );
    } finally {
      setLoading(false);
    }
  }

  /* -------------------------- saqlash --------------------------- */

  /** `indexes` — saqlanadigan betlar (0 dan); berilmasa hammasi */
  async function save(indexes?: number[]) {
    const original = originalRef.current;
    if (!original || saving) return;

    const all = pagesRef.current;
    const chosen = indexes ? all.filter((_, i) => indexes.includes(i)) : all;
    if (chosen.length === 0) return;
    const whole = chosen.length === all.length;

    setSaving(true);
    setError("");

    try {
      const bytes = await exportInkPdf(original, chosen);
      const saved = await saveToComputer(bytes, exportFileName(fileName));
      if (saved) {
        setExportPanel(false);
        /* Bir qismi saqlansa, qolgan yozuvlar hali saqlanmagan */
        if (whole) setDirty(false);
        setNotice(whole ? "PDF saqlandi." : `${chosen.length} ta bet PDF qilib saqlandi.`);
      }
    } catch {
      setError("PDF saqlanmadi. Qaytadan urinib köring.");
    } finally {
      setSaving(false);
    }
  }

  /* --------------------------- sahifalar ------------------------ */

  function addBlankPage(background: PageBackground) {
    setBlankMenu(false);
    const current = pagesRef.current;
    if (current.length === 0) return;

    const after = Math.min(currentPage, current.length - 1);
    const like = current[after];
    const page: InkPage = {
      id: newId(),
      source: null,
      width: like.width,
      height: like.height,
      toPdf: blankPageMatrix(like.height),
      background,
      strokes: [],
    };

    const next = current.slice();
    next.splice(after + 1, 0, page);
    commit(next);

    requestAnimationFrame(() => {
      scrollRef.current
        ?.querySelector(`[data-page-id="${page.id}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function clearPage() {
    const current = pagesRef.current;
    const page = current[currentPage];
    if (!page || page.strokes.length === 0) return;
    commit(current.map((p, i) => (i === currentPage ? { ...p, strokes: [] } : p)));
  }

  function deletePage() {
    const current = pagesRef.current;
    if (current.length <= 1) return;
    if (!window.confirm(`${currentPage + 1}-sahifa olib taşlansinmi?`)) return;
    commit(current.filter((_, i) => i !== currentPage));
    setCurrentPage((i) => Math.min(i, current.length - 2));
  }

  /* -------------------------- kattalik -------------------------- */

  const changeZoom = useCallback((next: number) => {
    const scroller = scrollRef.current;
    if (scroller && scroller.scrollHeight > 0) {
      zoomAnchorRef.current =
        (scroller.scrollTop + scroller.clientHeight / 2) / scroller.scrollHeight;
    }
    setZoom(clampZoom(next));
  }, []);

  /* Kattalashtirganda ko'rib turgan joy qochib ketmasin */
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;

    const target = pendingScrollRef.current;
    if (target) {
      pendingScrollRef.current = null;
      scrollToAnchor(scroller, target, zoom);
      return;
    }

    const anchor = zoomAnchorRef.current;
    if (anchor === null) return;
    zoomAnchorRef.current = null;
    scroller.scrollTop = anchor * scroller.scrollHeight - scroller.clientHeight / 2;
  }, [zoom]);

  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  /* Bo'sh holatda sahifalar oynasi yo'q — u paydo bo'lganda ulanamiz */
  const hasPages = pages.length > 0;

  /*
   * Ikki barmoq (yoki sensor panel / Ctrl + g'ildirak) bilan kattalashtirish.
   *
   * Harakat davomida sahifalar faqat CSS bilan cho'ziladi — bu tez.
   * Har kadrda haqiqiy kattalikni o'zgartirsak, hamma kanvas qayta
   * chizilib, ekran qotib qolardi. Barmoqlar ko'tarilganda haqiqiy
   * kattalik o'rnatiladi va sahifalar tiniq qilib qayta chiziladi;
   * barmoqlar ostidagi joy o'z o'rnida qoladi.
   */
  const beginPreview = useCallback((clientX: number, clientY: number) => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const rect = scroller.getBoundingClientRect();
    const vx = clientX - rect.left;
    const vy = clientY - rect.top;
    const zoom0 = zoomRef.current;

    /* Barmoqlarga eng yaqin bet */
    let pageId: string | null = null;
    let u = 0;
    let v = 0;
    let best = Infinity;
    scroller.querySelectorAll<HTMLElement>("[data-page-id]").forEach((node) => {
      const box = node.getBoundingClientRect();
      const dy = clientY < box.top ? box.top - clientY : Math.max(0, clientY - box.bottom);
      if (dy < best) {
        best = dy;
        pageId = node.dataset.pageId ?? null;
        u = (clientX - box.left) / zoom0;
        v = (clientY - box.top) / zoom0;
      }
    });

    previewRef.current = {
      zoom0,
      scale: 1,
      ox: scroller.scrollLeft + vx,
      oy: scroller.scrollTop + vy,
      vx0: vx,
      vy0: vy,
      vx,
      vy,
      pageId,
      u,
      v,
    };
  }, []);

  const updatePreview = useCallback((factor: number, clientX: number, clientY: number) => {
    const preview = previewRef.current;
    const scroller = scrollRef.current;
    const content = contentRef.current;
    if (!preview || !scroller || !content) return;

    const rect = scroller.getBoundingClientRect();
    const target = clampZoom(preview.zoom0 * factor);
    preview.scale = target / preview.zoom0;
    preview.vx = clientX - rect.left;
    preview.vy = clientY - rect.top;

    content.style.transformOrigin = `${preview.ox}px ${preview.oy}px`;
    content.style.transform = `translate(${preview.vx - preview.vx0}px, ${preview.vy - preview.vy0}px) scale(${preview.scale})`;
    setPreviewZoom(target);
  }, []);

  const endPreview = useCallback(() => {
    const preview = previewRef.current;
    const scroller = scrollRef.current;
    previewRef.current = null;
    if (contentRef.current) contentRef.current.style.transform = "";
    setPreviewZoom(null);
    if (!preview || !scroller) return;

    const next = clampZoom(preview.zoom0 * preview.scale);
    if (!preview.pageId) {
      setZoom(next);
      return;
    }

    const target = {
      pageId: preview.pageId,
      u: preview.u,
      v: preview.v,
      vx: preview.vx,
      vy: preview.vy,
    };

    if (next === zoomRef.current) {
      scrollToAnchor(scroller, target, next);
    } else {
      pendingScrollRef.current = target;
      setZoom(next);
    }
  }, []);

  /* Ctrl + g'ildirak; sensor paneldagi ikki barmoq ham shunday keladi */
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    let factor = 1;

    function onWheel(event: WheelEvent) {
      if (!event.ctrlKey) return;
      event.preventDefault();
      if (pinchRef.current) return;

      if (!previewRef.current) {
        factor = 1;
        beginPreview(event.clientX, event.clientY);
      }
      /* Sichqoncha bir "chiqillashda" ~100 beradi, sensor panel — kichik qiymatlar */
      const delta = Math.max(-50, Math.min(50, event.deltaY));
      factor *= Math.exp(-delta * 0.006);
      updatePreview(factor, event.clientX, event.clientY);

      window.clearTimeout(wheelTimerRef.current);
      wheelTimerRef.current = window.setTimeout(endPreview, 180);
    }

    scroller.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      scroller.removeEventListener("wheel", onWheel);
      window.clearTimeout(wheelTimerRef.current);
    };
  }, [hasPages, beginPreview, updatePreview, endPreview]);

  /* Ekranda ikki barmoq */
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const touches = touchesRef.current;
    /* Qalam ekranda bo'lsa, kaft tegishi kattalashtirmasin */
    const pens = new Set<number>();

    function spread() {
      const [a, b] = [...touches.values()];
      return {
        distance: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
      };
    }

    function onDown(event: PointerEvent) {
      if (event.pointerType === "pen") pens.add(event.pointerId);
      if (event.pointerType !== "touch") return;
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (touches.size === 2 && !pinchRef.current && pens.size === 0) {
        /* Birinchi barmoq boshlagan chizgi bekor bo'ladi (ink-page.tsx) */
        pinchingRef.current = true;
        window.clearTimeout(wheelTimerRef.current);
        if (previewRef.current) endPreview();
        const { distance, x, y } = spread();
        pinchRef.current = { distance };
        beginPreview(x, y);
      }
    }

    function onMove(event: PointerEvent) {
      if (!touches.has(event.pointerId)) return;
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const pinch = pinchRef.current;
      if (!pinch || touches.size < 2) return;
      event.preventDefault();
      const { distance, x, y } = spread();
      updatePreview(distance / pinch.distance, x, y);
    }

    function onUp(event: PointerEvent) {
      pens.delete(event.pointerId);
      if (!touches.delete(event.pointerId)) return;
      if (pinchRef.current && touches.size < 2) {
        pinchRef.current = null;
        endPreview();
      }
      if (touches.size === 0 && pinchingRef.current) {
        /*
         * Bu tinglovchi sahifadagidan oldin ishlaydi. Belgini darhol
         * olsak, oxirgi barmoq ko'tarilganda sahifa uning chizgisini
         * saqlab qo'yardi — shuning uchun hodisadan keyin olamiz.
         */
        window.setTimeout(() => {
          if (touches.size === 0) pinchingRef.current = false;
        }, 0);
      }
    }

    scroller.addEventListener("pointerdown", onDown, true);
    scroller.addEventListener("pointermove", onMove, true);
    scroller.addEventListener("pointerup", onUp, true);
    scroller.addEventListener("pointercancel", onUp, true);
    return () => {
      scroller.removeEventListener("pointerdown", onDown, true);
      scroller.removeEventListener("pointermove", onMove, true);
      scroller.removeEventListener("pointerup", onUp, true);
      scroller.removeEventListener("pointercancel", onUp, true);
      touches.clear();
    };
  }, [hasPages, beginPreview, updatePreview, endPreview]);

  /* Hozirgi sahifa — ekran o'rtasidagisi */
  function onScroll() {
    /* Surish hodisasi kadrdan ko'p keladi — kadrga bir marta hisoblaymiz */
    if (scrollFrameRef.current) return;
    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = 0;
      const scroller = scrollRef.current;
      if (!scroller) return;
      const middle = scroller.getBoundingClientRect().top + scroller.clientHeight / 2;
      const nodes = scroller.querySelectorAll<HTMLElement>("[data-page-id]");
      let index = 0;
      nodes.forEach((node, i) => {
        if (node.getBoundingClientRect().top <= middle) index = i;
      });
      setCurrentPage(index);
    });
  }

  /* -------------------------- klaviatura ------------------------ */

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (mod && key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if (mod && (key === "y" || (key === "z" && event.shiftKey))) {
        event.preventDefault();
        redo();
      } else if (mod && key === "s") {
        event.preventDefault();
        void save();
      } else if (!mod && !event.altKey) {
        const map: Record<string, EditorTool> = {
          p: "pen",
          m: "marker",
          l: "line",
          e: "eraser",
          h: "hand",
        };
        if (map[key]) setTool(map[key]);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /* Sahifa yuklanib bo'lgach — internetsiz ochilishga tayyorlanamiz */
  useEffect(() => {
    const timer = window.setTimeout(() => void prepareOffline(), 2000);
    return () => window.clearTimeout(timer);
  }, []);

  /* Saqlanmagan yozuv bilan sahifani yopishdan oldin ogohlantirish */
  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  useEffect(() => () => void pdf?.destroy(), [pdf]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  /* ---------------------------- ko'rinish ----------------------- */

  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="application/pdf,.pdf"
      className="hidden"
      onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file) void openFile(file);
      }}
    />
  );

  function onDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void openFile(file);
  }

  const dropProps = {
    onDragOver: (event: React.DragEvent) => {
      event.preventDefault();
      setDragOver(true);
    },
    onDragLeave: () => setDragOver(false),
    onDrop,
  };

  if (pages.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {fileInput}

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          {...dropProps}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed bg-white px-6 py-16 text-center transition",
            dragOver ? "border-mb-brand bg-mb-tintSoft" : "border-mb-line hover:border-mb-brand",
          )}
        >
          {loading ? (
            <Loader2 className="h-10 w-10 animate-spin text-mb-brand" aria-hidden="true" />
          ) : (
            <FileUp className="h-10 w-10 text-mb-brand" strokeWidth={1.8} aria-hidden="true" />
          )}
          <span className="text-lg font-bold text-mb-ink">
            {loading ? "PDF oçilmoqda…" : "PDF faylni tanlang"}
          </span>
          <span className="max-w-md text-sm leading-6 text-mb-muted">
            yoki şu yerga sudrab taşlang. Faqat PDF oçiladi. Fayl serverga
            yuborilmaydi — hammasi şu kompyuterda qoladi.
          </span>
        </button>

        {error && (
          <AppAlert variant="error" className="mt-4" compact>
            {error}
          </AppAlert>
        )}

        <ul className="mt-6 space-y-1.5 text-sm text-mb-muted">
          <li>Qalam (P), Marker (M), Töğri çiziq (L), Öçirğiç (E), Suriş (H).</li>
          <li>Ctrl+Z — orqaga, Ctrl+Y — oldinga, Ctrl+S — PDF saqlaş.</li>
          <li>Kattalaştiriş — ekranda ikki barmoq bilan yoki Ctrl + siçqonça ğildiragi.</li>
        </ul>
      </div>
    );
  }

  const colors = isMarker
    ? MARKER_COLORS
    : customColor
      ? [...PEN_COLORS, customColor]
      : PEN_COLORS;
  const showStyle = tool === "pen" || tool === "marker" || tool === "line";
  const PenIcon = PEN_KINDS.find((item) => item.kind === penKind)?.icon ?? PenLine;

  /* Qalam (yoki chiziq) tanlangan bo'lsa, qayta bosish oynani ochadi */
  function pickPenLike(next: "pen" | "line") {
    if (tool === next) setPenPanel((open) => !open);
    else {
      setTool(next);
      setPenPanel(false);
    }
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col" {...dropProps}>
      {fileInput}

      {/* Asboblar qatori */}
      <div className="relative border-b border-mb-line bg-white">
        <div className="flex items-center gap-1 pr-2 sm:pr-3">
          <div className="scroll-x flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-1.5 pl-2 sm:pl-3">
            <ToolButton
              icon={FileUp}
              label="Boşqa PDF oçiş"
              onClick={() => fileInputRef.current?.click()}
            />
            <span
              className="hidden max-w-[12rem] truncate px-1 text-sm font-semibold text-mb-ink 2xl:block"
              title={fileName}
            >
              {fileName}
              {dirty && <span className="text-amber-600"> •</span>}
            </span>

            <Divider />

            <ToolButton
              icon={PenIcon}
              label="Qalam (P) — qayta bosing: qalam turi va ölçami"
              active={tool === "pen"}
              onClick={() => pickPenLike("pen")}
            />
            <ToolButton
              icon={Highlighter}
              label="Marker (M)"
              active={tool === "marker"}
              onClick={() => setTool("marker")}
            />
            <ToolButton
              icon={Minus}
              label="Töğri çiziq (L)"
              active={tool === "line"}
              onClick={() => pickPenLike("line")}
            />
            <ToolButton
              icon={Eraser}
              label="Öçirğiç (E)"
              active={tool === "eraser"}
              onClick={() => setTool("eraser")}
            />
            <ToolButton icon={Hand} label="Suriş (H)" active={tool === "hand"} onClick={() => setTool("hand")} />

            {showStyle && (
              <>
                <Divider />
                {colors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    aria-label={`Rang ${c}`}
                    aria-pressed={c === color}
                    onClick={() => (isMarker ? setMarkerColor(c) : setPenColor(c))}
                    className="grid h-10 w-8 shrink-0 place-items-center"
                  >
                    <span
                      className={cn(
                        "h-6 w-6 rounded-full ring-offset-2 transition",
                        c === color ? "ring-2 ring-mb-brand" : "ring-1 ring-slate-300",
                      )}
                      style={{ backgroundColor: c }}
                    />
                  </button>
                ))}

                {!isMarker && (
                  <label
                    title="Boşqa rang"
                    className="relative grid h-10 w-8 shrink-0 cursor-pointer place-items-center"
                  >
                    <span className="grid h-6 w-6 place-items-center rounded-full border border-dashed border-slate-400 text-slate-600">
                      <Plus className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <input
                      type="color"
                      aria-label="Boşqa rang"
                      value={penColor}
                      onChange={(event) => {
                        const value = event.target.value.toUpperCase();
                        if (!PEN_COLORS.includes(value)) setCustomColor(value);
                        setPenColor(value);
                      }}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                  </label>
                )}
              </>
            )}

            {isMarker && (
              <>
                <Divider />
                {MARKER_WIDTHS.map((w, i) => (
                  <button
                    key={w}
                    type="button"
                    title={["Ingiçka", "Örtaça", "Qalin"][i]}
                    aria-label={["Ingiçka", "Örtaça", "Qalin"][i]}
                    aria-pressed={w === width}
                    onClick={() => setMarkerWidth(w)}
                    className={cn(
                      "grid h-10 w-9 shrink-0 place-items-center rounded-xl transition",
                      w === width ? "bg-mb-tint" : "hover:bg-slate-100",
                    )}
                  >
                    <span
                      className="rounded-full"
                      style={{
                        width: 4 + i * 5,
                        height: 4 + i * 5,
                        backgroundColor: color,
                        opacity: 0.6,
                      }}
                    />
                  </button>
                ))}
              </>
            )}

            <Divider />

            <ToolButton icon={Undo2} label="Orqaga (Ctrl+Z)" disabled={historyRef.current.past.length === 0} onClick={undo} />
            <ToolButton icon={Redo2} label="Oldinga (Ctrl+Y)" disabled={historyRef.current.future.length === 0} onClick={redo} />

            <Divider />

            {/* Kattalik ikki barmoq / Ctrl + g'ildirak bilan; bu yerda faqat foiz */}
            <button
              type="button"
              title="Ikki barmoq bilan kattalaştiring. Bosilsa — sahifa kengligiga moslanadi"
              onClick={() => {
                const box = scrollRef.current?.clientWidth ?? window.innerWidth;
                const widest = Math.max(...pages.map((page) => page.width), 1);
                changeZoom((box - 32) / widest);
              }}
              className="h-10 w-14 shrink-0 rounded-xl text-sm font-semibold tabular-nums text-slate-700 hover:bg-slate-100"
            >
              {Math.round((previewZoom ?? zoom) * 100)}%
            </button>

            <Divider />

            <div className="relative shrink-0">
              <ToolButton
                icon={FilePlus}
                label="Böş sahifa qöşiş"
                active={blankMenu}
                onClick={() => setBlankMenu((open) => !open)}
              />
            </div>
            <ToolButton
              icon={Trash2}
              label="Şu sahifadagi yozuvni tozalaş"
              disabled={!pages[currentPage]?.strokes.length}
              onClick={clearPage}
            />
            <ToolButton
              icon={X}
              label="Şu sahifani olib taşlaş"
              disabled={pages.length <= 1}
              onClick={deletePage}
            />

            <Divider />

            <button
              type="button"
              title="Yoqilsa, barmoq yozmaydi — sahifani suradi. Planşet qalami uçun."
              aria-label="Faqat qalam"
              aria-pressed={penOnly}
              onClick={() => setPenOnly((on) => !on)}
              className={cn(
                "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-sm font-semibold transition",
                penOnly ? "bg-mb-tint text-mb-brandDark" : "text-slate-700 hover:bg-slate-100",
              )}
            >
              <PenLine className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              <span className="hidden 2xl:inline">Faqat qalam</span>
            </button>
          </div>

          <span className="shrink-0 px-1 text-sm tabular-nums text-mb-muted">
            {Math.min(currentPage + 1, pages.length)} / {pages.length}
          </span>

          <button
            type="button"
            onClick={() => setExportPanel((open) => !open)}
            title="PDF saqlaş (Ctrl+S — hamma betlar)"
            aria-label="PDF saqlaş"
            disabled={saving}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-mb-brand px-4 text-sm font-semibold text-white transition hover:bg-mb-brandDark disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            )}
            <span className="hidden sm:inline">PDF saqlaş</span>
          </button>
        </div>

        {/*
          Xabar sahifalar ustida suzib turadi. Uni oqimga qo'ysak,
          paydo bo'lganda sahifalar pastga suriladi — qalam birinchi
          tekkanda ("Qalam aniqlandi") yozilayotgan chizgi sakrardi.
        */}
        {(error || notice) && (
          <div className="pointer-events-none absolute inset-x-0 top-full z-20 flex justify-center px-3 pt-2">
            <div className="pointer-events-auto w-full max-w-xl">
              <AppAlert variant={error ? "error" : "success"} compact>
                {error || notice}
              </AppAlert>
            </div>
          </div>
        )}

        {penPanel && (tool === "pen" || tool === "line") && (
          <PenPanel
            pen={penKind}
            size={penWidth}
            color={penColor}
            onPen={(kind) => {
              setPenKind(kind);
              setTool("pen");
            }}
            onSize={setPenWidth}
            onClose={() => setPenPanel(false)}
          />
        )}

        {exportPanel && (
          <ExportPanel
            pageCount={pages.length}
            currentPage={Math.min(currentPage, pages.length - 1)}
            inked={pages.map((page) => page.strokes.length > 0)}
            saving={saving}
            onExport={(indexes) => void save(indexes)}
            onClose={() => setExportPanel(false)}
          />
        )}

        {blankMenu && (
          <div className="flex flex-wrap items-center gap-2 border-t border-mb-line px-3 py-2 text-sm">
            <span className="text-mb-muted">{currentPage + 1}-sahifadan keyin qöşiş:</span>
            <button
              type="button"
              onClick={() => addBlankPage("blank")}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-mb-line bg-white px-3 font-semibold text-slate-700 hover:border-mb-brand"
            >
              <FilePlus className="h-4 w-4" aria-hidden="true" />
              Oq sahifa
            </button>
            <button
              type="button"
              onClick={() => addBlankPage("grid")}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-mb-line bg-white px-3 font-semibold text-slate-700 hover:border-mb-brand"
            >
              <Grid3x3 className="h-4 w-4" aria-hidden="true" />
              Katak sahifa
            </button>
          </div>
        )}
      </div>

      {/* Sahifalar */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        /* Oraliqlarda brauzer butun sahifani kattalashtirmasin — o'zimiz qilamiz */
        style={{ touchAction: "pan-x pan-y" }}
        className={cn(
          "relative flex-1 overflow-auto bg-slate-200/70 dark:bg-slate-900",
          dragOver && "outline outline-2 -outline-offset-4 outline-mb-brand",
        )}
      >
        <div
          ref={contentRef}
          className="flex w-max min-w-full flex-col items-center gap-4 px-4 py-4"
          style={{ willChange: previewZoom === null ? undefined : "transform" }}
        >
          {pages.map((page) => (
            <InkPageView
              key={page.id}
              page={page}
              pdf={pdf}
              zoom={zoom}
              tool={tool}
              color={color}
              width={width}
              pen={penKind}
              penOnly={penOnly}
              scrollRef={scrollRef}
              handlers={handlers}
            />
          ))}
        </div>

        {loading && (
          <div className="absolute inset-0 grid place-items-center bg-white/70">
            <Loader2 className="h-10 w-10 animate-spin text-mb-brand" aria-hidden="true" />
          </div>
        )}
      </div>
    </div>
  );
}
