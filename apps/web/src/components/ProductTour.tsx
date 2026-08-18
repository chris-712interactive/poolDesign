"use client";

import { useEffect, useState, type CSSProperties } from "react";

type Rect = { top: number; left: number; width: number; height: number };

type Props = {
  title: string;
  body: string;
  stepIndex: number;
  stepCount: number;
  target: string;
  reveal?: string;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
};

const PAD = 8;

function measure(selector: string): Rect | null {
  const el = document.querySelector(selector);
  if (!(el instanceof HTMLElement)) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 2 && r.height < 2) return null;
  return {
    top: r.top - PAD,
    left: r.left - PAD,
    width: r.width + PAD * 2,
    height: r.height + PAD * 2,
  };
}

export function ProductTour({
  title,
  body,
  stepIndex,
  stepCount,
  target,
  reveal,
  onNext,
  onBack,
  onSkip,
}: Props) {
  const [spot, setSpot] = useState<Rect | null>(null);
  const last = stepIndex >= stepCount - 1;

  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    let revealed = false;

    function clickReveal() {
      if (!reveal || revealed) return;
      const btn = document.querySelector(reveal);
      if (btn instanceof HTMLElement) {
        btn.click();
        revealed = true;
      }
    }

    function update() {
      clickReveal();
      const next = measure(target);
      if (next) {
        document.querySelector(target)?.scrollIntoView({
          block: "nearest",
          inline: "nearest",
        });
        if (!cancelled) setSpot(measure(target) ?? next);
        return true;
      }
      return false;
    }

    const timer = window.setInterval(() => {
      tries += 1;
      if (update() || tries > 24) window.clearInterval(timer);
    }, 50);
    update();

    function onWin() {
      setSpot(measure(target));
    }
    window.addEventListener("resize", onWin);
    window.addEventListener("scroll", onWin, true);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("resize", onWin);
      window.removeEventListener("scroll", onWin, true);
    };
  }, [reveal, target, stepIndex]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onSkip();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSkip]);

  const cardStyle = cardPosition(spot);

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <div className="tour-scrim" />
      {spot ? (
        <div
          className="tour-spot"
          style={{
            top: spot.top,
            left: spot.left,
            width: spot.width,
            height: spot.height,
          }}
        />
      ) : null}
      <div className="tour-card" style={cardStyle}>
        <p className="muted tour-progress">
          {stepIndex + 1} of {stepCount}
        </p>
        <h2 id="tour-title">{title}</h2>
        <p>{body}</p>
        <div className="tour-actions">
          <button type="button" className="btn ghost" onClick={onSkip}>
            Skip
          </button>
          <div className="row" style={{ gap: "0.5rem" }}>
            {stepIndex > 0 ? (
              <button type="button" className="btn secondary" onClick={onBack}>
                Back
              </button>
            ) : null}
            <button type="button" className="btn" onClick={onNext}>
              {last ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function cardPosition(spot: Rect | null): CSSProperties {
  const width = 320;
  const gap = 12;
  if (!spot) {
    return { top: "20vh", left: "50%", transform: "translateX(-50%)", width };
  }
  const below = spot.top + spot.height + gap;
  const flip = below + 220 > window.innerHeight && spot.top > 240;
  const top = flip ? Math.max(12, spot.top - gap) : below;
  let left = Math.min(
    Math.max(12, spot.left),
    window.innerWidth - width - 12,
  );
  const style: CSSProperties = { top, left, width };
  if (flip) {
    style.transform = "translateY(-100%)";
  }
  return style;
}
