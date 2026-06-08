"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/** Apple iPhone 15 Pro chassis (mm) — width × height */
const IPHONE_15_PRO_W = 70.6;
const IPHONE_15_PRO_H = 146.6;

/** Preview width in px; height follows real proportions */
const DEVICE_W = 300;
const DEVICE_H = Math.round(DEVICE_W * (IPHONE_15_PRO_H / IPHONE_15_PRO_W));

function FrameButton({
  side,
  top,
  height,
}: {
  side: "left" | "right";
  top: string;
  height: string;
}) {
  const isLeft = side === "left";
  return (
    <span
      className={cn(
        "absolute z-50 w-[4px]",
        isLeft ? "-left-[4px] rounded-l-[2px]" : "-right-[4px] rounded-r-[2px]"
      )}
      style={{
        top,
        height,
        background: "linear-gradient(180deg, #a1a1a6 0%, #636366 50%, #2c2c2e 100%)",
        boxShadow: isLeft
          ? "inset 1px 0 0 rgba(255,255,255,0.45), 2px 0 5px rgba(0,0,0,0.3)"
          : "inset -1px 0 0 rgba(255,255,255,0.45), -2px 0 5px rgba(0,0,0,0.3)",
      }}
      aria-hidden
    />
  );
}

function SideRims() {
  return (
    <>
      <div
        className="pointer-events-none absolute bottom-[5%] left-0 top-[5%] z-20 w-[5px] rounded-l-[2.5rem]"
        style={{
          background:
            "linear-gradient(90deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.12) 35%, transparent 100%)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-[5%] right-0 top-[5%] z-20 w-[6px] rounded-r-[2.5rem]"
        style={{
          background:
            "linear-gradient(270deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.18) 40%, transparent 100%)",
        }}
        aria-hidden
      />
    </>
  );
}

/**
 * iPhone 15 Pro proportions (70.6 × 146.6 mm) — not tall 19.5:9 slab.
 */
export function DeviceMockup({
  children,
  className,
  alive = false,
}: {
  children?: React.ReactNode;
  className?: string;
  alive?: boolean;
}) {
  return (
    <div
      className={cn("relative mx-auto shrink-0 overflow-visible px-1.5", className)}
      style={{ width: DEVICE_W, maxWidth: "min(300px, 78vw)" }}
    >
      <div
        className="pointer-events-none absolute left-1/2 top-[46%] -z-10 h-[62%] w-[82%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-coral/8 blur-2xl"
        aria-hidden
      />

      <motion.div
        animate={
          alive
            ? {
                boxShadow: [
                  "0 28px 56px -16px rgba(0,0,0,0.42), 0 12px 24px -8px rgba(0,0,0,0.2)",
                  "0 32px 64px -14px rgba(0,0,0,0.48), 0 14px 28px -6px rgba(0,0,0,0.24)",
                  "0 28px 56px -16px rgba(0,0,0,0.42), 0 12px 24px -8px rgba(0,0,0,0.2)",
                ],
              }
            : undefined
        }
        transition={alive ? { duration: 3.5, repeat: Infinity, ease: "easeInOut" } : undefined}
        className="relative overflow-visible rounded-[2.5rem]"
        style={{
          width: DEVICE_W,
          height: DEVICE_H,
          background: "linear-gradient(180deg, #2c2c2e 0%, #1c1c1e 100%)",
          boxShadow: "0 24px 48px -16px rgba(0,0,0,0.4), 0 8px 20px -8px rgba(0,0,0,0.22)",
        }}
      >
        {/* Titanium band — inset so full outer box = 15 Pro ratio */}
        <div
          className="absolute inset-[2px] overflow-visible rounded-[2.35rem]"
          style={{
            background:
              "linear-gradient(165deg, #d1d1d6 0%, #aeaeb2 6%, #8e8e93 14%, #636366 32%, #48484a 48%, #3a3a3c 62%, #525254 78%, #98989d 92%, #c7c7cc 100%)",
            boxShadow:
              "inset 2px 0 5px rgba(255,255,255,0.35), inset -4px 0 8px rgba(0,0,0,0.45), inset 0 2px 4px rgba(255,255,255,0.2), inset 0 -3px 8px rgba(0,0,0,0.35)",
          }}
        >
          <FrameButton side="left" top="23%" height="14px" />
          <FrameButton side="left" top="29%" height="26px" />
          <FrameButton side="left" top="38%" height="26px" />
          <FrameButton side="right" top="31%" height="44px" />

          <SideRims />

          <div
            className="pointer-events-none absolute inset-0 rounded-[2.35rem]"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.08) 22%, transparent 45%, transparent 60%, rgba(0,0,0,0.15) 100%)",
            }}
            aria-hidden
          />

          {/* Black bezel + screen — thin like 15 Pro */}
          <div
            className="absolute inset-[4px] rounded-[2.05rem]"
            style={{
              background: "linear-gradient(180deg, #1a1a1c 0%, #000 100%)",
              boxShadow:
                "inset 0 0 0 1px rgba(255,255,255,0.08), inset 0 3px 10px rgba(0,0,0,0.65)",
            }}
          >
            <div
              className="absolute inset-[2px] flex flex-col overflow-hidden rounded-[1.85rem] bg-black"
              style={{ boxShadow: "inset 0 0 12px rgba(0,0,0,0.5)" }}
            >
              <div
                className="pointer-events-none absolute left-1/2 top-[7px] z-40 h-[21px] w-[68px] -translate-x-1/2 rounded-[13px] bg-black shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.1),0_1px_4px_rgba(0,0,0,0.6)]"
                aria-hidden
              >
                <span className="absolute right-[8px] top-1/2 h-[5px] w-[5px] -translate-y-1/2 rounded-full bg-[#141820] ring-[0.5px] ring-[#2c3344]" />
              </div>

              <div
                className="pointer-events-none absolute inset-0 z-20 rounded-[1.85rem] bg-gradient-to-br from-white/[0.08] via-transparent to-black/[0.06]"
                aria-hidden
              />

              <div className="relative z-10 flex min-h-0 flex-1 flex-col">{children}</div>
            </div>
          </div>
        </div>
      </motion.div>

      <div
        className="pointer-events-none mx-auto mt-3 h-[8px] w-[54%] rounded-[100%] bg-gradient-to-b from-black/22 via-black/8 to-transparent blur-[3px]"
        aria-hidden
      />
    </div>
  );
}
