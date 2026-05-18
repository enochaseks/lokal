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
};

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1920;

function sanitizeFilename(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
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

export async function createStoreShareCardBlob(input: StoreShareCardInput) {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const primary = input.primaryColor || "#b42318";
  const accent = input.accentColor || "#f97316";
  const heroImage = await safeLoadImage(input.imageUrl);
  const logoImage = await safeLoadImage(input.logoUrl);

  const background = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  background.addColorStop(0, "#fff8f3");
  background.addColorStop(0.55, "#fff1e8");
  background.addColorStop(1, "#ffffff");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  if (heroImage) {
    const heroHeight = 880;
    ctx.drawImage(heroImage, 0, 0, CARD_WIDTH, heroHeight);
    const overlay = ctx.createLinearGradient(0, 0, 0, heroHeight);
    overlay.addColorStop(0, "rgba(0,0,0,0.08)");
    overlay.addColorStop(0.55, "rgba(0,0,0,0.2)");
    overlay.addColorStop(1, "rgba(0,0,0,0.6)");
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, CARD_WIDTH, heroHeight);
  } else {
    const fallback = ctx.createLinearGradient(0, 0, CARD_WIDTH, 960);
    fallback.addColorStop(0, primary);
    fallback.addColorStop(1, accent);
    ctx.fillStyle = fallback;
    ctx.fillRect(0, 0, CARD_WIDTH, 960);
  }

  drawRoundedRect(ctx, 64, 760, CARD_WIDTH - 128, 1030, 44);
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  ctx.fill();

  if (logoImage) {
    drawRoundedRect(ctx, 96, 700, 180, 180, 40);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.save();
    drawRoundedRect(ctx, 96, 700, 180, 180, 40);
    ctx.clip();
    ctx.drawImage(logoImage, 108, 712, 156, 156);
    ctx.restore();
  }

  ctx.font = "600 34px system-ui, sans-serif";
  const pills = [input.category, input.origin].filter(Boolean) as string[];
  let pillX = 96;
  for (const [index, pill] of pills.entries()) {
    const width = ctx.measureText(pill).width + 48;
    drawRoundedRect(ctx, pillX, 930, width, 64, 32);
    ctx.fillStyle = index === 0 ? `${primary}22` : `${accent}22`;
    ctx.fill();
    ctx.fillStyle = index === 0 ? primary : accent;
    ctx.fillText(pill, pillX + 24, 973);
    pillX += width + 18;
  }

  ctx.fillStyle = "#111111";
  ctx.font = "700 84px system-ui, sans-serif";
  const titleLines = wrapText(ctx, input.storeName, CARD_WIDTH - 192, 2);
  titleLines.forEach((line, index) => {
    ctx.fillText(line, 96, 1095 + index * 96);
  });

  if (input.description?.trim()) {
    ctx.fillStyle = "#57534e";
    ctx.font = "400 38px system-ui, sans-serif";
    const descriptionLines = wrapText(ctx, input.description, CARD_WIDTH - 192, 4);
    descriptionLines.forEach((line, index) => {
      ctx.fillText(line, 96, 1295 + index * 54);
    });
  }

  drawRoundedRect(ctx, 96, 1530, CARD_WIDTH - 192, 180, 36);
  const ctaGradient = ctx.createLinearGradient(96, 1530, CARD_WIDTH - 96, 1710);
  ctaGradient.addColorStop(0, primary);
  ctaGradient.addColorStop(1, accent);
  ctx.fillStyle = ctaGradient;
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 48px system-ui, sans-serif";
  ctx.fillText("Find this store on Lokal", 144, 1608);
  ctx.font = "400 30px system-ui, sans-serif";
  const urlLines = wrapText(ctx, input.shareUrl, CARD_WIDTH - 288, 2);
  urlLines.forEach((line, index) => {
    ctx.fillText(line, 144, 1666 + index * 38);
  });

  ctx.fillStyle = "#6b7280";
  ctx.font = "600 28px system-ui, sans-serif";
  ctx.fillText("Download and post this card to Stories or socials.", 96, 1828);

  return await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

export async function downloadStoreShareCard(input: StoreShareCardInput) {
  const blob = await createStoreShareCardBlob(input);
  if (!blob) return false;

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${sanitizeFilename(input.storeName) || "lokal-store"}-story-card.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

export type { StoreShareCardInput };