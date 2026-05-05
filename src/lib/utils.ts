import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Build public image URL from storage path.
 * Accepts both relative paths (store-id/cover.ext) and full URLs.
 */
export function getImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path; // Already a full URL
  // Relative path: construct from Supabase storage
  const baseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  return baseUrl ? `${baseUrl}/storage/v1/object/public/store-images/${path}` : null;
}

/**
 * Normalize image path: extract relative path from full URLs or return as-is.
 * Strips Supabase project ID from old stored URLs.
 */
export function normalizeImagePath(path: string | null | undefined): string | null {
  if (!path) return null;
  // If it's a full Supabase URL, extract just the relative path
  if (path.includes("/storage/v1/object/public/store-images/")) {
    const match = path.match(/\/store-images\/(.*?)$/);
    return match?.[1] ?? null;
  }
  // If it's a relative path, return as-is
  if (!path.startsWith("http")) return path;
  // Fallback for unrecognized URLs
  return null;
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
  const normalizedSource = domainPattern.test(withoutProtocol) ? withoutProtocol.replace(domainPattern, "") : trimmed;
  const handle = normalizedSource
    .replace(/^@/, "")
    .split(/[/?#]/)[0]
    .trim();

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

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  const currencyMap: Record<string, { symbol: string; locale: string }> = {
    'USD': { symbol: '$', locale: 'en-US' },
    'EUR': { symbol: '€', locale: 'en-DE' },
    'GBP': { symbol: '£', locale: 'en-GB' },
    'INR': { symbol: '₹', locale: 'en-IN' },
    'JPY': { symbol: '¥', locale: 'ja-JP' },
    'CNY': { symbol: '¥', locale: 'zh-CN' },
    'KRW': { symbol: '₩', locale: 'ko-KR' },
  };

  const config = currencyMap[currency] || { symbol: currency, locale: 'en-US' };
  
  try {
    return new Intl.NumberFormat(config.locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Fallback if currency is not recognized by Intl
    return `${config.symbol}${amount.toLocaleString()}`;
  }
}
