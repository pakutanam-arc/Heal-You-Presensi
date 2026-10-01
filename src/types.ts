export type AttendanceStatus = 'PENDING' | 'PRESENT' | 'LATE';

export type SignatureMode = 'TEXT' | 'IMAGE' | 'NONE';

export type FeedbackRecommendation = 'Sangat Merekomendasikan' | 'Merekomendasikan' | 'Cukup';

export interface ParticipantFeedback {
  participantId: string;
  participantName: string;
  institution: string;
  overallRating: number;
  speakerRating: number;
  facilityRating: number;
  takeaway: string;
  suggestedTopic?: string;
  recommendation: FeedbackRecommendation;
  submittedAt: string;
  certificateClaimed: boolean;
}

export interface CertificateSettings {
  organizerHeader?: string;
  certTitle: string;
  certSubtitle: string;
  numberSuffix: string;
  city: string;
  bodyIntro: string;
  signer1Label: string;
  signer1Name: string;
  signer1Title: string;
  signer1SigMode: SignatureMode;
  signer1SignatureText: string;
  signer1SignatureDataUrl?: string;
  enableSigner2: boolean;
  signer2Name: string;
  signer2Title: string;
  signer2SigMode: SignatureMode;
  signer2SignatureText: string;
  signer2SignatureDataUrl?: string;
  customTemplateDataUrl?: string;
}

export interface Participant {
  id: string;
  name: string;
  email: string;
  institution: string;
  role?: string;
  phone?: string;
  status: AttendanceStatus;
  checkInTime?: string;
  paymentVerified?: boolean;
  paymentProofUrl?: string;
  paymentFileName?: string;
  paymentSubmittedAt?: string;
  paymentVerifiedAt?: string;
  paymentVerifiedBy?: string;
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
  quota?: number;
}
