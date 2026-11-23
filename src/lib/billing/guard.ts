import "server-only";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { getSubscription, SUBSCRIPTION_REQUIRED } from "./stripe";

/** Renvoie une réponse « abonnement requis » si le compte n'est pas abonné, sinon null. */
export async function requireSubscription(user: User) {
  try {
    const sub = await getSubscription(user);
    return sub.active ? null : NextResponse.json(SUBSCRIPTION_REQUIRED, { status: 402 });
  } catch (err) {
    console.error("Vérification de l'abonnement impossible", err);
    return NextResponse.json({ error: "Impossible de vérifier votre abonnement. Réessayez dans un instant." }, { status: 503 });
  }
}
