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
  Tv,
  QrCode,
  LayoutDashboard,
  UserPlus,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '../lib/utils';

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

  const handleSelectQuickAccount = (targetId: string, defaultPass = '') => {
    setErrorMsg(null);
    setIdentifier(targetId);
    setPassword(defaultPass);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!identifier.trim()) {
      setErrorMsg('Mohon masukkan Email Admin (paku.tanam@gmail.com) atau Username Panitia (Panitia 1–3).');
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
      className="min-h-screen flex flex-col justify-between font-sans text-slate-900 p-4 sm:p-6 lg:p-8"
      style={{
        background:
          'linear-gradient(145deg, #23143c 0%, #38225e 42%, #4f327d 78%, #2a1947 100%)',
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
            <p className="text-xs text-purple-200/85 mt-0.5">
              Sistem Manajemen Presensi, Scanner QR &amp; E-Sertifikat Workshop
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenPublicRegistration}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-400/35 transition-all cursor-pointer"
        >
          <UserPlus className="w-4 h-4 text-emerald-300" />
          <span>Halaman Pendaftaran Peserta (Tanpa Login)</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Center Login Card Grid */}
      <div className="w-full max-w-5xl mx-auto my-8 grid grid-cols-1 lg:grid-cols-12 bg-white rounded-3xl shadow-2xl border border-purple-200/40 overflow-hidden">
        {/* Left Column: Brand & Access Control Policy */}
        <div
          className="lg:col-span-5 p-6 sm:p-8 flex flex-col justify-between text-white relative overflow-hidden"
          style={{
            background:
              'linear-gradient(160deg, #351f5c 0%, #4c327a 55%, #2b1847 100%)',
          }}
        >
          <div className="space-y-5 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-semibold text-purple-100">
              <ShieldCheck className="w-4 h-4 text-amber-300" />
              <span>Akses Terproteksi · Khusus Admin &amp; Panitia</span>
            </div>

            <div>
              <h2
                className="text-2xl sm:text-3xl font-bold leading-tight text-white"
                style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
              >
                Portal Login Manajemen Workshop
              </h2>
              <p className="text-xs sm:text-sm text-purple-100/85 mt-2 leading-relaxed">
                Acara Aktif: <strong className="text-white">{config.name}</strong>. Hanya akun resmi
                yang terdaftar di bawah ini yang diizinkan mengakses sistem:
              </p>
            </div>

            {/* Role Matrix */}
            <div className="space-y-3 pt-1">
              <div className="p-3.5 rounded-2xl bg-white/10 border border-white/15 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    1. Admin Utama (Akses Penuh)
                  </span>
                  <span className="text-[11px] font-mono bg-amber-400/20 text-amber-200 px-2 py-0.5 rounded-md">
                    Full Access
                  </span>
                </div>
                <p className="text-xs font-mono text-white font-semibold">
                  paku.tanam@gmail.com
                </p>
                <p className="text-[11px] text-purple-200/90 leading-relaxed">
                  Akses semua menu: Dashboard Kehadiran, Scanner QR,Verifikasi Sertifikat, Layar TV,
                  Kartu Pengenal &amp; Buat QR, Studio E-Sertifikat, Evaluasi, &amp; Pengaturan Acara.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/10 border border-white/15 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 shrink-0" />
                    2. Akun Panitia 1 – 3
                  </span>
                  <span className="text-[11px] font-mono bg-emerald-400/20 text-emerald-200 px-2 py-0.5 rounded-md">
                    Pass: 12345678
                  </span>
                </div>
                <p className="text-xs font-mono text-white font-semibold">
                  Panitia 1 · Panitia 2 · Panitia 3
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-purple-100">
                  <span className="inline-flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded-md">
                    <LayoutDashboard className="w-3 h-3 text-emerald-300" />
                    Dashboard Kehadiran
                  </span>
                  <span className="inline-flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded-md">
                    <QrCode className="w-3 h-3 text-emerald-300" />
                    Scanner QR
                  </span>
                  <span className="inline-flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded-md">
                    <Tv className="w-3 h-3 text-emerald-300" />
                    Layar TV
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Public Participant Portal Callout */}
          <div className="mt-6 pt-4 border-t border-white/15 relative z-10">
            <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-400/30 space-y-2">
              <p className="text-xs font-bold text-emerald-200">
                Peserta Workshop? Tidak Perlu Login!
              </p>
              <p className="text-[11px] text-emerald-100/85 leading-relaxed">
                Halaman Pendaftaran Mandiri &amp; Klaim E-Sertifikat dapat diakses langsung oleh
                seluruh peserta tanpa login.
              </p>
              <button
                type="button"
                onClick={onOpenPublicRegistration}
                className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Buka Formulir Pendaftaran Peserta</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Login Form */}
        <div className="lg:col-span-7 p-6 sm:p-8 lg:p-10 flex flex-col justify-center bg-white">
          <div className="max-w-md mx-auto w-full space-y-5">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#5e438f]">
                Otentikasi Sistem
              </span>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
                Masuk ke Web Presensi Heal You
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Pilih akun cepat di bawah atau ketik kredensial Admin / Panitia 1–3 Anda:
              </p>
            </div>

            {/* Quick Account Selector Buttons */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-500 block">
                Pilih Cepat Akun Resmi:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectQuickAccount('paku.tanam@gmail.com', '')}
                  className={cn(
                    'py-2 px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1',
                    isAdminIdentifier
                      ? 'bg-[#5e438f] text-white border-[#5e438f] shadow-2xs'
                      : 'bg-purple-50/70 hover:bg-purple-100/80 text-[#4c3575] border-purple-200'
                  )}
                >
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>Admin</span>
                </button>
                {(['Panitia 1', 'Panitia 2', 'Panitia 3'] as const).map((label) => {
                  const isSelected = identifier.trim().toLowerCase() === label.toLowerCase();
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => handleSelectQuickAccount(label, '12345678')}
                      className={cn(
                        'py-2 px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1',
                        isSelected
                          ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                          : 'bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-900 border-slate-200'
                      )}
                    >
                      <UserCheck className="w-3.5 h-3.5 shrink-0" />
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed font-medium">{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="login-identifier"
                  className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                >
                  Email Admin / Username Panitia
                </label>
                <div className="relative">
                  <UserCheck className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="login-identifier"
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => {
                      setIdentifier(e.target.value);
                      setErrorMsg(null);
                    }}
                    placeholder="paku.tanam@gmail.com atau Panitia 1 / Panitia 2 / Panitia 3"
                    className="w-full pl-10 pr-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/25 focus:border-[#5e438f] focus:bg-white transition-all"
                  />
                </div>
              </div>

              {!isAdminIdentifier ? (
                <div>
                  <label
                    htmlFor="login-password"
                    className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                  >
                    Password Panitia
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      required={!isAdminIdentifier}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setErrorMsg(null);
                      }}
                      placeholder="Masukkan password panitia (12345678)"
                      className="w-full pl-10 pr-10 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/25 focus:border-[#5e438f] focus:bg-white transition-all font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                      title={showPassword ? 'Sembunyikan Password' : 'Lihat Password'}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Email Admin utama terdeteksi (<strong>paku.tanam@gmail.com</strong>) — Akses
                    Penuh ke seluruh sistem.
                  </span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-5 rounded-xl font-bold text-sm text-white bg-[#5e438f] hover:bg-[#4c3575] shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <Lock className="w-4 h-4" />
                <span>
                  {isSubmitting
                    ? 'Memverifikasi Akses...'
                    : isAdminIdentifier
                      ? 'Masuk sebagai Admin (Akses Semua)'
                      : 'Masuk ke Sistem'}
                </span>
              </button>
            </form>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-200" />
              <span className="flex-shrink mx-3 text-[11px] font-semibold text-slate-400 uppercase">
                Atau OAuth Google Admin
              </span>
              <div className="flex-grow border-t border-slate-200" />
            </div>

            <button
              type="button"
              disabled={isSubmitting || isCloudSyncing}
              onClick={() => void handleGoogleAdminLogin()}
              className="w-full py-3 px-4 rounded-xl text-xs font-bold bg-purple-50 hover:bg-purple-100 text-[#4c3575] border border-purple-200 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <Cloud className="w-4 h-4 text-[#5e438f]" />
              <span>
                {isCloudSyncing
                  ? 'Menghubungkan Google Cloud...'
                  : 'Login Google Cloud (Khusus paku.tanam@gmail.com)'}
              </span>
            </button>

            <p className="text-[11px] text-center text-slate-400 leading-relaxed">
              Selain <strong>paku.tanam@gmail.com</strong> (Admin) dan <strong>Panitia 1–3</strong>{' '}
              tidak dapat login dan tidak dapat mengakses halaman manajemen ini.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="w-full max-w-5xl mx-auto text-center text-xs text-purple-200/70 pb-1">
        Heal You · Sistem Presensi &amp; E-Sertifikat Terintegrasi
      </div>
    </div>
  );
};
