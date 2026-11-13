-- =====================================================================
-- Le Cercle des Allocations : base de données Supabase
-- À coller en une fois dans Supabase > SQL Editor > New query > Run.
-- Crée les tables, les règles de sécurité (RLS) et les espaces de stockage.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. Référentiels
-- ---------------------------------------------------------------------
create table public.naf_codes (
  code   text primary key,
  label  text not null
);
insert into public.naf_codes (code, label) values
  ('56.10A','Restauration traditionnelle'),
  ('56.10B','Cafétérias et autres libres-services'),
  ('56.10C','Restauration de type rapide'),
  ('56.21Z','Services des traiteurs'),
  ('56.29B','Autres services de restauration'),
  ('56.30Z','Débits de boissons'),
  ('55.10Z','Hôtels et hébergement similaire'),
  ('47.25Z','Commerce de détail de boissons en magasin spécialisé'),
  ('47.29Z','Autres commerces de détail alimentaires en magasin spécialisé'),
  ('46.34Z','Commerce de gros de boissons'),
  ('01.21Z','Culture de la vigne'),
  ('11.02A','Fabrication de vins effervescents'),
  ('11.02B','Vinification'),
  ('11.03Z','Fabrication de cidre et de vins de fruits'),
  ('11.01Z','Production de boissons alcooliques distillées');

create table public.cgu_versions (
  version      text primary key,          -- ex. '2026-11-13'
  url          text not null,
  published_at timestamptz not null default now()
);
insert into public.cgu_versions (version, url)
values ('2026-11-13', 'https://[votre-domaine]/cgu');

create type public.account_status as enum ('pending','active','rejected','suspended');
create type public.member_kind    as enum ('Restaurant','Bar / bar à vin','Hôtel','Traiteur','Caviste / épicerie fine',
                                           'Grossiste / distributeur','Vigneron / domaine','Négociant','Distillerie');
create type public.seller_plan    as enum ('occasionnel','pro');
create type public.offer_status   as enum ('dispo','reservee','confirmee','vendue','retire');
create type public.delivery_mode  as enum ('retrait','coursier','colis');
create type public.group_status   as enum ('ouvert','valide','annule');
create type public.douane_doc     as enum ('crd','bl','dsa','dae');
create type public.claim_type     as enum ('casse','incomplet','nonrecu');
create type public.claim_status   as enum ('ouvert','regle');

-- ---------------------------------------------------------------------
-- 2. Membres
--    members         : fiche visible par les membres actifs (pseudo, activité…)
--    members_private : coordonnées et justificatifs, visibles par le membre,
--                      l'administrateur et la contrepartie d'une vente confirmée
-- ---------------------------------------------------------------------
create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table public.members (
  id            uuid primary key references auth.users(id) on delete cascade,
  pseudo        text not null check (char_length(pseudo) between 2 and 40),
  kind          public.member_kind not null,
  plan          public.seller_plan not null default 'occasionnel',
  city          text not null,
  status        public.account_status not null default 'pending',
  status_reason text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.members_private (
  id           uuid primary key references public.members(id) on delete cascade,
  legal_name   text not null,
  siret        text not null unique check (siret ~ '^[0-9]{14}$'),
  siren        text generated always as (left(siret, 9)) stored,
  vat_number   text not null,
  naf          text not null references public.naf_codes(code),
  excise_number text,
  licence      text not null,
  address      text not null,
  postcode     text not null,
  phone        text not null,
  kbis_path    text not null,             -- chemin dans le stockage 'kbis'
  iban_last4   text,                      -- l'IBAN complet reste chez Stripe
  stripe_account_id text,                 -- compte connecté Stripe (vendeurs)
  verified_at  timestamptz,
  verified_by  uuid references auth.users(id)
);

create table public.cgu_acceptances (
  id          bigint generated always as identity primary key,
  member_id   uuid not null references public.members(id) on delete cascade,
  version     text not null references public.cgu_versions(version),
  accepted_at timestamptz not null default now(),
  ip          inet,
  user_agent  text,
  unique (member_id, version)
);

-- ---------------------------------------------------------------------
-- 3. Lots, ventes, expéditions, litiges
-- ---------------------------------------------------------------------
create table public.offers (
  id          uuid primary key default gen_random_uuid(),
  seller_id   uuid not null references public.members(id) on delete restrict,
  category    text not null check (category in ('Vin','Champagne','Spiritueux')),
  name        text not null,
  producer    text not null,
  appellation text,
  spirit_type text,
  vintage     text,
  abv         numeric(4,1) check (abv between 0 and 80),
  grapes      text,
  bottled_year text,
  format      text not null,
  qty         integer not null check (qty between 1 and 600),
  purchase_price numeric(10,2) check (purchase_price >= 0),   -- facultatif
  price       numeric(10,2) not null check (price > 0),       -- HT par bouteille
  carton_price numeric(10,2) check (carton_price > 0),         -- producteurs : prix par bouteille au carton
  carton_size  smallint check (carton_size in (3,6,12)),
  has_invoice boolean not null default false,
  condition   text not null,
  storage     text,
  description text,
  pickup_city text not null,
  photos      jsonb not null default '[]',                      -- [{k:'general', path:'…'}]
  status      public.offer_status not null default 'dispo',
  created_at  timestamptz not null default now()
);
create index on public.offers (status, created_at desc);
create index on public.offers (lower(producer), lower(name), vintage, format);

create table public.orders (
  id           uuid primary key default gen_random_uuid(),
  offer_id     uuid not null references public.offers(id) on delete restrict,
  seller_id    uuid not null references public.members(id),
  buyer_id     uuid not null references public.members(id),
  ref          text unique,
  mode         public.delivery_mode not null,
  qty          integer not null,
  unit_price   numeric(10,2) not null,
  goods_ht     numeric(10,2) generated always as (qty * unit_price) stored,
  shipping_est numeric(10,2) not null default 0,   -- transport + emballage + assurance
  shipping_buyer_share numeric(10,2) generated always as (round(shipping_est / 2, 2)) stored,
  commission_rate numeric(4,3) not null,           -- 0.080 ou 0.020, figé à la vente
  commission_ht numeric(10,2) generated always as (round(qty * unit_price * commission_rate, 2)) stored,
  reserved_at  timestamptz not null default now(),
  confirmed_at timestamptz,
  shipped_at   timestamptz,
  received_at  timestamptz,
  cancelled_at timestamptz,
  stripe_payment_intent text,
  check (seller_id <> buyer_id)
);
create index orders_offer_idx on public.orders (offer_id);
create index orders_seller_idx on public.orders (seller_id);
create index orders_buyer_idx on public.orders (buyer_id);

create table public.shipments (
  order_id   uuid primary key references public.orders(id) on delete cascade,
  douane     public.douane_doc not null,
  douane_ref text,
  carrier    text,
  tracking   text,
  insured    boolean not null default false,
  label_path text,
  created_at timestamptz not null default now(),
  check (douane not in ('dsa','dae') or douane_ref is not null)
);

create table public.claims (
  order_id   uuid primary key references public.orders(id) on delete cascade,
  type       public.claim_type not null,
  details    text,
  photos     jsonb not null default '[]',
  status     public.claim_status not null default 'ouvert',
  opened_at  timestamptz not null default now(),
  settled_at timestamptz
);

-- ---------------------------------------------------------------------
-- 4. Achats groupés
-- ---------------------------------------------------------------------
create table public.group_buys (
  id          uuid primary key default gen_random_uuid(),
  seller_id   uuid not null references public.members(id),
  category    text not null check (category in ('Vin','Champagne','Spiritueux')),
  name        text not null,
  producer    text not null,
  appellation text,
  vintage     text,
  abv         numeric(4,1),
  format      text not null,
  price       numeric(10,2) not null check (price > 0),
  usual_price numeric(10,2),
  min_bottles integer not null check (min_bottles >= 2),
  deadline    timestamptz not null,
  delivery    text,
  photos      jsonb not null default '[]',
  description text,
  status      public.group_status not null default 'ouvert',
  ref         text unique,
  validated_at timestamptz,
  created_at  timestamptz not null default now()
);

create table public.pledges (
  group_id   uuid not null references public.group_buys(id) on delete cascade,
  member_id  uuid not null references public.members(id) on delete cascade,
  qty        integer not null check (qty between 1 and 600),
  updated_at timestamptz not null default now(),
  primary key (group_id, member_id)
);

-- ---------------------------------------------------------------------
-- 5. Messagerie, avis, signalements, alertes
-- ---------------------------------------------------------------------
create table public.wanted (                  -- tableau « Je cherche »
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references public.members(id) on delete cascade,
  query      text not null check (char_length(query) between 2 and 200),
  category   text,
  max_price  numeric(10,2),
  closed     boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.messages (
  id          bigint generated always as identity primary key,
  offer_id    uuid references public.offers(id) on delete cascade,
  group_id    uuid references public.group_buys(id) on delete cascade,
  sender_id   uuid not null references public.members(id),
  recipient_id uuid not null references public.members(id),
  body        text not null check (char_length(body) between 1 and 2000),
  created_at  timestamptz not null default now(),
  read_at     timestamptz,
  wanted_id   uuid references public.wanted(id) on delete cascade,
  check (num_nonnulls(offer_id, group_id, wanted_id) = 1),
  check (sender_id <> recipient_id)
);
create index on public.messages (recipient_id, created_at desc);

create table public.reviews (
  order_id   uuid not null references public.orders(id) on delete cascade,
  author_id  uuid not null references public.members(id),
  target_id  uuid not null references public.members(id),
  stars      smallint not null check (stars between 1 and 5),
  comment    text check (char_length(comment) <= 600),
  created_at timestamptz not null default now(),
  primary key (order_id, author_id)
);

create table public.reports (
  id          bigint generated always as identity primary key,
  offer_id    uuid not null references public.offers(id) on delete cascade,
  reporter_id uuid not null references public.members(id),
  reason      text not null check (reason in ('prix_abusif','description_trompeuse','comportement')),
  is_producer boolean not null default false,   -- « je suis le vigneron de ce vin »
  details     text,
  created_at  timestamptz not null default now(),
  unique (offer_id, reporter_id)
);

create table public.alerts (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references public.members(id) on delete cascade,
  query      text not null,
  category   text,
  max_price  numeric(10,2),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 6. Fonctions d'aide aux règles de sécurité
-- ---------------------------------------------------------------------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

create or replace function public.is_active() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where id = auth.uid() and status = 'active');
$$;

-- Vrai si l'utilisateur courant et « other » sont les deux parties d'une vente
-- confirmée ou d'un achat groupé validé : c'est ce qui débloque les coordonnées.
create or replace function public.is_counterparty(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.orders o
    where o.confirmed_at is not null and o.cancelled_at is null
      and ((o.seller_id = auth.uid() and o.buyer_id = other)
        or (o.buyer_id = auth.uid() and o.seller_id = other)))
  or exists (
    select 1 from public.group_buys g join public.pledges p on p.group_id = g.id
    where g.status = 'valide'
      and ((g.seller_id = auth.uid() and p.member_id = other)
        or (p.member_id = auth.uid() and g.seller_id = other)));
$$;

-- Taux de commission selon la formule du vendeur (8 % ou 2 %)
create or replace function public.commission_rate_for(seller uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select case when plan = 'pro' then 0.02 else 0.08 end from public.members where id = seller;
$$;

-- Empêche un membre de modifier lui-même son statut ou de se valider
create or replace function public.protect_member_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() and new.status is distinct from old.status
     and not (old.status = 'rejected' and new.status = 'pending') then
    raise exception 'Seul l''administrateur peut changer le statut d''un compte';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger members_protect_status before update on public.members
for each row execute function public.protect_member_status();

-- Un nouveau membre démarre toujours « en attente »
create or replace function public.force_pending() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then new.status := 'pending'; end if;
  return new;
end $$;
create trigger members_force_pending before insert on public.members
for each row execute function public.force_pending();

-- À la création d'une commande : prix et commission figés, quantité retirée du lot.
-- Un producteur (vigneron, négociant, distillerie, grossiste) vend à la bouteille dans son lot,
-- avec le prix carton dès que la quantité atteint un carton ; les autres lots se vendent entiers.
create sequence if not exists public.order_ref_seq;
create or replace function public.on_order_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare o public.offers; k public.member_kind;
begin
  select * into o from public.offers where id = new.offer_id for update;
  if o.status <> 'dispo' or o.qty < 1 then raise exception 'Ce lot n''est plus disponible'; end if;
  select kind into k from public.members where id = o.seller_id;
  new.seller_id := o.seller_id;
  new.ref := 'CA-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.order_ref_seq')::text, 5, '0');
  if k in ('Vigneron / domaine','Négociant','Distillerie','Grossiste / distributeur') then
    if new.qty is null or new.qty < 1 or new.qty > o.qty then raise exception 'Quantité indisponible'; end if;
  else
    new.qty := o.qty;
  end if;
  new.unit_price := case when o.carton_price is not null and o.carton_size is not null and new.qty >= o.carton_size
                         then o.carton_price else o.price end;
  new.commission_rate := public.commission_rate_for(o.seller_id);
  update public.offers set qty = qty - new.qty,
         status = case when qty - new.qty = 0 then 'reservee'::public.offer_status else status end
   where id = o.id;
  return new;
end $$;
create trigger orders_before_insert before insert on public.orders
for each row execute function public.on_order_insert();

-- À l'annulation d'une commande (refus, annulation, expiration), les bouteilles reviennent dans le lot
create or replace function public.on_order_cancel() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.cancelled_at is not null and old.cancelled_at is null then
    update public.offers set qty = qty + old.qty, status = 'dispo' where id = old.offer_id and status <> 'retire';
  end if;
  return new;
end $$;
create trigger orders_after_cancel after update on public.orders
for each row execute function public.on_order_cancel();

-- Réservations non confirmées depuis 48 h : annulées automatiquement (appelée par le site)
create or replace function public.release_expired_reservations() returns integer
language sql security definer set search_path = public as $$
  with x as (
    update public.orders set cancelled_at = now()
     where confirmed_at is null and cancelled_at is null and reserved_at < now() - interval '48 hours'
    returning 1)
  select count(*)::int from x;
$$;

-- Indicateur de prix : médiane des 10 dernières ventes du même vin, millésime et format
create or replace function public.price_reference(p_producer text, p_name text, p_vintage text, p_format text)
returns table (median numeric, n integer)
language sql stable security definer set search_path = public as $$
  with last10 as (
    select o.unit_price from public.orders o join public.offers f on f.id = o.offer_id
     where o.confirmed_at is not null and o.cancelled_at is null
       and lower(f.producer) = lower(p_producer) and lower(f.name) = lower(p_name)
       and coalesce(f.vintage,'') = coalesce(p_vintage,'') and f.format = p_format
     order by o.confirmed_at desc limit 10)
  select percentile_cont(0.5) within group (order by unit_price)::numeric, count(*)::int from last10;
$$;

-- Chacun ne fait que sa part : le vendeur confirme et expédie, l'acheteur confirme la réception
create or replace function public.protect_order_steps() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return new; end if;
  if (new.confirmed_at is distinct from old.confirmed_at or new.shipped_at is distinct from old.shipped_at)
     and auth.uid() <> old.seller_id then
    raise exception 'Seul le vendeur confirme et expédie';
  end if;
  if new.cancelled_at is not null and old.cancelled_at is null and old.confirmed_at is not null then
    raise exception 'Une vente confirmée ne peut plus être annulée : passez par un litige';
  end if;
  if new.received_at is distinct from old.received_at and auth.uid() <> old.buyer_id then
    raise exception 'Seul l''acheteur confirme la réception';
  end if;
  if new.shipped_at is not null and old.shipped_at is null
     and not exists (select 1 from public.shipments s where s.order_id = new.id) then
    raise exception 'Indiquez d''abord le document de circulation et le suivi';
  end if;
  if new.unit_price <> old.unit_price or new.qty <> old.qty or new.commission_rate <> old.commission_rate
     or new.seller_id <> old.seller_id or new.buyer_id <> old.buyer_id then
    raise exception 'Le prix, la quantité et la commission d''une commande ne peuvent pas être modifiés';
  end if;
  return new;
end $$;
create trigger orders_protect_steps before update on public.orders
for each row execute function public.protect_order_steps();

-- Pas d'expédition sans document de circulation ; pas de colis sans numéro de suivi
create or replace function public.check_shipment() returns trigger
language plpgsql security definer set search_path = public as $$
declare m public.delivery_mode;
begin
  select mode into m from public.orders where id = new.order_id;
  if m = 'colis' and (new.carrier is null or new.tracking is null) then
    raise exception 'Transporteur et numéro de suivi obligatoires pour un colis';
  end if;
  return new;
end $$;
create trigger shipments_check before insert or update on public.shipments
for each row execute function public.check_shipment();

-- ---------------------------------------------------------------------
-- 7. Règles de sécurité (Row Level Security)
-- ---------------------------------------------------------------------
alter table public.naf_codes        enable row level security;
alter table public.cgu_versions     enable row level security;
alter table public.admins           enable row level security;
alter table public.members          enable row level security;
alter table public.members_private  enable row level security;
alter table public.cgu_acceptances  enable row level security;
alter table public.offers           enable row level security;
alter table public.orders           enable row level security;
alter table public.shipments        enable row level security;
alter table public.claims           enable row level security;
alter table public.group_buys       enable row level security;
alter table public.pledges          enable row level security;
alter table public.messages         enable row level security;
alter table public.reviews          enable row level security;
alter table public.reports          enable row level security;
alter table public.alerts           enable row level security;
alter table public.wanted           enable row level security;

-- Référentiels : lisibles par tous les utilisateurs connectés
create policy naf_read on public.naf_codes    for select to authenticated using (true);
create policy cgu_read on public.cgu_versions for select to authenticated using (true);
create policy admins_self on public.admins    for select to authenticated using (user_id = auth.uid());

-- Fiches publiques : chacun voit la sienne, les membres actifs voient les fiches actives
create policy members_read on public.members for select to authenticated
  using (id = auth.uid() or public.is_admin() or (public.is_active() and status = 'active'));
create policy members_insert on public.members for insert to authenticated
  with check (id = auth.uid());
create policy members_update on public.members for update to authenticated
  using (id = auth.uid() or public.is_admin());

-- Coordonnées : soi-même, l'administrateur, la contrepartie d'une vente confirmée
create policy private_read on public.members_private for select to authenticated
  using (id = auth.uid() or public.is_admin() or public.is_counterparty(id));
create policy private_insert on public.members_private for insert to authenticated
  with check (id = auth.uid());
create policy private_update on public.members_private for update to authenticated
  using (id = auth.uid() or public.is_admin());

create policy cgu_acc_read on public.cgu_acceptances for select to authenticated
  using (member_id = auth.uid() or public.is_admin());
create policy cgu_acc_insert on public.cgu_acceptances for insert to authenticated
  with check (member_id = auth.uid());

-- Lots : visibles par les membres actifs ; publiés et modifiés par leur vendeur actif
create policy offers_read on public.offers for select to authenticated
  using (public.is_active() or seller_id = auth.uid() or public.is_admin());
create policy offers_insert on public.offers for insert to authenticated
  with check (seller_id = auth.uid() and public.is_active());
create policy offers_update on public.offers for update to authenticated
  using (seller_id = auth.uid() or public.is_admin());

-- Commandes : visibles par l'acheteur, le vendeur et l'administrateur
create policy orders_read on public.orders for select to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin());
create policy orders_insert on public.orders for insert to authenticated
  with check (buyer_id = auth.uid() and public.is_active());
create policy orders_update on public.orders for update to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin());

create policy ship_read on public.shipments for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id
         and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())) or public.is_admin());
create policy ship_write on public.shipments for all to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.seller_id = auth.uid()) or public.is_admin())
  with check (exists (select 1 from public.orders o where o.id = order_id and o.seller_id = auth.uid() and o.confirmed_at is not null) or public.is_admin());

create policy claims_read on public.claims for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id
         and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())) or public.is_admin());
create policy claims_insert on public.claims for insert to authenticated
  with check (exists (select 1 from public.orders o where o.id = order_id and o.buyer_id = auth.uid() and o.shipped_at is not null));
create policy claims_update on public.claims for update to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.seller_id = auth.uid()) or public.is_admin());

-- Achats groupés : visibles par les membres actifs, lancés par les producteurs
create policy groups_read on public.group_buys for select to authenticated
  using (public.is_active() or seller_id = auth.uid() or public.is_admin());
create policy groups_insert on public.group_buys for insert to authenticated
  with check (seller_id = auth.uid() and public.is_active() and exists (
    select 1 from public.members m where m.id = auth.uid()
    and m.kind in ('Vigneron / domaine','Négociant','Distillerie','Grossiste / distributeur')));
create policy groups_update on public.group_buys for update to authenticated
  using (seller_id = auth.uid() or public.is_admin());

create policy pledges_read on public.pledges for select to authenticated using (public.is_active() or public.is_admin());
create policy pledges_write on public.pledges for all to authenticated
  using (member_id = auth.uid())
  with check (member_id = auth.uid() and public.is_active()
    and exists (select 1 from public.group_buys g where g.id = group_id and g.status = 'ouvert' and g.deadline > now()));

-- Messages : seulement l'expéditeur et le destinataire
create policy msg_read on public.messages for select to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid());
create policy msg_insert on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_active());
create policy msg_mark_read on public.messages for update to authenticated
  using (recipient_id = auth.uid());

-- Avis : lisibles par les membres actifs, écrits par une partie de la commande remise
create policy reviews_read on public.reviews for select to authenticated using (public.is_active() or public.is_admin());
create policy reviews_insert on public.reviews for insert to authenticated
  with check (author_id = auth.uid() and exists (select 1 from public.orders o where o.id = order_id
    and o.received_at is not null
    and ((o.buyer_id = auth.uid() and o.seller_id = target_id) or (o.seller_id = auth.uid() and o.buyer_id = target_id))));

-- Signalements : écrits par les membres actifs, lus par l'administrateur
create policy reports_insert on public.reports for insert to authenticated
  with check (reporter_id = auth.uid() and public.is_active());
create policy reports_read on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_admin());

-- Recherches « Je cherche » : visibles par les membres actifs, gérées par leur auteur
create policy wanted_read on public.wanted for select to authenticated using (public.is_active() or member_id = auth.uid());
create policy wanted_write on public.wanted for all to authenticated
  using (member_id = auth.uid()) with check (member_id = auth.uid() and public.is_active());

-- Alertes : privées
create policy alerts_own on public.alerts for all to authenticated
  using (member_id = auth.uid()) with check (member_id = auth.uid());

-- ---------------------------------------------------------------------
-- 8. Vues pour l'administrateur
-- ---------------------------------------------------------------------
-- Commissions du mois par vendeur (base de ta facture mensuelle)
create or replace view public.admin_commissions_month with (security_invoker = true) as
select m.id as seller_id, p.legal_name, p.siret, p.vat_number, m.plan,
       count(o.id) as nb_ventes,
       coalesce(sum(o.goods_ht), 0) as ventes_ht,
       coalesce(sum(o.commission_ht), 0) as commission_ht,
       case when m.plan = 'pro' then 29 else 0 end as abonnement_ht
from public.members m
join public.members_private p on p.id = m.id
left join public.orders o on o.seller_id = m.id and o.confirmed_at >= date_trunc('month', now()) and o.cancelled_at is null
group by m.id, p.legal_name, p.siret, p.vat_number, m.plan;

-- Déclaration DAC7 : ventes et commissions par vendeur et par trimestre de l'année
create or replace view public.admin_dac7 with (security_invoker = true) as
select p.legal_name, p.siren, p.vat_number, p.address, p.postcode, m.city,
       extract(quarter from o.confirmed_at)::int as trimestre,
       count(o.id) as nb_ventes, sum(o.goods_ht) as montant_brut, sum(o.commission_ht) as commissions
from public.orders o
join public.members m on m.id = o.seller_id
join public.members_private p on p.id = m.id
where o.confirmed_at >= date_trunc('year', now()) and o.cancelled_at is null
group by p.legal_name, p.siren, p.vat_number, p.address, p.postcode, m.city, trimestre;

-- Vendeurs à surveiller : ventes à prix « rouge » et signalements des 6 derniers mois
create or replace view public.admin_watchlist with (security_invoker = true) as
select o.seller_id, m.pseudo,
       count(distinct r.id) filter (where r.created_at > now() - interval '6 months') as signalements,
       count(distinct r.id) filter (where r.is_producer and r.created_at > now() - interval '6 months') as signalements_producteurs
from public.offers o
join public.members m on m.id = o.seller_id
left join public.reports r on r.offer_id = o.id
group by o.seller_id, m.pseudo;

-- ---------------------------------------------------------------------
-- 9. Stockage des fichiers
--    photos  : public (photos des lots)
--    kbis    : privé (le membre et l'administrateur)
--    litiges : privé (photos de casse)
--    Chaque fichier est rangé dans un dossier portant l'identifiant du membre.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public) values
  ('photos',  'photos',  true),
  ('kbis',    'kbis',    false),
  ('litiges', 'litiges', false)
on conflict (id) do nothing;

create policy photos_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy photos_read on storage.objects for select
  using (bucket_id = 'photos');

create policy kbis_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'kbis' and (storage.foldername(name))[1] = auth.uid()::text);
create policy kbis_read on storage.objects for select to authenticated
  using (bucket_id = 'kbis' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

create policy litiges_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'litiges' and (storage.foldername(name))[1] = auth.uid()::text);
create policy litiges_read on storage.objects for select to authenticated
  using (bucket_id = 'litiges' and auth.uid() is not null);

-- =====================================================================
-- Fin. Ensuite, créez votre compte dans l'application, puis exécutez
-- (en remplaçant l'adresse) pour devenir administrateur :
--
--   insert into public.admins (user_id)
--   select id from auth.users where email = 'votre-adresse@exemple.fr';
-- =====================================================================
