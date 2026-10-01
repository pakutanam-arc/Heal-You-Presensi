import React, { useEffect, useRef, useState, useId } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Camera,
  CameraOff,
  Upload,
  Keyboard,
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCw,
  QrCode,
  Volume2,
  VolumeX,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Award,
  UserCheck,
  ExternalLink,
} from 'lucide-react';
import { useAppContext } from '../store';
import { cn } from '../lib/utils';
import { playScanBeep, isSoundEnabled, setSoundEnabledPref } from '../lib/sound';
import { motion, AnimatePresence } from 'motion/react';
import { Participant } from '../types';
import {
  parseCertificateQrOrInput,
  formatOfficialCertificateNumber,
  computeParticipantQrSignature,
} from '../lib/certificateRenderer';
import { decodeQrFromUploadedCardOrImage } from '../lib/qrSecurity';
import {
  resolveCertificateVerification,
  VerificationLookupResult,
} from './CertificateVerificationPanel';

type ScanMode = 'camera' | 'file' | 'manual';
export type ScannerPurpose = 'checkin' | 'verify_cert';

interface ScannerProps {
  scannerPurpose?: ScannerPurpose;
  onScannerPurposeChange?: (purpose: ScannerPurpose) => void;
  onVerifyCertificate?: (rawCodeOrId: string) => void;
}

export const Scanner: React.FC<ScannerProps> = ({
  scannerPurpose: controlledPurpose,
  onScannerPurposeChange,
  onVerifyCertificate,
}) => {
  const {
    checkIn,
    participants,
    certificateSettings,
    canVerifyPayment,
    verifyParticipantPayment,
    activeWorkshopId,
  } = useAppContext();
  const rawId = useId();
  const readerElementId = `qr-reader-${rawId.replace(/:/g, '')}`;

  const [internalPurpose, setInternalPurpose] = useState<ScannerPurpose>('checkin');
  const activePurpose = controlledPurpose ?? internalPurpose;

  const setPurpose = (next: ScannerPurpose) => {
    setInternalPurpose(next);
    onScannerPurposeChange?.(next);
  };

  const [mode, setMode] = useState<ScanMode>('camera');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [manualId, setManualId] = useState('');
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [soundOn, setSoundOn] = useState<boolean>(() => isSoundEnabled());

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabledPref(next);
    if (next) {
      playScanBeep('success');
    }
  };

  const [scanResult, setScanResult] = useState<{
    success: boolean;
    message: string;
    participant?: Participant;
  } | null>(null);

  const [certVerifyCard, setCertVerifyCard] = useState<VerificationLookupResult | null>(null);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const checkInRef = useRef(checkIn);
  const purposeRef = useRef(activePurpose);
  const participantsRef = useRef(participants);
  const certSuffixRef = useRef(certificateSettings.numberSuffix);
  const onVerifyCertRef = useRef(onVerifyCertificate);
  const onPurposeChangeRef = useRef(onScannerPurposeChange);
  const scanCooldownRef = useRef(false);
  const resultTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    checkInRef.current = checkIn;
  }, [checkIn]);

  useEffect(() => {
    purposeRef.current = activePurpose;
  }, [activePurpose]);

  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  useEffect(() => {
    certSuffixRef.current = certificateSettings.numberSuffix;
  }, [certificateSettings.numberSuffix]);

  useEffect(() => {
    onVerifyCertRef.current = onVerifyCertificate;
    onPurposeChangeRef.current = onScannerPurposeChange;
  }, [onVerifyCertificate, onScannerPurposeChange]);

  const handleDecodedInput = (decodedText: string, forceCertVerify = false) => {
    const cleanCode = decodedText.trim();
    if (!cleanCode) return;

    const parsed = parseCertificateQrOrInput(cleanCode);
    const shouldVerifyCert =
      forceCertVerify || parsed.isExplicitCert || purposeRef.current === 'verify_cert';

    if (shouldVerifyCert) {
      setInternalPurpose('verify_cert');
      onPurposeChangeRef.current?.('verify_cert');

      const lookup = resolveCertificateVerification(
        cleanCode,
        participantsRef.current,
        certSuffixRef.current,
        activeWorkshopId
      );
      setCertVerifyCard(lookup);
      setScanResult(null);
      onVerifyCertRef.current?.(cleanCode);

      if (lookup.participant) {
        if (lookup.participant.status === 'PRESENT' || lookup.participant.status === 'LATE') {
          playScanBeep('success');
        } else {
          playScanBeep('warning');
        }
      } else {
        playScanBeep('error');
      }

      if (resultTimeoutRef.current) {
        window.clearTimeout(resultTimeoutRef.current);
      }
      resultTimeoutRef.current = window.setTimeout(() => {
        scanCooldownRef.current = false;
      }, 1800);
      return;
    }

    // Standard Check-in Flow (pass cleanCode so store.checkIn validates signed QR signature)
    const result = checkInRef.current(cleanCode);
    setCertVerifyCard(null);
    setScanResult(result);

    if (result.success) {
      playScanBeep('success');
    } else if (result.message.includes('sudah melakukan check-in')) {
      playScanBeep('warning');
    } else {
      playScanBeep('error');
    }

    if (resultTimeoutRef.current) {
      window.clearTimeout(resultTimeoutRef.current);
    }
    resultTimeoutRef.current = window.setTimeout(() => {
      setScanResult(null);
      scanCooldownRef.current = false;
    }, 4000);
  };

  const stopCamera = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        html5QrCodeRef.current.clear();
      } catch {
        // Ignore stop errors during unmount
      }
    }
    setIsCameraActive(false);
  };

  const startCamera = async (cameraIdToUse?: string) => {
    setCameraError(null);
    setIsStartingCamera(true);

    try {
      await stopCamera();
      setIsStartingCamera(true);

      // Wait one frame so the reader container is visible in DOM with non-zero width before Html5Qrcode measures it
      await new Promise((resolve) => window.setTimeout(resolve, 60));

      const instance = new Html5Qrcode(readerElementId, false);
      html5QrCodeRef.current = instance;

      let detectedDevices: Array<{ id: string; label: string }> = [];
      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          detectedDevices = devices;
          setCameras(devices);
        }
      } catch {
        // Ignore if getCameras is not supported prior to getUserMedia
      }

      const qrConfig = {
        fps: 10,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdge = Math.min(viewfinderWidth || 260, viewfinderHeight || 260);
          const boxSize = Math.max(150, Math.min(220, Math.floor(minEdge * 0.75)));
          return { width: boxSize, height: boxSize };
        },
      };

      const onScanSuccess = (decodedText: string) => {
        if (scanCooldownRef.current) return;
        scanCooldownRef.current = true;
        handleDecodedInput(decodedText);
      };

      const onScanFailure = () => {
        // Ignore frame-by-frame scan misses
      };

      if (cameraIdToUse) {
        setSelectedCameraId(cameraIdToUse);
        await instance.start(cameraIdToUse, qrConfig, onScanSuccess, onScanFailure);
      } else if (detectedDevices.length > 0) {
        // Prefer back/environment camera if available on mobile, otherwise first camera (e.g. laptop webcam)
        const backCam = detectedDevices.find((d) =>
          /back|rear|environment|belakang/i.test(d.label)
        );
        const chosenId = backCam ? backCam.id : detectedDevices[0].id;
        setSelectedCameraId(chosenId);
        await instance.start(chosenId, qrConfig, onScanSuccess, onScanFailure);
      } else {
        try {
          await instance.start(
            { facingMode: 'environment' },
            qrConfig,
            onScanSuccess,
            onScanFailure
          );
        } catch {
          await instance.start({ facingMode: 'user' }, qrConfig, onScanSuccess, onScanFailure);
        }
      }

      setIsCameraActive(true);
    } catch {
      setIsCameraActive(false);
      setCameraError(
        'Kamera tidak dapat diakses. Pastikan izin kamera telah diberikan di browser Anda, atau gunakan tab "File QR" untuk memindai gambar Kartu QR / E-Sertifikat.'
      );
    } finally {
      setIsStartingCamera(false);
    }
  };

  useEffect(() => {
    return () => {
      if (resultTimeoutRef.current) {
        window.clearTimeout(resultTimeoutRef.current);
      }
      stopCamera();
    };
  }, []);

  const handleModeChange = async (newMode: ScanMode) => {
    if (newMode !== 'camera' && isCameraActive) {
      await stopCamera();
    }
    setCameraError(null);
    setMode(newMode);
  };

  // Helper to crop a specific region from an uploaded Kartu Tanda Pengenal or E-Certificate PNG
  const cropQrRegionFromPass = (
    file: File,
    region: { xRatio: number; yRatio: number; wRatio: number; hRatio: number }
  ): Promise<File> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }
        const sx = Math.max(0, img.width * region.xRatio);
        const sy = Math.max(0, img.height * region.yRatio);
        const sw = img.width * region.wRatio;
        const sh = img.height * region.hRatio;

        canvas.width = 400;
        canvas.height = 400;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 400, 400);
        ctx.drawImage(img, sx, sy, sw, sh, 20, 20, 360, 360);

        canvas.toBlob((blob) => {
          if (blob) {
            resolve(new File([blob], 'cropped-qr.png', { type: 'image/png' }));
          } else {
            reject(new Error('Blob creation failed'));
          }
        }, 'image/png');
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Image load failed'));
      };
      img.src = url;
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    setScanResult(null);
    const isCertFilename = /ESertifikat|Sertifikat/i.test(file.name);

    try {
      await stopCamera();
      const { decodedText } = await decodeQrFromUploadedCardOrImage(file, readerElementId);
      if (decodedText) {
        handleDecodedInput(decodedText, isCertFilename);
      } else {
        throw new Error('Unreadable QR');
      }
    } catch {
      playScanBeep('error');
      setScanResult({
        success: false,
        message:
          'Kode QR tidak terbaca dari gambar. Pastikan gambar jelas dan memuat QR Code Kartu Peserta atau E-Sertifikat yang valid.',
      });
    } finally {
      setIsProcessingFile(false);
      e.target.value = '';
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualId.trim()) return;
    handleDecodedInput(manualId.trim());
    setManualId('');
  };

  const pendingParticipants = participants.filter((p) => p.status === 'PENDING');
  const attendedParticipants = participants.filter(
    (p) => p.status === 'PRESENT' || p.status === 'LATE'
  );

  return (
    <div className="flex flex-col bg-white rounded-2xl shadow-xs border border-purple-100 overflow-hidden">
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {activePurpose === 'verify_cert'
                ? 'Scanner Verifikasi E-Sertifikat'
                : 'QR Scanner Presensi & Sertifikat'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {activePurpose === 'verify_cert'
                ? 'Pindai QR E-Sertifikat untuk cek keaslian & nomor seri'
                : 'Pindai Kartu QR presensi atau QR E-Sertifikat otomatis'}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={toggleSound}
              title={
                soundOn
                  ? 'Suara Beep Aktif (Klik untuk bisukan)'
                  : 'Suara Beep Nonaktif (Klik untuk aktifkan)'
              }
              className={cn(
                'h-9 px-2.5 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer',
                soundOn
                  ? 'bg-purple-50 border-purple-200 text-[#5e438f] hover:bg-purple-100'
                  : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200'
              )}
            >
              {soundOn ? (
                <>
                  <Volume2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Beep</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4" />
                  <span className="hidden sm:inline">Bisu</span>
                </>
              )}
            </button>
            <div
              className={cn(
                'h-9 w-9 rounded-xl flex items-center justify-center shrink-0',
                activePurpose === 'verify_cert'
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-purple-50 text-[#5e438f]'
              )}
            >
              {activePurpose === 'verify_cert' ? (
                <ShieldCheck className="w-4 h-4" />
              ) : (
                <QrCode className="w-4 h-4" />
              )}
            </div>
          </div>
        </div>

        {/* Primary Purpose Switcher: Presensi Check-in vs Verifikasi E-Sertifikat */}
        <div className="mt-3.5 grid grid-cols-2 gap-1.5 p-1 bg-slate-100 border border-slate-200/80 rounded-xl">
          <button
            type="button"
            onClick={() => {
              setPurpose('checkin');
              setCertVerifyCard(null);
            }}
            className={cn(
              'flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-semibold rounded-lg transition-all cursor-pointer',
              activePurpose === 'checkin'
                ? 'bg-[#5e438f] text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            <UserCheck className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Presensi Check-in</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setPurpose('verify_cert');
              setScanResult(null);
            }}
            className={cn(
              'flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-semibold rounded-lg transition-all cursor-pointer',
              activePurpose === 'verify_cert'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Verifikasi E-Sertifikat</span>
          </button>
        </div>

        {/* Input Method Switcher (Kamera / File QR / Input ID) */}
        <div className="mt-2.5 grid grid-cols-3 gap-1 p-1 bg-purple-50/70 border border-purple-100/80 rounded-xl">
          <button
            type="button"
            onClick={() => handleModeChange('camera')}
            className={cn(
              'flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer',
              mode === 'camera'
                ? 'bg-white text-[#2b1b47] shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            <Camera className="w-3.5 h-3.5 text-[#5e438f]" />
            Kamera
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('file')}
            className={cn(
              'flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer',
              mode === 'file'
                ? 'bg-white text-[#2b1b47] shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            <Upload className="w-3.5 h-3.5 text-[#5e438f]" />
            File QR
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('manual')}
            className={cn(
              'flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer',
              mode === 'manual'
                ? 'bg-white text-[#2b1b47] shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            <Keyboard className="w-3.5 h-3.5 text-[#5e438f]" />
            {activePurpose === 'verify_cert' ? 'Cek Nomor' : 'Input ID'}
          </button>
        </div>
      </div>

      <div className="p-5 flex flex-col relative">
        {/* Hidden or active reader container required by Html5Qrcode */}
        <div
          className={cn(
            'w-full max-w-xs mx-auto relative',
            (mode !== 'camera' || (!isCameraActive && !isStartingCamera)) && 'sr-only'
          )}
        >
          <div
            id={readerElementId}
            className={cn(
              'w-full overflow-hidden rounded-xl border border-purple-200 bg-slate-900 [&_video]:object-cover [&_video]:rounded-xl',
              !isCameraActive && !isStartingCamera && 'hidden'
            )}
          />
        </div>

        {/* CAMERA MODE UI */}
        {mode === 'camera' && (
          <div className="flex flex-col items-center justify-center text-center">
            {!isCameraActive ? (
              <div
                className={cn(
                  'w-full py-6 px-4 rounded-xl border border-dashed flex flex-col items-center',
                  activePurpose === 'verify_cert'
                    ? 'border-amber-300 bg-amber-50/30'
                    : 'border-purple-200 bg-purple-50/30'
                )}
              >
                <div
                  className={cn(
                    'w-12 h-12 rounded-full flex items-center justify-center mb-3',
                    activePurpose === 'verify_cert'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-purple-100/80 text-[#5e438f]'
                  )}
                >
                  {activePurpose === 'verify_cert' ? (
                    <ShieldCheck className="w-6 h-6" />
                  ) : (
                    <Camera className="w-6 h-6" />
                  )}
                </div>
                <p className="text-sm font-semibold text-slate-800">
                  {activePurpose === 'verify_cert'
                    ? 'Kamera Verifikasi Keaslian E-Sertifikat'
                    : 'Kamera Pemindai QR Presensi & Sertifikat'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {activePurpose === 'verify_cert'
                    ? 'Arahkan kamera ke QR Code di bagian tengah bawah E-Sertifikat untuk menguji keasliannya.'
                    : 'Aktifkan kamera untuk memindai Kartu QR peserta (atau QR E-Sertifikat secara otomatis).'}
                </p>

                {cameraError && (
                  <div className="mt-3 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 text-left">
                    {cameraError}
                  </div>
                )}

                <button
                  type="button"
                  disabled={isStartingCamera}
                  onClick={() => startCamera()}
                  className={cn(
                    'mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 disabled:opacity-60 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-2xs',
                    activePurpose === 'verify_cert'
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-[#5e438f] hover:bg-[#4c3575]'
                  )}
                >
                  {isStartingCamera ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Mengaktifkan Kamera...
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4" />
                      {activePurpose === 'verify_cert'
                        ? 'Aktifkan Kamera Verifikasi'
                        : 'Aktifkan Kamera Sekarang'}
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="w-full max-w-xs mx-auto mt-3 space-y-2.5">
                {cameras.length > 1 && (
                  <select
                    value={selectedCameraId}
                    onChange={(e) => {
                      setSelectedCameraId(e.target.value);
                      startCamera(e.target.value);
                    }}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
                  >
                    {cameras.map((cam, idx) => (
                      <option key={cam.id} value={cam.id}>
                        {cam.label || `Kamera ${idx + 1}`}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  onClick={stopCamera}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                >
                  <CameraOff className="w-3.5 h-3.5" />
                  Matikan Kamera
                </button>
              </div>
            )}
          </div>
        )}

        {/* FILE UPLOAD MODE UI */}
        {mode === 'file' && (
          <div className="flex flex-col items-center justify-center">
            <label
              className={cn(
                'w-full py-7 px-4 rounded-xl border-2 border-dashed transition-colors flex flex-col items-center text-center cursor-pointer',
                activePurpose === 'verify_cert'
                  ? 'border-amber-300 hover:border-amber-500 bg-amber-50/30 hover:bg-amber-50/60'
                  : 'border-purple-200 hover:border-purple-400 bg-purple-50/30 hover:bg-purple-50/60'
              )}
            >
              <div
                className={cn(
                  'w-12 h-12 rounded-full flex items-center justify-center mb-3',
                  activePurpose === 'verify_cert'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-purple-100/80 text-[#5e438f]'
                )}
              >
                <Upload className="w-5 h-5" />
              </div>
              <span className="text-sm font-semibold text-slate-800">
                {isProcessingFile
                  ? 'Memindai Gambar...'
                  : activePurpose === 'verify_cert'
                    ? 'Unggah File PNG E-Sertifikat / QR'
                    : 'Pilih Gambar Kartu QR / E-Sertifikat'}
              </span>
              <span className="text-xs text-slate-500 mt-1">
                {activePurpose === 'verify_cert'
                  ? 'Pilih file gambar E-Sertifikat (PNG/JPG) untuk memverifikasi keaslian QR Code & nomor serinya'
                  : 'Unggah file PNG Kartu QR (untuk check-in) atau PNG E-Sertifikat (untuk cek keaslian otomatis)'}
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={isProcessingFile}
                className="sr-only"
              />
            </label>
          </div>
        )}

        {/* MANUAL ID / CERTIFICATE NUMBER MODE UI */}
        {mode === 'manual' && (
          <div className="flex flex-col">
            <form onSubmit={handleManualSubmit} className="space-y-3">
              <div>
                <label
                  htmlFor="manual-id-input"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  {activePurpose === 'verify_cert'
                    ? 'Masukkan Nomor Seri Sertifikat atau ID Peserta'
                    : 'Masukkan ID Peserta'}
                </label>
                <div className="flex gap-2">
                  <input
                    id="manual-id-input"
                    type="text"
                    value={manualId}
                    onChange={(e) => setManualId(e.target.value)}
                    placeholder={
                      activePurpose === 'verify_cert'
                        ? 'Misal: No. 001/HY-001/... atau HY-001'
                        : 'Contoh: HY-001'
                    }
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm font-mono uppercase focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                  <button
                    type="submit"
                    className={cn(
                      'px-3.5 py-2 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shrink-0',
                      activePurpose === 'verify_cert'
                        ? 'bg-amber-600 hover:bg-amber-700'
                        : 'bg-[#5e438f] hover:bg-[#4c3575]'
                    )}
                  >
                    {activePurpose === 'verify_cert' ? 'Cek Asli' : 'Check-in'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Inline Certificate Verification Result Card (Immediate feedback inside Scanner) */}
        <AnimatePresence>
          {certVerifyCard && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className={cn(
                'mt-4 p-3.5 rounded-xl border space-y-2',
                certVerifyCard.participant
                  ? certVerifyCard.participant.status === 'PRESENT' ||
                    certVerifyCard.participant.status === 'LATE'
                    ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                    : 'bg-amber-50/90 border-amber-300 text-amber-950'
                  : 'bg-rose-50/90 border-rose-300 text-rose-950'
              )}
            >
              <div className="flex items-start gap-2.5">
                {certVerifyCard.participant ? (
                  certVerifyCard.participant.status === 'PRESENT' ||
                  certVerifyCard.participant.status === 'LATE' ? (
                    <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  )
                ) : (
                  <ShieldX className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white/80">
                      {certVerifyCard.participant
                        ? certVerifyCard.participant.status === 'PRESENT' ||
                          certVerifyCard.participant.status === 'LATE'
                          ? 'SERTIFIKAT ASLI & SAH'
                          : 'TERDAFTAR (BELUM CHECK-IN)'
                        : 'SERTIFIKAT TIDAK DITEMUKAN'}
                    </span>
                  </div>

                  {certVerifyCard.participant ? (
                    <>
                      <p className="text-xs sm:text-sm font-bold mt-1 truncate">
                        {certVerifyCard.participant.name}
                      </p>
                      <p className="text-[11px] font-mono font-semibold opacity-90 truncate">
                        {certVerifyCard.certNumber}
                      </p>
                      <p className="text-[11px] opacity-80 truncate">
                        {certVerifyCard.participant.institution} · Penandatangan:{' '}
                        {certificateSettings.signer1Name}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs mt-1">
                      Kode <strong>{certVerifyCard.query}</strong> tidak terdaftar pada acara ini.
                    </p>
                  )}
                </div>
              </div>

              {onVerifyCertificate && (
                <button
                  type="button"
                  onClick={() => onVerifyCertificate(certVerifyCard.query)}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/90 hover:bg-white text-[#4c3575] border border-purple-200 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Lihat Halaman Verifikasi Penuh</span>
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Standard Attendance Check-in Result Notification Toast */}
        <AnimatePresence>
          {scanResult && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className={cn(
                'mt-4 p-3.5 rounded-xl flex flex-col gap-2 border',
                scanResult.success
                  ? scanResult.participant?.status === 'LATE'
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              )}
            >
              <div className="flex items-start gap-3">
                {scanResult.success ? (
                  scanResult.participant?.status === 'LATE' ? (
                    <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  )
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                )}

                <div className="min-w-0 flex-1">
                  <p className="font-medium text-xs sm:text-sm leading-snug">
                    {scanResult.message}
                  </p>
                  {scanResult.participant && (
                    <div className="mt-1.5 space-y-1.5">
                      <p className="text-xs opacity-85 truncate font-mono">
                        ID: {scanResult.participant.id} · SIG:
                        {computeParticipantQrSignature(scanResult.participant.id)} ·{' '}
                        {formatOfficialCertificateNumber(
                          scanResult.participant.id,
                          participants,
                          certificateSettings.numberSuffix
                        )}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {!scanResult.success &&
                          scanResult.participant.paymentVerified === false &&
                          canVerifyPayment && (
                            <button
                              type="button"
                              onClick={() => {
                                const pid = scanResult.participant!.id;
                                verifyParticipantPayment(pid, true);
                                window.setTimeout(() => {
                                  handleDecodedInput(pid, false);
                                }, 50);
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-colors cursor-pointer shadow-2xs"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>ACC Pembayaran &amp; Check-in Sekarang</span>
                            </button>
                          )}
                        <button
                          type="button"
                          onClick={() => handleDecodedInput(scanResult.participant!.id, true)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/90 hover:bg-white text-[#4c3575] border border-purple-200 text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          <Award className="w-3.5 h-3.5 text-amber-600" />
                          <span>Buka E-Sertifikat Terhubung</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick List Below Scanner: Adjusts to Check-in vs Certificate Verification Mode */}
        {activePurpose === 'verify_cert' ? (
          participants.length > 0 && (
            <div className="mt-4 pt-3.5 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <Award className="w-3.5 h-3.5 text-amber-600" />
                  Pilih Cepat Uji Verifikasi ({attendedParticipants.length} Hadir /{' '}
                  {participants.length} Total)
                </span>
              </div>
              <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-xl bg-slate-50/50">
                {participants.map((p) => {
                  const isAttended = p.status === 'PRESENT' || p.status === 'LATE';
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleDecodedInput(p.id, true)}
                      className="w-full px-3 py-2 text-left hover:bg-amber-50/70 flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{p.name}</p>
                        <p className="text-[11px] text-slate-500 truncate">{p.institution}</p>
                      </div>
                      <span
                        className={cn(
                          'font-mono font-semibold px-2 py-0.5 rounded border shrink-0 text-[11px]',
                          isAttended
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-white text-slate-600 border-slate-200'
                        )}
                      >
                        {p.id}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )
        ) : (
          pendingParticipants.length > 0 && (
            <div className="mt-4 pt-3.5 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-600">
                  Check-in Cepat ({pendingParticipants.length} Belum Hadir)
                </span>
                <span className="text-[11px] text-[#5e438f] font-medium">Klik untuk hadir</span>
              </div>
              <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-xl bg-slate-50/50">
                {pendingParticipants.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleDecodedInput(p.id, false)}
                    className="w-full px-3 py-2 text-left hover:bg-purple-50/70 flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{p.name}</p>
                      <p className="text-[11px] text-slate-500 truncate">{p.institution}</p>
                    </div>
                    <span className="font-mono font-semibold text-[#5e438f] bg-white px-2 py-0.5 rounded border border-purple-100 shrink-0">
                      {p.id}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )
        )}

        <div className="mt-4 pt-3 border-t border-slate-100 text-center text-xs text-slate-400">
          {activePurpose === 'verify_cert'
            ? 'Pindai QR pada E-Sertifikat untuk menampilkan halaman verifikasi keaslian resmi.'
            : 'Arahkan Kartu QR untuk check-in, atau pindai QR E-Sertifikat untuk verifikasi otomatis.'}
        </div>
      </div>
    </div>
  );
};
