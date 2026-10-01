import React from 'react';
import * as XLSX from 'xlsx';
import { Download } from 'lucide-react';
import { useAppContext } from '../store';
import { format } from 'date-fns';

export const ExportButton: React.FC = () => {
  const { participants, config } = useAppContext();

  const handleExport = () => {
    const statusLabel = (st: string) => {
      if (st === 'PRESENT') return 'Hadir Tepat Waktu';
      if (st === 'LATE') return 'Hadir Terlambat';
      return 'Belum Hadir';
    };

    const total = participants.length;
    const present = participants.filter((p) => p.status === 'PRESENT').length;
    const late = participants.filter((p) => p.status === 'LATE').length;
    const pending = participants.filter((p) => p.status === 'PENDING').length;
    const attended = present + late;
    const rate = total > 0 ? Math.round((attended / total) * 100) : 0;

    let startFormatted = config.date;
    try {
      startFormatted = `${config.date} · Pukul ${format(new Date(config.startTime), 'HH:mm')} WIB`;
    } catch {
      // keep fallback
    }

    // Sheet 1: Full Attendance Report with Workshop Header Block
    const sheet1Rows: Array<Array<string | number>> = [
      ['LAPORAN KEHADIRAN PESERTA WORKSHOP - HEAL YOU'],
      ['Nama Acara Workshop', config.name],
      ['Penyelenggara', config.organizer || 'Muslimah Healing Journey'],
      ['Tanggal & Jam Mulai', startFormatted],
      ['Tempat / Lokasi', config.location],
      [
        'Ringkasan Kehadiran',
        `${attended} Hadir dari ${total} Peserta (${rate}%) — Tepat Waktu: ${present}, Terlambat: ${late}, Belum Hadir: ${pending}`,
      ],
      [],
      [
        'No.',
        'ID Presensi',
        'Nama Peserta',
        'Pekerjaan / Kegiatan',
        'Tempat Tinggal / Domisili',
        'Alamat Email',
        'No. WhatsApp',
        'Status Kehadiran',
        'Waktu Check-in',
      ],
      ...participants.map((p, idx) => [
        idx + 1,
        p.id,
        p.name,
        p.role || 'Peserta Workshop',
        p.institution,
        p.email,
        p.phone || '-',
        statusLabel(p.status),
        p.checkInTime ? `${format(new Date(p.checkInTime), 'dd/MM/yyyy HH:mm:ss')} WIB` : '-',
      ]),
    ];

    const wsAttendance = XLSX.utils.aoa_to_sheet(sheet1Rows);
    wsAttendance['!cols'] = [
      { wch: 6 }, // No.
      { wch: 14 }, // ID Presensi
      { wch: 30 }, // Nama Peserta
      { wch: 22 }, // Peran
      { wch: 28 }, // Institusi
      { wch: 28 }, // Email
      { wch: 18 }, // No. WhatsApp
      { wch: 20 }, // Status
      { wch: 24 }, // Waktu Check-in
    ];

    // Sheet 2: Statistical Summary
    const sheet2Rows: Array<Array<string | number>> = [
      ['RINGKASAN STATISTIK KEHADIRAN WORKSHOP'],
      ['Nama Acara', config.name],
      ['Tanggal Ekspor', `${format(new Date(), 'dd/MM/yyyy HH:mm')} WIB`],
      [],
      ['Kategori Status', 'Jumlah Peserta', 'Persentase'],
      ['Total Peserta Terdaftar', total, '100%'],
      [
        'Hadir Tepat Waktu',
        present,
        total > 0 ? `${Math.round((present / total) * 100)}%` : '0%',
      ],
      ['Hadir Terlambat', late, total > 0 ? `${Math.round((late / total) * 100)}%` : '0%'],
      ['Total Hadir (Tepat Waktu + Terlambat)', attended, `${rate}%`],
      ['Belum Hadir (Pending)', pending, total > 0 ? `${Math.round((pending / total) * 100)}%` : '0%'],
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet(sheet2Rows);
    wsSummary['!cols'] = [{ wch: 36 }, { wch: 18 }, { wch: 16 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsAttendance, 'Daftar Kehadiran');
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan Statistik');

    const fileName = `Laporan_Presensi_HealYou_${config.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      className="flex items-center gap-2 px-4 py-2 bg-[#5e438f] hover:bg-[#4c3575] text-white rounded-lg font-medium transition-colors text-xs sm:text-sm shadow-xs cursor-pointer shrink-0"
    >
      <Download size={15} />
      Ekspor Excel
    </button>
  );
};
