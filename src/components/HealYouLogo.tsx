import React from 'react';
import { cn } from '../lib/utils';

// Full brand mark SVG (with leaf-rounded gradient background + "Heal You" serif typography)
export const HEAL_YOU_SVG_RAW = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="500" height="500">
  <defs>
    <linearGradient id="hyGrad" x1="0%" y1="50%" x2="100%" y2="50%">
      <stop offset="0%" stop-color="#f0bdfb" />
      <stop offset="48%" stop-color="#c9b3fc" />
      <stop offset="100%" stop-color="#89b4ff" />
    </linearGradient>
    <filter id="hyShadow" x="-15%" y="-15%" width="130%" height="130%">
      <feDropShadow dx="0" dy="5" stdDeviation="6" flood-color="#5b4b8a" flood-opacity="0.28" />
    </filter>
  </defs>
  <path d="M 130 0 L 500 0 L 500 370 A 130 130 0 0 1 370 500 L 0 500 L 0 130 A 130 130 0 0 1 130 0 Z" fill="url(#hyGrad)" />
  <g fill="#fdfcf9">
    <path d="M 254 46 C 249 32, 254 20, 254 16 C 254 20, 259 32, 254 46 Z" />
    <path d="M 254 50 C 242 40, 236 30, 240 26 C 246 28, 251 38, 254 50 Z" />
    <path d="M 254 50 C 266 40, 272 30, 268 26 C 262 28, 257 38, 254 50 Z" />
    <path d="M 196 80 Q 250 54 300 84" fill="none" stroke="#fdfcf9" stroke-width="3.5" stroke-linecap="round" />
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
  <g fill="#faf8f2">
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
  <g fill="none" stroke="#c8b2fa" stroke-width="4" stroke-linecap="round">
    <path d="M 210 112 Q 215 117 221 113" stroke-width="3.5" />
    <path d="M 216 80 C 234 98, 250 124, 254 148 C 256 164, 246 184, 232 204" />
    <path d="M 238 74 C 238 104, 256 132, 256 156" />
    <path d="M 278 96 C 292 122, 290 162, 272 194" />
    <path d="M 244 226 C 268 214, 288 196, 304 192" />
    <path d="M 262 238 C 282 226, 302 216, 318 220" />
  </g>
  <g filter="url(#hyShadow)" fill="#ffffff" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, serif">
    <text x="250" y="346" font-size="126" font-weight="500" letter-spacing="2">Heal</text>
    <text x="250" y="465" font-size="126" font-weight="500" letter-spacing="2">You</text>
  </g>
</svg>`;

export const HEAL_YOU_DATA_URI = `data:image/svg+xml;utf8,${encodeURIComponent(HEAL_YOU_SVG_RAW)}`;

interface HealYouLogoProps {
  customLogoUrl?: string;
  className?: string;
  size?: number;
}

export const HealYouLogo: React.FC<HealYouLogoProps> = ({
  customLogoUrl,
  className,
  size = 40,
}) => {
  const src = customLogoUrl || HEAL_YOU_DATA_URI;
  return (
    <img
      src={src}
      alt="Heal You Logo"
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      className={cn('object-contain select-none shrink-0', className)}
    />
  );
};

export function loadLogoImage(customLogoUrl?: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = customLogoUrl || HEAL_YOU_DATA_URI;
  });
}
