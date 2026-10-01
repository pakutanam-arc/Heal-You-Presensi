import { Html5Qrcode } from 'html5-qrcode';
import { Participant } from '../types';
import {
  parseCertificateQrOrInput,
  computeParticipantQrSignature,
  buildSignedParticipantQrValue,
  getCanonicalParticipantSeqIndex,
  formatOfficialCertificateNumber,
} from './certificateRenderer';

export {
  computeParticipantQrSignature,
  buildSignedParticipantQrValue,
  getCanonicalParticipantSeqIndex,
  formatOfficialCertificateNumber,
};

/**
 * Extracts the base Participant ID (e.g. "HY-001") from any raw QR string
 * (supports signed "HY-001#HY8F3A21", Certificate Verification URLs, Digital Ticket URLs, or plain "HY-001").
 */
export function extractBaseParticipantIdFromQr(rawQrText: string): string {
  const trimmed = (rawQrText || '').trim();
  if (!trimmed) return '';

  // Check if signed format "HY-001#HYXXXXXX"
  if (trimmed.includes('#HY') && !/^https?:\/\//i.test(trimmed)) {
    return trimmed.split('#HY')[0].trim().toUpperCase().replace(/^PSY-/i, 'HY-');
  }

  const parsed = parseCertificateQrOrInput(trimmed);
  if (parsed.participantId) {
    return parsed.participantId.split('#HY')[0].trim().toUpperCase().replace(/^PSY-/i, 'HY-');
  }

  return trimmed.toUpperCase();
}

/**
 * Validates a scanned QR string from an uploaded Kartu Pengenal / Foto / Barcode / E-Sertifikat
 * against the workshop's participants list and verifies the cryptographic #HY signature.
 */
export function verifyScannedParticipantQr(
  rawQrText: string,
  participants: Participant[],
  workshopId = 'main'
): {
  participant: Participant | null;
  isVerifiedSignature: boolean;
  isForgedSignature: boolean;
  extractedId: string;
  linkedBarcodeToken: string;
  sourceType: 'id_card' | 'certificate' | 'legacy';
} {
  const trimmed = (rawQrText || '').trim();
  const parsed = parseCertificateQrOrInput(trimmed);
  const extractedId = extractBaseParticipantIdFromQr(trimmed);

  const participant =
    participants.find((p) => p.id.toUpperCase() === extractedId) || null;

  const linkedBarcodeToken = participant
    ? buildSignedParticipantQrValue(participant.id, workshopId)
    : extractedId
      ? buildSignedParticipantQrValue(extractedId, workshopId)
      : '';

  if (!participant) {
    return {
      participant: null,
      isVerifiedSignature: false,
      isForgedSignature: false,
      extractedId,
      linkedBarcodeToken,
      sourceType: parsed.isExplicitCert ? 'certificate' : 'id_card',
    };
  }

  const expectedMain = computeParticipantQrSignature(participant.id, workshopId);
  const expectedDefault = computeParticipantQrSignature(participant.id, 'main');

  // 1. If the QR code carries a #HY signature (Kartu Pengenal Barcode), verify it matches
  if (trimmed.includes('#HY') && !/^https?:\/\//i.test(trimmed)) {
    const parts = trimmed.split('#HY');
    const providedSig = (parts[1] || '').trim().toUpperCase();
    const isValid = providedSig === expectedMain || providedSig === expectedDefault;
    return {
      participant: isValid ? participant : null,
      isVerifiedSignature: isValid,
      isForgedSignature: !isValid,
      extractedId,
      linkedBarcodeToken,
      sourceType: 'id_card',
    };
  }

  // 2. If the QR code is an official Certificate Verification URL (?verify_cert=...&sig=...)
  if (trimmed.includes('verify_cert=')) {
    if (parsed.signature) {
      const providedSig = parsed.signature.trim().toUpperCase();
      const expectedEvt = parsed.workshopId
        ? computeParticipantQrSignature(participant.id, parsed.workshopId)
        : expectedDefault;
      const isValid =
        providedSig === expectedMain ||
        providedSig === expectedDefault ||
        providedSig === expectedEvt;
      return {
        participant: isValid ? participant : null,
        isVerifiedSignature: isValid,
        isForgedSignature: !isValid,
        extractedId,
        linkedBarcodeToken,
        sourceType: 'certificate',
      };
    }
    return {
      participant,
      isVerifiedSignature: true,
      isForgedSignature: false,
      extractedId,
      linkedBarcodeToken,
      sourceType: 'certificate',
    };
  }

  // 3. Digital Ticket URL (?ticket=...)
  if (trimmed.includes('ticket=')) {
    return {
      participant,
      isVerifiedSignature: true,
      isForgedSignature: false,
      extractedId,
      linkedBarcodeToken,
      sourceType: 'id_card',
    };
  }

  // 4. Legacy plain ID barcode
  return {
    participant,
    isVerifiedSignature: false,
    isForgedSignature: false,
    extractedId,
    linkedBarcodeToken,
    sourceType: parsed.isExplicitCert ? 'certificate' : 'legacy',
  };
}

/**
 * Compresses an uploaded Kartu Pengenal / Foto / Barcode into a lightweight data URL
 * strictly for saving in the user's browser localStorage (never sent to Firebase).
 */
export async function createLocalCardPreviewDataUrl(
  img: HTMLImageElement,
  maxWidth = 460
): Promise<string> {
  const ratio = Math.min(1, maxWidth / Math.max(1, img.width));
  const w = Math.max(1, Math.round(img.width * ratio));
  const h = Math.max(1, Math.round(img.height * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.8);
}

/**
 * Multi-engine QR / Barcode decoder for uploaded Kartu Pengenal Pendaftaran,
 * Foto Kartu, Gambar Barcode, or E-Sertifikat.
 * Runs 100% locally in the browser and never uploads files to Firebase.
 */
export async function decodeQrFromUploadedCardOrImage(
  file: File,
  tempScannerDomId: string
): Promise<{ decodedText: string | null; previewDataUrl: string }> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    const objectUrl = URL.createObjectURL(file);
    el.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(el);
    };
    el.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    };
    el.src = objectUrl;
  });

  const previewDataUrl = await createLocalCardPreviewDataUrl(img);

  // 1. Try native hardware-accelerated BarcodeDetector API first if available in browser
  try {
    const BarcodeDetectorClass = (
      window as unknown as {
        BarcodeDetector?: new (opts: { formats: string[] }) => {
          detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
        };
      }
    ).BarcodeDetector;

    if (BarcodeDetectorClass) {
      const detector = new BarcodeDetectorClass({
        formats: ['qr_code', 'code_128', 'code_39'],
      });
      const results = await detector.detect(img);
      if (results && results.length > 0 && results[0].rawValue) {
        return { decodedText: results[0].rawValue, previewDataUrl };
      }
    }
  } catch {
    // Fallback to Html5Qrcode pipeline below
  }

  const decodeCandidateFile = async (candidate: File): Promise<string> => {
    const scanner = new Html5Qrcode(tempScannerDomId);
    try {
      const res = await scanner.scanFile(candidate, false);
      scanner.clear();
      return res;
    } catch (err) {
      try {
        scanner.clear();
      } catch {
        // Ignore
      }
      throw err;
    }
  };

  // 2. Try direct scanFile on the uploaded file
  try {
    const direct = await decodeCandidateFile(file);
    if (direct) {
      return { decodedText: direct, previewDataUrl };
    }
  } catch {
    // Proceed to targeted crop regions
  }

  // 3. Multi-region smart crops tailored for Heal You Kartu Pengenal (Portrait) and E-Sertifikat (Landscape)
  const isLandscape = img.width > img.height * 1.15;
  const cropRegions = isLandscape
    ? [
        // Tight QR Medallion region on Heal You 1400x990 E-Sertifikat (at 710, 820)
        { sx: img.width * 0.43, sy: img.height * 0.72, sw: img.width * 0.16, sh: img.height * 0.21 },
        { sx: img.width * 0.34, sy: img.height * 0.64, sw: img.width * 0.32, sh: img.height * 0.34 },
        { sx: img.width * 0.1, sy: img.height * 0.1, sw: img.width * 0.8, sh: img.height * 0.8 },
        { sx: 0, sy: 0, sw: img.width, sh: img.height },
      ]
    : [
        // Tight QR Medallion region on Heal You 448x690 Kartu Pengenal Pendaftaran
        { sx: img.width * 0.25, sy: img.height * 0.52, sw: img.width * 0.5, sh: img.height * 0.34 },
        { sx: img.width * 0.2, sy: img.height * 0.48, sw: img.width * 0.6, sh: img.height * 0.4 },
        { sx: img.width * 0.14, sy: img.height * 0.42, sw: img.width * 0.72, sh: img.height * 0.48 },
        { sx: img.width * 0.1, sy: img.height * 0.1, sw: img.width * 0.8, sh: img.height * 0.8 },
        { sx: 0, sy: 0, sw: img.width, sh: img.height },
      ];

  for (const r of cropRegions) {
    for (const highContrast of [false, true]) {
      try {
        const c = document.createElement('canvas');
        const targetMax = 640;
        const scale = Math.min(1.5, targetMax / Math.max(1, Math.max(r.sw, r.sh)));
        const pad = 44;
        const drawW = Math.max(260, Math.round(r.sw * scale));
        const drawH = Math.max(260, Math.round(r.sh * scale));
        c.width = drawW + pad * 2;
        c.height = drawH + pad * 2;
        const ctx = c.getContext('2d');
        if (!ctx) continue;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, c.width, c.height);
        if (highContrast) {
          ctx.filter = 'grayscale(100%) contrast(185%)';
        }
        ctx.drawImage(
          img,
          Math.max(0, r.sx),
          Math.max(0, r.sy),
          Math.min(img.width - r.sx, r.sw),
          Math.min(img.height - r.sy, r.sh),
          pad,
          pad,
          drawW,
          drawH
        );
        ctx.filter = 'none';

        const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/png'));
        if (!blob) continue;
        const croppedFile = new File([blob], 'card-qr-crop.png', { type: 'image/png' });
        const decoded = await decodeCandidateFile(croppedFile);
        if (decoded) {
          return { decodedText: decoded, previewDataUrl };
        }
      } catch {
        // Try next pass
      }
    }
  }

  return { decodedText: null, previewDataUrl };
}
