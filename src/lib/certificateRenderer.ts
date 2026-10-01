import { Participant, WorkshopConfig } from '../types';
import { loadLogoImage } from '../components/HealYouLogo';
import { formatSafeDateStr } from './whatsapp';
import botanicalBgUrl from '../assets/images/certificate_botanical_bg_1790819143174.jpg';

export type SignatureMode = 'TEXT' | 'IMAGE' | 'NONE';

export interface CertificateSettings {
  organizerHeader?: string;
  certTitle: string;
  certSubtitle: string;
  numberSuffix: string;
  city: string;
  bodyIntro: string;
  signer1Label: string;
  signer1Name: string;
  signer1Title: string;
  signer1SigMode: SignatureMode;
  signer1SignatureText: string;
  signer1SignatureDataUrl?: string;
  enableSigner2: boolean;
  signer2Name: string;
  signer2Title: string;
  signer2SigMode: SignatureMode;
  signer2SignatureText: string;
  signer2SignatureDataUrl?: string;
  customTemplateDataUrl?: string;
}

/**
 * Official Heal You Emblem SVG tailored for the Top-Center Pearl-Gold Medallion
 * Uses the exact floral crown, veiled Muslimah profile, peaceful eye, hijab folds,
 * and "Heal You" serif typography from HealYouLogo.tsx
 */
const HEAL_YOU_TOP_MEDALLION_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="500" height="500">
  <defs>
    <linearGradient id="hyPlumGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#9B7BC7" />
      <stop offset="55%" stop-color="#7656A3" />
      <stop offset="100%" stop-color="#583C82" />
    </linearGradient>
  </defs>
  <!-- Official Floral Crown -->
  <g fill="#7C5CA8">
    <path d="M 254 46 C 249 32, 254 20, 254 16 C 254 20, 259 32, 254 46 Z" />
    <path d="M 254 50 C 242 40, 236 30, 240 26 C 246 28, 251 38, 254 50 Z" />
    <path d="M 254 50 C 266 40, 272 30, 268 26 C 262 28, 257 38, 254 50 Z" />
    <path d="M 196 80 Q 250 54 300 84" fill="none" stroke="#7C5CA8" stroke-width="4" stroke-linecap="round" />
    <path d="M 232 58 C 222 44, 224 32, 230 30 C 236 34, 236 46, 232 58 Z" />
    <path d="M 226 62 C 212 56, 204 46, 208 40 C 216 42, 222 52, 226 62 Z" />
    <path d="M 212 68 C 198 58, 194 46, 200 42 C 207 46, 210 58, 212 68 Z" />
    <path d="M 202 74 C 186 72, 180 62, 184 56 C 192 58, 198 66, 202 74 Z" />
    <path d="M 196 82 C 184 86, 182 78, 187 73 C 192 74, 195 78, 196 82 Z" />
    <path d="M 274 58 C 284 44, 282 32, 276 30 C 270 34, 270 46, 274 58 Z" />
    <path d="M 280 64 C 294 56, 300 46, 296 40 C 288 42, 283 52, 280 64 Z" />
    <path d="M 290 72 C 304 64, 308 54, 302 48 C 295 52, 292 62, 290 72 Z" />
    <path d="M 298 80 C 310 80, 314 72, 308 66 C 302 68, 299 74, 298 80 Z" />
  </g>
  <!-- Official Veiled Muslimah Silhouette -->
  <g fill="url(#hyPlumGrad)">
    <path d="M 244 72
             C 282 72, 308 106, 308 152
             C 308 178, 296 202, 296 202
             C 308 208, 322 222, 326 234
             C 314 230, 302 242, 294 256
             C 288 260, 286 250, 276 252
             C 254 256, 224 260, 192 250
             C 198 242, 224 248, 248 236
             C 268 224, 286 200, 294 176
             C 278 198, 254 222, 226 234
             C 202 242, 174 236, 172 228
             C 172 222, 194 218, 214 204
             C 228 194, 236 178, 232 164
             C 220 164, 210 166, 204 162
             C 200 158, 203 152, 201 148
             C 198 145, 196 142, 200 139
             C 196 136, 200 132, 198 128
             C 192 126, 194 120, 200 110
             C 202 94, 212 78, 244 72 Z" />
  </g>
  <!-- Official Peaceful Eye & Hijab Drape Lines -->
  <g fill="none" stroke="#F7F3EB" stroke-width="4.5" stroke-linecap="round">
    <path d="M 210 112 Q 215 117 221 113" stroke-width="4" />
    <path d="M 216 80 C 234 98, 250 124, 254 148 C 256 164, 246 184, 232 204" />
    <path d="M 238 74 C 238 104, 256 132, 256 156" />
    <path d="M 278 96 C 292 122, 290 162, 272 194" />
    <path d="M 244 226 C 268 214, 288 196, 304 192" />
    <path d="M 262 238 C 282 226, 302 216, 318 220" />
  </g>
  <!-- Official Heal You Serif Title -->
  <g fill="#3E2B5C" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, serif">
    <text x="250" y="348" font-size="118" font-weight="700" letter-spacing="2">Heal</text>
    <text x="250" y="458" font-size="118" font-weight="700" letter-spacing="2">You</text>
  </g>
</svg>`;

const HEAL_YOU_TOP_MEDALLION_URI = `data:image/svg+xml;utf8,${encodeURIComponent(HEAL_YOU_TOP_MEDALLION_SVG)}`;

/**
 * Official Heal You Emblem SVG in 3D Embossed Metallic Gold for the Bottom Foil Seal Stamp
 */
const HEAL_YOU_GOLD_FOIL_EMBLEM_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="145 5 210 270" width="400" height="400">
  <defs>
    <linearGradient id="goldEmbossGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFF4C8" />
      <stop offset="40%" stop-color="#E5C168" />
      <stop offset="75%" stop-color="#B88B32" />
      <stop offset="100%" stop-color="#8A6218" />
    </linearGradient>
    <filter id="embossShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="1.5" dy="2.5" stdDeviation="2" flood-color="#5E3F08" flood-opacity="0.55" />
    </filter>
  </defs>
  <g filter="url(#embossShadow)">
    <!-- Floral Crown in Embossed Gold -->
    <g fill="url(#goldEmbossGrad)" stroke="#7A5412" stroke-width="1.8">
      <path d="M 254 46 C 249 32, 254 20, 254 16 C 254 20, 259 32, 254 46 Z" />
      <path d="M 254 50 C 242 40, 236 30, 240 26 C 246 28, 251 38, 254 50 Z" />
      <path d="M 254 50 C 266 40, 272 30, 268 26 C 262 28, 257 38, 254 50 Z" />
      <path d="M 196 80 Q 250 54 300 84" fill="none" stroke="#7A5412" stroke-width="3.5" stroke-linecap="round" />
      <path d="M 232 58 C 222 44, 224 32, 230 30 C 236 34, 236 46, 232 58 Z" />
      <path d="M 226 62 C 212 56, 204 46, 208 40 C 216 42, 222 52, 226 62 Z" />
      <path d="M 212 68 C 198 58, 194 46, 200 42 C 207 46, 210 58, 212 68 Z" />
      <path d="M 202 74 C 186 72, 180 62, 184 56 C 192 58, 198 66, 202 74 Z" />
      <path d="M 196 82 C 184 86, 182 78, 187 73 C 192 74, 195 78, 196 82 Z" />
      <path d="M 274 58 C 284 44, 282 32, 276 30 C 270 34, 270 46, 274 58 Z" />
      <path d="M 280 64 C 294 56, 300 46, 296 40 C 288 42, 283 52, 280 64 Z" />
      <path d="M 290 72 C 304 64, 308 54, 302 48 C 295 52, 292 62, 290 72 Z" />
      <path d="M 298 80 C 310 80, 314 72, 308 66 C 302 68, 299 74, 298 80 Z" />
    </g>
    <!-- Veiled Muslimah Silhouette in Embossed Gold -->
    <g fill="url(#goldEmbossGrad)" stroke="#7A5412" stroke-width="2.6" stroke-linejoin="round">
      <path d="M 244 72
               C 282 72, 308 106, 308 152
               C 308 178, 296 202, 296 202
               C 308 208, 322 222, 326 234
               C 314 230, 302 242, 294 256
               C 288 260, 286 250, 276 252
               C 254 256, 224 260, 192 250
               C 198 242, 224 248, 248 236
               C 268 224, 286 200, 294 176
               C 278 198, 254 222, 226 234
               C 202 242, 174 236, 172 228
               C 172 222, 194 218, 214 204
               C 228 194, 236 178, 232 164
               C 220 164, 210 166, 204 162
               C 200 158, 203 152, 201 148
               C 198 145, 196 142, 200 139
               C 196 136, 200 132, 198 128
               C 192 126, 194 120, 200 110
               C 202 94, 212 78, 244 72 Z" />
    </g>
    <!-- Peaceful Eye & Hijab Drape Lines in Deep Gold Relief -->
    <g fill="none" stroke="#785210" stroke-width="3.6" stroke-linecap="round">
      <path d="M 210 112 Q 215 117 221 113" stroke-width="3.5" />
      <path d="M 216 80 C 234 98, 250 124, 254 148 C 256 164, 246 184, 232 204" />
      <path d="M 238 74 C 238 104, 256 132, 256 156" />
      <path d="M 278 96 C 292 122, 290 162, 272 194" />
      <path d="M 244 226 C 268 214, 288 196, 304 192" />
      <path d="M 262 238 C 282 226, 302 216, 318 220" />
    </g>
  </g>
</svg>`;

const HEAL_YOU_GOLD_FOIL_EMBLEM_URI = `data:image/svg+xml;utf8,${encodeURIComponent(HEAL_YOU_GOLD_FOIL_EMBLEM_SVG)}`;

export function getShortSignatureName(fullName: string): string {
  return fullName
    .replace(/^(Dr\.|Hj\.|H\.|Prof\.|Ir\.|Ns\.|Dra\.|Drs\.)\s*/gi, '')
    .split(',')[0]
    .trim();
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapCanvasLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.trim().split(/\s+/);
  if (words.length === 0 || !words[0]) return [''];
  const lines: string[] = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const testLine = `${currentLine} ${words[i]}`;
    if (ctx.measureText(testLine).width <= maxWidth) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = words[i];
    }
  }
  lines.push(currentLine);
  return lines;
}

const imageCache = new Map<string, HTMLImageElement>();

function loadImageElement(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src);
  if (cached && cached.complete && cached.naturalWidth > 0) {
    return Promise.resolve(cached);
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

function drawParchmentFallback(ctx: CanvasRenderingContext2D, baseW: number, baseH: number) {
  const bgGrad = ctx.createLinearGradient(0, 0, baseW, baseH);
  bgGrad.addColorStop(0, '#F9F5EC');
  bgGrad.addColorStop(0.5, '#FBF9F3');
  bgGrad.addColorStop(1, '#F3EDE0');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, baseW, baseH);
}

function patchParchmentRegion(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  targetX: number,
  targetY: number,
  targetW: number,
  targetH: number
) {
  const sx = img.naturalWidth * 0.17;
  const sy = img.naturalHeight * 0.14;
  const sw = img.naturalWidth * 0.13;
  const sh = img.naturalHeight * 0.09;

  ctx.save();
  drawRoundedRect(ctx, targetX, targetY, targetW, targetH, 8);
  ctx.clip();

  const tileW = 180;
  const tileH = 95;
  for (let x = targetX; x < targetX + targetW; x += tileW) {
    for (let y = targetY; y < targetY + targetH; y += tileH) {
      ctx.drawImage(img, sx, sy, sw, sh, x, y, tileW + 2, tileH + 2);
    }
  }
  ctx.restore();
}

/**
 * Top-Center Scalloped Gold Medallion Emblem ("Heal You" with Laurel Wreath)
 * Uses the authentic HealYouLogo SVG at (cx = 700, cy = 78, r = 64)
 */
async function drawTopGoldMedallion(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  customLogoUrl?: string
) {
  ctx.save();

  ctx.shadowColor = 'rgba(95, 74, 38, 0.26)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;

  // 12-lobe wavy scalloped antique gold outer medallion
  const lobes = 12;
  const rOuter = 64;
  const rInner = 59;
  const goldGrad = ctx.createLinearGradient(cx - rOuter, cy - rOuter, cx + rOuter, cy + rOuter);
  goldGrad.addColorStop(0, '#EFE0B8');
  goldGrad.addColorStop(0.3, '#CBB07A');
  goldGrad.addColorStop(0.65, '#E2CC9C');
  goldGrad.addColorStop(1, '#9E824C');

  ctx.fillStyle = goldGrad;
  ctx.beginPath();
  for (let i = 0; i < lobes * 2; i++) {
    const angle = (i * Math.PI) / lobes - Math.PI / 2;
    const r = i % 2 === 0 ? rOuter : rInner;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      const midA = angle - Math.PI / (lobes * 2);
      ctx.quadraticCurveTo(
        cx + Math.cos(midA) * (r + 2.4),
        cy + Math.sin(midA) * (r + 2.4),
        x,
        y
      );
    }
  }
  ctx.closePath();
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.strokeStyle = '#9C804B';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Inner metallic gold ring
  ctx.beginPath();
  ctx.arc(cx, cy, 53, 0, Math.PI * 2);
  ctx.strokeStyle = '#8F7340';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // Pearl-lavender inner disc
  const discGrad = ctx.createRadialGradient(cx, cy - 12, 5, cx, cy, 51);
  discGrad.addColorStop(0, '#FAF7F4');
  discGrad.addColorStop(0.7, '#ECE5E4');
  discGrad.addColorStop(1, '#DED5D6');
  ctx.fillStyle = discGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, 51, 0, Math.PI * 2);
  ctx.fill();

  // Gold Laurel Wreath inside medallion rim
  ctx.fillStyle = '#B49862';
  for (const side of [-1, 1]) {
    for (let i = 0; i < 11; i++) {
      const a = Math.PI * 0.5 + side * (0.18 + i * 0.22);
      const lx = cx + Math.cos(a) * 45.5;
      const ly = cy + Math.sin(a) * 45.5;
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(a + side * 0.45);
      ctx.beginPath();
      ctx.ellipse(0, 0, 4.2, 1.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // Inner fine gold circle inside laurel
  ctx.beginPath();
  ctx.arc(cx, cy, 40.5, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(176, 148, 94, 0.65)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Draw Official Heal You Logo inside Top Medallion
  try {
    if (customLogoUrl) {
      const customImg = await loadLogoImage(customLogoUrl);
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, 39, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(customImg, cx - 39, cy - 39, 78, 78);
      ctx.restore();
    } else {
      const officialMedallionImg = await loadImageElement(HEAL_YOU_TOP_MEDALLION_URI);
      ctx.drawImage(officialMedallionImg, cx - 36, cy - 36, 72, 72);
    }
  } catch {
    // Fallback text if SVG fails
    ctx.fillStyle = '#43325E';
    ctx.textAlign = 'center';
    ctx.font = '700 17px "Cormorant Garamond", Georgia, serif';
    ctx.fillText('Heal', cx, cy - 2);
    ctx.fillText('You', cx, cy + 16);
  }

  ctx.restore();
}

/**
 * Symmetrical Botanical Vine & Scroll Flourish Divider (at cx = 700, cy = 648)
 */
function drawCenterBotanicalDivider(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = '#9E8B66';
  ctx.fillStyle = 'rgba(184, 165, 128, 0.38)';
  ctx.lineWidth = 1.25;
  ctx.lineCap = 'round';

  for (const dir of [-1, 1]) {
    ctx.save();
    ctx.scale(dir, 1);

    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.bezierCurveTo(28, -16, 68, 12, 106, -4);
    ctx.bezierCurveTo(118, -10, 118, -22, 108, -20);
    ctx.bezierCurveTo(100, -18, 102, -8, 110, -8);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.bezierCurveTo(32, 12, 48, 18, 38, 25);
    ctx.bezierCurveTo(31, 29, 25, 22, 31, 18);
    ctx.stroke();

    ctx.fillStyle = '#9E8B66';
    ctx.beginPath();
    ctx.arc(132, -8, 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(138, -8);
    ctx.lineTo(175, -8);
    ctx.stroke();

    ctx.fillStyle = 'rgba(184, 165, 128, 0.38)';
    const leaves = [
      { x: 22, y: -6, a: -0.65, l: 17 },
      { x: 44, y: -2, a: -0.45, l: 18 },
      { x: 52, y: 2, a: 0.55, l: 17 },
      { x: 74, y: 2, a: -0.4, l: 16 },
      { x: 82, y: 3, a: 0.48, l: 15 },
    ];
    for (const lf of leaves) {
      ctx.save();
      ctx.translate(lf.x, lf.y);
      ctx.rotate(lf.a);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(lf.l * 0.5, -4.5, lf.l, 0);
      ctx.quadraticCurveTo(lf.l * 0.5, 4.5, 0, 0);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  ctx.beginPath();
  ctx.moveTo(0, -4);
  ctx.quadraticCurveTo(-5.5, 12, 0, 24);
  ctx.quadraticCurveTo(5.5, 12, 0, -4);
  ctx.fill();
  ctx.stroke();

  for (const s of [-1, 1]) {
    ctx.save();
    ctx.scale(s, 1);
    ctx.beginPath();
    ctx.moveTo(2, -2);
    ctx.quadraticCurveTo(10, 6, 14, 16);
    ctx.quadraticCurveTo(5, 11, 2, -2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

/**
 * 3D Embossed Metallic Gold Foil Seal Stamp at (cx = 944, cy = 777, r = 70)
 * Uses the official Heal You Floral-Crown Veiled Muslimah SVG embossed in 3D gold in the center
 */
async function drawEmbossedGoldFoilSeal(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.save();

  ctx.shadowColor = 'rgba(88, 64, 22, 0.30)';
  ctx.shadowBlur = 13;
  ctx.shadowOffsetY = 4;

  const teeth = 36;
  const rOuter = 70;
  const rInner = 64;

  const foilGrad = ctx.createLinearGradient(cx - rOuter, cy - rOuter, cx + rOuter, cy + rOuter);
  foilGrad.addColorStop(0, '#F7E5B1');
  foilGrad.addColorStop(0.22, '#D1AA56');
  foilGrad.addColorStop(0.48, '#FFF1C2');
  foilGrad.addColorStop(0.74, '#B38632');
  foilGrad.addColorStop(1, '#E3C376');

  ctx.fillStyle = foilGrad;
  ctx.beginPath();
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i * Math.PI) / teeth;
    const r = i % 2 === 0 ? rOuter : rInner;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Inner embossed gold disc
  const innerFoil = ctx.createRadialGradient(cx - 16, cy - 16, 6, cx, cy, 58);
  innerFoil.addColorStop(0, '#FBECC2');
  innerFoil.addColorStop(0.55, '#D6B162');
  innerFoil.addColorStop(1, '#A67C2C');

  ctx.fillStyle = innerFoil;
  ctx.beginPath();
  ctx.arc(cx, cy, 57, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#89621C';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Inner raised gold ring
  ctx.beginPath();
  ctx.arc(cx, cy, 41, 0, Math.PI * 2);
  ctx.strokeStyle = '#FFF3C9';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, 39.5, 0, Math.PI * 2);
  ctx.strokeStyle = '#89621C';
  ctx.lineWidth = 1.1;
  ctx.stroke();

  // Top Curved Embossed Text: "MUSLIMAH HEALING JOURNEY"
  const arcText = 'MUSLIMAH HEALING JOURNEY';
  ctx.fillStyle = '#745012';
  ctx.font = '700 7.2px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const startAngle = -Math.PI * 0.88;
  const stepAngle = (Math.PI * 0.76) / (arcText.length - 1);
  for (let i = 0; i < arcText.length; i++) {
    const a = startAngle + i * stepAngle;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * 48.5, cy + Math.sin(a) * 48.5);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillText(arcText[i], 0, 0);
    ctx.restore();
  }

  // Bottom Curved Embossed Laurel Wreath
  ctx.fillStyle = '#8E671F';
  for (let i = -7; i <= 7; i++) {
    if (i === 0) continue;
    const a = Math.PI * 0.5 + i * 0.14;
    const lx = cx + Math.cos(a) * 48.5;
    const ly = cy + Math.sin(a) * 48.5;
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(a + (i > 0 ? 0.42 : -0.42));
    ctx.beginPath();
    ctx.ellipse(0, 0, 4.6, 2.0, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Center Official Heal You Floral-Crown Veiled Muslimah Silhouette in 3D Embossed Gold
  try {
    const goldEmblemImg = await loadImageElement(HEAL_YOU_GOLD_FOIL_EMBLEM_URI);
    ctx.drawImage(goldEmblemImg, cx - 31, cy - 32, 62, 62);
  } catch {
    // Ignore fallback
  }

  ctx.restore();
}

/**
 * Flowing Fountain-Pen Script Signature ("Sacramento")
 */
function drawStylizedSignature(
  ctx: CanvasRenderingContext2D,
  customSigText: string,
  fallbackName: string,
  centerX: number,
  centerY: number
) {
  const displaySig = (customSigText && customSigText.trim()) || getShortSignatureName(fallbackName);
  if (!displaySig) return;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(-0.02);

  ctx.font = '400 54px "Sacramento", "Cormorant Garamond", cursive';
  ctx.fillStyle = '#1C1526';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(displaySig, 0, 2);

  ctx.restore();
}

/**
 * Main High-Resolution A4 Landscape Botanical & Gold Filigree Certificate Renderer
 * Precision-locked to the exact coordinates of the user's reference image
 */
export async function renderBotanicalCertificateCanvas(
  participant: Participant,
  seqIndex: number,
  config: WorkshopConfig,
  settings: CertificateSettings
): Promise<HTMLCanvasElement> {
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  const baseW = 1400;
  const baseH = 990;
  const scale = 2;

  const canvas = document.createElement('canvas');
  canvas.width = baseW * scale;
  canvas.height = baseH * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.scale(scale, scale);

  // 1. Draw Background Image
  if (settings.customTemplateDataUrl) {
    try {
      const customBg = await loadImageElement(settings.customTemplateDataUrl);
      ctx.drawImage(customBg, 0, 0, baseW, baseH);

      // Cleanly patch over the static text, signature, and QR regions of the reference image
      patchParchmentRegion(ctx, customBg, 275, 148, 850, 468);
      patchParchmentRegion(ctx, customBg, 145, 735, 330, 185);
      patchParchmentRegion(ctx, customBg, 620, 745, 185, 175);
      patchParchmentRegion(ctx, customBg, 1020, 735, 255, 130);
      patchParchmentRegion(ctx, customBg, 975, 855, 310, 68);
    } catch {
      drawParchmentFallback(ctx, baseW, baseH);
    }
  } else {
    try {
      const bgImg = await loadImageElement(botanicalBgUrl);
      ctx.drawImage(bgImg, 0, 0, baseW, baseH);
    } catch {
      drawParchmentFallback(ctx, baseW, baseH);
    }

    // Draw Symmetrical Botanical Vine & Scroll Divider at exact (700, 648)
    drawCenterBotanicalDivider(ctx, baseW / 2, 648);
  }

  // Always draw the crisp Official Heal You Top-Center Gold Medallion & Bottom 3D Gold Foil Seal
  await drawTopGoldMedallion(ctx, baseW / 2, 78, config.customLogoUrl);
  await drawEmbossedGoldFoilSeal(ctx, 944, 777);

  // 2. Precision Typography & Layout matching reference image coordinates
  const organizer =
    (settings.organizerHeader && settings.organizerHeader.trim()) ||
    config.organizer ||
    'Muslimah Healing Journey';
  const tagline = config.tagline || "Let's Heal";
  const eventLabel = config.eventLabel || 'Agenda Workshop Psikologi';
  const certNumber = `No. ${String(seqIndex + 1).padStart(3, '0')}/${participant.id.toUpperCase()}${settings.numberSuffix}`;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // HEAL YOU · MUSLIMAH HEALING JOURNEY (y = 168)
  ctx.fillStyle = '#2A1E3D';
  ctx.font = '600 13.5px "Plus Jakarta Sans", sans-serif';
  ctx.letterSpacing = '3.6px';
  ctx.fillText(`HEAL YOU  ·  ${organizer.toUpperCase()}`, baseW / 2, 168);
  ctx.letterSpacing = '0px';

  // — Let's Heal — (y = 191)
  ctx.fillStyle = '#4A3966';
  ctx.font = 'italic 500 16.5px "Cormorant Garamond", Georgia, serif';
  ctx.fillText(`— ${tagline} —`, baseW / 2, 191);

  // SERTIFIKAT PENGHARGAAN (y = 252)
  ctx.fillStyle = '#211436';
  ctx.font = '700 46px "Cormorant Garamond", Georgia, serif';
  ctx.letterSpacing = '3.5px';
  ctx.fillText(settings.certTitle.toUpperCase(), baseW / 2, 252);
  ctx.letterSpacing = '0px';

  // Certificate Number (y = 280)
  ctx.fillStyle = '#6E5D3E';
  ctx.font = '600 13px "Plus Jakarta Sans", sans-serif';
  ctx.letterSpacing = '1.8px';
  ctx.fillText(certNumber, baseW / 2, 280);
  ctx.letterSpacing = '0px';

  // Gold Line with Center Diamond under Certificate Number (y = 298)
  const divY = 298;
  ctx.strokeStyle = 'rgba(176, 148, 96, 0.75)';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(baseW / 2 - 210, divY);
  ctx.lineTo(baseW / 2 - 14, divY);
  ctx.moveTo(baseW / 2 + 14, divY);
  ctx.lineTo(baseW / 2 + 210, divY);
  ctx.stroke();

  ctx.fillStyle = '#A8894E';
  ctx.beginPath();
  ctx.moveTo(baseW / 2, divY - 5);
  ctx.lineTo(baseW / 2 + 5.5, divY);
  ctx.lineTo(baseW / 2, divY + 5);
  ctx.lineTo(baseW / 2 - 5.5, divY);
  ctx.closePath();
  ctx.fill();

  // 3. Recipient Section
  // Diberikan dengan penuh apresiasi kepada: (y = 335)
  ctx.fillStyle = '#221538';
  ctx.font = 'italic 600 20px "Cormorant Garamond", Georgia, serif';
  ctx.fillText(settings.certSubtitle, baseW / 2, 335);

  // Recipient Name (y = 398)
  ctx.fillStyle = '#1E1133';
  ctx.font = '700 54px "Cormorant Garamond", Georgia, serif';
  const nameLines = wrapCanvasLines(ctx, participant.name, 920);
  let cursorY = 398;
  for (const line of nameLines.slice(0, 2)) {
    ctx.fillText(line, baseW / 2, cursorY);
    cursorY += 54;
  }
  cursorY -= 34;

  // Gold Underline below Recipient Name (y = 418)
  ctx.strokeStyle = 'rgba(176, 148, 96, 0.72)';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(baseW / 2 - 295, cursorY);
  ctx.lineTo(baseW / 2 + 295, cursorY);
  ctx.stroke();

  // Recipient Role & Institution (y = 444)
  cursorY += 26;
  const roleLabel = participant.role || 'Peserta Workshop';
  const instLabel = participant.institution ? `  ·  ${participant.institution}` : '';
  ctx.fillStyle = '#241936';
  ctx.font = '600 14.5px "Plus Jakarta Sans", sans-serif';
  ctx.letterSpacing = '1.2px';
  ctx.fillText(`${roleLabel.toUpperCase()}${instLabel.toUpperCase()}`, baseW / 2, cursorY);
  ctx.letterSpacing = '0px';

  // 4. Workshop Citation Block
  cursorY += 42;
  ctx.fillStyle = '#221933';
  ctx.font = '400 15.5px "Plus Jakarta Sans", sans-serif';
  const introLines = wrapCanvasLines(ctx, settings.bodyIntro, 880);
  for (const line of introLines.slice(0, 2)) {
    ctx.fillText(line, baseW / 2, cursorY);
    cursorY += 23;
  }

  cursorY += 11;
  ctx.fillStyle = '#221538';
  ctx.font = 'italic 600 19px "Cormorant Garamond", Georgia, serif';
  ctx.fillText(eventLabel, baseW / 2, cursorY);

  cursorY += 36;
  ctx.fillStyle = '#1E1133';
  ctx.font = '700 30px "Cormorant Garamond", Georgia, serif';
  const eventLines = wrapCanvasLines(ctx, `“${config.name.toUpperCase()}”`, 920);
  for (const line of eventLines.slice(0, 2)) {
    ctx.fillText(line, baseW / 2, cursorY);
    cursorY += 34;
  }

  cursorY += 5;
  const formattedDate = formatSafeDateStr(config.date, 'dd MMMM yyyy');
  ctx.fillStyle = '#221933';
  ctx.font = '400 14.5px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(
    `Diselenggarakan pada ${formattedDate}  ·  Bertempat di ${config.location}`,
    baseW / 2,
    cursorY
  );

  // 5. Bottom Row: Left Signer (x=305), Center QR (x=710), 3D Gold Seal (x=944), Right Signer (x=1127)
  const footerBaseY = 770;
  const issueDateText = `${settings.city}, ${formattedDate}`;

  // Center Double-Framed QR Code Medallion at (710, 820)
  const qrCanvas = document.getElementById(
    `global-qr-${participant.id}`
  ) as HTMLCanvasElement | null;

  const qrCenterX = 710;
  const qrCenterY = 820;

  drawRoundedRect(ctx, qrCenterX - 60, qrCenterY - 60, 120, 120, 14);
  ctx.fillStyle = '#FBF9F4';
  ctx.fill();
  ctx.strokeStyle = '#B49A6B';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  drawRoundedRect(ctx, qrCenterX - 53, qrCenterY - 53, 106, 106, 9);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = 'rgba(180, 154, 107, 0.55)';
  ctx.lineWidth = 1;
  ctx.stroke();

  if (qrCanvas) {
    ctx.drawImage(qrCanvas, qrCenterX - 46, qrCenterY - 46, 92, 92);
  }

  ctx.fillStyle = '#2B203D';
  ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
  ctx.letterSpacing = '1.6px';
  ctx.fillText(`TERVERIFIKASI  ·  ${participant.id}`, qrCenterX, qrCenterY + 78);
  ctx.letterSpacing = '0px';

  // Signer Column Helper
  const drawSignerBlock = async (
    xPos: number,
    topCaption: string,
    name: string,
    title: string,
    sigMode: SignatureMode,
    sigText: string,
    sigDataUrl?: string
  ) => {
    ctx.fillStyle = '#221933';
    ctx.font = '400 13.5px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(topCaption, xPos, footerBaseY - 12);

    if (sigMode === 'IMAGE' && sigDataUrl) {
      try {
        const sigImg = await loadImageElement(sigDataUrl);
        ctx.drawImage(sigImg, xPos - 95, footerBaseY - 2, 190, 78);
      } catch {
        drawStylizedSignature(ctx, sigText, name, xPos, footerBaseY + 38);
      }
    } else if (sigMode === 'TEXT') {
      drawStylizedSignature(ctx, sigText, name, xPos, footerBaseY + 38);
    }

    // Thin Gold-Taupe Signature Line
    ctx.strokeStyle = 'rgba(176, 148, 96, 0.72)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xPos - 145, footerBaseY + 82);
    ctx.lineTo(xPos + 145, footerBaseY + 82);
    ctx.stroke();

    // Signer Bold Name
    ctx.fillStyle = '#1B1424';
    ctx.font = '700 15.5px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(name, xPos, footerBaseY + 104);

    // Signer Title/Role
    ctx.fillStyle = '#2C223D';
    ctx.font = '400 12.5px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(title, xPos, footerBaseY + 123);
  };

  if (settings.enableSigner2) {
    const leftX = 305;
    const rightX = 1127;

    await drawSignerBlock(
      leftX,
      settings.signer1Label || 'Mengetahui, Penyelenggara:',
      settings.signer1Name,
      settings.signer1Title,
      settings.signer1SigMode,
      settings.signer1SignatureText,
      settings.signer1SignatureDataUrl
    );

    await drawSignerBlock(
      rightX,
      issueDateText,
      settings.signer2Name,
      settings.signer2Title,
      settings.signer2SigMode,
      settings.signer2SignatureText,
      settings.signer2SignatureDataUrl
    );
  } else {
    const rightX = 1127;
    await drawSignerBlock(
      rightX,
      issueDateText,
      settings.signer1Name,
      settings.signer1Title,
      settings.signer1SigMode,
      settings.signer1SignatureText,
      settings.signer1SignatureDataUrl
    );
  }

  return canvas;
}
