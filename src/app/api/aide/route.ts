import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";
import { HELP_GUIDE } from "@/lib/help-guide";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

/* Assistant d'aide de l'appli SiteClic (pour les commerçants). Modèle rapide et peu cher, 30 messages par jour et par compte. */

const Body = z.object({
  page: z.string().max(200).default(""),
  error: z.string().max(400).default(""),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().trim().min(1).max(1500) })).min(1).max(16),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ reply: "Connectez-vous d'abord, puis rouvrez l'aide." });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.messages.at(-1)?.role !== "user") return NextResponse.json({ error: "Message invalide." }, { status: 400 });
  const { page, error, messages } = parsed.data;
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ reply: "L'aide n'est pas disponible pour le moment. Écrivez-nous à siteclic.contact@gmail.com." });

  // Limite d'usage (réutilise le compteur de l'assistant). Si le compteur n'est pas encore installé, on laisse passer : le coût est minime.
  const { data: ok, error: limitErr } = await supabase.rpc("assistant_hit", { p_slug: `aide:${user.id}`, p_visitor: user.id });
  if (!limitErr && ok === false) {
    return NextResponse.json({ reply: "Vous avez beaucoup utilisé l'aide aujourd'hui. Revenez demain, ou écrivez-nous à siteclic.contact@gmail.com." });
  }

  const system = `Tu es l'aide de l'application SiteClic. Tu aides des commerçants (souvent peu à l'aise avec la technique, sur téléphone) à utiliser l'appli et à résoudre leurs problèmes.

Règles :
- Français simple, vouvoiement, chaleureux et rassurant. Réponses courtes (2 à 5 phrases), lisibles à voix haute. Pour une marche à suivre, donne au plus 4 étapes numérotées très courtes, en citant les boutons exactement comme ils s'appellent entre guillemets.
- Appuie-toi uniquement sur le mode d'emploi ci-dessous. Si tu ne sais pas, ou si c'est un vrai bug, dis-le honnêtement et propose d'écrire à siteclic.contact@gmail.com avec une capture d'écran.
- Si la personne parle d'un message d'erreur, explique-le simplement et donne la solution.
- Ne demande jamais de mot de passe ni de code bancaire. Ne parle que de SiteClic.
- Pas de markdown (pas d'astérisques ni de titres).

Contexte : la personne est sur la page « ${page || "inconnue"} ».${error ? ` Message d'erreur affiché à l'écran : « ${error} ».` : ""}

<mode_d_emploi>
${HELP_GUIDE}
</mode_d_emploi>`;

  try {
    const client = new Anthropic();
    const res = await client.messages.create({
      model: "claude-haiku-5-5",
      max_tokens: 2500,
      output_config: { effort: "low" },
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.text })),
    });
    const reply = res.content.map((b) => (b.type === "text" ? b.text : "")).join("").replace(/\*\*/g, "").trim();
    return NextResponse.json({ reply: reply || "Pouvez-vous reformuler votre question ?" });
  } catch (err) {
    console.error("Aide en panne", err);
    return NextResponse.json({ reply: "L'aide ne répond pas pour le moment. Réessayez dans une minute, ou écrivez-nous à siteclic.contact@gmail.com." });
  }
}
