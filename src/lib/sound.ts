// Web Audio API Synthesizer for QR Check-in Feedback (No external audio files needed)

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      audioCtx = new AudioCtx();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function isSoundEnabled(): boolean {
  try {
    const saved = localStorage.getItem('workshop_sound_enabled');
    return saved === null ? true : saved === 'true';
  } catch {
    return true;
  }
}

export function setSoundEnabledPref(enabled: boolean): void {
  try {
    localStorage.setItem('workshop_sound_enabled', String(enabled));
  } catch {
    // Ignore storage errors
  }
}

export function playScanBeep(type: 'success' | 'warning' | 'error'): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    if (type === 'success') {
      // Pleasant ascending chime (D5 -> A5)
      playTone(ctx, 587.33, now, 0.1, 'sine', 0.16);
      playTone(ctx, 880, now + 0.09, 0.18, 'sine', 0.18);
    } else if (type === 'warning') {
      // Double neutral beep for already checked-in participant
      playTone(ctx, 466.16, now, 0.09, 'triangle', 0.14);
      playTone(ctx, 466.16, now + 0.13, 0.12, 'triangle', 0.14);
    } else {
      // Low descending tone for invalid / unknown QR code
      playTone(ctx, 310, now, 0.12, 'sawtooth', 0.11);
      playTone(ctx, 215, now + 0.12, 0.18, 'sawtooth', 0.12);
    }
  } catch {
    // Ignore audio context restrictions
  }
}

function playTone(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  oscType: OscillatorType,
  peakGain: number
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = oscType;
  osc.frequency.setValueAtTime(freq, startTime);

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + duration + 0.01);
}
