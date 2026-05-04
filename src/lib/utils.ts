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
