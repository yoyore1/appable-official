"use client";

import { useEffect, useState } from "react";
import { imageForCategory } from "@/lib/expoApp/images";
import { cn } from "@/lib/utils";

export function PreviewCoverImage({
  src,
  className,
  category = "general",
  fallbackIndex = 0,
}: {
  src: string;
  className?: string;
  category?: string;
  fallbackIndex?: number;
}) {
  const [url, setUrl] = useState(src);
  const [ready, setReady] = useState(false);
  const fallback = imageForCategory(category, fallbackIndex);

  useEffect(() => {
    setUrl(src);
    setReady(false);
  }, [src]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className={cn(className, "transition-opacity duration-300", ready ? "opacity-100" : "opacity-0")}
      onLoad={() => setReady(true)}
      onError={() => {
        if (url !== fallback) {
          setReady(false);
          setUrl(fallback);
        }
      }}
    />
  );
}
