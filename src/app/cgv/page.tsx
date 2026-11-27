import type { Metadata } from "next";
import { LegalPage, Section } from "@/components/LegalPage";
import { LEGAL } from "@/lib/legal";
import { EDITS_PER_SITE, HOSTING, OFFERS } from "@/lib/pricing";

export const metadata: Metadata = { title: "Conditions de vente · SiteClic" };

export default function Page() {
  return (
    <LegalPage eyebrow="Conditions" title="Conditions générales de vente">
      <Section title="Le service">
        <p>SiteClic permet à un commerçant de créer, modifier et mettre en ligne le site de son commerce avec l&apos;aide d&apos;une intelligence artificielle.</p>
      </Section>
      <Section title="Ce qui est gratuit">
        <p>Créer un site et le regarder en aperçu (avec la mention « Aperçu SiteClic »), dans la limite de l&apos;essai gratuit affichée dans l&apos;application.</p>
      </Section>
      <Section title="Prix">
        {OFFERS.map((o) => <p key={o.id}><strong>{o.name} :</strong> {o.price}, {o.unit}, {EDITS_PER_SITE} modifications par l&apos;IA incluses par site.</p>)}
        <p><strong>Hébergement :</strong> {HOSTING.year} par an ou {HOSTING.month} par mois, sans engagement.</p>
        <p>Les options (assistant IA de réservation, nom de domaine, newsletter…) sont facturées au prix affiché au moment de leur activation. Les prix sont indiqués toutes taxes comprises.</p>
      </Section>
      <Section title="Paiement">
        <p>Le paiement se fait en ligne par carte bancaire, Apple Pay ou Google Pay, via Stripe. L&apos;hébergement se renouvelle automatiquement à chaque période.</p>
      </Section>
      <Section title="Arrêt de l'hébergement">
        <p>Vous pouvez arrêter l&apos;hébergement à tout moment depuis votre espace. Votre site reste en ligne jusqu&apos;à la fin de la période déjà payée, puis il est retiré d&apos;Internet. Il reste dans votre espace et peut être remis en ligne plus tard.</p>
      </Section>
      <Section title="Droit de rétractation">
        <p>Le service est fourni immédiatement après le paiement, à votre demande. Le site étant créé sur mesure, le droit de rétractation ne s&apos;applique plus une fois le site mis en ligne. En cas de souci, écrivez-nous : nous trouvons toujours une solution.</p>
      </Section>
      <Section title="Responsabilités">
        <p>Le commerçant vérifie et reste responsable des informations publiées sur son site (prix, horaires, allergènes…). SiteClic fait son possible pour que les sites restent disponibles en permanence.</p>
      </Section>
      <Section title="Contact">
        <p><a href={`mailto:${LEGAL.email}`} className="text-clic">{LEGAL.email}</a></p>
      </Section>
    </LegalPage>
  );
}
