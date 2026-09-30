import { Participant, WorkshopConfig } from './types';

export const WORKSHOP_CONFIG: WorkshopConfig = {
  name: "Cognitive Behavioral Therapy (CBT) & Mindful Healing",
  brandTitle: "Heal You",
  organizer: "Muslimah Healing Journey",
  tagline: "Let's Heal",
  eventLabel: "Agenda Workshop Psikologi",
  date: new Date().toISOString().split('T')[0],
  location: "Grand Ballroom, Hotel Mulia",
  // Set start time to 5 minutes ago to simulate some people being late
  startTime: new Date(Date.now() - 5 * 60000).toISOString(), 
};

export const INITIAL_PARTICIPANTS: Participant[] = [
  {
    id: "HY-001",
    name: "Dr. Sarah Jenkins",
    email: "sarah.j@university.edu",
    institution: "National Psych Institute",
    status: "PENDING"
  },
  {
    id: "HY-002",
    name: "Michael Chen",
    email: "m.chen@clinic.org",
    institution: "City Health Clinic",
    status: "PENDING"
  },
  {
    id: "HY-003",
    name: "Elena Rodriguez",
    email: "elena.r@hospital.com",
    institution: "Memorial Hospital",
    status: "PENDING"
  },
  {
    id: "HY-004",
    name: "Dr. James Wilson",
    email: "jwilson@privatepractice.net",
    institution: "Wilson Psychological Services",
    status: "PENDING"
  },
  {
    id: "HY-005",
    name: "Anita Desai",
    email: "anita.desai@university.edu",
    institution: "National Psych Institute",
    status: "PENDING"
  },
  {
    id: "HY-006",
    name: "David Kim",
    email: "dkim@wellness.org",
    institution: "Wellness Center",
    status: "PENDING"
  },
  {
    id: "HY-007",
    name: "Rachel Green",
    email: "rachel.g@hospital.com",
    institution: "Memorial Hospital",
    status: "PENDING"
  },
  {
    id: "HY-008",
    name: "Dr. Marcus Johnson",
    email: "mjohnson@clinic.org",
    institution: "City Health Clinic",
    status: "PENDING"
  }
];
