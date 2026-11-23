"use client";

import { createClient } from "@/lib/supabase/client";

const MAX_SIDE = 2000;

/** Réduit une photo de téléphone (souvent 4 à 10 Mo) en une image légère et nette. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => null);
  if (!bitmap) throw new Error("Ce fichier n'est pas une photo lisible. Essayez une photo JPEG ou PNG.");
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.85));
  const fallback = blob ?? (await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85)));
  if (!fallback) throw new Error("Impossible de préparer cette photo.");
  return fallback;
}

/** Envoie une photo du client et renvoie son adresse publique. */
export async function uploadPhoto(file: File, siteId: string): Promise<string> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Veuillez vous reconnecter.");
  const blob = await shrink(file);
  const ext = blob.type === "image/webp" ? "webp" : "jpg";
  const path = `${user.id}/${siteId}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("photos").upload(path, blob, { contentType: blob.type, cacheControl: "31536000" });
  if (error) {
    console.error("Envoi photo", error);
    throw new Error(/bucket|not found/i.test(error.message)
      ? "L'envoi de photos n'est pas encore activé. (code PHOTO-dossier)"
      : `L'envoi de la photo a échoué. Réessayez. (code PHOTO : ${error.message.slice(0, 80)})`);
  }
  return supabase.storage.from("photos").getPublicUrl(path).data.publicUrl;
}

export const MAX_PHOTOS = 12;
