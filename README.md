# Le Cercle des Allocations — site web

Place de marché privée entre professionnels du vin (restaurateurs, cavistes, vignerons, négociants, distilleries, grossistes).
Next.js 14 (App Router) + Supabase (base, connexion par lien e-mail, stockage des photos). Hébergement prévu : Vercel.

## Ce qui fonctionne

| Écran | Rôle |
|---|---|
| `/` | Accueil et démarche « Le vin se partage » |
| `/connexion` | Connexion par lien magique envoyé par e-mail |
| `/inscription` | Fiche établissement : SIRET vérifié au registre (API Recherche d'entreprises), code NAF autorisé, Kbis, licence, n° d'accise, formule vendeur, acceptation des CGU horodatée avec IP |
| `/catalogue` | Lots, achats groupés, « Je cherche », filtres, indicateur de prix vert / orange / rouge |
| `/lot/[id]` | Fiche lot, photos, réservation (quantité au choix chez les producteurs, prix carton), frais d'envoi partagés 50/50, signalement |
| `/publier` | Publication d'un lot ou d'un achat groupé, photos obligatoires, lecture d'étiquette (facultative), filtre loi Évin |
| `/echanges` | Ventes, achats, lots : confirmer, refuser, expédier (document douanier + suivi), réception, litiges, avis |
| `/achats-groupes/[id]` | Participer, se retirer, valider ou annuler (vendeur) |
| `/messages` | Messagerie par lot, achat groupé ou recherche ; coordonnées masquées avant confirmation |
| `/alertes` | Alertes et annonces « Je cherche » |
| `/vendeur/[id]` | Boutique d'un vendeur et ses avis |
| `/documents/...` | Bon de livraison, facture du vendeur, bon d'achat groupé, imprimables en PDF |
| `/admin` | Validation des comptes (Kbis, SIRET), refus motivé, suspension, litiges, signalements, exports CSV commissions et DAC7 |
| `/cgu` | Conditions générales (texte dans `content/cgu.md`) |

Les règles sensibles sont appliquées **dans la base** (fichier `supabase-schema.sql`) et non seulement dans le site : un membre ne peut pas se valider lui-même, les prix et commissions d'une commande sont figés, seul le vendeur confirme et expédie, seul l'acheteur confirme la réception, un colis exige un suivi, les coordonnées ne sont visibles qu'entre les deux parties d'une vente confirmée.

## Mise en route (≈ 1 heure)

### 1. Supabase
1. Créer un projet, région **Europe (Paris ou Francfort)**.
2. **SQL Editor** → coller tout `supabase-schema.sql` → *Run*. Remplacer d'abord `[votre-domaine]` dans la ligne `cgu_versions`.
3. **Authentication → URL Configuration** : *Site URL* = l'adresse du site ; *Redirect URLs* : `https://votre-domaine/auth/callback` (et `http://localhost:3000/auth/callback` pour les essais).
4. **Authentication → Emails → Templates** : dans les modèles **Magic Link** et **Confirm signup**, remplacer le lien par
   `<a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email">Me connecter</a>`
   et ajouter la ligne `Ou entrez ce code : {{ .Token }}`. Ainsi le lien marche même ouvert depuis l'application Mail ou un autre appareil.
5. **Authentication → Emails → SMTP** : brancher un expéditeur (Brevo, Resend…) ; l'envoi intégré de Supabase est limité à quelques e-mails par heure.
6. Se connecter une première fois sur le site avec l'adresse de l'administrateur, puis dans **SQL Editor** :
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'adresse-de-l-administrateur@exemple.fr';
   ```

### 2. Variables d'environnement
Copier `.env.example` en `.env.local` et remplir. Seules l'URL et la clé **anon** (publique) de Supabase sont nécessaires.
**Ne jamais mettre la clé `service_role` dans le site ni la transmettre par e-mail** : le site n'en a pas besoin.

### 3. En local
```bash
npm install
npm run dev      # http://localhost:3000
npm test         # tests des règles (SIRET, NAF, Évin, frais d'envoi, prix)
npm run build
```

### 4. Vercel
1. Pousser ce dossier sur un dépôt GitHub privé.
2. Vercel → *Add New Project* → importer le dépôt (framework détecté : Next.js).
3. Reporter les variables de `.env.local` dans *Settings → Environment Variables*.
4. *Domains* : ajouter le nom de domaine, puis mettre à jour *Site URL* et *Redirect URLs* dans Supabase.

### Modifier les CGU
Éditer `content/cgu.md`, lancer `npm run cgu`, puis ajouter la nouvelle version en base
(`insert into cgu_versions (version, url) values ('AAAA-MM-JJ', 'https://…/cgu')`) et changer `NEXT_PUBLIC_CGU_VERSION` :
les membres devront accepter la nouvelle version.

## Reste à faire avant d'encaisser de l'argent

1. **Paiement sous séquestre — Stripe Connect** (comptes *Express* pour les vendeurs). À la confirmation : `PaymentIntent` avec `application_fee_amount` = `commission_ht` (+ TVA) ; versement au vendeur à la réception ou 5 jours après la livraison. Colonnes prévues : `members_private.stripe_account_id`, `orders.stripe_payment_intent`. Abonnement Pro : Stripe Billing, 29 € HT/mois.
2. **Étiquettes prépayées** : Sendcloud ou Boxtal (API) pour générer l'étiquette Colissimo depuis `/echanges` ; colonne prévue `shipments.label_path`.
3. **E-mails de notification** (réservation, confirmation, expédition, alerte « Je cherche ») : Supabase *Database Webhooks* ou *Edge Function* + Resend.
4. **Facturation des commissions** : export CSV mensuel depuis `/admin` à importer dans l'outil de facturation (Pennylane, Tiime…).
5. Relecture des CGU par un avocat ; DAC7 : déclaration annuelle à partir de l'export CSV.

## Structure
```
app/            écrans et actions serveur (un dossier par écran)
components/     éléments partagés (barre d'onglets, carte de lot, documents)
lib/rules.ts    règles métier sans dépendance (testées dans tests/)
lib/supabase/   clients Supabase côté serveur et navigateur
content/        texte des CGU
supabase-schema.sql   tables, droits d'accès, déclencheurs, vues d'administration
```
