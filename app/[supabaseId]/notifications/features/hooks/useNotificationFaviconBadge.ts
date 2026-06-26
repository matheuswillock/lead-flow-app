"use client";

import { useEffect, useRef } from "react";

const DEFAULT_FAVICON = "/corretor-studio-icon.svg";
const CANVAS_SIZE = 32;

function drawBadgedFavicon(ctx: CanvasRenderingContext2D, image: HTMLImageElement) {
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  ctx.drawImage(image, 0, 0, CANVAS_SIZE, CANVAS_SIZE);

  ctx.beginPath();
  ctx.fillStyle = "#ef4444";
  ctx.arc(CANVAS_SIZE - 6, 6, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

export function useNotificationFaviconBadge(unreadCount: number) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const originalHrefRef = useRef<string>(DEFAULT_FAVICON);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const iconLinks = Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="shortcut icon"]'),
    );

    if (iconLinks.length > 0) {
      originalHrefRef.current = iconLinks[0].href || DEFAULT_FAVICON;
    }

    const image = new Image();
    image.src = DEFAULT_FAVICON;
    imageRef.current = image;

    return () => {
      for (const link of iconLinks) {
        link.href = DEFAULT_FAVICON;
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const iconLinks = Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="shortcut icon"]'),
    );

    if (unreadCount <= 0) {
      for (const link of iconLinks) {
        link.href = DEFAULT_FAVICON;
      }
      return;
    }

    const applyBadge = () => {
      const image = imageRef.current;
      if (!image) return;

      const canvas = document.createElement("canvas");
      canvas.width = CANVAS_SIZE;
      canvas.height = CANVAS_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      drawBadgedFavicon(ctx, image);
      const dataUrl = canvas.toDataURL("image/png");
      for (const link of iconLinks) {
        link.href = dataUrl;
      }
    };

    const image = imageRef.current;
    if (!image) return;

    if (image.complete) {
      applyBadge();
      return;
    }

    image.addEventListener("load", applyBadge);
    return () => {
      image.removeEventListener("load", applyBadge);
    };
  }, [unreadCount]);
}
