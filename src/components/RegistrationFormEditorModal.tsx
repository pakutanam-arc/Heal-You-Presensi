import React, { useState } from 'react';
import {
  X,
  Save,
  RotateCcw,
  Sparkles,
  Calendar,
  ListChecks,
  HelpCircle,
  Link2,
  Check,
  Copy,
  CreditCard,
  KeyRound,
} from 'lucide-react';
import {
  RegistrationFormTemplate,
  DEFAULT_REGISTRATION_FORM_TEMPLATE,
  saveRegistrationTemplate,
  resetRegistrationTemplate,
  computePaymentAccessCode,
} from '../lib/registrationTemplate';
import { cn } from '../lib/utils';

interface RegistrationFormEditorModalProps {
  workshopId: string;
  initialTemplate: RegistrationFormTemplate;
  portalShareUrl: string;
  onClose: () => void;
  onSaved: (updated: RegistrationFormTemplate) => void;
  onCopyPortalLink?: () => void;
}

export function RegistrationFormEditorModal({
  workshopId,
  initialTemplate,
  portalShareUrl,
  onClose,
  onSaved,
  onCopyPortalLink,
}: RegistrationFormEditorModalProps) {
  const [activeSection, setActiveSection] = useState<'invitation' | 'core4' | 'questions'>(
    'invitation'
  );
  const [draft, setDraft] = useState<RegistrationFormTemplate>(() => ({
    ...initialTemplate,
    benefitItems: [...initialTemplate.benefitItems],
    q5FeelingOptions: [...initialTemplate.q5FeelingOptions],
    q6FollowOptions: [...initialTemplate.q6FollowOptions],
    q7WoundOptions: [...initialTemplate.q7WoundOptions],
    q10SupporterOptions: [...initialTemplate.q10SupporterOptions],
    q11CommitmentOptions: [...initialTemplate.q11CommitmentOptions],
  }));

  // Multi-line text representations for array options so Admin can edit lines effortlessly
  const [benefitsText, setBenefitsText] = useState(() =>
    initialTemplate.benefitItems.join('\n')
  );
  const [q5OptionsText, setQ5OptionsText] = useState(() =>
    initialTemplate.q5FeelingOptions.join('\n')
  );
  const [q6OptionsText, setQ6OptionsText] = useState(() =>
    initialTemplate.q6FollowOptions.join('\n')
  );
  const [q7OptionsText, setQ7OptionsText] = useState(() =>
    initialTemplate.q7WoundOptions.join('\n')
  );
  const [q10OptionsText, setQ10OptionsText] = useState(() =>
    initialTemplate.q10SupporterOptions.join('\n')
  );
  const [q11OptionsText, setQ11OptionsText] = useState(() =>
    initialTemplate.q11CommitmentOptions.join('\n')
  );

  const [savedNotice, setSavedNotice] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [samplePhoneForCode, setSamplePhoneForCode] = useState('081234567890');
  const [copiedSampleCode, setCopiedSampleCode] = useState(false);

  const parseLines = (text: string, fallback: string[]): string[] => {
    const lines = text
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    return lines.length > 0 ? lines : fallback;
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const finalTemplate: RegistrationFormTemplate = {
      ...draft,
      shareLinkSlug: (draft.shareLinkSlug || 'HealYou-Pendaftaran')
        .trim()
        .replace(/\s+/g, '-'),
      benefitItems: parseLines(
        benefitsText,
        DEFAULT_REGISTRATION_FORM_TEMPLATE.benefitItems
      ),
      q5FeelingOptions: parseLines(
        q5OptionsText,
        DEFAULT_REGISTRATION_FORM_TEMPLATE.q5FeelingOptions
      ),
      q6FollowOptions: parseLines(
        q6OptionsText,
        DEFAULT_REGISTRATION_FORM_TEMPLATE.q6FollowOptions
      ),
      q7WoundOptions: parseLines(
        q7OptionsText,
        DEFAULT_REGISTRATION_FORM_TEMPLATE.q7WoundOptions
      ),
      q10SupporterOptions: parseLines(
        q10OptionsText,
        DEFAULT_REGISTRATION_FORM_TEMPLATE.q10SupporterOptions
      ),
      q11CommitmentOptions: parseLines(
        q11OptionsText,
        DEFAULT_REGISTRATION_FORM_TEMPLATE.q11CommitmentOptions
      ),
    };

    const normalized = saveRegistrationTemplate(workshopId, finalTemplate);
    onSaved(normalized);
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 2500);
  };

  const handleResetDefault = () => {
    const fresh = resetRegistrationTemplate(workshopId);
    setDraft({ ...fresh });
    setBenefitsText(fresh.benefitItems.join('\n'));
    setQ5OptionsText(fresh.q5FeelingOptions.join('\n'));
    setQ6OptionsText(fresh.q6FollowOptions.join('\n'));
    setQ7OptionsText(fresh.q7WoundOptions.join('\n'));
    setQ10OptionsText(fresh.q10SupporterOptions.join('\n'));
    setQ11OptionsText(fresh.q11CommitmentOptions.join('\n'));
    onSaved(fresh);
  };

  const handleCopyUrl = () => {
    if (onCopyPortalLink) {
      onCopyPortalLink();
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(portalShareUrl);
    }
    setCopiedLink(true);
    window.setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-purple-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[#2b1b47] text-white flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-pink-400/20 border border-pink-300/30 flex items-center justify-center text-pink-200 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold truncate">
                Edit Undangan &amp; Formulir Pendaftaran Secara Keseluruhan
              </h2>
              <p className="text-xs text-purple-200/90 truncate">
                Sesuaikan teks undangan, Save the Date, Benefit, pertanyaan, rekening, dan nama link share
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-purple-100 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Share Link Name Bar ("HealYou-Pendaftaran") */}
        <div className="px-6 py-3 bg-purple-50 border-b border-purple-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold text-purple-950 inline-flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-purple-700" />
              Nama Link Share Formulir:
            </span>
            <input
              type="text"
              value={draft.shareLinkSlug}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, shareLinkSlug: e.target.value }))
              }
              placeholder="HealYou-Pendaftaran"
              className="px-2.5 py-1 rounded-lg bg-white border border-purple-200 font-mono font-bold text-purple-900 text-xs focus:outline-none focus:border-purple-600 w-48"
            />
            <span className="text-[11px] text-slate-500 font-mono truncate max-w-xs">
              ({portalShareUrl})
            </span>
          </div>

          <button
            type="button"
            onClick={handleCopyUrl}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-900 hover:bg-purple-950 text-white transition-colors cursor-pointer shrink-0"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-300" />
                <span>Tersalin: {draft.shareLinkSlug || 'HealYou-Pendaftaran'}</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Salin Link &ldquo;{draft.shareLinkSlug || 'HealYou-Pendaftaran'}&rdquo;</span>
              </>
            )}
          </button>
        </div>

        {/* Section Tabs */}
        <div className="px-6 pt-3 pb-2 bg-slate-50 border-b border-slate-200 flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveSection('invitation')}
            className={cn(
              'px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer',
              activeSection === 'invitation'
                ? 'bg-purple-900 text-white shadow-2xs'
                : 'bg-white text-slate-700 hover:bg-purple-50 border border-slate-200'
            )}
          >
            <Calendar className="w-3.5 h-3.5" />
            1. Kartu Undangan, Save the Date &amp; Benefit
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('core4')}
            className={cn(
              'px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer',
              activeSection === 'core4'
                ? 'bg-purple-900 text-white shadow-2xs'
                : 'bg-white text-slate-700 hover:bg-purple-50 border border-slate-200'
            )}
          >
            <ListChecks className="w-3.5 h-3.5" />
            2. Pertanyaan Utama (Sinkron Kartu &amp; Sertifikat)
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('questions')}
            className={cn(
              'px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer',
              activeSection === 'questions'
                ? 'bg-purple-900 text-white shadow-2xs'
                : 'bg-white text-slate-700 hover:bg-purple-50 border border-slate-200'
            )}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            3. Pertanyaan Healing, Rekening &amp; Komitmen (Q5–Q11)
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeSection === 'invitation' && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-pink-50/70 border border-pink-200/80 text-xs text-slate-700">
                <strong className="text-purple-950 block mb-0.5">
                  Bagian Kartu Undangan Atas &amp; Kuota Peserta:
                </strong>
                Di sini Anda dapat mengubah kapasitas kuota peserta (default 30), judul acara,
                sapaan pembuka, isi kotak <strong>Save the date</strong>, serta daftar{' '}
                <strong>Benefit yang kamu dapat</strong>.
              </div>

              {/* Participant Capacity / Quota Editor */}
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/90 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-emerald-950">
                      Kapasitas / Kuota Maksimal Peserta Workshop
                    </label>
                    <p className="text-[11px] text-emerald-800/90 mt-0.5">
                      Kuota terisi akan bertambah otomatis secara real-time saat pembayaran peserta
                      di-ACC Admin/Panitia.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={5000}
                      value={draft.participantQuota || 30}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setDraft((prev) => ({
                          ...prev,
                          participantQuota: Number.isFinite(val) && val >= 1 ? val : 1,
                        }));
                      }}
                      className="w-24 px-3 py-2 rounded-xl border border-emerald-300 bg-white text-sm font-mono font-bold text-emerald-950 text-center focus:outline-none focus:border-emerald-700"
                    />
                    <span className="text-xs font-bold text-emerald-900">Kursi</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] font-semibold text-emerald-800 mr-1">
                    Pilih Cepat Kuota:
                  </span>
                  {[10, 15, 20, 25, 30, 40, 50, 75, 100].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() =>
                        setDraft((prev) => ({
                          ...prev,
                          participantQuota: preset,
                        }))
                      }
                      className={cn(
                        'px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer border',
                        (draft.participantQuota || 30) === preset
                          ? 'bg-emerald-700 text-white border-emerald-700'
                          : 'bg-white text-emerald-900 border-emerald-200 hover:bg-emerald-100/70'
                      )}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Judul Undangan Acara
                  </label>
                  <input
                    type="text"
                    value={draft.invitationTitle}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, invitationTitle: e.target.value }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-purple-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Sapaan Pembuka
                  </label>
                  <input
                    type="text"
                    value={draft.greetingText}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, greetingText: e.target.value }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-purple-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Paragraf Pengantar 1
                </label>
                <input
                  type="text"
                  value={draft.introParagraph1}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, introParagraph1: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-purple-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Paragraf Pengantar 2 (Deskripsi Workshop)
                </label>
                <textarea
                  rows={3}
                  value={draft.introParagraph2}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, introParagraph2: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-purple-600"
                />
              </div>

              {/* Save the Date Box Editor */}
              <div className="p-4 rounded-2xl bg-pink-50/40 border border-pink-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-purple-950">
                    Kotak &ldquo;Save the date:&rdquo;
                  </h3>
                  <input
                    type="text"
                    value={draft.saveTheDateTitle}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, saveTheDateTitle: e.target.value }))
                    }
                    className="px-2.5 py-1 rounded-lg border border-pink-200 bg-white text-xs font-bold text-slate-900 w-44"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Baris Tanggal (beserta emoji)
                    </label>
                    <input
                      type="text"
                      value={draft.dateDisplay}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, dateDisplay: e.target.value }))
                      }
                      placeholder="🗓️ Sabtu, 10 Oktober 2026"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Baris Waktu / Jam
                    </label>
                    <input
                      type="text"
                      value={draft.timeDisplay}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, timeDisplay: e.target.value }))
                      }
                      placeholder="⏰ 13.00 – Selesai"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Baris Lokasi / Tempat Acara
                    </label>
                    <input
                      type="text"
                      value={draft.locationDisplay}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, locationDisplay: e.target.value }))
                      }
                      placeholder="📍 J Chicken Tole, Depok"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Baris Dresscode (kosongkan jika tidak ada)
                    </label>
                    <input
                      type="text"
                      value={draft.dresscodeDisplay}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, dresscodeDisplay: e.target.value }))
                      }
                      placeholder="👗 Dresscode: Soft pink / Cream / White"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Benefit Box Editor */}
              <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-200 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-purple-950">
                    Kotak &ldquo;Benefit yang kamu dapat:&rdquo;
                  </h3>
                  <input
                    type="text"
                    value={draft.benefitTitle}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, benefitTitle: e.target.value }))
                    }
                    className="px-2.5 py-1 rounded-lg border border-purple-200 bg-white text-xs font-bold text-slate-900 w-56"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Satu baris = satu item benefit. Anda bebas menambah, menghapus, atau mengubah emoji &amp; kalimat:
                </p>
                <textarea
                  rows={7}
                  value={benefitsText}
                  onChange={(e) => setBenefitsText(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:border-purple-600 font-sans leading-relaxed"
                />
              </div>

              {/* Closing & Quote */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Kalimat Ajakan Penutup Undangan
                  </label>
                  <input
                    type="text"
                    value={draft.closingCallout}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, closingCallout: e.target.value }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Kutipan / Quote Bawah (Italic)
                  </label>
                  <input
                    type="text"
                    value={draft.closingQuote}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, closingQuote: e.target.value }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900"
                  />
                </div>
              </div>
            </div>
          )}

          {activeSection === 'core4' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950">
                <strong className="block mb-0.5">
                  ✓ 4 Pertanyaan Inti (Tersinkronisasi Otomatis ke Kartu Pengenal QR &amp; E-Sertifikat):
                </strong>
                Anda dapat mengubah kalimat pertanyaan dan teks petunjuk (*placeholder*) di bawah ini. Jawaban peserta pada ke-4 pertanyaan ini akan tetap otomatis masuk ke Kartu Peserta dan E-Sertifikat.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-purple-800">
                    Pertanyaan 1 · Terhubung ke Nama Kartu &amp; Sertifikat
                  </span>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Teks Pertanyaan Nama
                    </label>
                    <input
                      type="text"
                      value={draft.q1NameLabel}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, q1NameLabel: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Placeholder Input
                    </label>
                    <input
                      type="text"
                      value={draft.q1NamePlaceholder}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, q1NamePlaceholder: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-700"
                    />
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-purple-800">
                    Pertanyaan 2 · Terhubung ke Kontak WhatsApp
                  </span>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Teks Pertanyaan No. WhatsApp
                    </label>
                    <input
                      type="text"
                      value={draft.q2PhoneLabel}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, q2PhoneLabel: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Placeholder Input
                    </label>
                    <input
                      type="text"
                      value={draft.q2PhonePlaceholder}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, q2PhonePlaceholder: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-700"
                    />
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-purple-800">
                    Pertanyaan 3 · Terhubung ke Kegiatan/Peran di Kartu &amp; Sertifikat
                  </span>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Teks Pertanyaan Pekerjaan / Kegiatan
                    </label>
                    <input
                      type="text"
                      value={draft.q3RoleLabel}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, q3RoleLabel: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Placeholder Input
                    </label>
                    <input
                      type="text"
                      value={draft.q3RolePlaceholder}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, q3RolePlaceholder: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-700"
                    />
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-purple-800">
                    Pertanyaan 4 · Terhubung ke Tempat Tinggal / Domisili di Kartu &amp; Sertifikat
                  </span>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Teks Pertanyaan Tempat Tinggal / Domisili
                    </label>
                    <input
                      type="text"
                      value={draft.q4DomicileLabel}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, q4DomicileLabel: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Placeholder Input
                    </label>
                    <input
                      type="text"
                      value={draft.q4DomicilePlaceholder}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          q4DomicilePlaceholder: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-700"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'questions' && (
            <div className="space-y-5">
              {/* Q5: Perasaan */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-800">
                  Pertanyaan 5 · Perasaan Sebelum Acara
                </span>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Label Pertanyaan
                  </label>
                  <input
                    type="text"
                    value={draft.q5FeelingLabel}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, q5FeelingLabel: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Pilihan Jawaban (1 baris = 1 pilihan radio)
                  </label>
                  <textarea
                    rows={4}
                    value={q5OptionsText}
                    onChange={(e) => setQ5OptionsText(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-900"
                  />
                </div>
              </div>

              {/* Q6: Follow Instagram Utama */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-800">
                  Pertanyaan 6 · Follow Instagram Penyelenggara
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Label Pertanyaan
                    </label>
                    <input
                      type="text"
                      value={draft.q6FollowLabel}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, q6FollowLabel: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Teks Link
                    </label>
                    <input
                      type="text"
                      value={draft.q6FollowLinkText}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, q6FollowLinkText: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-900"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      URL Link Instagram
                    </label>
                    <input
                      type="text"
                      value={draft.q6FollowLinkUrl}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, q6FollowLinkUrl: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Pilihan Radio (1 baris = 1 pilihan)
                  </label>
                  <textarea
                    rows={2}
                    value={q6OptionsText}
                    onChange={(e) => setQ6OptionsText(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-900"
                  />
                </div>
              </div>

              {/* Q7: Luka Batin */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-800">
                  Pertanyaan 7 · Harapan Kesembuhan Diri
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Label Pertanyaan Utama
                    </label>
                    <input
                      type="text"
                      value={draft.q7WoundLabel}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, q7WoundLabel: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Sub-label Miring (Opsional)
                    </label>
                    <input
                      type="text"
                      value={draft.q7WoundSubLabel}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, q7WoundSubLabel: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Pilihan Jawaban (1 baris = 1 pilihan)
                  </label>
                  <textarea
                    rows={5}
                    value={q7OptionsText}
                    onChange={(e) => setQ7OptionsText(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-900"
                  />
                </div>
                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.q7AllowOther}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, q7AllowOther: e.target.checked }))
                    }
                    className="w-4 h-4 accent-purple-700"
                  />
                  <span>Sertakan pilihan isian bebas &ldquo;Yang lain: ...&rdquo;</span>
                </label>
              </div>

              {/* Q8: Harapan / Doa */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-800">
                  Pertanyaan 8 · Harapan atau Doa (Opsional)
                </span>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Label Pertanyaan
                  </label>
                  <input
                    type="text"
                    value={draft.q8HopeLabel}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, q8HopeLabel: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900"
                  />
                </div>
              </div>

              {/* Q9: Bukti Transfer & Rekening Bank */}
              <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-200 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-purple-950 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-purple-700" />
                    Pertanyaan 9 · Upload Bukti Transfer &amp; Informasi Rekening
                  </span>
                  <label className="inline-flex items-center gap-2 text-xs font-bold text-purple-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draft.q9TransferEnabled}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          q9TransferEnabled: e.target.checked,
                        }))
                      }
                      className="w-4 h-4 accent-purple-700"
                    />
                    <span>Tampilkan Bagian Ini</span>
                  </label>
                </div>

                {draft.q9TransferEnabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-3">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Label Pertanyaan &amp; Harga Tiket
                      </label>
                      <input
                        type="text"
                        value={draft.q9TransferLabel}
                        onChange={(e) =>
                          setDraft((prev) => ({ ...prev, q9TransferLabel: e.target.value }))
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Nama Bank
                      </label>
                      <input
                        type="text"
                        value={draft.q9BankName}
                        onChange={(e) =>
                          setDraft((prev) => ({ ...prev, q9BankName: e.target.value }))
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Nomor Rekening
                      </label>
                      <input
                        type="text"
                        value={draft.q9BankAccount}
                        onChange={(e) =>
                          setDraft((prev) => ({ ...prev, q9BankAccount: e.target.value }))
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm font-mono text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Atas Nama Rekening
                      </label>
                      <input
                        type="text"
                        value={draft.q9BankHolder}
                        onChange={(e) =>
                          setDraft((prev) => ({ ...prev, q9BankHolder: e.target.value }))
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900"
                      />
                    </div>

                    {/* Sistem Verifikasi / Approval Admin & Panitia */}
                    <div className="sm:col-span-3 mt-2 p-4 rounded-2xl bg-white border border-purple-200 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <KeyRound className="w-4 h-4 text-emerald-700" />
                          <span className="text-xs font-bold text-slate-900">
                            Sistem Verifikasi / Approval Admin &amp; Panitia (Kunci Kartu QR Sebelum Di-ACC)
                          </span>
                        </div>
                        <label className="inline-flex items-center gap-2 text-xs font-bold text-emerald-800 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={draft.paymentAccessCodeRequired}
                            onChange={(e) =>
                              setDraft((prev) => ({
                                ...prev,
                                paymentAccessCodeRequired: e.target.checked,
                              }))
                            }
                            className="w-4 h-4 accent-emerald-700"
                          />
                          <span>Wajibkan Approval Admin / Panitia Sebelum Kartu QR Aktif</span>
                        </label>
                      </div>

                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Saat fitur ini aktif, peserta yang mendaftar &amp; mengunggah bukti transfer akan berstatus <strong>Menunggu Verifikasi (ACC)</strong>. <strong>Kartu Pengenal (Barcode QR)</strong> peserta baru akan terbuka dan dapat diunduh setelah <strong>Admin atau Panitia menekan tombol Terima / ACC Pembayaran</strong> di menu Dashboard atau Pendaftaran.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Nomor WhatsApp Admin (Tujuan Konfirmasi Bukti Transfer Peserta)
                          </label>
                          <input
                            type="text"
                            value={draft.adminConfirmationWhatsapp}
                            onChange={(e) =>
                              setDraft((prev) => ({
                                ...prev,
                                adminConfirmationWhatsapp: e.target.value,
                              }))
                            }
                            placeholder="Contoh: 085772904491"
                            className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 text-xs font-mono text-slate-900"
                          />
                          <span className="text-[10px] text-slate-500 mt-0.5 block">
                            Tujuan tombol langsung &ldquo;Hubungi WA Admin&rdquo; pada halaman status verifikasi peserta
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Q10: Supporter */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-purple-800">
                    Pertanyaan 10 · Follow Instagram Supporter / Sponsor
                  </span>
                  <label className="inline-flex items-center gap-2 text-xs font-bold text-purple-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draft.q10SupporterEnabled}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          q10SupporterEnabled: e.target.checked,
                        }))
                      }
                      className="w-4 h-4 accent-purple-700"
                    />
                    <span>Tampilkan Bagian Ini</span>
                  </label>
                </div>

                {draft.q10SupporterEnabled && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-3">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Label Pertanyaan Supporter
                        </label>
                        <input
                          type="text"
                          value={draft.q10SupporterLabel}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              q10SupporterLabel: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Teks Link
                        </label>
                        <input
                          type="text"
                          value={draft.q10SupporterLinkText}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              q10SupporterLinkText: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-900"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          URL Link Instagram Supporter
                        </label>
                        <input
                          type="text"
                          value={draft.q10SupporterLinkUrl}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              q10SupporterLinkUrl: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Pilihan Radio Supporter (1 baris = 1 pilihan)
                      </label>
                      <textarea
                        rows={3}
                        value={q10OptionsText}
                        onChange={(e) => setQ10OptionsText(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-900"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Q11: Pernyataan Kesiapan & Tombol Submit */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-800">
                  Pertanyaan 11 · Pernyataan Komitmen &amp; Teks Tombol Kirim
                </span>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kalimat Pernyataan Kesiapan
                  </label>
                  <textarea
                    rows={2}
                    value={draft.q11CommitmentLabel}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, q11CommitmentLabel: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Pilihan Persetujuan (1 baris = 1 pilihan)
                  </label>
                  <textarea
                    rows={2}
                    value={q11OptionsText}
                    onChange={(e) => setQ11OptionsText(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Teks Tombol Kirim Formulir
                  </label>
                  <input
                    type="text"
                    value={draft.submitButtonText}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, submitButtonText: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 sticky bottom-0 bg-white py-3">
            <button
              type="button"
              onClick={handleResetDefault}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-rose-700 bg-slate-100 hover:bg-rose-50 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset ke Format Default
            </button>

            <div className="flex items-center gap-2.5">
              {savedNotice && (
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                  ✓ Perubahan Formulir Tersimpan!
                </span>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-purple-900 hover:bg-purple-950 text-white shadow-sm transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                Simpan Perubahan Formulir
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
