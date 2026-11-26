-- SiteClic : garantie des réservations (empreinte bancaire ou acompte via Stripe) — 26/11/2026.
-- À exécuter une fois dans Supabase > SQL Editor.

alter table public.reservations add column if not exists pay_session text;
alter table public.reservations add column if not exists pay_mode text not null default '';
alter table public.reservations add column if not exists pay_amount int not null default 0;   -- centimes
alter table public.reservations add column if not exists pay_charged int not null default 0;  -- centimes prélevés pour absence

-- Relie le paiement Stripe à la réservation qui vient d'être faite (appelé par le serveur SiteClic).
-- Ce n'est qu'un repère : l'état réel du paiement est toujours relu chez Stripe.
create or replace function public.attach_reservation_payment(
  p_slug text, p_phone text, p_day date, p_time text, p_session text, p_mode text, p_amount int
) returns boolean
language plpgsql security definer set search_path = public
as $$
declare rid uuid;
begin
  if p_session !~ '^cs_[A-Za-z0-9_]{10,200}$' or p_mode not in ('empreinte', 'acompte') then return false; end if;
  select r.id into rid from public.reservations r join public.sites s on s.id = r.site_id
  where s.slug = p_slug and r.phone = trim(p_phone) and r.day = p_day and r.time = p_time
    and r.pay_session is null and r.created_at > now() - interval '10 minutes'
  order by r.created_at desc limit 1;
  if rid is null then return false; end if;
  update public.reservations set pay_session = p_session, pay_mode = p_mode, pay_amount = greatest(0, least(p_amount, 1000000)) where id = rid;
  return true;
end;
$$;
revoke all on function public.attach_reservation_payment(text, text, date, text, text, text, int) from public;
grant execute on function public.attach_reservation_payment(text, text, date, text, text, text, int) to anon, authenticated;
