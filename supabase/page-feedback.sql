-- ============================================================
-- TEMPORARY: per-page review feedback from the admin.
--
-- Run this once in the Supabase SQL editor (after setup.sql).
-- Any logged-in staff can read it; only the admin can add/delete.
--
-- To remove the feature later, run:
--   drop function if exists admin_delete_page_feedback(uuid, uuid);
--   drop function if exists admin_add_page_feedback(uuid, text, text);
--   drop function if exists list_page_feedback(uuid, text);
--   drop table if exists page_feedback;
-- ============================================================

create table if not exists page_feedback (
  id uuid primary key default gen_random_uuid(),
  page text not null,
  message text not null,
  created_by text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_page_feedback_page on page_feedback (page, created_at desc);

alter table page_feedback enable row level security;
revoke all on page_feedback from anon, authenticated;

create or replace function list_page_feedback(p_token uuid, p_page text)
returns table (id uuid, page text, message text, created_by text, created_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform validate_session(p_token, 'teacher');
  return query
    select f.id, f.page, f.message, f.created_by, f.created_at
    from page_feedback f
    where f.page = p_page
    order by f.created_at desc;
end;
$$;

grant execute on function list_page_feedback(uuid, text) to anon;

create or replace function admin_add_page_feedback(p_token uuid, p_page text, p_message text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session auth_sessions;
begin
  v_session := validate_session(p_token, 'admin');
  if p_message is null or trim(p_message) = '' then
    raise exception 'Please write some feedback.';
  end if;
  if length(p_message) > 2000 or length(coalesce(p_page, '')) > 200 then
    raise exception 'That feedback is too long.';
  end if;
  insert into page_feedback (page, message, created_by)
  values (p_page, trim(p_message), v_session.display_name);
end;
$$;

grant execute on function admin_add_page_feedback(uuid, text, text) to anon;

create or replace function admin_delete_page_feedback(p_token uuid, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform validate_session(p_token, 'admin');
  delete from page_feedback where id = p_id;
end;
$$;

grant execute on function admin_delete_page_feedback(uuid, uuid) to anon;
