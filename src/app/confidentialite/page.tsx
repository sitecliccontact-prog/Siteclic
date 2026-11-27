import type { Metadata } from "next";
import { LegalPage, Section } from "@/components/LegalPage";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Confidentialité · SiteClic" };

export default function Page() {
  return (
    <LegalPage eyebrow="Vos données" title="Politique de confidentialité">
      <Section title="En bref">
        <p>Nous collectons le strict nécessaire pour faire fonctionner SiteClic. Nous ne vendons aucune donnée et n&apos;affichons aucune publicité.</p>
      </Section>
      <Section title="Commerçants (utilisateurs de l'application)">
        <p><strong>Données :</strong> adresse e-mail, nom du commerce, contenu de vos sites (textes, photos), historique d&apos;utilisation de l&apos;IA.</p>
        <p><strong>Pourquoi :</strong> créer et faire fonctionner votre compte et vos sites, éviter les abus de l&apos;essai gratuit, vous facturer.</p>
        <p><strong>Paiements :</strong> traités par Stripe. Nous ne voyons jamais votre numéro de carte.</p>
        <p><strong>Intelligence artificielle :</strong> vos demandes de modification et les textes de votre site sont envoyés à notre fournisseur d&apos;IA (Anthropic) uniquement pour produire la réponse. Ils ne servent pas à entraîner ses modèles.</p>
      </Section>
      <Section title="Visiteurs des sites des commerçants">
        <p><strong>Réservations, commandes, rendez-vous, candidatures, newsletter :</strong> le nom, le téléphone (et l&apos;e-mail si vous le donnez) sont transmis au commerçant concerné, qui en est responsable. Ils ne servent qu&apos;à traiter votre demande.</p>
        <p><strong>Statistiques :</strong> nous comptons les visites sans cookie publicitaire ni donnée personnelle.</p>
      </Section>
      <Section title="Durée de conservation">
        <p>Les données d&apos;un compte sont gardées tant que le compte existe. Sur simple demande, nous supprimons le compte et tout ce qu&apos;il contient.</p>
      </Section>
      <Section title="Vos droits">
        <p>Vous pouvez consulter, corriger ou supprimer vos données, ou vous opposer à leur utilisation, en écrivant à <a href={`mailto:${LEGAL.email}`} className="text-clic">{LEGAL.email}</a>. Vous pouvez aussi saisir la CNIL (cnil.fr).</p>
      </Section>
    </LegalPage>
  );
}
