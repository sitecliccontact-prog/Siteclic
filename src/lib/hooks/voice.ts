"use client";

import { speak, stopSpeaking, type VoiceKind } from "./speak";

/* Voix naturelle de l'assistant (synthèse et écoute faites par nos serveurs, beaucoup plus claires et fiables
   que celles du téléphone). Si elle n'est pas disponible, on revient aux voix du téléphone. */

let avail: Promise<boolean> | null = null;
export function naturalVoiceAvailable() {
  avail ??= fetch("/api/voix").then((r) => r.json()).then((d) => Boolean(d.ok)).catch(() => false);
  return avail;
}

let run = 0;
let current: HTMLAudioElement | null = null;

/** Lit une réponse de l'assistant (texte signé par le serveur) avec la voix naturelle. */
export async function speakNatural(text: string, sig: string | undefined, kind: VoiceKind, onDone?: () => void) {
  const id = ++run;
  stopAudio();
  const fallback = () => { if (id === run) speak(text, onDone, kind); };
  if (!sig || !(await naturalVoiceAvailable())) return fallback();
  try {
    const res = await fetch("/api/voix/parler", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, sig, voice: kind }),
    });
    if (!res.ok) return fallback();
    const url = URL.createObjectURL(await res.blob());
    if (id !== run) return URL.revokeObjectURL(url);
    const audio = new Audio(url);
    current = audio;
    let ended = false;
    const done = () => {
      if (ended) return;
      ended = true;
      URL.revokeObjectURL(url);
      if (id === run) { current = null; onDone?.(); }
    };
    audio.onended = done;
    audio.onerror = () => { if (!ended) { ended = true; fallback(); } };
    await audio.play().catch(() => { if (!ended) { ended = true; fallback(); } });
  } catch {
    fallback();
  }
}

function stopAudio() {
  if (current) {
    current.pause();
    current.src = "";
    current = null;
  }
}

export function stopVoice() {
  run++;
  stopAudio();
  stopSpeaking();
}

/* ---------- Écoute : on enregistre la voix du visiteur, puis on la fait transcrire ---------- */

let stream: MediaStream | null = null;
let ctx: AudioContext | null = null;

async function micStream() {
  if (stream && stream.getAudioTracks().some((t) => t.readyState === "live")) return stream;
  stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  return stream;
}

export function releaseMic() {
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  void ctx?.close().catch(() => {});
  ctx = null;
}

export type Listening = { cancel: () => void; finish: () => void };

/**
 * Écoute une phrase : commence quand la personne parle, s'arrête après ~1,3 s de silence (ou 25 s maximum).
 * `onLevel` donne le volume (0 à 1) pour animer l'écran. Renvoie l'audio, ou null si personne n'a parlé.
 */
export async function listenOnce(onDone: (audio: Blob | null) => void, onLevel?: (v: number) => void): Promise<Listening> {
  let cancelled = false;
  let stop = () => {};
  const handle: Listening = { cancel: () => { cancelled = true; stop(); }, finish: () => stop() };
  try {
    const s = await micStream();
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") await ctx.resume().catch(() => {});
    const src = ctx.createMediaStreamSource(s);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    src.connect(analyser);
    const buf = new Float32Array(analyser.fftSize);

    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((m) => MediaRecorder.isTypeSupported?.(m)) ?? "";
    const rec = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

    const t0 = performance.now();
    let floor = 0.004, started = 0, lastLoud = 0, loudFor = 0, ended = false;
    const tick = window.setInterval(() => {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += v * v;
      const rms = Math.sqrt(sum / buf.length);
      const now = performance.now();
      if (now - t0 < 350) { floor = Math.max(floor, rms); return; } // bruit de fond de la pièce
      const thr = Math.max(0.012, floor * 2.2);
      onLevel?.(Math.min(1, rms / (thr * 4)));
      if (rms > thr) {
        loudFor += 50;
        lastLoud = now;
        if (!started && loudFor >= 150) started = now;
      } else loudFor = 0;
      if (started && now - lastLoud > 1300) stop();           // fin de phrase
      else if (!started && now - t0 > 9000) stop();            // personne n'a parlé
      else if (now - t0 > 25000) stop();                       // sécurité
    }, 50);

    stop = () => {
      if (ended) return;
      ended = true;
      window.clearInterval(tick);
      src.disconnect();
      onLevel?.(0);
      rec.onstop = () => {
        if (cancelled) return;
        onDone(started ? new Blob(chunks, { type: rec.mimeType || "audio/webm" }) : null);
      };
      if (rec.state !== "inactive") rec.stop();
      else if (!cancelled) onDone(null);
    };
    rec.start(250);
  } catch {
    if (!cancelled) onDone(null);
  }
  return handle;
}

/** Envoie l'audio à transcrire. Renvoie le texte, ou null si la transcription n'est pas disponible. */
export async function transcribe(audio: Blob, where: { slug?: string; siteId?: string }): Promise<string | null> {
  const form = new FormData();
  form.append("audio", audio, "voix");
  if (where.slug) form.append("slug", where.slug);
  if (where.siteId) form.append("siteId", where.siteId);
  try {
    const res = await fetch("/api/voix/ecouter", { method: "POST", body: form });
    if (!res.ok) return null;
    const d = await res.json();
    return typeof d.text === "string" ? d.text : null;
  } catch {
    return null;
  }
}
