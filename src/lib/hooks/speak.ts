"use client";

/** Lit un texte à voix haute avec la voix française du téléphone (gratuit, rien n'est envoyé). */
export function speak(text: string, onDone?: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    onDone?.();
    return;
  }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/[«»"*]/g, ""));
  u.lang = "fr-FR";
  u.rate = 1.03;
  const voices = window.speechSynthesis.getVoices();
  const fr = voices.find((v) => v.lang === "fr-FR" && /google|natural|premium|enhanced/i.test(v.name)) ?? voices.find((v) => v.lang.startsWith("fr"));
  if (fr) u.voice = fr;
  u.onend = () => onDone?.();
  u.onerror = () => onDone?.();
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (typeof window !== "undefined") window.speechSynthesis?.cancel();
}
