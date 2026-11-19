# SiteClic · Ton site en un clic

Application pour les petits commerçants : ils créent le site de leur commerce avec l'IA,
ou importent leur site actuel pour l'améliorer, puis le modifient en écrivant.

## Ce qui est en place (étape 1)
- Page d'accueil (présentation, fonctionnement, tarif, questions)
- Inscription et connexion (Supabase)
- Espace « Mes sites » (réservé aux clients connectés)
- Appli installable sur téléphone (manifeste + icônes)

## Lancer l'appli sur un ordinateur
```bash
npm install
cp .env.example .env.local   # puis remplir les clés Supabase
npm run dev                  # ouvrir http://localhost:3000
```
Sans clés Supabase, l'appli s'affiche quand même : les comptes sont simplement désactivés.

## Outils
Next.js · Tailwind CSS · Supabase · (bientôt) API Claude · Stripe · Vercel
