import { Participant, WorkshopConfig, CertificateSettings } from '../types';
import { WorkshopEventItem } from '../store';
import { DEFAULT_CERT_SETTINGS, normalizeCertificateSettings } from './certificateRenderer';

export interface VerifiedCertificateResult {
  isValidFound: boolean;
  isAttended: boolean;
  queryCode: string;
  certificateNumber: string;
  seqIndex: number;
  participant?: Participant;
  workshopId: string;
  config: WorkshopConfig;
  certificateSettings: CertificateSettings;
  verifiedAtIso: string;
  source: 'ACTIVE_EVENT' | 'OTHER_EVENT' | 'URL_EMBEDDED' | 'NOT_FOUND';
}

/**
 * Generates a compact, fast-scanning QR Code URL for the E-Certificate medallion.
 * Works both when scanned in the in-app Scanner menu and when scanned by an external phone camera.
 */
export function buildCompactCertQrValue(
  participantId: string,
  seqIndex: number,
  workshopId: string,
  numberSuffix: string
): string {
  const baseUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}`
      : 'https://healyou.id/';
  const cleanSuffix = (numberSuffix || DEFAULT_CERT_SETTINGS.numberSuffix).trim();
  const certNo = `${String(seqIndex + 1).padStart(3, '0')}${cleanSuffix}`;
  const params = new URLSearchParams({
    verify_cert: participantId,
    w: workshopId || 'main',
    no: certNo,
  });
  return `${baseUrl}?${params.toString()}`;
}

/**
 * Generates a full shareable public verification URL containing fallback metadata
 * so external verifiers can view certificate details even on another device without login.
 */
export function buildFullCertificateVerificationUrl(
  participant: Participant,
  seqIndex: number,
  config: WorkshopConfig,
  certSettings: CertificateSettings,
  workshopId = 'main'
): string {
  const baseUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}`
      : '';
  const cleanSuffix = (certSettings.numberSuffix || DEFAULT_CERT_SETTINGS.numberSuffix).trim();
  const certNo = `${String(seqIndex + 1).padStart(3, '0')}${cleanSuffix}`;
  const params = new URLSearchParams({
    verify_cert: participant.id,
    w: workshopId,
    no: certNo,
    name: participant.name,
    role: participant.role || 'Peserta Workshop',
    inst: participant.institution || '-',
    status: participant.status,
    checkin: participant.checkInTime || '',
    event: config.name,
    date: config.date,
    loc: config.location,
    org: config.organizer || 'Muslimah Healing Journey',
    city: certSettings.city || 'Jakarta',
    s1: certSettings.signer1Name,
    s1t: certSettings.signer1Title,
    s2: certSettings.enableSigner2 ? certSettings.signer2Name : '',
    s2t: certSettings.enableSigner2 ? certSettings.signer2Title : '',
  });
  return `${baseUrl}?${params.toString()}`;
}

export interface ParsedCertScanPayload {
  isExplicitCertificateQr: boolean;
  participantId?: string;
  workshopId?: string;
  certNumber?: string;
  seqNumber?: number;
  rawQuery: string;
  urlFallback?: {
    participant: Participant;
    config: WorkshopConfig;
    certificateSettings: CertificateSettings;
    certNumber: string;
  };
}

/**
 * Parses any scanned QR string, URL, Certificate Number (e.g. 001/SERT-HY/MHJ/2026),
 * or Participant ID (e.g. HY-001).
 */
export function parseScannedCertificatePayload(rawInput: string): ParsedCertScanPayload {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { isExplicitCertificateQr: false, rawQuery: '' };
  }

  // 1. Check if it's a URL containing ?verify_cert=... or ?ticket=...
  if (trimmed.includes('verify_cert=') || /^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(
        trimmed.startsWith('http')
          ? trimmed
          : `https://healyou.local/${trimmed.replace(/^\?/, '?')}`
      );
      const verifyCertId = url.searchParams.get('verify_cert');
      if (verifyCertId) {
        const wId = url.searchParams.get('w') || undefined;
        const certNo = url.searchParams.get('no') || undefined;
        const seqMatch = certNo ? certNo.match(/^0*(\d+)/) : null;
        const seqNum = seqMatch ? parseInt(seqMatch[1], 10) : undefined;

        let urlFallback: ParsedCertScanPayload['urlFallback'] | undefined;
        const fallbackName = url.searchParams.get('name');
        if (fallbackName) {
          const statusParam = url.searchParams.get('status');
          const status =
            statusParam === 'PRESENT' || statusParam === 'LATE' || statusParam === 'PENDING'
              ? statusParam
              : 'PRESENT';
          const s2Name = url.searchParams.get('s2') || '';
          urlFallback = {
            certNumber: certNo || `001${DEFAULT_CERT_SETTINGS.numberSuffix}`,
            participant: {
              id: verifyCertId.toUpperCase(),
              name: fallbackName,
              role: url.searchParams.get('role') || 'Peserta Workshop',
              institution: url.searchParams.get('inst') || '-',
              email: '-',
              status,
              checkInTime: url.searchParams.get('checkin') || undefined,
            },
            config: {
              name: url.searchParams.get('event') || 'Workshop Psikologi Heal You',
              date: url.searchParams.get('date') || new Date().toISOString().split('T')[0],
              startTime: new Date().toISOString(),
              location: url.searchParams.get('loc') || 'Jakarta',
              organizer: url.searchParams.get('org') || 'Muslimah Healing Journey',
            },
            certificateSettings: normalizeCertificateSettings({
              city: url.searchParams.get('city') || 'Jakarta',
              signer1Name: url.searchParams.get('s1') || DEFAULT_CERT_SETTINGS.signer1Name,
              signer1Title: url.searchParams.get('s1t') || DEFAULT_CERT_SETTINGS.signer1Title,
              enableSigner2: Boolean(s2Name),
              signer2Name: s2Name || DEFAULT_CERT_SETTINGS.signer2Name,
              signer2Title: url.searchParams.get('s2t') || DEFAULT_CERT_SETTINGS.signer2Title,
            }),
          };
        }

        return {
          isExplicitCertificateQr: true,
          participantId: verifyCertId.trim().toUpperCase(),
          workshopId: wId,
          certNumber: certNo,
          seqNumber: seqNum,
          rawQuery: verifyCertId.trim().toUpperCase(),
          urlFallback,
        };
      }

      const ticketId = url.searchParams.get('ticket');
      if (ticketId) {
        return {
          isExplicitCertificateQr: false,
          participantId: ticketId.trim().toUpperCase(),
          rawQuery: ticketId.trim().toUpperCase(),
        };
      }
    } catch {
      // Fall through to pattern matching
    }
  }

  // 2. Check if it starts with CERT: prefix
  if (/^CERT:/i.test(trimmed)) {
    const cleanId = trimmed.replace(/^CERT:/i, '').trim().toUpperCase();
    return {
      isExplicitCertificateQr: true,
      participantId: cleanId,
      rawQuery: cleanId,
    };
  }

  // 3. Check if it's a formatted Certificate Number like "No. 001/SERT-HY/MHJ/2026" or "001/SERT-HY/..."
  const certNoMatch = trimmed.match(/^(?:No\.?\s*)?0*(\d+)\s*\/([A-Za-z0-9\-_/]+)$/i);
  if (certNoMatch) {
    const seqNum = parseInt(certNoMatch[1], 10);
    return {
      isExplicitCertificateQr: true,
      certNumber: trimmed.replace(/^No\.?\s*/i, '').trim().toUpperCase(),
      seqNumber: !isNaN(seqNum) && seqNum > 0 ? seqNum : undefined,
      rawQuery: trimmed,
    };
  }

  // 4. Otherwise treat as Participant ID (e.g. HY-001) or Name search
  return {
    isExplicitCertificateQr: false,
    participantId: trimmed.toUpperCase(),
    rawQuery: trimmed,
  };
}

/**
 * Checks window.location.search on initial page load to see if the user opened a
 * ?verify_cert=... link directly from an external QR scanner.
 */
export function parseCertificateVerificationFromUrl(): ParsedCertScanPayload | null {
  if (typeof window === 'undefined') return null;
  if (!window.location.search.includes('verify_cert=')) return null;
  const parsed = parseScannedCertificatePayload(window.location.href);
  return parsed.isExplicitCertificateQr ? parsed : null;
}

/**
 * Resolves a scanned or typed query against the active workshop (and all other workshop sessions).
 */
export function verifyCertificateQuery(params: {
  rawInput: string;
  activeWorkshopId: string;
  activeConfig: WorkshopConfig;
  activeParticipants: Participant[];
  activeCertSettings: CertificateSettings;
  eventsList: WorkshopEventItem[];
  allLocalParticlesMap?: Record<string, Participant[]>;
}): VerifiedCertificateResult {
  const {
    rawInput,
    activeWorkshopId,
    activeConfig,
    activeParticipants,
    activeCertSettings,
    eventsList,
  } = params;

  const parsed = parseScannedCertificatePayload(rawInput);
  const nowIso = new Date().toISOString();

  const matchInList = (
    list: Participant[],
    certSettings: CertificateSettings
  ): { participant: Participant; seqIndex: number } | null => {
    const attendedList = list.filter((p) => p.status === 'PRESENT' || p.status === 'LATE');

    // 1. Match by exact Participant ID
    if (parsed.participantId) {
      const targetId = parsed.participantId.toUpperCase();
      const found = list.find(
        (p) =>
          p.id.toUpperCase() === targetId ||
          p.id.replace(/^PSY-/i, 'HY-').toUpperCase() === targetId.replace(/^PSY-/i, 'HY-')
      );
      if (found) {
        const idxInAttended = attendedList.findIndex((p) => p.id === found.id);
        const idxInAll = list.findIndex((p) => p.id === found.id);
        const seqIndex = idxInAttended >= 0 ? idxInAttended : Math.max(0, idxInAll);
        return { participant: found, seqIndex };
      }
    }

    // 2. Match by Certificate Sequence Number (e.g. 001/SERT-HY/MHJ/2026 -> index 0)
    if (parsed.seqNumber !== undefined && parsed.seqNumber >= 1) {
      const idx = parsed.seqNumber - 1;
      if (attendedList[idx]) {
        return { participant: attendedList[idx], seqIndex: idx };
      }
      if (list[idx]) {
        return { participant: list[idx], seqIndex: idx };
      }
      // Also check if HY-00X matches
      const candidateId = `HY-${String(parsed.seqNumber).padStart(3, '0')}`;
      const byCandidate = list.find((p) => p.id.toUpperCase() === candidateId);
      if (byCandidate) {
        return { participant: byCandidate, seqIndex: idx };
      }
    }

    // 3. Match by exact or partial Participant Name (if length >= 3)
    const cleanQ = parsed.rawQuery.trim().toLowerCase();
    if (cleanQ.length >= 3) {
      const exactName = list.find((p) => p.name.trim().toLowerCase() === cleanQ);
      if (exactName) {
        const idxInAttended = attendedList.findIndex((p) => p.id === exactName.id);
        const idxInAll = list.findIndex((p) => p.id === exactName.id);
        return {
          participant: exactName,
          seqIndex: idxInAttended >= 0 ? idxInAttended : Math.max(0, idxInAll),
        };
      }
      const partialName = list.find((p) => p.name.toLowerCase().includes(cleanQ));
      if (partialName) {
        const idxInAttended = attendedList.findIndex((p) => p.id === partialName.id);
        const idxInAll = list.findIndex((p) => p.id === partialName.id);
        return {
          participant: partialName,
          seqIndex: idxInAttended >= 0 ? idxInAttended : Math.max(0, idxInAll),
        };
      }
    }

    void certSettings;
    return null;
  };

  // Check active workshop first (unless workshopId specifically points to another event)
  const activeMatch = matchInList(activeParticipants, activeCertSettings);
  if (activeMatch && (!parsed.workshopId || parsed.workshopId === activeWorkshopId)) {
    const suffix = activeCertSettings.numberSuffix || DEFAULT_CERT_SETTINGS.numberSuffix;
    const certNumber =
      parsed.certNumber ||
      `${String(activeMatch.seqIndex + 1).padStart(3, '0')}${suffix}`;
    return {
      isValidFound: true,
      isAttended:
        activeMatch.participant.status === 'PRESENT' ||
        activeMatch.participant.status === 'LATE',
      queryCode: parsed.rawQuery,
      certificateNumber: certNumber,
      seqIndex: activeMatch.seqIndex,
      participant: activeMatch.participant,
      workshopId: activeWorkshopId,
      config: activeConfig,
      certificateSettings: activeCertSettings,
      verifiedAtIso: nowIso,
      source: 'ACTIVE_EVENT',
    };
  }

  // Check stored sessions in localStorage if available
  try {
    const savedSessionsRaw = localStorage.getItem('workshop_sessions_v1');
    if (savedSessionsRaw) {
      const sessionsMap = JSON.parse(savedSessionsRaw) as Record<
        string,
        {
          workshopId: string;
          config: WorkshopConfig;
          participants: Participant[];
          certificateSettings?: CertificateSettings;
        }
      >;
      // Prioritize target workshopId if specified in QR URL
      const orderedIds = Object.keys(sessionsMap).sort((a, b) =>
        a === parsed.workshopId ? -1 : b === parsed.workshopId ? 1 : 0
      );
      for (const wId of orderedIds) {
        const sess = sessionsMap[wId];
        if (!sess || !Array.isArray(sess.participants)) continue;
        const sessCert = normalizeCertificateSettings(sess.certificateSettings);
        const m = matchInList(sess.participants, sessCert);
        if (m) {
          const suffix = sessCert.numberSuffix || DEFAULT_CERT_SETTINGS.numberSuffix;
          const certNumber =
            parsed.certNumber || `${String(m.seqIndex + 1).padStart(3, '0')}${suffix}`;
          return {
            isValidFound: true,
            isAttended:
              m.participant.status === 'PRESENT' || m.participant.status === 'LATE',
            queryCode: parsed.rawQuery,
            certificateNumber: certNumber,
            seqIndex: m.seqIndex,
            participant: m.participant,
            workshopId: wId,
            config: sess.config,
            certificateSettings: sessCert,
            verifiedAtIso: nowIso,
            source: wId === activeWorkshopId ? 'ACTIVE_EVENT' : 'OTHER_EVENT',
          };
        }
      }
    }
  } catch {
    // Ignore storage read errors
  }

  // If activeMatch was found even though workshopId differed, return activeMatch
  if (activeMatch) {
    const suffix = activeCertSettings.numberSuffix || DEFAULT_CERT_SETTINGS.numberSuffix;
    const certNumber =
      parsed.certNumber ||
      `${String(activeMatch.seqIndex + 1).padStart(3, '0')}${suffix}`;
    return {
      isValidFound: true,
      isAttended:
        activeMatch.participant.status === 'PRESENT' ||
        activeMatch.participant.status === 'LATE',
      queryCode: parsed.rawQuery,
      certificateNumber: certNumber,
      seqIndex: activeMatch.seqIndex,
      participant: activeMatch.participant,
      workshopId: activeWorkshopId,
      config: activeConfig,
      certificateSettings: activeCertSettings,
      verifiedAtIso: nowIso,
      source: 'ACTIVE_EVENT',
    };
  }

  // Fallback to URL-embedded verification metadata if scanned from a shared verification link
  if (parsed.urlFallback) {
    return {
      isValidFound: true,
      isAttended:
        parsed.urlFallback.participant.status === 'PRESENT' ||
        parsed.urlFallback.participant.status === 'LATE',
      queryCode: parsed.rawQuery,
      certificateNumber: parsed.urlFallback.certNumber,
      seqIndex: (parsed.seqNumber || 1) - 1,
      participant: parsed.urlFallback.participant,
      workshopId: parsed.workshopId || activeWorkshopId,
      config: parsed.urlFallback.config,
      certificateSettings: parsed.urlFallback.certificateSettings,
      verifiedAtIso: nowIso,
      source: 'URL_EMBEDDED',
    };
  }

  void eventsList;

  // Not found
  return {
    isValidFound: false,
    isAttended: false,
    queryCode: parsed.rawQuery || rawInput,
    certificateNumber: parsed.certNumber || '-',
    seqIndex: 0,
    workshopId: activeWorkshopId,
    config: activeConfig,
    certificateSettings: activeCertSettings,
    verifiedAtIso: nowIso,
    source: 'NOT_FOUND',
  };
}
