import React, { useMemo, useState } from 'react';
import { useAppContext } from '../store';
import { AttendanceStatus } from '../types';
import { ExportButton } from './ExportButton';
import {
  Users,
  CheckCircle2,
  Clock,
  UserX,
  Search,
  QrCode,
  UserCheck,
  RotateCcw,
  ArrowUpDown,
  TrendingUp,
  Zap,
  Timer,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { playScanBeep } from '../lib/sound';
import { format, differenceInMinutes } from 'date-fns';
import { motion } from 'motion/react';

type StatusFilter = 'ALL' | AttendanceStatus;
type SortOption = 'id' | 'recent' | 'name';

export const Dashboard: React.FC<{ onEditParticipant?: (id: string) => void }> = ({
  onEditParticipant,
}) => {
  const { participants, config, checkIn, updateParticipant } = useAppContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('id');

  const stats = useMemo(() => {
    const total = participants.length;
    const present = participants.filter((p) => p.status === 'PRESENT').length;
    const late = participants.filter((p) => p.status === 'LATE').length;
    const pending = participants.filter((p) => p.status === 'PENDING').length;
    const attended = present + late;
    const attendanceRate = total > 0 ? Math.round((attended / total) * 100) : 0;

    return { total, present, late, pending, attendanceRate, attended };
  }, [participants]);

  // Arrival velocity & check-in timing insights
  const velocityStats = useMemo(() => {
    const startTime = new Date(config.startTime);
    const checkedInList = participants
      .filter((p) => p.status !== 'PENDING' && p.checkInTime)
      .map((p) => ({
        ...p,
        time: new Date(p.checkInTime!),
      }))
      .filter((p) => !isNaN(p.time.getTime()))
      .sort((a, b) => a.time.getTime() - b.time.getTime());

    const totalCheckedIn = checkedInList.length;
    if (totalCheckedIn === 0) {
      return {
        totalCheckedIn: 0,
        first30MinFromOpenCount: 0,
        first30MinFromOpenPct: 0,
        earlyArrivalCount: 0, // > 15 mins before start
        justInTimeCount: 0, // -15 mins to 0 mins (on time)
        within30MinAfterStartCount: 0, // 1 to 30 mins after start
        after30MinStartCount: 0, // > 30 mins after start
        avgOffsetMinutes: 0,
        firstCheckInTime: null as Date | null,
        latestCheckInTime: null as Date | null,
        peakRatePer10Min: 0,
      };
    }

    const firstTime = checkedInList[0].time;
    const latestTime = checkedInList[checkedInList.length - 1].time;

    // Count how many checked in within the first 30 minutes from the first check-in
    const first30MinFromOpenCount = checkedInList.filter(
      (p) => differenceInMinutes(p.time, firstTime) <= 30
    ).length;
    const first30MinFromOpenPct = Math.round((first30MinFromOpenCount / totalCheckedIn) * 100);

    let earlyArrivalCount = 0;
    let justInTimeCount = 0;
    let within30MinAfterStartCount = 0;
    let after30MinStartCount = 0;
    let totalOffsetMinutes = 0;

    for (const p of checkedInList) {
      const diffFromStart = differenceInMinutes(p.time, startTime); // negative = before start
      totalOffsetMinutes += diffFromStart;

      if (diffFromStart < -15) {
        earlyArrivalCount++;
      } else if (diffFromStart <= 0) {
        justInTimeCount++;
      } else if (diffFromStart <= 30) {
        within30MinAfterStartCount++;
      } else {
        after30MinStartCount++;
      }
    }

    // Calculate peak check-ins in any 10-minute sliding window
    let peakRatePer10Min = 0;
    for (let i = 0; i < checkedInList.length; i++) {
      let windowCount = 0;
      for (let j = i; j < checkedInList.length; j++) {
        if (differenceInMinutes(checkedInList[j].time, checkedInList[i].time) <= 10) {
          windowCount++;
        } else {
          break;
        }
      }
      if (windowCount > peakRatePer10Min) {
        peakRatePer10Min = windowCount;
      }
    }

    const avgOffsetMinutes = Math.round(totalOffsetMinutes / totalCheckedIn);

    return {
      totalCheckedIn,
      first30MinFromOpenCount,
      first30MinFromOpenPct,
      earlyArrivalCount,
      justInTimeCount,
      within30MinAfterStartCount,
      after30MinStartCount,
      avgOffsetMinutes,
      firstCheckInTime: firstTime,
      latestCheckInTime: latestTime,
      peakRatePer10Min,
    };
  }, [participants, config.startTime]);

  const filteredParticipants = useMemo(() => {
    const lowerQuery = searchQuery.trim().toLowerCase();

    const filtered = participants.filter((p) => {
      if (statusFilter !== 'ALL' && p.status !== statusFilter) {
        return false;
      }
      if (!lowerQuery) return true;
      return (
        p.name.toLowerCase().includes(lowerQuery) ||
        p.id.toLowerCase().includes(lowerQuery) ||
        p.institution.toLowerCase().includes(lowerQuery) ||
        p.email.toLowerCase().includes(lowerQuery)
      );
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'recent') {
        const timeA = a.checkInTime ? new Date(a.checkInTime).getTime() : 0;
        const timeB = b.checkInTime ? new Date(b.checkInTime).getTime() : 0;
        if (timeB !== timeA) return timeB - timeA;
      }
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name, 'id');
      }
      return a.id.localeCompare(b.id, undefined, { numeric: true });
    });
  }, [participants, searchQuery, statusFilter, sortBy]);

  const handleQuickUndoCheckIn = (id: string) => {
    updateParticipant(id, {
      status: 'PENDING',
      checkInTime: undefined,
    });
  };

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Peserta"
          value={stats.total}
          subtitle={`${stats.attendanceRate}% telah hadir`}
          icon={<Users className="w-5 h-5 text-purple-700" />}
          bgColor="bg-purple-50"
          active={statusFilter === 'ALL'}
          onClick={() => setStatusFilter('ALL')}
        />
        <StatCard
          title="Hadir Tepat Waktu"
          value={stats.present}
          subtitle="Sesuai jadwal"
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
          bgColor="bg-emerald-50"
          active={statusFilter === 'PRESENT'}
          onClick={() => setStatusFilter(statusFilter === 'PRESENT' ? 'ALL' : 'PRESENT')}
        />
        <StatCard
          title="Hadir Terlambat"
          value={stats.late}
          subtitle="Lewat jam mulai"
          icon={<Clock className="w-5 h-5 text-amber-600" />}
          bgColor="bg-amber-50"
          active={statusFilter === 'LATE'}
          onClick={() => setStatusFilter(statusFilter === 'LATE' ? 'ALL' : 'LATE')}
        />
        <StatCard
          title="Belum Hadir"
          value={stats.pending}
          subtitle="Menunggu check-in"
          icon={<UserX className="w-5 h-5 text-slate-500" />}
          bgColor="bg-slate-100"
          active={statusFilter === 'PENDING'}
          onClick={() => setStatusFilter(statusFilter === 'PENDING' ? 'ALL' : 'PENDING')}
        />
      </div>

      {/* Arrival Velocity & Check-in Timing Insight Card */}
      <div className="bg-white rounded-2xl shadow-xs border border-purple-100 p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left Header & Primary Velocity Metric */}
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 text-[#5e438f] flex items-center justify-center shrink-0 mt-0.5">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  Tren Kecepatan &amp; Waktu Kedatangan Peserta
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-50 text-[#5e438f] border border-purple-100">
                  <Zap className="w-3 h-3" />
                  {velocityStats.first30MinFromOpenCount} peserta (
                  {velocityStats.first30MinFromOpenPct}%) di 30 menit pertama
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {velocityStats.totalCheckedIn > 0 ? (
                  <>
                    Check-in pertama pukul{' '}
                    <strong className="text-slate-700 font-mono">
                      {velocityStats.firstCheckInTime
                        ? format(velocityStats.firstCheckInTime, 'HH:mm')
                        : '-'}
                    </strong>{' '}
                    · Rata-rata kedatangan{' '}
                    <strong className="text-[#4c3575]">
                      {velocityStats.avgOffsetMinutes <= 0
                        ? `${Math.abs(velocityStats.avgOffsetMinutes)} menit sebelum jam mulai`
                        : `${velocityStats.avgOffsetMinutes} menit setelah jam mulai`}
                    </strong>{' '}
                    · Puncak arus:{' '}
                    <strong className="text-slate-700">
                      {velocityStats.peakRatePer10Min} peserta / 10 mnt
                    </strong>
                  </>
                ) : (
                  'Menunggu data check-in pertama untuk menampilkan analisis kecepatan kedatangan.'
                )}
              </p>
            </div>
          </div>

          {/* Right Mini Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
            <div className="px-3 py-2 rounded-xl bg-emerald-50/70 border border-emerald-100">
              <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-800">
                <Timer className="w-3 h-3 text-emerald-600 shrink-0" />
                <span>&gt;15 Mnt Awal</span>
              </div>
              <p className="text-base font-bold text-emerald-900 mt-0.5">
                {velocityStats.earlyArrivalCount}{' '}
                <span className="text-[11px] font-normal text-emerald-700">org</span>
              </p>
            </div>

            <div className="px-3 py-2 rounded-xl bg-teal-50/70 border border-teal-100">
              <div className="flex items-center gap-1 text-[11px] font-medium text-teal-800">
                <CheckCircle2 className="w-3 h-3 text-teal-600 shrink-0" />
                <span>0–15 Mnt Awal</span>
              </div>
              <p className="text-base font-bold text-teal-900 mt-0.5">
                {velocityStats.justInTimeCount}{' '}
                <span className="text-[11px] font-normal text-teal-700">org</span>
              </p>
            </div>

            <div className="px-3 py-2 rounded-xl bg-amber-50/70 border border-amber-100">
              <div className="flex items-center gap-1 text-[11px] font-medium text-amber-800">
                <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                <span>+1 s/d 30 Mnt</span>
              </div>
              <p className="text-base font-bold text-amber-900 mt-0.5">
                {velocityStats.within30MinAfterStartCount}{' '}
                <span className="text-[11px] font-normal text-amber-700">org</span>
              </p>
            </div>

            <div className="px-3 py-2 rounded-xl bg-rose-50/70 border border-rose-100">
              <div className="flex items-center gap-1 text-[11px] font-medium text-rose-800">
                <Clock className="w-3 h-3 text-rose-600 shrink-0" />
                <span>&gt;30 Mnt Lewat</span>
              </div>
              <p className="text-base font-bold text-rose-900 mt-0.5">
                {velocityStats.after30MinStartCount}{' '}
                <span className="text-[11px] font-normal text-rose-700">org</span>
              </p>
            </div>
          </div>
        </div>

        {/* Segmented Timeline Distribution Bar */}
        {velocityStats.totalCheckedIn > 0 && (
          <div className="mt-3.5 pt-3 border-t border-slate-100">
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
              <div
                className="bg-emerald-500 transition-all duration-300"
                style={{
                  width: `${(velocityStats.earlyArrivalCount / velocityStats.totalCheckedIn) * 100}%`,
                }}
                title={`Datang >15 menit sebelum mulai: ${velocityStats.earlyArrivalCount} peserta`}
              />
              <div
                className="bg-teal-500 transition-all duration-300"
                style={{
                  width: `${(velocityStats.justInTimeCount / velocityStats.totalCheckedIn) * 100}%`,
                }}
                title={`Datang 0-15 menit sebelum mulai: ${velocityStats.justInTimeCount} peserta`}
              />
              <div
                className="bg-amber-400 transition-all duration-300"
                style={{
                  width: `${(velocityStats.within30MinAfterStartCount / velocityStats.totalCheckedIn) * 100}%`,
                }}
                title={`Terlambat 1-30 menit: ${velocityStats.within30MinAfterStartCount} peserta`}
              />
              <div
                className="bg-rose-400 transition-all duration-300"
                style={{
                  width: `${(velocityStats.after30MinStartCount / velocityStats.totalCheckedIn) * 100}%`,
                }}
                title={`Terlambat >30 menit: ${velocityStats.after30MinStartCount} peserta`}
              />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
              <span>
                Distribusi waktu kedatangan terhadap jadwal mulai (Pukul{' '}
                {format(new Date(config.startTime), 'HH:mm')} WIB)
              </span>
              {velocityStats.latestCheckInTime && (
                <span>
                  Check-in terakhir:{' '}
                  <strong className="font-mono text-slate-700">
                    {format(velocityStats.latestCheckInTime, 'HH:mm:ss')} WIB
                  </strong>
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Attendance Table Card */}
      <div className="flex-1 bg-white rounded-2xl shadow-xs border border-purple-100 overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-100 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Daftar Kehadiran Peserta</h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Jam mulai workshop:{' '}
                <span className="font-medium text-slate-700">
                  Pukul {format(new Date(config.startTime), 'HH:mm')} WIB
                </span>{' '}
                &nbsp;·&nbsp; Kehadiran:{' '}
                <span className="font-semibold text-[#5e438f]">
                  {stats.attended} dari {stats.total} peserta ({stats.attendanceRate}%)
                </span>
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari nama, ID (HY-...), institusi..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-400 w-full sm:w-64"
                />
              </div>
              <ExportButton />
            </div>
          </div>

          {/* Filter Tabs & Sort Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'ALL', label: 'Semua', count: stats.total },
                  { id: 'PRESENT', label: 'Hadir Tepat Waktu', count: stats.present },
                  { id: 'LATE', label: 'Terlambat', count: stats.late },
                  { id: 'PENDING', label: 'Belum Hadir', count: stats.pending },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer',
                    statusFilter === tab.id
                      ? 'bg-[#5e438f] text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                  )}
                >
                  <span>{tab.label}</span>
                  <span
                    className={cn(
                      'px-1.5 py-0.2 rounded-md text-[10px] font-semibold',
                      statusFilter === tab.id
                        ? 'bg-white/20 text-white'
                        : 'bg-white text-slate-600'
                    )}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <label htmlFor="dashboard-sort" className="text-xs text-slate-500">
                Urutkan:
              </label>
              <select
                id="dashboard-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-400 cursor-pointer"
              >
                <option value="id">No. Presensi (HY-001...)</option>
                <option value="recent">Waktu Check-in Terbaru</option>
                <option value="name">Nama Peserta (A - Z)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider sticky top-0 z-10">
                <th className="px-4 py-3.5 whitespace-nowrap">ID Presensi</th>
                <th className="px-4 py-3.5">Peserta &amp; Institusi</th>
                <th className="px-4 py-3.5 whitespace-nowrap">Status</th>
                <th className="px-4 py-3.5 whitespace-nowrap">Waktu Check-in</th>
                <th className="px-4 py-3.5 text-right whitespace-nowrap">Aksi Cepat &amp; Kartu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredParticipants.map((p) => (
                <motion.tr
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  key={p.id}
                  className="hover:bg-purple-50/35 transition-colors"
                >
                  <td className="px-4 py-3.5 font-mono text-xs font-semibold text-[#4c3575] whitespace-nowrap">
                    {p.id}
                  </td>
                  <td className="px-4 py-3.5 min-w-[200px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-900">{p.name}</p>
                      {p.role && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-purple-50 text-[#5e438f] border border-purple-100 rounded">
                          {p.role}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-600 text-xs mt-0.5 font-medium">
                      {p.institution}
                    </p>
                    <p className="text-slate-400 text-[11px] mt-0.5">
                      {p.email}
                      {p.phone ? ` · ${p.phone}` : ''}
                    </p>
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium',
                        p.status === 'PRESENT' && 'bg-emerald-100 text-emerald-800',
                        p.status === 'LATE' && 'bg-amber-100 text-amber-800',
                        p.status === 'PENDING' && 'bg-slate-100 text-slate-600'
                      )}
                    >
                      {p.status === 'PRESENT' && <CheckCircle2 className="w-3.5 h-3.5" />}
                      {p.status === 'LATE' && <Clock className="w-3.5 h-3.5" />}
                      {p.status === 'PENDING' && <UserX className="w-3.5 h-3.5" />}
                      {p.status === 'PRESENT'
                        ? 'Hadir'
                        : p.status === 'LATE'
                          ? 'Terlambat'
                          : 'Belum Hadir'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-slate-500 text-xs font-mono whitespace-nowrap">
                    {p.checkInTime ? `${format(new Date(p.checkInTime), 'HH:mm:ss')} WIB` : '-'}
                  </td>
                  <td className="px-4 py-3.5 text-right whitespace-nowrap">
                    <div className="inline-flex items-center justify-end gap-1.5">
                      {p.status === 'PENDING' ? (
                        <button
                          type="button"
                          onClick={() => {
                            const res = checkIn(p.id);
                            if (res.success) playScanBeep('success');
                          }}
                          title="Tandai hadir sekarang"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/60 rounded-lg transition-colors cursor-pointer"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          Check-in
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleQuickUndoCheckIn(p.id)}
                          title="Batalkan status check-in (kembalikan ke Belum Hadir)"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Batal
                        </button>
                      )}

                      {onEditParticipant && (
                        <button
                          type="button"
                          onClick={() => onEditParticipant(p.id)}
                          title="Lihat Kartu Pengenal & Edit Data"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#5e438f] bg-purple-50 hover:bg-purple-100 border border-purple-200/60 rounded-lg transition-colors cursor-pointer"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          Kartu / Edit
                        </button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
              {filteredParticipants.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500 text-sm">
                    Tidak ada data peserta yang sesuai dengan filter atau pencarian Anda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

function StatCard({
  title,
  value,
  subtitle,
  icon,
  bgColor,
  active,
  onClick,
}: {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ReactNode;
  bgColor: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'bg-white p-4 sm:p-5 rounded-2xl shadow-xs border text-left flex items-center gap-3.5 transition-all cursor-pointer',
        active
          ? 'border-[#7c52b8] ring-2 ring-purple-200/70'
          : 'border-slate-200/90 hover:border-purple-200'
      )}
    >
      <div
        className={cn(
          'w-11 h-11 rounded-xl flex items-center justify-center shrink-0',
          bgColor
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500 truncate">{title}</p>
        <p className="text-2xl font-bold text-slate-900 leading-tight mt-0.5">{value}</p>
        {subtitle && <p className="text-[11px] text-slate-400 truncate mt-0.5">{subtitle}</p>}
      </div>
    </button>
  );
}
