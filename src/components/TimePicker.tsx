"use client";

import { useEffect, useId, useRef, useState } from "react";

const SIZE = 220;
const CENTER = SIZE / 2;
const OUTER_R = 82;
const INNER_R = 52;
const FACE_R = 96;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function parseValue(value: string): { hour: number; minute: number } {
  const m = value.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return { hour: 12, minute: 0 };
  return { hour: Number(m[1]), minute: Number(m[2]) };
}

/** Ángulo (0-360, 0 = arriba, sentido horario) desde el centro del reloj hasta (x, y). */
function angleFromCenter(x: number, y: number): number {
  const dx = x - CENTER;
  const dy = y - CENTER;
  return (Math.atan2(dx, -dy) * (180 / Math.PI) + 360) % 360;
}

function pointFor(angleDeg: number, radius: number): { x: number; y: number } {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return { x: CENTER + radius * Math.cos(rad), y: CENTER + radius * Math.sin(rad) };
}

/**
 * Selector de hora con reloj análogo de 24 horas (dos anillos: 1-12 el
 * exterior, 13-00 el interior, como los relojes de pared reales) más un
 * segundo paso para los minutos con precisión de 1 minuto (los 12 números
 * marcan cada 5, pero se puede tocar entre ellos para un valor exacto).
 * Controlado (value/onChange) o no controlado (defaultValue) — en ambos
 * casos expone un <input type="hidden"> con `name` para que funcione
 * dentro de un <form action={...}> normal.
 */
export function TimePicker({
  id,
  name,
  value,
  defaultValue,
  onChange,
  required,
  placeholder = "--:--",
  className = "",
}: {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const reactId = useId();
  const inputId = id ?? reactId;
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const current = isControlled ? value! : internalValue;

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"hour" | "minute">("hour");
  const [draftHour, setDraftHour] = useState(0);
  const [draftMinute, setDraftMinute] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  function commit(next: string) {
    if (!isControlled) setInternalValue(next);
    onChange?.(next);
  }

  function openPicker() {
    const { hour, minute } = parseValue(current || "12:00");
    setDraftHour(hour);
    setDraftMinute(minute);
    setStep("hour");
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function handleHourClick(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * SIZE;
    const y = ((e.clientY - rect.top) / rect.height) * SIZE;
    const dist = Math.hypot(x - CENTER, y - CENTER);
    const angle = angleFromCenter(x, y);
    const idx = Math.round(angle / 30) % 12;
    const outer = dist > (OUTER_R + INNER_R) / 2;
    const hour = outer ? (idx === 0 ? 12 : idx) : idx === 0 ? 0 : idx + 12;
    setDraftHour(hour);
    setStep("minute");
  }

  function handleMinuteClick(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * SIZE;
    const y = ((e.clientY - rect.top) / rect.height) * SIZE;
    const angle = angleFromCenter(x, y);
    const minute = Math.round(angle / 6) % 60;
    setDraftMinute(minute);
    commit(`${pad(draftHour)}:${pad(minute)}`);
    setOpen(false);
  }

  const hourAngle =
    step === "hour"
      ? undefined
      : draftHour === 0 || draftHour === 12
      ? 0
      : draftHour < 12
      ? draftHour * 30
      : (draftHour - 12) * 30;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input type="hidden" name={name} value={current} required={required} />
      <button
        type="button"
        id={inputId}
        onClick={() => (open ? setOpen(false) : openPicker())}
        aria-label="Elegir hora"
        className="flex w-full items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-left text-sm text-foreground hover:border-accent focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 flex-none text-muted" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
        <span className={current ? "" : "text-faint"}>{current || placeholder}</span>
      </button>

      {open && (
        <div className="absolute left-1/2 top-full z-30 mt-1 w-[240px] -translate-x-1/2 rounded-lg border border-border bg-surface p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-center gap-1 text-2xl font-semibold text-foreground">
            <button
              type="button"
              onClick={() => setStep("hour")}
              className={`rounded px-1.5 ${step === "hour" ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground"}`}
            >
              {pad(draftHour)}
            </button>
            <span>:</span>
            <button
              type="button"
              onClick={() => setStep("minute")}
              className={`rounded px-1.5 ${step === "minute" ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground"}`}
            >
              {pad(draftMinute)}
            </button>
          </div>
          <p className="mb-2 text-center text-[11px] text-faint">
            {step === "hour" ? "Elige la hora (anillo interior = 13-00)" : "Elige los minutos — toca entre las marcas para un valor exacto"}
          </p>

          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className="mx-auto block h-[200px] w-[200px] cursor-pointer select-none"
            onClick={step === "hour" ? handleHourClick : handleMinuteClick}
          >
            <circle cx={CENTER} cy={CENTER} r={FACE_R} className="fill-background stroke-border" strokeWidth={1} />
            <circle
              cx={CENTER}
              cy={CENTER}
              r={2.5}
              className="fill-accent"
            />

            {step === "hour" ? (
              <>
                {hourAngle !== undefined && (
                  <line
                    x1={CENTER}
                    y1={CENTER}
                    x2={pointFor(hourAngle, draftHour === 0 || (draftHour > 12) ? INNER_R : OUTER_R).x}
                    y2={pointFor(hourAngle, draftHour === 0 || (draftHour > 12) ? INNER_R : OUTER_R).y}
                    className="stroke-accent"
                    strokeWidth={2}
                  />
                )}
                {Array.from({ length: 12 }, (_, i) => {
                  const angle = i * 30;
                  const outerLabel = i === 0 ? 12 : i;
                  const innerLabel = i === 0 ? "00" : i + 12;
                  const outerPos = pointFor(angle, OUTER_R);
                  const innerPos = pointFor(angle, INNER_R);
                  const isOuterSelected = draftHour === outerLabel && draftHour <= 12 && draftHour !== 0;
                  const isInnerSelected = draftHour === (i === 0 ? 0 : i + 12) && (draftHour === 0 || draftHour > 12);
                  return (
                    <g key={i}>
                      <circle
                        cx={outerPos.x}
                        cy={outerPos.y}
                        r={13}
                        className={isOuterSelected ? "fill-accent" : "fill-transparent"}
                      />
                      <text
                        x={outerPos.x}
                        y={outerPos.y}
                        textAnchor="middle"
                        dominantBaseline="central"
                        className={`text-[13px] font-medium ${isOuterSelected ? "fill-accent-foreground" : "fill-foreground"}`}
                      >
                        {outerLabel}
                      </text>
                      <circle
                        cx={innerPos.x}
                        cy={innerPos.y}
                        r={11}
                        className={isInnerSelected ? "fill-accent" : "fill-transparent"}
                      />
                      <text
                        x={innerPos.x}
                        y={innerPos.y}
                        textAnchor="middle"
                        dominantBaseline="central"
                        className={`text-[10px] ${isInnerSelected ? "fill-accent-foreground" : "fill-muted"}`}
                      >
                        {innerLabel}
                      </text>
                    </g>
                  );
                })}
              </>
            ) : (
              <>
                <line
                  x1={CENTER}
                  y1={CENTER}
                  x2={pointFor(draftMinute * 6, OUTER_R).x}
                  y2={pointFor(draftMinute * 6, OUTER_R).y}
                  className="stroke-accent"
                  strokeWidth={2}
                />
                {Array.from({ length: 12 }, (_, i) => {
                  const angle = i * 30;
                  const minuteValue = i * 5;
                  const pos = pointFor(angle, OUTER_R);
                  const isSelected = draftMinute === minuteValue;
                  return (
                    <g key={i}>
                      <circle cx={pos.x} cy={pos.y} r={13} className={isSelected ? "fill-accent" : "fill-transparent"} />
                      <text
                        x={pos.x}
                        y={pos.y}
                        textAnchor="middle"
                        dominantBaseline="central"
                        className={`text-[13px] font-medium ${isSelected ? "fill-accent-foreground" : "fill-foreground"}`}
                      >
                        {pad(minuteValue)}
                      </text>
                    </g>
                  );
                })}
              </>
            )}
          </svg>

          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[11px] text-faint">O escribe la hora:</span>
            <input
              type="time"
              value={`${pad(draftHour)}:${pad(draftMinute)}`}
              onChange={(e) => {
                const { hour, minute } = parseValue(e.target.value);
                setDraftHour(hour);
                setDraftMinute(minute);
                commit(e.target.value);
              }}
              className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
            />
          </div>
        </div>
      )}
    </div>
  );
}
