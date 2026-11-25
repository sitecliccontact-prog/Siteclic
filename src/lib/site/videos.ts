"use client";

import { createClient } from "@/lib/supabase/client";

export const MAX_VIDEO_MB = 50;

/** Envoie la vidéo de présentation du commerçant et renvoie son adresse publique. */
export async function uploadVideo(file: File, folder: string): Promise<string> {
  if (!file.type.startsWith("video/")) throw new Error("Ce fichier n'est pas une vidéo. Choisissez une vidéo de votre galerie.");
  if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
    throw new Error(`Vidéo trop lourde (plus de ${MAX_VIDEO_MB} Mo). Prenez une vidéo plus courte (30 secondes suffisent).`);
  }
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Veuillez vous reconnecter.");
  const ext = file.type.includes("webm") ? "webm" : file.type.includes("quicktime") ? "mov" : "mp4";
  const path = `${user.id}/${folder}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("videos").upload(path, file, { contentType: file.type, cacheControl: "31536000" });
  if (error) {
    console.error("Envoi vidéo", error);
    throw new Error(/bucket|not found/i.test(error.message)
      ? "L'envoi de vidéos n'est pas encore activé. (code VIDEO-dossier)"
      : `L'envoi de la vidéo a échoué. Réessayez. (code VIDEO : ${error.message.slice(0, 80)})`);
  }
  return supabase.storage.from("videos").getPublicUrl(path).data.publicUrl;
}
