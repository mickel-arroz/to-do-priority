"use client";

import confetti from "canvas-confetti";

let completeAudio: HTMLAudioElement | null = null;

/** Confetti + subtle sound when something is completed satisfactorily. */
export function celebrate() {
  void confetti({
    particleCount: 90,
    spread: 70,
    startVelocity: 35,
    origin: { y: 0.7 },
    disableForReducedMotion: true,
  });
  if (!completeAudio) completeAudio = new Audio("/sounds/complete.wav");
  completeAudio.currentTime = 0;
  void completeAudio.play().catch(() => {});
}

/** Bigger burst for milestones (habit day completed, streak grows). */
export function celebrateBig() {
  const defaults = { disableForReducedMotion: true };
  void confetti({ ...defaults, particleCount: 120, spread: 100, origin: { y: 0.6 } });
  setTimeout(() => {
    void confetti({
      ...defaults,
      particleCount: 60,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
    });
    void confetti({
      ...defaults,
      particleCount: 60,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
    });
  }, 200);
}
