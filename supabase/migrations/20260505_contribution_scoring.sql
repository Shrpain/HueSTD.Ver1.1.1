-- Contribution scoring support: point history + badge automation

create table if not exists public.point_transactions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    points_delta integer not null,
    reason text not null,
    reference_type text,
    reference_id uuid,
    created_at timestamptz not null default now()
);

create index if not exists idx_point_transactions_user_id_created_at
    on public.point_transactions(user_id, created_at desc);

create or replace function public.calculate_profile_badge(p_points integer)
returns text
language plpgsql
immutable
as $$
begin
    if p_points >= 1000 then
        return 'Elite Contributor';
    elsif p_points >= 500 then
        return 'Top Contributor';
    elsif p_points >= 100 then
        return 'Contributor';
    else
        return 'Member';
    end if;
end;
$$;

create or replace function public.sync_profile_badge_from_points()
returns trigger
language plpgsql
as $$
begin
    new.badge := public.calculate_profile_badge(coalesce(new.points, 0));
    return new;
end;
$$;

drop trigger if exists trg_profiles_sync_badge_from_points on public.profiles;
create trigger trg_profiles_sync_badge_from_points
before insert or update of points on public.profiles
for each row
execute function public.sync_profile_badge_from_points();

-- Backfill existing badges based on current points
update public.profiles
set badge = public.calculate_profile_badge(coalesce(points, 0));