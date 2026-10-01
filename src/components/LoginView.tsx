import React, { useState } from 'react';
import { useAppContext, ADMIN_EMAIL } from '../store';
import { HealYouLogo } from './HealYouLogo';
import {
  Lock,
  UserCheck,
  ShieldCheck,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  Cloud,
  QrCode,
  UserPlus,
  KeyRound,
  CheckCircle2,
  Calendar,
  MapPin,
} from 'lucide-react';

interface LoginViewProps {
  onOpenPublicRegistration: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onOpenPublicRegistration }) => {
  const { config, loginWithCredentials, loginWithGoogleAdmin, isCloudSyncing } = useAppContext();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAdminIdentifier =
    identifier.trim().toLowerCase() === ADMIN_EMAIL ||
    identifier.trim().toLowerCase() === 'paku.tanam';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!identifier.trim()) {
      setErrorMsg('Mohon masukkan email atau username akun resmi Anda.');
      return;
    }

    if (!isAdminIdentifier && !password.trim()) {
      setErrorMsg('Mohon masukkan kata sandi akun Anda.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await loginWithCredentials(identifier, password);
      if (!res.success) {
        setErrorMsg(res.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleAdminLogin = async () => {
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const res = await loginWithGoogleAdmin();
      if (!res.success) {
        setErrorMsg(res.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col justify-between font-sans text-slate-900 p-4 sm:p-6 lg:p-10"
      style={{
        background:
          'linear-gradient(145deg, #1d1033 0%, #2e1b4f 45%, #3d2466 80%, #22133b 100%)',
      }}
    >
      {/* Top Bar */}
      <div className="w-full max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-3">
          <HealYouLogo
            customLogoUrl={config.customLogoUrl}
            size={42}
            className="rounded-xl shadow-md shrink-0"
          />
          <div>
            <h1
              className="text-xl sm:text-2xl font-bold text-white leading-none"
              style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
            >
              Heal You · {config.organizer || 'Muslimah Healing Journey'}
            </h1>
            <p className="text-xs text-purple-200/80 mt-0.5">
              Sistem Manajemen Presensi QR &amp; E-Sertifikat Resmi
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenPublicRegistration}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/15 text-white border border-white/20 transition-all cursor-pointer backdrop-blur-xs"
        >
          <UserPlus className="w-4 h-4 text-emerald-300" />
          <span>Portal Pendaftaran &amp; Sertifikat Peserta</span>
          <ArrowRight className="w-3.5 h-3.5 text-emerald-300" />
        </button>
      </div>

      {/* Center Standardized Login Card Grid */}
      <div className="w-full max-w-5xl mx-auto my-8 grid grid-cols-1 lg:grid-cols-12 bg-white rounded-3xl shadow-2xl border border-white/15 overflow-hidden">
        {/* Left Column (5/12): Executive Brand & Workshop Identity */}
        <div
          className="lg:col-span-5 p-7 sm:p-9 flex flex-col justify-between text-white relative overflow-hidden"
          style={{
            background:
              'linear-gradient(165deg, #2b184a 0%, #3f266b 55%, #23133d 100%)',
          }}
        >
          <div className="space-y-6 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-semibold uppercase tracking-wider text-purple-100">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-300" />
              <span>Portal Manajemen Internal</span>
            </div>

            <div>
              <h2
                className="text-2xl sm:text-3xl font-bold leading-tight text-white"
                style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
              >
                Sistem Administrasi &amp; Presensi Acara
              </h2>
              <p className="text-xs sm:text-sm text-purple-100/80 mt-2 leading-relaxed">
                Platform terpadu untuk pengelolaan kuota pendaftaran, verifikasi bukti pembayaran,
                pemindaian Barcode QR kehadiran, dan penerbitan E-Sertifikat.
              </p>
            </div>

            {/* Active Workshop Summary Card */}
            <div className="p-4 rounded-2xl bg-white/8 border border-white/15 space-y-2.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-300 block">
                Acara Aktif Saat Ini
              </span>
              <h3 className="text-sm font-bold text-white leading-snug">
                {config.name}
              </h3>
              <div className="space-y-1.5 pt-1 text-xs text-purple-100/85">
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                  <span>
                    {config.date}
                    {config.startTime ? ` · ${config.startTime}` : ''}
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 text-emerald-300 shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{config.location}</span>
                </div>
              </div>
            </div>

            {/* Security & Feature Pillars */}
            <div className="space-y-2.5 pt-1 text-xs text-purple-100/90">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Verifikasi &amp; persetujuan (ACC) bukti pembayaran peserta</span>
              </div>
              <div className="flex items-center gap-2.5">
                <QrCode className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Pemindaian Barcode QR terenkripsi &amp; layar sapaan langsung</span>
              </div>
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Sinkronisasi data kartu peserta &amp; nomor seri E-Sertifikat</span>
              </div>
            </div>
          </div>

          {/* Public Participant Portal Callout */}
          <div className="mt-8 pt-5 border-t border-white/15 relative z-10">
            <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-400/30 space-y-2.5">
              <p className="text-xs font-bold text-emerald-200">
                Peserta Workshop?
              </p>
              <p className="text-[11px] text-emerald-100/85 leading-relaxed">
                Peserta tidak perlu login pada halaman ini. Gunakan portal publik untuk mendaftar,
                mengunggah bukti transfer, atau mengunduh E-Sertifikat.
              </p>
              <button
                type="button"
                onClick={onOpenPublicRegistration}
                className="w-full py-2.5 px-3.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Buka Portal Peserta</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column (7/12): Standardized Professional Login Form */}
        <div className="lg:col-span-7 p-7 sm:p-10 lg:p-12 flex flex-col justify-center bg-white">
          <div className="max-w-md mx-auto w-full space-y-6">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#5e438f] block">
                Otentikasi Sistem
              </span>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">
                Masuk ke Panel Manajemen
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
                Masukkan kredensial akun resmi Anda untuk melanjutkan ke dashboard pengelolaan
                acara.
              </p>
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed font-medium">{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on">
              <div>
                <label
                  htmlFor="login-identifier"
                  className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                >
                  Email atau Username
                </label>
                <div className="relative">
                  <UserCheck className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="login-identifier"
                    name="username"
                    type="text"
                    required
                    autoComplete="username"
                    value={identifier}
                    onChange={(e) => {
                      setIdentifier(e.target.value);
                      setErrorMsg(null);
                    }}
                    placeholder="Masukkan email atau username"
                    className="w-full pl-10 pr-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/25 focus:border-[#5e438f] focus:bg-white transition-all text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                >
                  Kata Sandi
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErrorMsg(null);
                    }}
                    placeholder="Masukkan kata sandi"
                    className="w-full pl-10 pr-10 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/25 focus:border-[#5e438f] focus:bg-white transition-all text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                    title={showPassword ? 'Sembunyikan Kata Sandi' : 'Tampilkan Kata Sandi'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-5 rounded-xl font-bold text-sm text-white bg-[#2b184a] hover:bg-[#3f266b] shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 mt-2"
              >
                <Lock className="w-4 h-4" />
                <span>{isSubmitting ? 'Memverifikasi Kredensial...' : 'Masuk ke Sistem'}</span>
              </button>
            </form>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-200" />
              <span className="flex-shrink mx-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Atau Masuk Dengan
              </span>
              <div className="flex-grow border-t border-slate-200" />
            </div>

            <button
              type="button"
              disabled={isSubmitting || isCloudSyncing}
              onClick={() => void handleGoogleAdminLogin()}
              className="w-full py-3 px-4 rounded-xl text-xs font-bold bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200/90 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <Cloud className="w-4 h-4 text-[#5e438f]" />
              <span>
                {isCloudSyncing
                  ? 'Menghubungkan Layanan Google...'
                  : 'Otentikasi Akun Google (SSO)'}
              </span>
            </button>

            <p className="text-[11px] text-center text-slate-400 leading-relaxed pt-1">
              Akses dibatasi khusus bagi personel penyelenggara yang berwenang. Seluruh aktivitas
              presensi dan verifikasi tercatat secara otomatis.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="w-full max-w-5xl mx-auto text-center text-xs text-purple-200/60 pb-1">
        Heal You · Sistem Presensi &amp; E-Sertifikat Terintegrasi
      </div>
    </div>
  );
};
