import React, { useMemo, useState } from 'react';
import { Participant, WorkshopConfig } from '../types';
import { normalizeWhatsAppPhone, buildWhatsAppMessage } from '../lib/whatsapp';
import {
  MessageCircle,
  X,
  Check,
  Send,
  Copy,
  RotateCcw,
  Users,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { cn } from '../lib/utils';

interface WhatsAppBroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  participants: Participant[];
  config: WorkshopConfig;
}

type TargetFilter = 'ALL' | 'PENDING' | 'ATTENDED';

export const WhatsAppBroadcastModal: React.FC<WhatsAppBroadcastModalProps> = ({
  isOpen,
  onClose,
  participants,
  config,
}) => {
  const [targetFilter, setTargetFilter] = useState<TargetFilter>('ALL');
  const [sentIds, setSentIds] = useState<Record<string, boolean>>({});
  const [copiedNumbers, setCopiedNumbers] = useState(false);

  const recipients = useMemo(() => {
    return participants
      .filter((p) => {
        const cleanPhone = normalizeWhatsAppPhone(p.phone);
        if (!cleanPhone || cleanPhone.length < 9) return false;
        if (targetFilter === 'PENDING') return p.status === 'PENDING';
        if (targetFilter === 'ATTENDED') return p.status !== 'PENDING';
        return true;
      })
      .map((p) => ({
        participant: p,
        cleanPhone: normalizeWhatsAppPhone(p.phone),
      }));
  }, [participants, targetFilter]);

  const missingPhoneCount = useMemo(() => {
    return participants.filter((p) => {
      const cleanPhone = normalizeWhatsAppPhone(p.phone);
      return !cleanPhone || cleanPhone.length < 9;
    }).length;
  }, [participants]);

  const nextUnsent = useMemo(() => {
    return recipients.find((r) => !sentIds[r.participant.id]) || null;
  }, [recipients, sentIds]);

  const sentCount = useMemo(() => {
    return recipients.filter((r) => sentIds[r.participant.id]).length;
  }, [recipients, sentIds]);

  if (!isOpen) return null;

  const buildCustomWaUrl = (p: Participant, cleanPhone: string) => {
    const msg = buildWhatsAppMessage(p, config);
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
  };

  const handleCopyAllNumbers = async () => {
    const list = recipients.map((r) => r.cleanPhone).join(', ');
    if (!list) return;
    try {
      await navigator.clipboard.writeText(list);
      setCopiedNumbers(true);
      window.setTimeout(() => setCopiedNumbers(false), 2500);
    } catch {
      // Ignore
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-purple-100 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-4 bg-emerald-50/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                Asisten Broadcast WhatsApp Massal
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Kirim pesan tiket &amp; pengingat beruntun ke seluruh peserta yang memiliki nomor
                WA
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Banner & Filter Controls */}
        <div className="p-5 border-b border-slate-100 space-y-4">
          <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200/80 flex items-start gap-2.5 text-xs text-amber-900">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>Cara Kerja Anti-Blokir WhatsApp:</strong> Demi keamanan akun WhatsApp Anda
              agar tidak diblokir sebagai spam, gunakan tombol{' '}
              <strong>&ldquo;Kirim ke Peserta Berikutnya&rdquo;</strong> di bawah untuk membuka
              chat WA satu per satu secara berurutan dengan 1 klik.
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'ALL', label: 'Semua Nomor WA' },
                  { id: 'PENDING', label: 'Hanya Belum Hadir (Pengingat)' },
                  { id: 'ATTENDED', label: 'Sudah Hadir' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTargetFilter(tab.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer',
                    targetFilter === tab.id
                      ? 'bg-[#5e438f] text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleCopyAllNumbers()}
                disabled={recipients.length === 0}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
                title="Salin seluruh nomor WA yang terfilter"
              >
                {copiedNumbers ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    Nomor Tersalin!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Salin {recipients.length} Nomor
                  </>
                )}
              </button>
              {sentCount > 0 && (
                <button
                  type="button"
                  onClick={() => setSentIds({})}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-rose-600 bg-slate-100 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                  title="Ulangi status pengiriman dari awal"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Antrean
                </button>
              )}
            </div>
          </div>

          {/* Primary Sequential 1-Click Next Button */}
          {recipients.length > 0 && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                    Progres Antrean: {sentCount} / {recipients.length} Terkirim
                  </span>
                </div>
                <p className="text-xs text-emerald-900 mt-0.5">
                  {nextUnsent ? (
                    <>
                      Berikutnya: <strong>{nextUnsent.participant.name}</strong> (
                      <span className="font-mono">{nextUnsent.participant.id}</span> ·{' '}
                      {nextUnsent.participant.phone})
                    </>
                  ) : (
                    <strong>Seluruh peserta dalam daftar ini sudah dibuka chat WhatsApp-nya!</strong>
                  )}
                </p>
              </div>

              {nextUnsent ? (
                <a
                  href={buildCustomWaUrl(nextUnsent.participant, nextUnsent.cleanPhone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() =>
                    setSentIds((prev) => ({ ...prev, [nextUnsent.participant.id]: true }))
                  }
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition-colors cursor-pointer shrink-0"
                >
                  <Send className="w-4 h-4" />
                  Kirim ke Peserta Berikutnya ({sentCount + 1}/{recipients.length})
                </a>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold shrink-0">
                  <Check className="w-4 h-4" />
                  Selesai Semua
                </span>
              )}
            </div>
          )}
        </div>

        {/* Recipients Queue List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {recipients.length > 0 ? (
            recipients.map(({ participant: p, cleanPhone }, idx) => {
              const isSent = Boolean(sentIds[p.id]);
              return (
                <div
                  key={p.id}
                  className={cn(
                    'px-5 py-3 flex items-center justify-between gap-3 transition-colors',
                    isSent ? 'bg-emerald-50/30' : 'hover:bg-slate-50'
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900 truncate">{p.name}</p>
                        <span className="font-mono text-xs font-semibold text-[#5e438f] shrink-0">
                          {p.id}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                        WA: <span className="font-mono text-slate-700">{p.phone}</span> ·{' '}
                        {p.institution}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isSent && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                        <Check className="w-3 h-3" />
                        Sudah Dibuka
                      </span>
                    )}
                    <a
                      href={buildCustomWaUrl(p, cleanPhone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setSentIds((prev) => ({ ...prev, [p.id]: true }))}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer',
                        isSent
                          ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                      )}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      {isSent ? 'Kirim Ulang' : 'Kirim WA'}
                    </a>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-10 text-center text-slate-500">
              <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-700">
                Tidak ada peserta dengan nomor WhatsApp pada filter ini
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Pastikan kolom No. WhatsApp peserta sudah terisi (mis. 0812-xxxx-xxxx).
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3 text-xs text-slate-500">
          <span>
            {missingPhoneCount > 0
              ? `${missingPhoneCount} peserta belum memiliki nomor WhatsApp.`
              : 'Seluruh peserta telah memiliki nomor WhatsApp.'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
