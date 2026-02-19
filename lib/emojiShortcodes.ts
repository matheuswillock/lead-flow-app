import { fetchShortcodes, fromCodepointToUnicode } from "emojibase";
import type { ShortcodesDataset } from "emojibase";

let cachedShortcodeMap: Map<string, string> | null = null;
let loadingPromise: Promise<Map<string, string>> | null = null;

const normalizeShortcode = (value: string) => value.trim().toLowerCase();

export async function loadSlackShortcodes(): Promise<Map<string, string>> {
  if (cachedShortcodeMap) {
    return cachedShortcodeMap;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    let dataset: ShortcodesDataset;
    try {
      dataset = (await fetchShortcodes("en", { preset: "slack" } as any)) as ShortcodesDataset;
    } catch {
      dataset = (await fetchShortcodes("en", "slack" as any)) as ShortcodesDataset;
    }
    const map = new Map<string, string>();

    Object.entries(dataset).forEach(([hexcode, shortcodes]) => {
      const emoji = fromCodepointToUnicode(hexcode.split("-").map((h) => parseInt(h, 16)));
      if (!emoji) return;

      const list = Array.isArray(shortcodes) ? shortcodes : [shortcodes];
      list.forEach((shortcode) => {
        if (!shortcode) return;
        map.set(normalizeShortcode(shortcode), emoji);
      });
    });

    cachedShortcodeMap = map;
    return map;
  })();

  return loadingPromise;
}

export async function replaceShortcodes(value: string): Promise<string> {
  if (!value.includes(":")) {
    return value;
  }

  const shortcodeMap = await loadSlackShortcodes();
  return value.replace(/:([a-z0-9_+\-]+):/gi, (match, shortcode) => {
    const emoji = shortcodeMap.get(normalizeShortcode(shortcode));
    return emoji || match;
  });
}
