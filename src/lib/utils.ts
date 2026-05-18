import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function stripQueryAndHash(value: string): string {
  return value.replace(/[?#].*$/, "");
}

const DISPLAYABLE_IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "avif",
  "svg",
]);

const DISPLAYABLE_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/svg+xml",
]);

function getPathExtension(value: string): string | null {
  const cleaned = stripQueryAndHash(value.trim());
  const fileName = cleaned.split("/").pop() ?? "";
  const extension = fileName.split(".").pop()?.toLowerCase();
  return extension && extension !== fileName.toLowerCase() ? extension : null;
}

const renderableImageUrlCache = new Map<string, Promise<string | null>>();

function extractEmbeddedJpegs(buffer: ArrayBuffer): Blob[] {
  const bytes = new Uint8Array(buffer);
  const segments: Array<{ start: number; end: number }> = [];

  for (let start = 0; start < bytes.length - 1; start += 1) {
    if (bytes[start] !== 0xff || bytes[start + 1] !== 0xd8) continue;

    for (let end = start + 2; end < bytes.length - 1; end += 1) {
      if (bytes[end] === 0xff && bytes[end + 1] === 0xd9) {
        segments.push({ start, end: end + 2 });
        start = end;
        break;
      }
    }
  }

  return segments
    .sort((a, b) => b.end - b.start - (a.end - a.start))
    .map((segment) => new Blob([bytes.slice(segment.start, segment.end)], { type: "image/jpeg" }));
}

type ParsedJpeg = {
  precision: number | null;
  width: number | null;
  height: number | null;
  components: number | null;
};

function canDecodeImage(url: string): Promise<boolean> {
  if (typeof Image === "undefined") return Promise.resolve(false);

  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.src = url;
  });
}

function parseJpegMetadata(bytes: Uint8Array): ParsedJpeg | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  let offset = 2;
  while (offset < bytes.length - 1) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    while (offset < bytes.length && bytes[offset] === 0xff) {
      offset += 1;
    }
    if (offset >= bytes.length) break;

    const marker = bytes[offset];
    offset += 1;

    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 1 >= bytes.length) return null;

    const segmentLength = (bytes[offset] << 8) | bytes[offset + 1];
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return null;

    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);

    if (isStartOfFrame && segmentLength >= 7) {
      return {
        precision: bytes[offset + 2],
        height: (bytes[offset + 3] << 8) | bytes[offset + 4],
        width: (bytes[offset + 5] << 8) | bytes[offset + 6],
        components: bytes[offset + 7],
      };
    }

    offset += segmentLength;
  }

  return null;
}

export function isDisplayableImagePath(path: string | null | undefined): boolean {
  const trimmed = path?.trim();
  if (!trimmed) return false;
  const normalizedPath = normalizeImagePath(trimmed);
  const candidate = normalizedPath ?? trimmed;
  const extension = getPathExtension(candidate);
  return extension ? DISPLAYABLE_IMAGE_EXTENSIONS.has(extension) : false;
}

export function validateDisplayImageFile(file: File): string | null {
  const extension = getPathExtension(file.name);
  const mimeType = file.type.trim().toLowerCase();

  if (extension && DISPLAYABLE_IMAGE_EXTENSIONS.has(extension)) return null;
  if (mimeType && DISPLAYABLE_IMAGE_MIME_TYPES.has(mimeType)) return null;

  return "Use JPG, PNG, WEBP, GIF, AVIF, or SVG images. RAW formats like DNG are not supported.";
}

export async function resolveRenderableImageUrl(
  path: string | null | undefined,
): Promise<string | null> {
  const trimmed = path?.trim();
  if (!trimmed) return null;

  const directUrl = getImageUrl(trimmed);
  if (!directUrl) return null;
  if (isDisplayableImagePath(trimmed)) return directUrl;

  const normalizedPath = normalizeImagePath(trimmed) ?? trimmed;
  if (getPathExtension(normalizedPath) !== "dng") return null;

  const weservSource = encodeURIComponent(directUrl);
  return `https://images.weserv.nl/?url=${weservSource}&output=jpg&fit=contain&w=1400&h=1400`;
}

/**
 * Build public image URL from storage path.
 * Accepts both relative paths (store-id/cover.ext) and full URLs.
 */
export function getImageUrl(path: string | null | undefined): string | null {
  const trimmed = path?.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  const normalizedPath = normalizeImagePath(trimmed);
  if (!normalizedPath) return null;

  const baseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  return baseUrl ? `${baseUrl}/storage/v1/object/public/store-images/${normalizedPath}` : null;
}

/**
 * Normalize image path: extract relative path from full URLs or return as-is.
 * Strips Supabase project ID from old stored URLs.
 */
export function normalizeImagePath(path: string | null | undefined): string | null {
  const trimmed = path?.trim();
  if (!trimmed) return null;

  const withoutQuery = stripQueryAndHash(trimmed);
  const publicMarker = "/storage/v1/object/public/store-images/";
  const publicIndex = withoutQuery.indexOf(publicMarker);
  if (publicIndex >= 0) {
    const extracted = withoutQuery.slice(publicIndex + publicMarker.length);
    return extracted || null;
  }

  if (/^https?:\/\//i.test(withoutQuery)) return null;

  return withoutQuery
    .replace(/^\/+/, "")
    .replace(/^storage\/v1\/object\/public\/store-images\//i, "")
    .replace(/^store-images\//i, "") || null;

  // Fallback for unrecognized URLs
}

export function normalizeWebsiteUrl(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function normalizeSocialPath(value: string, domainPattern: RegExp) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const withoutProtocol = trimmed.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  const normalizedSource = domainPattern.test(withoutProtocol)
    ? withoutProtocol.replace(domainPattern, "")
    : trimmed;
  const handle = normalizedSource.replace(/^@/, "").split(/[/?#]/)[0].trim();

  return handle || null;
}

export function normalizeInstagramHandle(value: string | null | undefined): string | null {
  return value ? normalizeSocialPath(value, /^instagram\.com\//i) : null;
}

export function normalizeTikTokHandle(value: string | null | undefined): string | null {
  const handle = value ? normalizeSocialPath(value, /^tiktok\.com\//i) : null;
  return handle?.replace(/^@/, "") ?? null;
}

export function buildInstagramUrl(handle: string | null | undefined): string | null {
  const normalized = normalizeInstagramHandle(handle);
  return normalized ? `https://www.instagram.com/${normalized}` : null;
}

export function buildTikTokUrl(handle: string | null | undefined): string | null {
  const normalized = normalizeTikTokHandle(handle);
  return normalized ? `https://www.tiktok.com/@${normalized}` : null;
}

/**
 * Check if a category/subcategory combination requires body-contact verification
 * (portfolio, license, age verification).
 */
export function isBodyContactService(
  category?: string | null,
  subcategory?: string | null,
): boolean {
  if (category === "Body Arts & Crafts") {
    return ["Tattooing", "Piercing", "Henna", "Body Painting"].includes(subcategory ?? "");
  }
  return false;
}
export function formatCurrency(amount: number, currency: string = "USD"): string {
  const currencyMap: Record<string, { symbol: string; locale: string }> = {
    USD: { symbol: "$", locale: "en-US" },
    EUR: { symbol: "€", locale: "en-DE" },
    GBP: { symbol: "£", locale: "en-GB" },
    INR: { symbol: "₹", locale: "en-IN" },
    JPY: { symbol: "¥", locale: "ja-JP" },
    CNY: { symbol: "¥", locale: "zh-CN" },
    KRW: { symbol: "₩", locale: "ko-KR" },
  };

  const config = currencyMap[currency] || { symbol: currency, locale: "en-US" };

  try {
    return new Intl.NumberFormat(config.locale, {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Fallback if currency is not recognized by Intl
    return `${config.symbol}${amount.toLocaleString()}`;
  }
}
