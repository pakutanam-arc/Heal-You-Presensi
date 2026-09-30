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
} from 'lucide-react';
import { useAppContext } from '../store';
import { cn } from '../lib/utils';
import { playScanBeep, isSoundEnabled, setSoundEnabledPref } from '../lib/sound';
import { motion, AnimatePresence } from 'motion/react';
import { Participant } from '../types';

type ScanMode = 'camera' | 'file' | 'manual';

export const Scanner: React.FC = () => {
  const { checkIn, participants } = useAppContext();
  const rawId = useId();
  const readerElementId = `qr-reader-${rawId.replace(/:/g, '')}`;

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

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const checkInRef = useRef(checkIn);
  const scanCooldownRef = useRef(false);
  const resultTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    checkInRef.current = checkIn;
  }, [checkIn]);

  const triggerCheckIn = (decodedText: string) => {
    const cleanCode = decodedText.trim();
    if (!cleanCode) return;

    const result = checkInRef.current(cleanCode);
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
    }, 3500);
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
        triggerCheckIn(decodedText);
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
        'Kamera tidak dapat diakses. Pastikan izin kamera telah diberikan di browser Anda, atau gunakan tab "File QR" untuk memindai gambar Kartu QR.'
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

  // Helper to crop a specific region from an uploaded Kartu Tanda Pengenal PNG
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

    try {
      await stopCamera();
      const instance = new Html5Qrcode(readerElementId, false);
      html5QrCodeRef.current = instance;

      try {
        const decodedText = await instance.scanFile(file, false);
        triggerCheckIn(decodedText);
      } catch {
        try {
          // Retry with exact QR medallion region from the 1:1 Web Preview Heal You ID Card
          const idCardCrop = await cropQrRegionFromPass(file, {
            xRatio: 0.25,
            yRatio: 0.5,
            wRatio: 0.5,
            hRatio: 0.36,
          });
          const decodedText = await instance.scanFile(idCardCrop, false);
          triggerCheckIn(decodedText);
        } catch {
          try {
            // Fallback wider crop
            const centerCrop = await cropQrRegionFromPass(file, {
              xRatio: 0.2,
              yRatio: 0.45,
              wRatio: 0.6,
              hRatio: 0.48,
            });
            const decodedText = await instance.scanFile(centerCrop, false);
            triggerCheckIn(decodedText);
          } catch {
            // Check if the uploaded file is an official downloaded IDCard_HealYou_<ID>_*.png
            const nameMatch = file.name.match(/IDCard_HealYou_([A-Za-z0-9-]+?)_/i);
            if (nameMatch && nameMatch[1]) {
              triggerCheckIn(nameMatch[1]);
            } else {
              throw new Error('Unreadable QR');
            }
          }
        }
      }
    } catch {
      playScanBeep('error');
      setScanResult({
        success: false,
        message: 'Kode QR tidak terbaca dari gambar. Pastikan gambar jelas dan memuat QR Code yang valid.',
      });
    } finally {
      setIsProcessingFile(false);
      e.target.value = '';
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualId.trim()) return;
    triggerCheckIn(manualId.trim().toUpperCase());
    setManualId('');
  };

  const pendingParticipants = participants.filter((p) => p.status === 'PENDING');

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-xs border border-purple-100 overflow-hidden">
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">QR Scanner Presensi</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pindai lewat kamera, gambar kartu QR, atau ID
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={toggleSound}
              title={soundOn ? 'Suara Beep Aktif (Klik untuk bisukan)' : 'Suara Beep Nonaktif (Klik untuk aktifkan)'}
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
            <div className="h-9 w-9 bg-purple-50 rounded-xl flex items-center justify-center text-[#5e438f] shrink-0">
              <QrCode className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="mt-4 grid grid-cols-3 gap-1 p-1 bg-purple-50/70 border border-purple-100/80 rounded-xl">
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
            Input ID
          </button>
        </div>
      </div>

      <div className="flex-1 p-5 flex flex-col justify-between relative">
        {/* Hidden or active reader container required by Html5Qrcode */}
        <div
          className={cn(
            'w-full max-w-xs mx-auto relative',
            mode !== 'camera' && 'sr-only'
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
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            {!isCameraActive ? (
              <div className="w-full max-w-xs mx-auto py-6 px-4 rounded-xl border border-dashed border-purple-200 bg-purple-50/30 flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-purple-100/80 text-[#5e438f] flex items-center justify-center mb-3">
                  <Camera className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-slate-800">
                  Kamera Pemindai QR
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Aktifkan kamera untuk memindai QR Code peserta secara langsung.
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
                  className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#5e438f] hover:bg-[#4c3575] disabled:opacity-60 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-2xs"
                >
                  {isStartingCamera ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Mengaktifkan Kamera...
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4" />
                      Aktifkan Kamera Sekarang
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
          <div className="flex-1 flex flex-col items-center justify-center">
            <label className="w-full max-w-xs mx-auto py-8 px-4 rounded-xl border-2 border-dashed border-purple-200 hover:border-purple-400 bg-purple-50/30 hover:bg-purple-50/60 transition-colors flex flex-col items-center text-center cursor-pointer">
              <div className="w-12 h-12 rounded-full bg-purple-100/80 text-[#5e438f] flex items-center justify-center mb-3">
                <Upload className="w-5 h-5" />
              </div>
              <span className="text-sm font-semibold text-slate-800">
                {isProcessingFile ? 'Memindai Gambar...' : 'Pilih Gambar / Kartu QR'}
              </span>
              <span className="text-xs text-slate-500 mt-1">
                Unggah file PNG Kartu QR yang diunduh dari menu Buat QR untuk check-in instan
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

        {/* MANUAL ID MODE UI */}
        {mode === 'manual' && (
          <div className="flex-1 flex flex-col justify-center">
            <form onSubmit={handleManualSubmit} className="space-y-3">
              <div>
                <label htmlFor="manual-id-input" className="block text-xs font-medium text-slate-700 mb-1">
                  Masukkan ID Peserta
                </label>
                <div className="flex gap-2">
                  <input
                    id="manual-id-input"
                    type="text"
                    value={manualId}
                    onChange={(e) => setManualId(e.target.value)}
                    placeholder="Contoh: HY-001"
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono uppercase focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#5e438f] hover:bg-[#4c3575] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shrink-0"
                  >
                    Check-in
                  </button>
                </div>
              </div>
            </form>

            {pendingParticipants.length > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-100">
                <p className="text-xs font-medium text-slate-500 mb-2">
                  Pilih Cepat Peserta Belum Check-in ({pendingParticipants.length}):
                </p>
                <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-lg">
                  {pendingParticipants.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => triggerCheckIn(p.id)}
                      className="w-full px-3 py-2 text-left hover:bg-purple-50/50 flex items-center justify-between text-xs transition-colors cursor-pointer"
                    >
                      <span className="font-medium text-slate-800 truncate pr-2">{p.name}</span>
                      <span className="font-mono font-semibold text-[#5e438f] shrink-0">{p.id}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Scan Result Notification Toast */}
        <AnimatePresence>
          {scanResult && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className={cn(
                'mt-4 p-3.5 rounded-xl flex items-start gap-3 border',
                scanResult.success
                  ? scanResult.participant?.status === 'LATE'
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              )}
            >
              {scanResult.success ? (
                scanResult.participant?.status === 'LATE' ? (
                  <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                )
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              )}

              <div className="min-w-0">
                <p className="font-medium text-xs sm:text-sm leading-snug">
                  {scanResult.message}
                </p>
                {scanResult.success && scanResult.participant && (
                  <p className="text-xs mt-0.5 opacity-80 truncate">
                    {scanResult.participant.id} · {scanResult.participant.institution}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-4 pt-3 border-t border-slate-100 text-center text-xs text-slate-400">
          Arahkan QR Code ke kamera atau unggah Kartu QR peserta untuk mencatat kehadiran otomatis.
        </div>
      </div>
    </div>
  );
};
