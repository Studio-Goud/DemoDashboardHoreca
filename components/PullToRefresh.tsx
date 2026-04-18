"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useCallback } from "react";

const THRESHOLD = 80;

export default function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);

  const doRefresh = useCallback(async () => {
    setRefreshing(true);
    window.dispatchEvent(new CustomEvent("dashboard:refresh"));
    router.refresh();
    await new Promise((r) => setTimeout(r, 1000));
    setRefreshing(false);
    setPullY(0);
  }, [router]);

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) {
        startY.current = e.touches[0].clientY;
        pulling.current = true;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!pulling.current || refreshing) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta > 0) {
        e.preventDefault();
        setPullY(Math.min(delta * 0.5, THRESHOLD + 20));
      }
    };

    const onTouchEnd = () => {
      if (!pulling.current) return;
      pulling.current = false;
      if (pullY >= THRESHOLD) {
        doRefresh();
      } else {
        setPullY(0);
      }
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd);

    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [pullY, refreshing, doRefresh]);

  const progress = Math.min(pullY / THRESHOLD, 1);
  const visible = pullY > 5 || refreshing;

  return (
    <div className="relative">
      {/* Pull indicator */}
      <div
        className="flex items-center justify-center overflow-hidden transition-all duration-200"
        style={{ height: refreshing ? 48 : pullY > 0 ? pullY : 0 }}
      >
        {visible && (
          <div className="flex flex-col items-center gap-1">
            <svg
              className={`w-6 h-6 text-slate-500 transition-transform duration-200 ${
                refreshing ? "animate-spin" : ""
              }`}
              style={{
                transform: refreshing ? undefined : `rotate(${progress * 180}deg)`,
              }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              {refreshing ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 9l-7 7-7-7"
                />
              )}
            </svg>
            <span className="text-slate-400 text-xs">
              {refreshing
                ? "Verversen..."
                : progress >= 1
                ? "Loslaten om te verversen"
                : "Trek omlaag om te verversen"}
            </span>
          </div>
        )}
      </div>

      {children}
    </div>
  );
}
