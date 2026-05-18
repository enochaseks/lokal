import QRCode from "qrcode";
import lokalLogoUrl from "../assets/logo.png";

type StoreShareCardFormat = "story" | "square";

type StoreShareCardInput = {
  storeName: string;
  description?: string | null;
  category?: string | null;
  origin?: string | null;
  imageUrl?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  shareUrl: string;
  verificationTier?: "verified" | "online_verified" | string | null;
  sellingMode?: "products" | "services" | string | null;
  highlights?: Array<{ name: string; price?: number | null; unit?: string | null }>;
  city?: string | null;
  websiteUrl?: string | null;
  instagramHandle?: string | null;
  phone?: string | null;
  campaignCode?: string | null;
  campaignSource?: string | null;
  campaignMedium?: string | null;
  campaignName?: string | null;
  lastUpdatedLabel?: string | null;
  formats?: StoreShareCardFormat[];
};

const CARD_DIMENSIONS: Record<StoreShareCardFormat, { width: number; height: number }> = {
  story: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
};

const DEFAULT_FORMATS: StoreShareCardFormat[] = ["story", "square"];

const CATEGORY_STYLES: Record<string, { bgA: string; bgB: string; bgC: string }> = {
  Groceries: { bgA: "#ebfff4", bgB: "#d9ffe8", bgC: "#ffffff" },
  Barbers: { bgA: "#eef7ff", bgB: "#dcecff", bgC: "#ffffff" },
  "Hair & Beauty": { bgA: "#fff2f5", bgB: "#ffe1ea", bgC: "#ffffff" },
  "Beauty Store": { bgA: "#fff6ed", bgB: "#ffe9d8", bgC: "#ffffff" },
  "Clothes & Fashion": { bgA: "#f7f3ff", bgB: "#ebe3ff", bgC: "#ffffff" },
  "Body Arts & Crafts": { bgA: "#fff4f2", bgB: "#ffe2de", bgC: "#ffffff" },
};

function sanitizeFilename(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function withOpacity(color: string, opacityHex: string) {
  const normalized = color.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(normalized)) return `${normalized}${opacityHex}`;
  return color;
}

function cleanHandle(value?: string | null) {
  if (!value) return null;
  return value.replace(/^@+/, "").trim() || null;
}

function formatPrice(value?: number | null, unit?: string | null) {
  if (value == null || Number.isNaN(value)) return null;
  const number = Number(value);
  const fixed = number % 1 === 0 ? number.toFixed(0) : number.toFixed(2);
  const suffix = unit?.trim() ? ` / ${unit.trim()}` : "";
  return `GBP ${fixed}${suffix}`;
}

function defaultUpdatedLabel() {
  try {
    return `Updated ${new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })}`;
  } catch {
    return "Updated recently";
  }
}

function buildCampaignUrl(input: StoreShareCardInput) {
  try {
    const url = new URL(input.shareUrl);
    if (input.campaignCode?.trim()) {
      url.searchParams.set("ref", input.campaignCode.trim());
    }
    const source = input.campaignSource?.trim() || "store_card";
    const medium = input.campaignMedium?.trim() || "social";
    const name = input.campaignName?.trim() || "merchant_share";
    url.searchParams.set("utm_source", source);
    url.searchParams.set("utm_medium", medium);
    url.searchParams.set("utm_campaign", name);
    return url.toString();
  } catch {
    return input.shareUrl;
  }
}

function getCategoryStyle(category?: string | null) {
  const key = (category || "").trim();
  return CATEGORY_STYLES[key] || { bgA: "#fff8f3", bgB: "#fff1e8", bgC: "#ffffff" };
}

function getCtaLabel(input: StoreShareCardInput) {
  const category = input.category || "";
  const mode = input.sellingMode || "";
  if (
    mode === "services" ||
    category === "Barbers" ||
    category === "Body Arts & Crafts" ||
    (category === "Hair & Beauty" && mode !== "products")
  ) {
    return "Book now";
  }
  return "Shop now";
}

function getDisplayUrl(value: string) {
  try {
    const parsed = new URL(value);
    const path = parsed.pathname.length > 24 ? `${parsed.pathname.slice(0, 24)}...` : parsed.pathname;
    return `${parsed.origin}${path}`;
  } catch {
    return value.length > 44 ? `${value.slice(0, 44)}...` : value;
  }
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const imageRatio = image.width / image.height;
  const targetRatio = width / height;
  let drawWidth = width;
  let drawHeight = height;
  let offsetX = x;
  let offsetY = y;

  if (imageRatio > targetRatio) {
    drawWidth = height * imageRatio;
    offsetX = x - (drawWidth - width) / 2;
  } else {
    drawHeight = width / imageRatio;
    offsetY = y - (drawHeight - height) / 2;
  }

  ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
}

async function createQrImage(shareUrl: string) {
  const dataUrl = await QRCode.toDataURL(shareUrl, {
    margin: 1,
    width: 320,
    color: {
      dark: "#111111",
      light: "#ffffffff",
    },
    errorCorrectionLevel: "M",
  });
  return await loadImage(dataUrl);
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
) {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    if (lines.length === maxLines - 1) break;
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    lines[lines.length - 1] = `${lines[lines.length - 1].replace(/[.,;:!?-]*$/, "")}...`;
  }

  return lines;
}

async function loadImage(url: string) {
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.referrerPolicy = "no-referrer";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    image.src = url;
  });
}

async function safeLoadImage(url: string | null | undefined) {
  if (!url) return null;
  try {
    return await loadImage(url);
  } catch {
    return null;
  }
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  category: string | null | undefined,
) {
  const style = getCategoryStyle(category);
  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, style.bgA);
  background.addColorStop(0.52, style.bgB);
  background.addColorStop(1, style.bgC);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
}

type RenderCardArgs = {
  input: StoreShareCardInput;
  format: StoreShareCardFormat;
  campaignUrl: string;
  heroImage: HTMLImageElement | null;
  logoImage: HTMLImageElement | null;
  qrImage: HTMLImageElement | null;
  lokalLogoImage: HTMLImageElement | null;
};

async function renderCardBlob({
  input,
  format,
  campaignUrl,
  heroImage,
  logoImage,
  qrImage,
  lokalLogoImage,
}: RenderCardArgs) {
  const { width, height } = CARD_DIMENSIONS[format];
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const primary = input.primaryColor || "#b42318";
  const accent = input.accentColor || "#f97316";
  const displayUrl = getDisplayUrl(campaignUrl);
  const ctaLabel = getCtaLabel(input);
  const isStory = format === "story";
  const isSquare = format === "square";
  const isLandscape = format === "landscape";

  drawBackground(ctx, width, height, input.category);

  const outerPad = format === "story" ? 44 : format === "square" ? 34 : 26;
  const cardX = outerPad;
  const cardY = outerPad;
  const cardW = width - outerPad * 2;
  const cardH = height - outerPad * 2;
  const headerH = format === "story" ? 96 : format === "square" ? 78 : 56;

  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, format === "landscape" ? 28 : 34);
  ctx.fillStyle = "rgba(255,255,255,0.98)";
  ctx.fill();
  ctx.lineWidth = format === "landscape" ? 2 : 3;
  ctx.strokeStyle = withOpacity(primary, "55");
  ctx.stroke();

  const headerX = cardX + 20;
  const headerY = cardY + 16;
  const logoBox = format === "landscape" ? 38 : 50;
  if (lokalLogoImage) {
    drawRoundedRect(ctx, headerX, headerY, logoBox, logoBox, 12);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.drawImage(lokalLogoImage, headerX + 5, headerY + 5, logoBox - 10, logoBox - 10);
  }

  ctx.fillStyle = "#111827";
  ctx.font = `700 ${format === "landscape" ? 24 : 32}px system-ui, sans-serif`;
  ctx.fillText("Lokal", headerX + logoBox + 12, headerY + (format === "landscape" ? 28 : 35));
  ctx.fillStyle = "#6b7280";
  ctx.font = `${format === "landscape" ? 12 : 15}px system-ui, sans-serif`;
  ctx.fillText("Share card", headerX + logoBox + 12, headerY + (format === "landscape" ? 44 : 54));

  const heroH = isStory ? 760 : isSquare ? 380 : 250;
  const heroX = cardX + 20;
  const heroY = cardY + 20 + headerH;
  const heroW = cardW - 40;

  drawRoundedRect(ctx, heroX, heroY, heroW, heroH, format === "landscape" ? 22 : 28);
  ctx.save();
  ctx.clip();

  if (heroImage) {
    drawImageCover(ctx, heroImage, heroX, heroY, heroW, heroH);
    const overlay = ctx.createLinearGradient(heroX, heroY, heroX, heroY + heroH);
    overlay.addColorStop(0, "rgba(0,0,0,0.08)");
    overlay.addColorStop(0.56, "rgba(0,0,0,0.22)");
    overlay.addColorStop(1, "rgba(0,0,0,0.6)");
    ctx.fillStyle = overlay;
    ctx.fillRect(heroX, heroY, heroW, heroH);
  } else {
    const fallback = ctx.createLinearGradient(heroX, heroY, heroX + heroW, heroY + heroH);
    fallback.addColorStop(0, primary);
    fallback.addColorStop(1, accent);
    ctx.fillStyle = fallback;
    ctx.fillRect(heroX, heroY, heroW, heroH);
  }
  ctx.restore();

  const bodyX = cardX + 50;
  const bodyW = cardW - 100;
  let cursorY = heroY + heroH + (isStory ? 42 : isSquare ? 26 : 18);

  if (logoImage) {
    const logoSize = format === "landscape" ? 72 : format === "square" ? 84 : 96;
    const logoX = bodyX;
    const logoY = heroY + heroH - Math.round(logoSize / 2);
    drawRoundedRect(ctx, logoX, logoY, logoSize, logoSize, 16);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.save();
    drawRoundedRect(ctx, logoX, logoY, logoSize, logoSize, 16);
    ctx.clip();
    const inset = 8;
    ctx.drawImage(logoImage, logoX + inset, logoY + inset, logoSize - inset * 2, logoSize - inset * 2);
    ctx.restore();
    cursorY += isStory ? 12 : 4;
  }

  const verificationLabel =
    input.verificationTier === "verified"
      ? "Verified store"
      : input.verificationTier === "online_verified"
        ? "Online verified"
        : "Listed on Lokal";
  const trustLabel =
    input.verificationTier && input.verificationTier !== "none"
      ? "Secure orders on Lokal"
      : "Buy safely with verified details";

  if (!isLandscape) {
    ctx.font = `${isSquare ? 18 : 20}px system-ui, sans-serif`;
    const trustX = logoImage ? bodyX + 110 : bodyX;
    drawRoundedRect(ctx, trustX, cursorY, isSquare ? 210 : 230, 34, 17);
    ctx.fillStyle = withOpacity(primary, "22");
    ctx.fill();
    ctx.fillStyle = primary;
    ctx.fillText(verificationLabel, trustX + 14, cursorY + 24);

    ctx.fillStyle = "#374151";
    ctx.font = `${isSquare ? 14 : 16}px system-ui, sans-serif`;
    ctx.fillText(trustLabel, trustX, cursorY + 52);

    cursorY += isStory ? 116 : 92;

    ctx.font = `600 ${isSquare ? 20 : 22}px system-ui, sans-serif`;
    const pills = [input.category, input.origin].filter(Boolean) as string[];
    let pillX = bodyX;
    for (const [index, pill] of pills.entries()) {
      const pillWidth = clamp(ctx.measureText(pill).width + 30, 90, 250);
      drawRoundedRect(ctx, pillX, cursorY, pillWidth, 38, 19);
      ctx.fillStyle = index === 0 ? `${primary}22` : `${accent}22`;
      ctx.fill();
      ctx.fillStyle = index === 0 ? primary : accent;
      ctx.fillText(pill, pillX + 14, cursorY + 26);
      pillX += pillWidth + 10;
      if (pillX > cardX + cardW - 160) break;
    }
    cursorY += isStory ? 82 : 70;
  } else {
    ctx.font = "600 16px system-ui, sans-serif";
    const pills = [input.category, input.origin].filter(Boolean) as string[];
    let pillX = heroX + 280;
    const pillY = heroY + heroH - 34;
    for (const [index, pill] of pills.entries()) {
      const pillWidth = clamp(ctx.measureText(pill).width + 24, 90, 210);
      drawRoundedRect(ctx, pillX, pillY, pillWidth, 30, 15);
      ctx.fillStyle = index === 0 ? `${primary}CC` : `${accent}CC`;
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.fillText(pill, pillX + 12, pillY + 21);
      pillX += pillWidth + 8;
    }
    cursorY = heroY + heroH + 76;
  }

  ctx.fillStyle = "#111111";
  if (isLandscape) {
    const titleBandY = heroY + heroH + 148;
    ctx.textAlign = "center";
    ctx.font = "700 34px system-ui, sans-serif";
    ctx.fillText(input.storeName, cardX + cardW / 2, titleBandY);
    ctx.textAlign = "left";
    cursorY = titleBandY + 42;
  } else {
    const titleBandWidth = isStory ? bodyW - 30 : bodyW - 90;
    const titleX = cardX + cardW / 2;
    const titleY = cursorY + (isStory ? 36 : 28);
    ctx.textAlign = "center";
    ctx.font = `700 ${isStory ? 52 : 38}px system-ui, sans-serif`;
    const titleLines = wrapText(ctx, input.storeName, titleBandWidth, 2);
    titleLines.forEach((line, index) => {
      const y = titleY + index * (isStory ? 56 : 44);
      ctx.fillText(line, titleX, y);
    });
    cursorY = titleY + titleLines.length * (isStory ? 56 : 44) + 18;
    ctx.textAlign = "left";
  }

  if (input.description?.trim() && !isLandscape) {
    ctx.fillStyle = "#57534e";
    ctx.font = `${isSquare ? 18 : 22}px system-ui, sans-serif`;
    const descriptionLines = wrapText(
      ctx,
      input.description,
      bodyW,
      isStory ? 2 : 1,
    );
    descriptionLines.forEach((line, index) => {
      const y = cursorY + index * (isStory ? 32 : 26);
      if (isStory) {
        ctx.fillText(line, bodyX, y);
      } else {
        ctx.textAlign = "center";
        ctx.fillText(line, cardX + cardW / 2, y);
        ctx.textAlign = "left";
      }
    });
    cursorY += descriptionLines.length * (isStory ? 34 : 26) + (isSquare ? 6 : 12);
  }

  const highlightCount = isStory ? 3 : isSquare ? 1 : 0;
  const highlights = (input.highlights ?? []).filter((item) => item?.name?.trim()).slice(0, highlightCount);
  if (highlights.length > 0) {
    ctx.font = `700 ${isSquare ? 20 : 24}px system-ui, sans-serif`;
    ctx.fillStyle = "#111827";
    const titleX = isStory ? bodyX : cardX + cardW / 2;
    if (isStory) {
      ctx.textAlign = "left";
      ctx.fillText("Top picks", titleX, cursorY + 24);
    } else {
      ctx.textAlign = "center";
      ctx.fillText("Top picks", titleX, cursorY + 24);
      ctx.textAlign = "left";
    }
    cursorY += 40;

    ctx.font = `${isSquare ? 17 : 19}px system-ui, sans-serif`;
    highlights.forEach((item, index) => {
      const price = formatPrice(item.price, item.unit);
      const line = price ? `${item.name}  •  ${price}` : item.name;
      const rendered = wrapText(ctx, line, bodyW, 1)[0];
      ctx.fillStyle = "#374151";
      const y = cursorY + 20 + index * (isStory ? 28 : 24);
      if (isStory) {
        ctx.fillText(`• ${rendered}`, bodyX, y);
      } else {
        const compact = `• ${rendered}`;
        ctx.textAlign = "center";
        ctx.fillText(compact, cardX + cardW / 2, y);
        ctx.textAlign = "left";
      }
    });
    cursorY += 14 + highlights.length * (isStory ? 28 : 24);
  }

  const footerH = format === "story" ? 120 : 92;
  const ctaH = format === "story" ? 130 : isSquare ? 98 : 88;
  const ctaY = isLandscape
    ? cardY + cardH - 110
    : cardY + cardH - footerH - ctaH - (isStory ? 34 : 22);
  const qrSize = isStory ? 152 : isSquare ? 120 : 86;
  const qrX = format === "landscape" ? cardX + cardW - qrSize - 52 : bodyX;
  const qrY = ctaY - (format === "story" ? 10 : 0);

  if (qrImage) {
    drawRoundedRect(ctx, qrX, qrY, qrSize, qrSize, 18);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.drawImage(qrImage, qrX + 8, qrY + 8, qrSize - 16, qrSize - 16);
    ctx.fillStyle = "#4b5563";
    ctx.font = `${format === "landscape" ? 13 : 15}px system-ui, sans-serif`;
    ctx.fillText("Scan", qrX + 6, qrY + qrSize + 16);
  }

  const ctaX = isLandscape ? bodyX + 40 : bodyX + qrSize + 20;
  const ctaW = isLandscape ? Math.round(bodyW * 0.54) : bodyW - qrSize - 20;

  drawRoundedRect(ctx, ctaX, ctaY, ctaW, ctaH, 22);
  const ctaGradient = ctx.createLinearGradient(ctaX, ctaY, ctaX + ctaW, ctaY + ctaH);
  ctaGradient.addColorStop(0, primary);
  ctaGradient.addColorStop(1, accent);
  ctx.fillStyle = ctaGradient;
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = `700 ${format === "story" ? 46 : format === "square" ? 34 : 28}px system-ui, sans-serif`;
  ctx.fillText(`${ctaLabel} on Lokal`, ctaX + 22, ctaY + (format === "story" ? 52 : 40));
  ctx.font = `${format === "story" ? 18 : 14}px system-ui, sans-serif`;
  const urlLines = wrapText(ctx, displayUrl, ctaW - 42, 1);
  urlLines.forEach((line, index) => {
    ctx.fillText(line, ctaX + 22, ctaY + (format === "story" ? 86 : 66) + index * 22);
  });

  const socialBits = [
    input.city?.trim() ? `City: ${input.city.trim()}` : null,
    cleanHandle(input.instagramHandle) ? `IG: @${cleanHandle(input.instagramHandle)}` : null,
    input.phone?.trim() ? `WhatsApp: ${input.phone.trim()}` : null,
    input.websiteUrl?.trim() ? input.websiteUrl.trim() : null,
  ].filter(Boolean) as string[];
  const footerLeft = socialBits.slice(0, 2).join("  •  ");
  const footerRight = socialBits.slice(2, 4).join("  •  ");

  ctx.fillStyle = "#4b5563";
  ctx.font = `${format === "story" ? 16 : 12}px system-ui, sans-serif`;
  const footerY1 = cardY + cardH - (format === "story" ? 58 : 48);
  const footerY2 = cardY + cardH - (format === "story" ? 30 : 26);
  if (footerLeft) {
    ctx.fillText(footerLeft, bodyX, footerY1);
  }
  if (footerRight) {
    ctx.fillText(footerRight, bodyX, footerY2);
  }

  const stampText = input.lastUpdatedLabel?.trim() || defaultUpdatedLabel();
  const codeSuffix = input.campaignCode?.trim() ? `  •  Code: ${input.campaignCode.trim()}` : "";
  const stampLine = `${stampText}${codeSuffix}`;
  const stampWidth = ctx.measureText(stampLine).width + 22;
  const stampX = cardX + cardW - stampWidth - 18;
  const stampY = cardY + cardH - (format === "story" ? 56 : 42);
  drawRoundedRect(
    ctx,
    stampX,
    stampY,
    stampWidth,
    format === "story" ? 32 : 24,
    12,
  );
  ctx.fillStyle = withOpacity(accent, "22");
  ctx.fill();
  ctx.fillStyle = "#334155";
  ctx.font = `${format === "story" ? 13 : 10}px system-ui, sans-serif`;
  ctx.fillText(stampLine, stampX + 11, stampY + (format === "story" ? 21 : 16));

  return await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

export async function createStoreShareCardBlob(
  input: StoreShareCardInput,
  format: StoreShareCardFormat = "story",
) {
  const campaignUrl = buildCampaignUrl(input);
  const [heroImage, logoImage, qrImage, lokalLogoImage] = await Promise.all([
    safeLoadImage(input.imageUrl),
    safeLoadImage(input.logoUrl),
    createQrImage(campaignUrl).catch(() => null),
    safeLoadImage(lokalLogoUrl),
  ]);

  return await renderCardBlob({
    input,
    format,
    campaignUrl,
    heroImage,
    logoImage,
    qrImage,
    lokalLogoImage,
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadStoreShareCard(input: StoreShareCardInput) {
  const formats = (input.formats?.length ? input.formats : DEFAULT_FORMATS).filter(
    (format, index, array) => array.indexOf(format) === index,
  );
  if (formats.length === 0) return false;

  const campaignUrl = buildCampaignUrl(input);
  const [heroImage, logoImage, qrImage, lokalLogoImage] = await Promise.all([
    safeLoadImage(input.imageUrl),
    safeLoadImage(input.logoUrl),
    createQrImage(campaignUrl).catch(() => null),
    safeLoadImage(lokalLogoUrl),
  ]);

  let downloaded = 0;
  for (const format of formats) {
    const blob = await renderCardBlob({
      input,
      format,
      campaignUrl,
      heroImage,
      logoImage,
      qrImage,
      lokalLogoImage,
    });
    if (!blob) continue;
    const name = sanitizeFilename(input.storeName) || "lokal-store";
    downloadBlob(blob, `${name}-${format}-card.png`);
    downloaded += 1;
  }

  if (downloaded === 0) return false;
  return true;
}

export type { StoreShareCardInput, StoreShareCardFormat };