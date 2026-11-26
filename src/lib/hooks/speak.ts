"use client";

/* Lecture à voix haute avec les voix du téléphone (gratuit, rien n'est envoyé).

   Fiabilité (surtout Chrome Android) :
   - le texte est lu phrase par phrase : les longues lectures s'arrêtent sinon d'elles-mêmes au bout de ~15 s ;
   - chaque phrase a un minuteur de secours : si le téléphone « oublie » de dire qu'il a fini,
     on continue quand même (sinon la conversation restait bloquée).

   Voix : « homme » = une voix masculine si le téléphone en a une. (La voix naturelle de qualité passe par voice.ts.) */

export type VoiceKind = "homme" | "femme";

const MALE = /homme|male|masculin|thomas|paul|henri|nicolas|daniel|antoine|mathieu|guillaume|fabrice|x-frd|x-vlf|x-frb|fr-fr-.*-(d|b)-/i;
const FEMALE = /femme|female|amelie|amélie|audrey|aurelie|julie|marie|celine|léa|lea|hortense|denise|x-fra|x-frc/i;

let voicesReady: Promise<SpeechSynthesisVoice[]> | null = null;
function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (voicesReady) return voicesReady;
  voicesReady = new Promise((resolve) => {
    const now = window.speechSynthesis.getVoices();
    if (now.length) return resolve(now);
    const done = () => resolve(window.speechSynthesis.getVoices());
    window.speechSynthesis.addEventListener?.("voiceschanged", done, { once: true });
    window.setTimeout(done, 1200);
  });
  return voicesReady;
}

function pickVoice(voices: SpeechSynthesisVoice[], kind: VoiceKind) {
  const fr = voices.filter((v) => v.lang.toLowerCase().startsWith("fr"));
  const best = (list: SpeechSynthesisVoice[]) =>
    list.find((v) => /fr-FR/i.test(v.lang) && /google|natural|premium|enhanced|neural/i.test(v.name)) ??
    list.find((v) => /fr-FR/i.test(v.lang)) ?? list[0];
  const wanted = kind === "homme" ? fr.filter((v) => MALE.test(v.name) && !FEMALE.test(v.name)) : fr.filter((v) => !MALE.test(v.name));
  const voice = best(wanted) ?? best(fr);
  return { voice };
}

/** Coupe le texte en phrases courtes (pas plus de ~180 caractères chacune). */
function sentences(text: string) {
  const parts = text.replace(/[«»"*]/g, "").match(/[^.!?…]+[.!?…]*\s*/g) ?? [text];
  const out: string[] = [];
  for (const p of parts) {
    const s = p.trim();
    if (!s) continue;
    if (s.length <= 180) out.push(s);
    else out.push(...(s.match(/.{1,170}(\s|$)/g) ?? [s]).map((x) => x.trim()));
  }
  return out;
}

let run = 0; // chaque nouvelle lecture annule la précédente
const keep: SpeechSynthesisUtterance[] = []; // garde les phrases en mémoire (sinon Chrome peut les perdre en route)

export function speak(text: string, onDone?: () => void, kind: VoiceKind = "femme") {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    onDone?.();
    return;
  }
  const id = ++run;
  const synth = window.speechSynthesis;
  synth.cancel();
  keep.length = 0;
  const list = sentences(text);
  let finished = false;
  const finish = () => {
    if (finished || id !== run) return;
    finished = true;
    onDone?.();
  };

  void loadVoices().then((voices) => {
    if (id !== run) return;
    const { voice } = pickVoice(voices, kind);
    const next = (k: number) => {
      if (id !== run) return;
      if (k >= list.length) return finish();
      const u = new SpeechSynthesisUtterance(list[k]);
      u.lang = "fr-FR";
      if (voice) u.voice = voice;
      // Voix d'homme : grave et posée. Si le téléphone n'a qu'une voix de femme, on la rend plus grave.
      // Voix naturelle, sans la rendre artificiellement grave (sinon elle sonne enrouée).
      u.pitch = 1;
      u.rate = 1.02;
      let moved = false;
      const go = () => { if (!moved) { moved = true; window.clearTimeout(watch); next(k + 1); } };
      // Minuteur de secours : environ 90 ms par caractère + 2,5 s.
      const watch = window.setTimeout(go, list[k].length * 90 + 2500);
      u.onend = go;
      u.onerror = go;
      keep.push(u);
      synth.speak(u);
      // Chrome met parfois la lecture en pause toute seule : on la relance.
      if (synth.paused) synth.resume();
    };
    next(0);
  });
}

export function stopSpeaking() {
  run++;
  keep.length = 0;
  if (typeof window !== "undefined") window.speechSynthesis?.cancel();
}
