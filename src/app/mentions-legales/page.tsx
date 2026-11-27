import type { Metadata } from "next";
import { LegalPage, Section } from "@/components/LegalPage";
import { LEGAL, LEGAL_PENDING } from "@/lib/legal";

export const metadata: Metadata = { title: "Mentions légales · SiteClic" };

export default function Page() {
  return (
    <LegalPage eyebrow="Informations" title="Mentions légales">
      <Section title="Éditeur">
        <p><strong>{LEGAL.company || LEGAL.brand}</strong>{LEGAL.company ? "" : ` (${LEGAL_PENDING})`}</p>
        {LEGAL.siret && <p>SIRET : {LEGAL.siret}</p>}
        {LEGAL.address && <p>{LEGAL.address}</p>}
        <p>Contact : <a href={`mailto:${LEGAL.email}`} className="text-clic">{LEGAL.email}</a></p>
      </Section>
      <Section title="Hébergement">
        <p>L&apos;application et les sites des commerçants sont hébergés par <strong>Vercel Inc.</strong>, 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis (vercel.com).</p>
        <p>Les comptes et les données sont conservés par <strong>Supabase Inc.</strong>, sur des serveurs situés dans l&apos;Union européenne.</p>
      </Section>
      <Section title="Sites des commerçants">
        <p>Chaque commerçant est responsable du contenu de son propre site (textes, photos, prix, horaires). SiteClic fournit l&apos;outil qui permet de le créer et de le mettre en ligne.</p>
      </Section>
      <Section title="Propriété intellectuelle">
        <p>La marque SiteClic, son logo, l&apos;application et ses modèles de sites sont protégés. Les textes et photos d&apos;un commerçant restent sa propriété.</p>
      </Section>
    </LegalPage>
  );
}
