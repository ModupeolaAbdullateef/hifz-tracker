-- Hifz Class Tracker — database setup.
-- Safe to re-run: every statement is idempotent.
--
-- Security model:
--   * RLS is enabled on every table with NO policies for anon — the anon key
--     cannot read or write any table directly.
--   * All access goes through SECURITY DEFINER functions, each with an
--     explicit search_path, callable only via supabase.rpc(...).
--   * EXECUTE is granted to anon only on the functions explicitly listed
--     below. `validate_session`, `build_student_bundle` and
--     `set_initial_codes` are internal/bootstrap and are never granted.

create extension if not exists pgcrypto;

-- ============================================================
-- Tables
-- ============================================================

create table if not exists course (
  id smallint primary key default 1,
  name text not null default 'Hifz Class',
  start_date date not null,
  weeks int not null default 10,
  class_weekday smallint not null default 4, -- 4 = Thursday (ISO-ish, 0=Sun..6=Sat here)
  target_pages numeric,
  constraint course_single_row check (id = 1)
);

create table if not exists course_weeks (
  week_number int primary key,
  class_date date not null,
  cancelled boolean not null default false,
  note text
);

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  student_code text not null unique,
  join_week int not null default 1,
  target_pages numeric,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_students_active on students (active);

create table if not exists record_fields (
  key text primary key,
  label text not null,
  type text not null check (type in ('number', 'yesno')),
  unit text,
  sort_order int not null default 0,
  active boolean not null default true
);

create table if not exists weekly_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  week_number int not null,
  status text not null check (status in ('present', 'absent')),
  good_week boolean not null default false,
  values jsonb not null default '{}'::jsonb,
  note text,
  next_assignment text,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, week_number)
);

create index if not exists idx_weekly_records_student on weekly_records (student_id);
create index if not exists idx_weekly_records_week on weekly_records (week_number);

create table if not exists badges (
  student_id uuid not null references students (id) on delete cascade,
  badge_key text not null,
  awarded_at timestamptz not null default now(),
  primary key (student_id, badge_key)
);

create table if not exists tips (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('technique', 'schedule', 'announcement')),
  text text not null,
  active boolean not null default true,
  sort_order int not null default 0
);

create index if not exists idx_tips_active on tips (active);

create table if not exists settings (
  id smallint primary key default 1,
  teacher_code_hash text,
  admin_code_hash text,
  constraint settings_single_row check (id = 1)
);

create table if not exists auth_sessions (
  token uuid primary key default gen_random_uuid(),
  role text not null check (role in ('teacher', 'admin')),
  display_name text not null,
  expires_at timestamptz not null
);

create index if not exists idx_auth_sessions_expires on auth_sessions (expires_at);

create table if not exists login_attempts (
  id bigserial primary key,
  kind text not null check (kind in ('staff_login', 'student_code')),
  identifier text not null,
  success boolean not null,
  attempted_at timestamptz not null default now()
);

create index if not exists idx_login_attempts_lookup on login_attempts (kind, identifier, attempted_at);

-- ============================================================
-- Row Level Security — enabled everywhere, no policies for anon.
-- ============================================================

alter table course enable row level security;
alter table course_weeks enable row level security;
alter table students enable row level security;
alter table record_fields enable row level security;
alter table weekly_records enable row level security;
alter table badges enable row level security;
alter table tips enable row level security;
alter table settings enable row level security;
alter table auth_sessions enable row level security;
alter table login_attempts enable row level security;

-- Belt-and-braces: explicitly revoke any default table grants on anon /
-- authenticated so direct PostgREST table access is denied regardless of RLS.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- ============================================================
-- Internal helpers (never granted to anon)
-- ============================================================

create or replace function validate_session(p_token uuid, p_min_role text default 'teacher')
returns auth_sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session auth_sessions;
begin
  if p_token is null then
    raise exception 'Not signed in.';
  end if;

  select * into v_session from auth_sessions s where s.token = p_token and s.expires_at > now();

  if v_session.token is null then
    raise exception 'Session expired or invalid. Please log in again.';
  end if;

  if p_min_role = 'admin' and v_session.role <> 'admin' then
    raise exception 'This action requires admin access.';
  end if;

  if p_min_role = 'teacher' and v_session.role not in ('teacher', 'admin') then
    raise exception 'This action requires staff access.';
  end if;

  return v_session;
end;
$$;

create or replace function build_student_bundle(p_student_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_student jsonb;
  v_course jsonb;
  v_weeks jsonb;
  v_fields jsonb;
  v_records jsonb;
  v_badges jsonb;
  v_totals jsonb;
begin
  select to_jsonb(s) into v_student from students s where s.id = p_student_id;
  if v_student is null then
    raise exception 'Student not found.';
  end if;

  select to_jsonb(c) into v_course from course c where c.id = 1;

  select coalesce(jsonb_agg(to_jsonb(w) order by w.week_number), '[]'::jsonb)
    into v_weeks from course_weeks w;

  select coalesce(jsonb_agg(to_jsonb(f) order by f.sort_order), '[]'::jsonb)
    into v_fields from record_fields f where f.active;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.week_number), '[]'::jsonb)
    into v_records from weekly_records r where r.student_id = p_student_id;

  select coalesce(jsonb_agg(to_jsonb(b)), '[]'::jsonb)
    into v_badges from badges b where b.student_id = p_student_id;

  select jsonb_build_object(
    'new_hifz_total', coalesce(sum((r.values ->> 'new_hifz')::numeric), 0),
    'old_hifz_total', coalesce(sum((r.values ->> 'old_hifz')::numeric), 0),
    'weeks_present', coalesce(sum(case when r.status = 'present' then 1 else 0 end), 0),
    'weeks_recorded', count(*),
    'good_weeks', coalesce(sum(case when r.good_week then 1 else 0 end), 0)
  )
    into v_totals from weekly_records r where r.student_id = p_student_id;

  return jsonb_build_object(
    'student', v_student,
    'course', v_course,
    'weeks', v_weeks,
    'fields', v_fields,
    'records', v_records,
    'totals', v_totals,
    'badges', v_badges
  );
end;
$$;

-- ============================================================
-- Public functions
-- ============================================================

create or replace function search_students(p_q text)
returns table (id uuid, first_name text, last_initial text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_q is null or length(trim(p_q)) < 2 then
    return;
  end if;

  return query
    select s.id, s.first_name, upper(left(s.last_name, 1))
    from students s
    where s.active
      and (s.first_name ilike '%' || trim(p_q) || '%' or s.last_name ilike '%' || trim(p_q) || '%')
    order by s.first_name, s.last_name
    limit 10;
end;
$$;

grant execute on function search_students(text) to anon;

create or replace function get_student_record(p_student_id uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_student students;
  v_recent_failures int;
begin
  select count(*) into v_recent_failures
  from login_attempts
  where kind = 'student_code'
    and identifier = p_student_id::text
    and success = false
    and attempted_at > now() - interval '15 minutes';

  if v_recent_failures >= 10 then
    raise exception 'Too many attempts. Please try again later.';
  end if;

  select * into v_student from students s where s.id = p_student_id;

  if v_student.id is null or p_code is null or v_student.student_code <> trim(p_code) then
    insert into login_attempts (kind, identifier, success) values ('student_code', p_student_id::text, false);
    raise exception 'Invalid code.';
  end if;

  insert into login_attempts (kind, identifier, success) values ('student_code', p_student_id::text, true);

  return build_student_bundle(p_student_id);
end;
$$;

grant execute on function get_student_record(uuid, text) to anon;

create or replace function get_active_tips()
returns table (id uuid, category text, text text, active boolean, sort_order int)
language sql
security definer
set search_path = public, pg_temp
as $$
  select t.id, t.category, t.text, t.active, t.sort_order
  from tips t
  where t.active
  order by t.sort_order;
$$;

grant execute on function get_active_tips() to anon;

create or replace function staff_login(p_display_name text, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_settings settings;
  v_role text;
  v_token uuid;
  v_expires timestamptz;
  v_recent_failures int;
  v_identifier text;
begin
  if p_display_name is null or trim(p_display_name) = '' then
    raise exception 'Name is required.';
  end if;

  v_identifier := lower(trim(p_display_name));

  select count(*) into v_recent_failures
  from login_attempts
  where kind = 'staff_login'
    and identifier = v_identifier
    and success = false
    and attempted_at > now() - interval '15 minutes';

  if v_recent_failures >= 10 then
    raise exception 'Too many attempts. Please try again later.';
  end if;

  select * into v_settings from settings where id = 1;

  if v_settings.admin_code_hash is not null and crypt(p_code, v_settings.admin_code_hash) = v_settings.admin_code_hash then
    v_role := 'admin';
  elsif v_settings.teacher_code_hash is not null and crypt(p_code, v_settings.teacher_code_hash) = v_settings.teacher_code_hash then
    v_role := 'teacher';
  else
    insert into login_attempts (kind, identifier, success) values ('staff_login', v_identifier, false);
    raise exception 'Incorrect name or access code.';
  end if;

  insert into login_attempts (kind, identifier, success) values ('staff_login', v_identifier, true);

  v_token := gen_random_uuid();
  v_expires := now() + interval '12 hours';

  insert into auth_sessions (token, role, display_name, expires_at)
    values (v_token, v_role, trim(p_display_name), v_expires);

  return jsonb_build_object('token', v_token, 'role', v_role, 'expires_at', v_expires);
end;
$$;

grant execute on function staff_login(text, text) to anon;

create or replace function staff_logout(p_token uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from auth_sessions where token = p_token;
$$;

grant execute on function staff_logout(uuid) to anon;

-- ============================================================
-- Teacher functions (token role: teacher or admin)
-- ============================================================

create or replace function staff_search_students(p_token uuid, p_q text)
returns table (id uuid, first_name text, last_name text, student_code text, join_week int, target_pages numeric, active boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform validate_session(p_token, 'teacher');

  return query
    select s.id, s.first_name, s.last_name, s.student_code, s.join_week, s.target_pages, s.active
    from students s
    where s.active
      and (p_q is null or trim(p_q) = '' or s.first_name ilike '%' || trim(p_q) || '%' or s.last_name ilike '%' || trim(p_q) || '%')
    order by s.first_name, s.last_name;
end;
$$;

grant execute on function staff_search_students(uuid, text) to anon;

create or replace function get_student_grid(p_token uuid, p_student_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform validate_session(p_token, 'teacher');
  return build_student_bundle(p_student_id);
end;
$$;

grant execute on function get_student_grid(uuid, uuid) to anon;

create or replace function save_weekly_record(
  p_token uuid,
  p_student_id uuid,
  p_week_number int,
  p_status text,
  p_good_week boolean,
  p_values jsonb,
  p_note text,
  p_next_assignment text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session auth_sessions;
  v_field record;
  v_existing weekly_records;
  v_now timestamptz := now();
  v_total_new_hifz numeric;
  v_good_count int;
  v_absent_count int;
  v_present_count int;
  v_target numeric;
  v_values jsonb := coalesce(p_values, '{}'::jsonb);
begin
  v_session := validate_session(p_token, 'teacher');

  if p_status not in ('present', 'absent') then
    raise exception 'Invalid status.';
  end if;

  if p_status = 'absent' then
    v_values := '{}'::jsonb;
  else
    for v_field in select * from record_fields where active loop
      if v_values ? v_field.key and v_values -> v_field.key <> 'null'::jsonb then
        if v_field.type = 'yesno' and jsonb_typeof(v_values -> v_field.key) <> 'boolean' then
          raise exception 'Field % must be yes/no.', v_field.label;
        end if;
        if v_field.type = 'number' and jsonb_typeof(v_values -> v_field.key) <> 'number' then
          raise exception 'Field % must be a number.', v_field.label;
        end if;
      end if;
    end loop;
  end if;

  select * into v_existing from weekly_records r where r.student_id = p_student_id and r.week_number = p_week_number;

  insert into weekly_records (
    student_id, week_number, status, good_week, values, note, next_assignment, created_by, updated_by, created_at, updated_at
  )
  values (
    p_student_id, p_week_number, p_status, p_good_week, v_values, p_note, p_next_assignment,
    v_session.display_name, v_session.display_name, v_now, v_now
  )
  on conflict (student_id, week_number) do update set
    status = excluded.status,
    good_week = excluded.good_week,
    values = excluded.values,
    note = excluded.note,
    next_assignment = excluded.next_assignment,
    updated_by = excluded.updated_by,
    updated_at = v_now;

  -- Badges (awarded automatically; never deleted once earned, except the
  -- "perfect attendance so far" status badge which reflects current state).
  if v_existing.student_id is null then
    insert into badges (student_id, badge_key) values (p_student_id, 'first_record') on conflict do nothing;
  end if;

  if p_good_week then
    insert into badges (student_id, badge_key) values (p_student_id, 'first_good_week') on conflict do nothing;

    select count(*) into v_good_count from weekly_records r where r.student_id = p_student_id and r.good_week;
    if v_good_count >= 3 then
      insert into badges (student_id, badge_key) values (p_student_id, 'three_good_weeks') on conflict do nothing;
    end if;
  end if;

  select count(*) into v_present_count from weekly_records r where r.student_id = p_student_id;
  select count(*) into v_absent_count from weekly_records r where r.student_id = p_student_id and r.status = 'absent';

  if v_present_count > 0 and v_absent_count = 0 then
    insert into badges (student_id, badge_key) values (p_student_id, 'perfect_attendance') on conflict do nothing;
  else
    delete from badges where student_id = p_student_id and badge_key = 'perfect_attendance';
  end if;

  select coalesce(sum((r.values ->> 'new_hifz')::numeric), 0) into v_total_new_hifz
  from weekly_records r where r.student_id = p_student_id;

  if v_total_new_hifz >= 1 then
    insert into badges (student_id, badge_key) values (p_student_id, 'pages_1') on conflict do nothing;
  end if;
  if v_total_new_hifz >= 5 then
    insert into badges (student_id, badge_key) values (p_student_id, 'pages_5') on conflict do nothing;
  end if;
  if v_total_new_hifz >= 10 then
    insert into badges (student_id, badge_key) values (p_student_id, 'pages_10') on conflict do nothing;
  end if;

  select coalesce(s.target_pages, c.target_pages) into v_target
  from students s, course c where s.id = p_student_id and c.id = 1;

  if v_target is not null and v_total_new_hifz >= v_target then
    insert into badges (student_id, badge_key) values (p_student_id, 'target_reached') on conflict do nothing;
  end if;
end;
$$;

grant execute on function save_weekly_record(uuid, uuid, int, text, boolean, jsonb, text, text) to anon;

create or replace function get_week_roster(p_token uuid, p_week_number int)
returns table (student_id uuid, first_name text, last_name text, has_record boolean, status text, good_week boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform validate_session(p_token, 'teacher');

  return query
    select
      s.id,
      s.first_name,
      s.last_name,
      (r.student_id is not null) as has_record,
      r.status,
      coalesce(r.good_week, false)
    from students s
    left join weekly_records r on r.student_id = s.id and r.week_number = p_week_number
    where s.active
    order by s.first_name, s.last_name;
end;
$$;

grant execute on function get_week_roster(uuid, int) to anon;

create or replace function get_class_overview(p_token uuid)
returns table (
  student_id uuid,
  first_name text,
  last_name text,
  new_hifz_total numeric,
  old_hifz_total numeric,
  attendance_pct numeric,
  good_weeks int,
  last_recorded_week int,
  on_track boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_weeks_elapsed int;
  v_total_weeks int;
  v_default_target numeric;
begin
  perform validate_session(p_token, 'teacher');

  select count(*) into v_weeks_elapsed
  from course_weeks w
  where w.class_date <= (now() at time zone 'Europe/London')::date and not w.cancelled;

  select c.weeks, c.target_pages into v_total_weeks, v_default_target from course c where c.id = 1;

  return query
    select
      s.id,
      s.first_name,
      s.last_name,
      coalesce(sum((r.values ->> 'new_hifz')::numeric), 0) as new_hifz_total,
      coalesce(sum((r.values ->> 'old_hifz')::numeric), 0) as old_hifz_total,
      case when count(r.*) > 0
        then round(100.0 * sum(case when r.status = 'present' then 1 else 0 end) / count(r.*), 0)
        else 0
      end as attendance_pct,
      coalesce(sum(case when r.good_week then 1 else 0 end), 0)::int as good_weeks,
      max(r.week_number) as last_recorded_week,
      case
        when coalesce(s.target_pages, v_default_target) is null then null
        when v_weeks_elapsed = 0 then true
        else coalesce(sum((r.values ->> 'new_hifz')::numeric), 0) >=
             coalesce(s.target_pages, v_default_target) * v_weeks_elapsed / greatest(v_total_weeks, 1)
      end as on_track
    from students s
    left join weekly_records r on r.student_id = s.id
    where s.active
    group by s.id, s.first_name, s.last_name, s.target_pages
    order by s.first_name, s.last_name;
end;
$$;

grant execute on function get_class_overview(uuid) to anon;

-- ============================================================
-- Admin-only functions
-- ============================================================

create or replace function upsert_student(
  p_token uuid, p_id uuid, p_first_name text, p_last_name text, p_join_week int, p_target_pages numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid := p_id;
  v_code text;
begin
  perform validate_session(p_token, 'admin');

  if p_first_name is null or trim(p_first_name) = '' or p_last_name is null or trim(p_last_name) = '' then
    raise exception 'First and last name are required.';
  end if;

  if v_id is null then
    loop
      v_code := 'HZ-' || lpad(floor(random() * 10000)::int::text, 4, '0');
      exit when not exists (select 1 from students where student_code = v_code);
    end loop;

    insert into students (first_name, last_name, student_code, join_week, target_pages)
    values (trim(p_first_name), trim(p_last_name), v_code, coalesce(p_join_week, 1), p_target_pages)
    returning id into v_id;
  else
    update students set
      first_name = trim(p_first_name),
      last_name = trim(p_last_name),
      join_week = coalesce(p_join_week, join_week),
      target_pages = p_target_pages
    where id = v_id;
  end if;

  select student_code into v_code from students where id = v_id;
  return jsonb_build_object('id', v_id, 'student_code', v_code);
end;
$$;

grant execute on function upsert_student(uuid, uuid, text, text, int, numeric) to anon;

create or replace function deactivate_student(p_token uuid, p_student_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform validate_session(p_token, 'admin');
  update students set active = p_active where id = p_student_id;
end;
$$;

grant execute on function deactivate_student(uuid, uuid, boolean) to anon;

create or replace function regenerate_student_code(p_token uuid, p_student_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code text;
begin
  perform validate_session(p_token, 'admin');

  loop
    v_code := 'HZ-' || lpad(floor(random() * 10000)::int::text, 4, '0');
    exit when not exists (select 1 from students where student_code = v_code);
  end loop;

  update students set student_code = v_code where id = p_student_id;
  return jsonb_build_object('student_code', v_code);
end;
$$;

grant execute on function regenerate_student_code(uuid, uuid) to anon;

create or replace function update_course(p_token uuid, p_name text, p_start_date date, p_weeks int, p_target_pages numeric)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  i int;
begin
  perform validate_session(p_token, 'admin');

  update course set
    name = p_name,
    start_date = p_start_date,
    weeks = p_weeks,
    target_pages = p_target_pages
  where id = 1;

  for i in 1..p_weeks loop
    insert into course_weeks (week_number, class_date)
    values (i, p_start_date + ((i - 1) * 7))
    on conflict (week_number) do update set class_date = excluded.class_date;
  end loop;

  delete from course_weeks where week_number > p_weeks;
end;
$$;

grant execute on function update_course(uuid, text, date, int, numeric) to anon;

create or replace function set_week_cancelled(p_token uuid, p_week_number int, p_cancelled boolean, p_note text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform validate_session(p_token, 'admin');
  update course_weeks set cancelled = p_cancelled, note = p_note where week_number = p_week_number;
end;
$$;

grant execute on function set_week_cancelled(uuid, int, boolean, text) to anon;

create or replace function upsert_record_field(
  p_token uuid, p_key text, p_label text, p_type text, p_unit text, p_sort_order int, p_active boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform validate_session(p_token, 'admin');

  if p_type not in ('number', 'yesno') then
    raise exception 'Invalid field type.';
  end if;

  insert into record_fields (key, label, type, unit, sort_order, active)
  values (p_key, p_label, p_type, p_unit, p_sort_order, p_active)
  on conflict (key) do update set
    label = excluded.label,
    type = excluded.type,
    unit = excluded.unit,
    sort_order = excluded.sort_order,
    active = excluded.active;
end;
$$;

grant execute on function upsert_record_field(uuid, text, text, text, text, int, boolean) to anon;

create or replace function upsert_tip(p_token uuid, p_id uuid, p_category text, p_text text, p_active boolean, p_sort_order int)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform validate_session(p_token, 'admin');

  if p_category not in ('technique', 'schedule', 'announcement') then
    raise exception 'Invalid category.';
  end if;

  if p_id is null then
    insert into tips (category, text, active, sort_order) values (p_category, p_text, p_active, p_sort_order);
  else
    update tips set category = p_category, text = p_text, active = p_active, sort_order = p_sort_order
    where id = p_id;
  end if;
end;
$$;

grant execute on function upsert_tip(uuid, uuid, text, text, boolean, int) to anon;

create or replace function delete_tip(p_token uuid, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform validate_session(p_token, 'admin');
  delete from tips where id = p_id;
end;
$$;

grant execute on function delete_tip(uuid, uuid) to anon;

create or replace function set_codes(p_token uuid, p_new_teacher_code text, p_new_admin_code text)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  perform validate_session(p_token, 'admin');

  if p_new_teacher_code is not null and trim(p_new_teacher_code) <> '' then
    update settings set teacher_code_hash = crypt(trim(p_new_teacher_code), gen_salt('bf')) where id = 1;
  end if;

  if p_new_admin_code is not null and trim(p_new_admin_code) <> '' then
    update settings set admin_code_hash = crypt(trim(p_new_admin_code), gen_salt('bf')) where id = 1;
  end if;
end;
$$;

grant execute on function set_codes(uuid, text, text) to anon;

create or replace function export_class(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rows jsonb;
begin
  perform validate_session(p_token, 'admin');

  select coalesce(jsonb_agg(
    row_data
    order by row_data ->> 'student_last_name', row_data ->> 'student_first_name', (row_data ->> 'week_number')::int
  ), '[]'::jsonb)
  into v_rows
  from (
    select
      jsonb_build_object(
        'student_first_name', s.first_name,
        'student_last_name', s.last_name,
        'student_code', s.student_code,
        'week_number', w.week_number,
        'class_date', to_char(w.class_date, 'DD/MM/YYYY'),
        'status', coalesce(r.status, ''),
        'good_week', coalesce(r.good_week, false)
      ) || coalesce(
        (select jsonb_object_agg(f.key, r.values -> f.key) from record_fields f where r.id is not null),
        '{}'::jsonb
      ) as row_data
    from students s
    cross join course_weeks w
    left join weekly_records r on r.student_id = s.id and r.week_number = w.week_number
    where s.active
  ) t;

  return v_rows;
end;
$$;

grant execute on function export_class(uuid) to anon;

create or replace function admin_list_students(p_token uuid)
returns table (id uuid, first_name text, last_name text, student_code text, join_week int, target_pages numeric, active boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform validate_session(p_token, 'admin');

  return query
    select s.id, s.first_name, s.last_name, s.student_code, s.join_week, s.target_pages, s.active
    from students s
    order by s.active desc, s.first_name, s.last_name;
end;
$$;

grant execute on function admin_list_students(uuid) to anon;

create or replace function admin_list_tips(p_token uuid)
returns table (id uuid, category text, text text, active boolean, sort_order int)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform validate_session(p_token, 'admin');
  return query select t.id, t.category, t.text, t.active, t.sort_order from tips t order by t.sort_order;
end;
$$;

grant execute on function admin_list_tips(uuid) to anon;

create or replace function get_record_fields(p_token uuid)
returns table (key text, label text, type text, unit text, sort_order int, active boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform validate_session(p_token, 'admin');
  return query select f.key, f.label, f.type, f.unit, f.sort_order, f.active from record_fields f order by f.sort_order;
end;
$$;

grant execute on function get_record_fields(uuid) to anon;

create or replace function get_course_weeks(p_token uuid)
returns table (week_number int, class_date date, cancelled boolean, note text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform validate_session(p_token, 'admin');
  return query select w.week_number, w.class_date, w.cancelled, w.note from course_weeks w order by w.week_number;
end;
$$;

grant execute on function get_course_weeks(uuid) to anon;

-- Returns a single composite row (not SETOF), so Supabase hands the
-- frontend one JSON object rather than a one-element array.
create or replace function get_course(p_token uuid)
returns course
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_course course;
begin
  perform validate_session(p_token, 'admin');
  select * into v_course from course c where c.id = 1;
  return v_course;
end;
$$;

grant execute on function get_course(uuid) to anon;

-- ============================================================
-- Useful Docs — admin-uploaded files, publicly downloadable.
--
-- Storage access can't take a token as a function argument the way RPCs
-- do, so admin-only writes are enforced by a storage.objects RLS policy
-- that checks a custom `x-admin-token` request header against
-- auth_sessions (same validity check as validate_session, just surfaced
-- at the Storage layer). Downloads are public since these are meant to be
-- freely viewable by students/parents without a student code.
-- ============================================================

create table if not exists resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  sort_order int not null default 0,
  active boolean not null default true,
  uploaded_by text,
  created_at timestamptz not null default now()
);

alter table resources enable row level security;
revoke all on resources from anon, authenticated;

create or replace function get_active_resources()
returns table (id uuid, title text, description text, storage_path text, file_name text, mime_type text, size_bytes bigint)
language sql
security definer
set search_path = public, pg_temp
as $$
  select r.id, r.title, r.description, r.storage_path, r.file_name, r.mime_type, r.size_bytes
  from resources r
  where r.active
  order by r.sort_order;
$$;

grant execute on function get_active_resources() to anon;

create or replace function admin_list_resources(p_token uuid)
returns table (
  id uuid, title text, description text, storage_path text, file_name text,
  mime_type text, size_bytes bigint, sort_order int, active boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform validate_session(p_token, 'admin');
  return query
    select r.id, r.title, r.description, r.storage_path, r.file_name, r.mime_type, r.size_bytes, r.sort_order, r.active
    from resources r
    order by r.sort_order;
end;
$$;

grant execute on function admin_list_resources(uuid) to anon;

create or replace function upsert_resource_meta(
  p_token uuid, p_id uuid, p_title text, p_description text, p_storage_path text,
  p_file_name text, p_mime_type text, p_size_bytes bigint, p_sort_order int, p_active boolean
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session auth_sessions;
  v_id uuid := p_id;
begin
  v_session := validate_session(p_token, 'admin');

  if v_id is null then
    insert into resources (title, description, storage_path, file_name, mime_type, size_bytes, sort_order, active, uploaded_by)
    values (p_title, p_description, p_storage_path, p_file_name, p_mime_type, p_size_bytes, p_sort_order, p_active, v_session.display_name)
    returning id into v_id;
  else
    update resources set
      title = p_title,
      description = p_description,
      sort_order = p_sort_order,
      active = p_active
    where id = v_id;
  end if;

  return v_id;
end;
$$;

grant execute on function upsert_resource_meta(uuid, uuid, text, text, text, text, text, bigint, int, boolean) to anon;

create or replace function delete_resource(p_token uuid, p_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_path text;
begin
  perform validate_session(p_token, 'admin');
  select storage_path into v_path from resources where id = p_id;
  delete from resources where id = p_id;
  return v_path;
end;
$$;

grant execute on function delete_resource(uuid, uuid) to anon;

-- Checks the admin-session token passed in the 'x-admin-token' header by
-- the browser's storage-only client (see src/lib/supabase.ts).
create or replace function storage_is_admin()
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_token text;
begin
  v_token := nullif(current_setting('request.headers', true)::json ->> 'x-admin-token', '');
  if v_token is null then
    return false;
  end if;
  return exists (
    select 1 from auth_sessions s
    where s.token = v_token::uuid and s.role = 'admin' and s.expires_at > now()
  );
exception when others then
  return false;
end;
$$;

grant execute on function storage_is_admin() to anon;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resources',
  'resources',
  true,
  20971520,
  array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "resources_admin_insert" on storage.objects;
create policy "resources_admin_insert" on storage.objects
  for insert to anon
  with check (bucket_id = 'resources' and storage_is_admin());

drop policy if exists "resources_admin_update" on storage.objects;
create policy "resources_admin_update" on storage.objects
  for update to anon
  using (bucket_id = 'resources' and storage_is_admin())
  with check (bucket_id = 'resources' and storage_is_admin());

drop policy if exists "resources_admin_delete" on storage.objects;
create policy "resources_admin_delete" on storage.objects
  for delete to anon
  using (bucket_id = 'resources' and storage_is_admin());

drop policy if exists "resources_public_select" on storage.objects;
create policy "resources_public_select" on storage.objects
  for select to anon
  using (bucket_id = 'resources');

-- ============================================================
-- Bootstrap function — NOT granted to anon. Run manually below.
-- ============================================================

create or replace function set_initial_codes(p_teacher_code text, p_admin_code text)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  insert into settings (id, teacher_code_hash, admin_code_hash)
  values (1, crypt(p_teacher_code, gen_salt('bf')), crypt(p_admin_code, gen_salt('bf')))
  on conflict (id) do update set
    teacher_code_hash = excluded.teacher_code_hash,
    admin_code_hash = excluded.admin_code_hash;
end;
$$;

-- ============================================================
-- Seed data
-- ============================================================

insert into course (id, name, start_date, weeks, class_weekday, target_pages)
values (1, 'Hifz Class', date '2026-10-15', 10, 4, null)
on conflict (id) do nothing;

insert into settings (id) values (1) on conflict (id) do nothing;

insert into course_weeks (week_number, class_date)
select gs, (date '2026-10-15' + ((gs - 1) * 7))
from generate_series(1, 10) gs
on conflict (week_number) do nothing;

insert into record_fields (key, label, type, unit, sort_order, active) values
  ('new_hifz', 'New Hifz', 'number', 'pages', 1, true),
  ('old_hifz', 'Old Hifz', 'number', 'pages', 2, true),
  ('revision', 'Revision', 'yesno', null, 3, true),
  ('tajweed', 'Tajweed', 'yesno', null, 4, true)
on conflict (key) do nothing;

insert into tips (category, text, sort_order, active)
select v.category, v.text, v.sort_order, true
from (values
  ('technique', 'Listen to your new ayaat recited by a qari several times before you start memorising.', 1),
  ('technique', 'Repeat each ayah 10-20 times looking, then 10-20 times without looking, before moving on.', 2),
  ('technique', 'Join the ayaat together: recite ayah 1+2, then 1+2+3, building up the passage.', 3),
  ('technique', 'Always use the same mushaf so your mind remembers where each ayah sits on the page.', 4),
  ('technique', 'Recite your new portion in your sunnah and nafl prayers.', 5),
  ('technique', 'Understand the meaning of what you memorise -- it makes the words stick.', 6),
  ('schedule', 'Memorise your new hifz after Fajr, when your mind is fresh.', 7),
  ('schedule', 'Every day has three parts: new hifz, old hifz and revision. Never skip revision.', 8),
  ('schedule', 'Little and often beats a lot once a week. Try 20 focused minutes every day.', 9),
  ('schedule', 'Recite your new hifz to a family member before Thursday''s class.', 10),
  ('schedule', 'Revise before you sleep, and test yourself again in the morning.', 11),
  ('schedule', 'Pick a fixed time and place each day for your hifz so it becomes a habit.', 12)
) as v(category, text, sort_order)
where not exists (select 1 from tips t where t.text = v.text);

-- ============================================================
-- EDIT THESE, then run once in the SQL editor to set the
-- initial teacher and admin access codes:
-- ============================================================
-- select set_initial_codes('CHANGE-ME-TEACHER', 'CHANGE-ME-ADMIN');
