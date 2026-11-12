"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from "lucide-react";

/*
 * Imtihon taymeri — elektron doskaga chiqarish uchun.
 *
 * Vaqt `endsAt` (tugash payti) orqali hisoblanadi, har soniyada
 * sanab emas. Sabab: brauzer fon oynada taymerni sekinlashtiradi,
 * sanab borilsa 2 soatda bir necha daqiqa adashardi. Bu yerda esa
 * ekranga har safar `endsAt - hozir` yoziladi — qancha turib qolsa
 * ham aniq qoladi.
 */

const STORAGE_KEY = "vepa-exam-timer";

/** Tayyor muddatlar (daqiqada) */
const PRESETS = [30, 45, 60, 90, 120, 180];

type Status = "idle" | "running" | "paused" | "finished";

type Saved = {
  status: Status;
  totalMs: number;
  endsAt: number | null;
  remainingMs: number;
};

function formatDuration(ms: number, withHours: boolean) {
  const safe = Math.max(0, ms);
  const totalSeconds = Math.ceil(safe / 1000);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");

  return withHours ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

function minutesLabel(total: number) {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;

  if (hours === 0) return `${minutes} daqiqa`;
  if (minutes === 0) return `${hours} soat`;

  return `${hours} soat ${minutes} daqiqa`;
}

/** Tugaganda qisqa signal — fayl kerak emas, brauzer o'zi chaladi */
function playChime() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (!Ctx) return;

    const ctx = new Ctx();

    [0, 0.45, 0.9].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.value = 880;
      osc.connect(gain);
      gain.connect(ctx.destination);

      const start = ctx.currentTime + offset;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.3, start + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);

      osc.start(start);
      osc.stop(start + 0.4);
    });

    window.setTimeout(() => void ctx.close(), 2000);
  } catch {
    /* ovoz ishlamasa taymer baribir ishlayveradi */
  }
}

export default function ExamTimer() {
  const [status, setStatus] = useState<Status>("idle");
  const [totalMs, setTotalMs] = useState(60 * 60 * 1000);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [remainingMs, setRemainingMs] = useState(60 * 60 * 1000);

  const [soundOn, setSoundOn] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [customHours, setCustomHours] = useState("1");
  const [customMinutes, setCustomMinutes] = useState("0");

  const shellRef = useRef<HTMLDivElement>(null);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
  const finishedRef = useRef(false);

  /* ---------- saqlangan holatni tiklash ---------- */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const saved = JSON.parse(raw) as Saved;
      if (!saved || typeof saved.totalMs !== "number") return;

      setTotalMs(saved.totalMs);

      if (saved.status === "running" && saved.endsAt) {
        const left = saved.endsAt - Date.now();

        if (left > 0) {
          setEndsAt(saved.endsAt);
          setRemainingMs(left);
          setStatus("running");
          return;
        }

        setRemainingMs(0);
        setStatus("finished");
        finishedRef.current = true;
        return;
      }

      setRemainingMs(saved.remainingMs ?? saved.totalMs);
      setStatus(saved.status === "paused" ? "paused" : "idle");
    } catch {
      /* buzilgan yozuv bo'lsa e'tiborsiz qoldiramiz */
    }
  }, []);

  /* ---------- holatni saqlash ---------- */
  useEffect(() => {
    try {
      const saved: Saved = { status, totalMs, endsAt, remainingMs };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch {
      /* xotira to'la bo'lsa ham to'xtatmaymiz */
    }
  }, [status, totalMs, endsAt, remainingMs]);

  /* ---------- sanash ---------- */
  useEffect(() => {
    if (status !== "running" || endsAt === null) return;

    const tick = () => {
      const left = endsAt - Date.now();

      if (left <= 0) {
        setRemainingMs(0);
        setStatus("finished");
        return;
      }

      setRemainingMs(left);
    };

    tick();
    const id = window.setInterval(tick, 200);

    return () => window.clearInterval(id);
  }, [status, endsAt]);

  /* ---------- tugaganda signal ---------- */
  useEffect(() => {
    if (status !== "finished") {
      if (status === "running") finishedRef.current = false;
      return;
    }

    if (finishedRef.current) return;
    finishedRef.current = true;

    if (soundOn) playChime();
  }, [status, soundOn]);

  /* ---------- ekran o'chmasin ---------- */
  useEffect(() => {
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> };
    };

    if (status !== "running" || !nav.wakeLock) return;

    let cancelled = false;

    nav.wakeLock
      .request("screen")
      .then((lock) => {
        if (cancelled) {
          void lock.release();
          return;
        }
        wakeLockRef.current = lock;
      })
      .catch(() => {
        /* ruxsat bo'lmasa ham taymer ishlayveradi */
      });

    return () => {
      cancelled = true;
      void wakeLockRef.current?.release();
      wakeLockRef.current = null;
    };
  }, [status]);

  /* ---------- to'liq ekran ---------- */
  useEffect(() => {
    const onChange = () =>
      setIsFullscreen(Boolean(document.fullscreenElement));

    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }

    void shellRef.current?.requestFullscreen?.();
  }, []);

  /* ---------- amallar ---------- */
  const applyMinutes = useCallback((minutes: number) => {
    const ms = Math.max(1, minutes) * 60 * 1000;
    setTotalMs(ms);
    setRemainingMs(ms);
    setEndsAt(null);
    setStatus("idle");
    finishedRef.current = false;
  }, []);

  const start = useCallback(() => {
    const left = status === "paused" ? remainingMs : totalMs;
    if (left <= 0) return;

    setEndsAt(Date.now() + left);
    setRemainingMs(left);
    setStatus("running");
    finishedRef.current = false;
  }, [status, remainingMs, totalMs]);

  const pause = useCallback(() => {
    if (status !== "running" || endsAt === null) return;

    setRemainingMs(Math.max(0, endsAt - Date.now()));
    setEndsAt(null);
    setStatus("paused");
  }, [status, endsAt]);

  const reset = useCallback(() => {
    setRemainingMs(totalMs);
    setEndsAt(null);
    setStatus("idle");
    finishedRef.current = false;
  }, [totalMs]);

  /* ---------- probel bilan boshqarish ---------- */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      if (event.code === "Space") {
        event.preventDefault();
        if (status === "running") pause();
        else start();
      }

      if (event.key.toLowerCase() === "f") toggleFullscreen();
      if (event.key.toLowerCase() === "r") reset();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status, pause, start, reset, toggleFullscreen]);

  /* ---------- ko'rinish ---------- */
  const withHours = totalMs >= 60 * 60 * 1000;
  const finished = status === "finished";

  const ratio = totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0;
  const secondsLeft = Math.ceil(remainingMs / 1000);

  const urgent = !finished && secondsLeft <= 60;
  const warning = !finished && !urgent && secondsLeft <= 5 * 60;

  const digitColor = finished
    ? "text-red-400"
    : urgent
      ? "text-red-400"
      : warning
        ? "text-amber-300"
        : "text-white";

  const barColor = finished || urgent
    ? "bg-red-500"
    : warning
      ? "bg-amber-400"
      : "bg-mb-brand";

  return (
    <div ref={shellRef} className="bg-[#0B1220]">
      {/* ---------------- Katta ekran ---------------- */}
      <div
        className={[
          "relative flex flex-col items-center justify-center overflow-hidden rounded-3xl bg-[#0B1220] px-6 text-center",
          isFullscreen ? "h-screen rounded-none" : "min-h-[52vh] py-12",
          urgent && !finished ? "animate-pulse" : "",
        ].join(" ")}
      >
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-400 sm:text-base">
          {finished ? "Vaqt tugadi" : minutesLabel(Math.round(totalMs / 60000))}
        </p>

        <p
          className={[
            "mt-4 font-bold tabular-nums leading-none tracking-tight transition-colors",
            digitColor,
            isFullscreen
              ? "text-[clamp(5rem,20vw,22rem)]"
              : "text-[clamp(4rem,16vw,13rem)]",
          ].join(" ")}
        >
          {formatDuration(remainingMs, withHours)}
        </p>

        {finished ? (
          <p className="mt-6 rounded-2xl bg-red-500/15 px-6 py-3 text-xl font-bold text-red-300 sm:text-2xl">
            Qalamlarni qöying
          </p>
        ) : (
          <div className="mt-8 h-2.5 w-full max-w-4xl overflow-hidden rounded-full bg-white/10 sm:h-3">
            <div
              className={`h-full rounded-full transition-[width] duration-200 ease-linear ${barColor}`}
              style={{ width: `${ratio * 100}%` }}
            />
          </div>
        )}

        {/* to'liq ekranda minimal boshqaruv */}
        {isFullscreen && (
          <div className="absolute bottom-6 flex items-center gap-2 opacity-25 transition hover:opacity-100">
            <IconButton
              onClick={status === "running" ? pause : start}
              label={status === "running" ? "Töxtatiş" : "Boşlaş"}
            >
              {status === "running" ? (
                <Pause className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Play className="h-5 w-5" aria-hidden="true" />
              )}
            </IconButton>

            <IconButton onClick={reset} label="Qaytadan">
              <RotateCcw className="h-5 w-5" aria-hidden="true" />
            </IconButton>

            <IconButton onClick={toggleFullscreen} label="Çiqiş">
              <Minimize2 className="h-5 w-5" aria-hidden="true" />
            </IconButton>
          </div>
        )}
      </div>

      {/* ---------------- Boshqaruv ---------------- */}
      {!isFullscreen && (
        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="rounded-2xl border border-mb-line bg-white p-5">
            <p className="text-sm font-semibold text-mb-ink">Muddat</p>

            <div className="mt-2.5 flex flex-wrap gap-2">
              {PRESETS.map((minutes) => {
                const active = Math.round(totalMs / 60000) === minutes;

                return (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() => applyMinutes(minutes)}
                    aria-pressed={active}
                    className={[
                      "min-h-11 rounded-xl border px-4 text-sm font-semibold transition",
                      active
                        ? "border-mb-brand bg-mb-brand text-white shadow-sm"
                        : "border-slate-300 bg-white text-mb-ink hover:bg-slate-50",
                    ].join(" ")}
                  >
                    {minutesLabel(minutes)}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-mb-line pt-4">
              <div>
                <label
                  htmlFor="timer-hours"
                  className="block text-xs font-semibold text-mb-muted"
                >
                  Soat
                </label>

                <input
                  id="timer-hours"
                  type="number"
                  min={0}
                  max={9}
                  value={customHours}
                  onChange={(event) => setCustomHours(event.target.value)}
                  className="mt-1 min-h-11 w-20 rounded-xl border border-slate-300 bg-white px-3 text-center text-sm tabular-nums text-mb-ink outline-none transition focus:border-mb-brand focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div>
                <label
                  htmlFor="timer-minutes"
                  className="block text-xs font-semibold text-mb-muted"
                >
                  Daqiqa
                </label>

                <input
                  id="timer-minutes"
                  type="number"
                  min={0}
                  max={59}
                  value={customMinutes}
                  onChange={(event) => setCustomMinutes(event.target.value)}
                  className="mt-1 min-h-11 w-20 rounded-xl border border-slate-300 bg-white px-3 text-center text-sm tabular-nums text-mb-ink outline-none transition focus:border-mb-brand focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <button
                type="button"
                onClick={() =>
                  applyMinutes(
                    Number(customHours || 0) * 60 + Number(customMinutes || 0),
                  )
                }
                className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-mb-ink transition hover:bg-slate-50"
              >
                Qöyiş
              </button>
            </div>

            <p className="mt-3 text-xs leading-5 text-mb-muted">
              Klaviatura: <b>Probel</b> — boşlaş va töxtatiş,{" "}
              <b>F</b> — töliq ekran, <b>R</b> — qaytadan.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5 lg:flex-col">
            <button
              type="button"
              onClick={status === "running" ? pause : start}
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-mb-brand px-6 text-base font-bold text-white transition hover:bg-mb-brandDark lg:w-48 lg:flex-none"
            >
              {status === "running" ? (
                <>
                  <Pause className="h-5 w-5" aria-hidden="true" />
                  Töxtatiş
                </>
              ) : (
                <>
                  <Play className="h-5 w-5" aria-hidden="true" />
                  {status === "paused" ? "Davom etiş" : "Boşlaş"}
                </>
              )}
            </button>

            <button
              type="button"
              onClick={reset}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-mb-ink transition hover:bg-slate-50 lg:w-48"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Qaytadan
            </button>

            <button
              type="button"
              onClick={toggleFullscreen}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-mb-ink transition hover:bg-slate-50 lg:w-48"
            >
              <Maximize2 className="h-4 w-4" aria-hidden="true" />
              Töliq ekran
            </button>

            <button
              type="button"
              onClick={() => setSoundOn((value) => !value)}
              aria-pressed={soundOn}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-mb-ink transition hover:bg-slate-50 lg:w-48"
            >
              {soundOn ? (
                <>
                  <Volume2 className="h-4 w-4" aria-hidden="true" />
                  Ovoz yoniq
                </>
              ) : (
                <>
                  <VolumeX className="h-4 w-4" aria-hidden="true" />
                  Ovoz öçiq
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function IconButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="grid h-11 w-11 place-items-center rounded-xl border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
    >
      {children}
    </button>
  );
}
