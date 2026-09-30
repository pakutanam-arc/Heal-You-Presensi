export type AttendanceStatus = 'PENDING' | 'PRESENT' | 'LATE';

export interface Participant {
  id: string;
  name: string;
  email: string;
  institution: string;
  role?: string;
  phone?: string;
  status: AttendanceStatus;
  checkInTime?: string;
}

export interface WorkshopConfig {
  name: string;
  brandTitle?: string;
  organizer?: string;
  tagline?: string;
  eventLabel?: string;
  date: string;
  location: string;
  startTime: string; // ISO string
  customLogoUrl?: string;
}
