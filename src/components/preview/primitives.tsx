"use client";

import { useState, type ReactNode } from "react";
import { ChevronRight, X } from "lucide-react";
import type { PreviewTokens } from "@/lib/expoApp/preview/tokens";
import { cn } from "@/lib/utils";
import { PreviewCoverImage } from "./PreviewCoverImage";

export function ScreenHeader({
  tokens,
  title,
  subtitle,
  trailing,
}: {
  tokens: PreviewTokens;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="mb-2 flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p
          className="text-[12px] font-extrabold leading-tight"
          style={{ color: tokens.charcoal, fontFamily: `var(--font-display), Georgia, serif` }}
        >
          {title}
        </p>
        {subtitle && (
          <p className="mt-0.5 text-[10px] leading-snug" style={{ color: tokens.muted }}>
            {subtitle}
          </p>
        )}
      </div>
      {trailing}
    </div>
  );
}

export function PrimaryButton({
  tokens,
  children,
  onClick,
  disabled,
  className,
}: {
  tokens: PreviewTokens;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "w-full rounded-xl py-2.5 text-[10px] font-bold text-white transition-opacity disabled:opacity-45",
        className
      )}
      style={{
        background: tokens.accent,
        borderRadius: tokens.radiusMd,
        boxShadow: `0 6px 16px ${tokens.accentMuted}`,
      }}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  tokens,
  children,
  onClick,
}: {
  tokens: PreviewTokens;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl border py-2 text-[10px] font-bold"
      style={{
        borderColor: tokens.line,
        background: tokens.cream,
        color: tokens.charcoal,
        borderRadius: tokens.radiusMd,
      }}
    >
      {children}
    </button>
  );
}

export function EmptyState({
  tokens,
  title,
  body,
  actionLabel,
  onAction,
}: {
  tokens: PreviewTokens;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div
      className="rounded-xl border px-3 py-6 text-center"
      style={{ borderColor: tokens.line, background: tokens.card }}
    >
      <p className="text-[11px] font-bold" style={{ color: tokens.charcoal }}>
        {title}
      </p>
      <p className="mt-1 text-[10px] leading-relaxed" style={{ color: tokens.muted }}>
        {body}
      </p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-3 text-[10px] font-bold"
          style={{ color: tokens.accent }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function StatusChip({
  tokens,
  label,
}: {
  tokens: PreviewTokens;
  label: string;
}) {
  return (
    <span
      className="rounded-md px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide"
      style={{ background: tokens.accentSoft, color: tokens.accent }}
    >
      {label}
    </span>
  );
}

export function ThreadRow({
  tokens,
  participant,
  preview,
  time,
  unread,
  avatarUrl,
  category,
  index,
  onPress,
}: {
  tokens: PreviewTokens;
  participant: string;
  preview: string;
  time: string;
  unread?: boolean;
  avatarUrl?: string;
  category: string;
  index: number;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      className="flex w-full items-center gap-2.5 rounded-xl border p-2.5 text-left transition-transform active:scale-[0.99]"
      style={{
        borderColor: tokens.line,
        background: tokens.card,
        boxShadow: tokens.shadowCard,
        borderRadius: tokens.radiusLg,
        minHeight: 44,
      }}
    >
      <PreviewCoverImage
        src={avatarUrl ?? ""}
        category={category}
        fallbackIndex={index}
        className="h-10 w-10 shrink-0 rounded-full object-cover"
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-[10px] font-bold" style={{ color: tokens.charcoal }}>
            {participant}
          </span>
          <span className="shrink-0 text-[8px] font-medium" style={{ color: tokens.muted }}>
            {time}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-[9px]" style={{ color: tokens.muted }}>
          {preview}
        </span>
      </span>
      {unread && (
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: tokens.accent }}
          aria-label="Unread"
        />
      )}
      <ChevronRight className="h-3.5 w-3.5 shrink-0" style={{ color: tokens.muted }} />
    </button>
  );
}

export function MessageBubble({
  tokens,
  text,
  sent,
  senderLabel,
  at,
}: {
  tokens: PreviewTokens;
  text: string;
  sent: boolean;
  senderLabel: string;
  at: string;
}) {
  return (
    <div className={cn("flex flex-col", sent ? "items-end" : "items-start")}>
      {!sent && (
        <span className="mb-0.5 px-1 text-[8px] font-semibold" style={{ color: tokens.muted }}>
          {senderLabel}
        </span>
      )}
      <div
        className="max-w-[85%] px-2.5 py-2 text-[10px] leading-relaxed"
        style={{
          background: sent ? tokens.accentSoft : tokens.card,
          color: tokens.charcoal,
          borderRadius: sent
            ? `${tokens.radiusMd}px ${tokens.radiusMd}px 4px ${tokens.radiusMd}px`
            : `${tokens.radiusMd}px ${tokens.radiusMd}px ${tokens.radiusMd}px 4px`,
          border: sent ? "none" : `1px solid ${tokens.line}`,
        }}
      >
        {text}
      </div>
      <span className="mt-0.5 px-1 text-[7px]" style={{ color: tokens.muted }}>
        {at}
      </span>
    </div>
  );
}

export function PreviewComposeSheet({
  tokens,
  title,
  placeholder,
  onClose,
  onSend,
}: {
  tokens: PreviewTokens;
  title: string;
  placeholder: string;
  onClose: () => void;
  onSend: (text: string) => void;
}) {
  const [draft, setDraft] = useState("");
  return (
    <div
      className="absolute inset-0 z-40 flex flex-col justify-end bg-charcoal/40"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="rounded-t-2xl p-3"
        style={{ background: tokens.card }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] font-bold" style={{ color: tokens.charcoal }}>
            {title}
          </p>
          <button type="button" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" style={{ color: tokens.muted }} />
          </button>
        </div>
        <textarea
          autoFocus
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          className="w-full resize-none rounded-xl border px-2.5 py-2 text-[10px] outline-none focus:ring-2 focus:ring-coral/25"
          style={{
            borderColor: tokens.line,
            background: tokens.cream,
            color: tokens.charcoal,
            borderRadius: tokens.radiusMd,
          }}
        />
        <PrimaryButton
          tokens={tokens}
          disabled={!draft.trim()}
          onClick={() => onSend(draft)}
          className="mt-2"
        >
          Send
        </PrimaryButton>
      </div>
    </div>
  );
}
