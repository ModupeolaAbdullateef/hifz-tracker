-- Hifdh Portal — database setup (run AFTER setup.sql). Safe to re-run.
--
-- Same security model as setup.sql: RLS on every table with no anon
-- policies, and all access through SECURITY DEFINER functions that check a
-- staff session token (auth_sessions) or a student's personal link + PIN.
--
-- Brothers and Sisters are separate groups: a teacher's session carries a
-- group_id and every function refuses data from the other group. Admin
-- sessions (group_id null) can see both.

create extension if not exists pgcrypto;

-- ============================================================
-- Tables
-- ============================================================

create table if not exists hf_groups (
  id smallserial primary key,
  name text not null unique,
  teacher_code_hash text,
  sort_order int not null default 0
);

create table if not exists hf_students (
  id uuid primary key default gen_random_uuid(),
  group_id smallint not null references hf_groups (id),
  code text not null,
  display_name text not null,
  status text not null default 'active' check (status in ('active', 'left', 'archived')),
  notes text,
  link_token text not null unique,
  pin text not null,
  created_at timestamptz not null default now(),
  unique (group_id, code)
);

create table if not exists hf_teachers (
  id uuid primary key default gen_random_uuid(),
  group_id smallint not null references hf_groups (id),
  name text not null,
  initials text not null,
  colour text,
  student_id uuid references hf_students (id) on delete set null,
  active boolean not null default true
);

create table if not exists hf_terms (
  id serial primary key,
  group_id smallint not null references hf_groups (id),
  name text not null,
  start_date date not null,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists hf_term_weeks (
  term_id int not null references hf_terms (id) on delete cascade,
  week_number int not null,
  class_date date not null,
  cancelled boolean not null default false,
  primary key (term_id, week_number)
);

create table if not exists hf_enrolments (
  term_id int not null references hf_terms (id) on delete cascade,
  student_id uuid not null references hf_students (id) on delete cascade,
  pages_before numeric not null default 0,
  projected_override numeric,
  paid boolean not null default false,
  exception_from date,
  exception_until date,
  primary key (term_id, student_id)
);

create table if not exists hf_lines (
  id uuid primary key default gen_random_uuid(),
  term_id int not null references hf_terms (id) on delete cascade,
  student_id uuid not null references hf_students (id) on delete cascade,
  label text not null,
  type text not null check (type in ('new_hifdh', 'planned_pages', 'juz', 'prev5', 'revision', 'half_revision', 'juz_tests', 'custom')),
  sort_order int not null default 0,
  has_done boolean not null default true,
  done_label text
);

create index if not exists idx_hf_lines_term on hf_lines (term_id, student_id);

create table if not exists hf_targets (
  line_id uuid not null references hf_lines (id) on delete cascade,
  week int not null,
  plan text,
  override text,
  updated_by text,
  updated_at timestamptz not null default now(),
  primary key (line_id, week)
);

create table if not exists hf_results (
  line_id uuid not null references hf_lines (id) on delete cascade,
  week int not null,
  value text not null,
  initials text,
  note text,
  updated_by text,
  updated_at timestamptz not null default now(),
  primary key (line_id, week)
);

create table if not exists hf_attendance (
  term_id int not null references hf_terms (id) on delete cascade,
  student_id uuid not null references hf_students (id) on delete cascade,
  week int not null,
  absent boolean not null,
  initials text,
  updated_by text,
  updated_at timestamptz not null default now(),
  primary key (term_id, student_id, week)
);

create table if not exists hf_pairs (
  id serial primary key,
  term_id int not null references hf_terms (id) on delete cascade,
  pair_number int not null
);

create table if not exists hf_pair_members (
  pair_id int not null references hf_pairs (id) on delete cascade,
  student_id uuid not null references hf_students (id) on delete cascade,
  revising text,
  primary key (pair_id, student_id)
);

create table if not exists hf_notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references hf_students (id) on delete cascade,
  author text not null,
  text text not null,
  visible_to_student boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists hf_selfchecks (
  line_id uuid not null references hf_lines (id) on delete cascade,
  week int not null,
  checked_at timestamptz not null default now(),
  primary key (line_id, week)
);

create table if not exists hf_audit (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor text not null,
  action text not null,
  entity text not null,
  entity_key jsonb not null,
  student_id uuid,
  before jsonb,
  after jsonb
);

create index if not exists idx_hf_audit_at on hf_audit (at desc);

alter table auth_sessions add column if not exists group_id smallint;
alter table auth_sessions add column if not exists teacher_id uuid;
alter table auth_sessions add column if not exists initials text;

alter table hf_groups enable row level security;
alter table hf_students enable row level security;
alter table hf_teachers enable row level security;
alter table hf_terms enable row level security;
alter table hf_term_weeks enable row level security;
alter table hf_enrolments enable row level security;
alter table hf_lines enable row level security;
alter table hf_targets enable row level security;
alter table hf_results enable row level security;
alter table hf_attendance enable row level security;
alter table hf_pairs enable row level security;
alter table hf_pair_members enable row level security;
alter table hf_notes enable row level security;
alter table hf_selfchecks enable row level security;
alter table hf_audit enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- Seed the two groups. Both start with the existing teacher code, so
-- teachers can log in straight away; the admin can give each group its own
-- code on the Codes page.
insert into hf_groups (name, sort_order, teacher_code_hash)
select v.name, v.sort_order, (select teacher_code_hash from settings where id = 1)
from (values ('Brothers', 1), ('Sisters', 2)) as v(name, sort_order)
where not exists (select 1 from hf_groups g where g.name = v.name);

-- ============================================================
-- Internal helpers (never granted to anon)
-- ============================================================

create or replace function hf_session(p_token uuid, p_min_role text default 'teacher')
returns auth_sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return validate_session(p_token, p_min_role);
end;
$$;

create or replace function hf_check_group(p_session auth_sessions, p_group_id smallint)
returns void
language plpgsql
as $$
begin
  if p_group_id is null then
    raise exception 'Not found.';
  end if;
  if p_session.role <> 'admin' and p_session.group_id is distinct from p_group_id then
    raise exception 'You can only see your own group.';
  end if;
end;
$$;

create or replace function hf_line_group(p_line_id uuid)
returns smallint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select t.group_id from hf_lines l join hf_terms t on t.id = l.term_id where l.id = p_line_id;
$$;

create or replace function hf_term_group(p_term_id int)
returns smallint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select group_id from hf_terms where id = p_term_id;
$$;

create or replace function hf_student_group(p_student_id uuid)
returns smallint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select group_id from hf_students where id = p_student_id;
$$;

create or replace function hf_actor(p_session auth_sessions)
returns text
language sql
immutable
as $$
  select p_session.display_name || coalesce(' (' || p_session.initials || ')', '');
$$;

create or replace function hf_log(
  p_actor text, p_action text, p_entity text, p_key jsonb, p_student_id uuid, p_before jsonb, p_after jsonb
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into hf_audit (actor, action, entity, entity_key, student_id, before, after)
  values (p_actor, p_action, p_entity, p_key, p_student_id, p_before, p_after);
$$;

create or replace function hf_random_link()
returns text
language sql
volatile
set search_path = public, extensions, pg_temp
as $$
  select translate(encode(gen_random_bytes(12), 'base64'), '+/=', '-_');
$$;

create or replace function hf_random_pin()
returns text
language sql
volatile
as $$
  select lpad(floor(random() * 10000)::int::text, 4, '0');
$$;

-- The whole of one term as JSON. p_student_id limits it to one student
-- (the student's own view): their lines, their notes marked visible, and
-- only the names of their revision partners.
create or replace function hf_term_payload(p_term_id int, p_student_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_student_mode boolean := p_student_id is not null;
begin
  return jsonb_build_object(
    'term', (select to_jsonb(t) from hf_terms t where t.id = p_term_id),
    'weeks', coalesce((
      select jsonb_agg(jsonb_build_object('week_number', w.week_number, 'class_date', w.class_date, 'cancelled', w.cancelled)
        order by w.week_number)
      from hf_term_weeks w where w.term_id = p_term_id), '[]'::jsonb),
    'students', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', s.id,
          'code', s.code,
          'display_name', s.display_name,
          'status', s.status,
          'notes', case when v_student_mode then null else s.notes end,
          'is_teacher', exists (select 1 from hf_teachers tt where tt.student_id = s.id and tt.active),
          'pages_before', e.pages_before,
          'projected_override', e.projected_override,
          'paid', e.paid,
          'exception_from', e.exception_from,
          'exception_until', e.exception_until))
      from hf_enrolments e join hf_students s on s.id = e.student_id
      where e.term_id = p_term_id and s.status <> 'archived'
        and (not v_student_mode or s.id = p_student_id)), '[]'::jsonb),
    'lines', coalesce((
      select jsonb_agg(to_jsonb(l) order by l.sort_order)
      from hf_lines l where l.term_id = p_term_id and (not v_student_mode or l.student_id = p_student_id)), '[]'::jsonb),
    'targets', coalesce((
      select jsonb_agg(jsonb_build_object('line_id', x.line_id, 'week', x.week, 'plan', x.plan, 'override', x.override))
      from hf_targets x join hf_lines l on l.id = x.line_id
      where l.term_id = p_term_id and (not v_student_mode or l.student_id = p_student_id)), '[]'::jsonb),
    'results', coalesce((
      select jsonb_agg(jsonb_build_object('line_id', r.line_id, 'week', r.week, 'value', r.value, 'initials', r.initials,
                                          'note', r.note, 'updated_by', r.updated_by, 'updated_at', r.updated_at))
      from hf_results r join hf_lines l on l.id = r.line_id
      where l.term_id = p_term_id and (not v_student_mode or l.student_id = p_student_id)), '[]'::jsonb),
    'attendance', coalesce((
      select jsonb_agg(jsonb_build_object('student_id', a.student_id, 'week', a.week, 'absent', a.absent, 'initials', a.initials))
      from hf_attendance a
      where a.term_id = p_term_id and (not v_student_mode or a.student_id = p_student_id)), '[]'::jsonb),
    'pairs', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', p.id,
          'pair_number', p.pair_number,
          'members', (select coalesce(jsonb_agg(jsonb_build_object(
                          'student_id', case when v_student_mode then null else m.student_id end,
                          'is_me', m.student_id = p_student_id,
                          'display_name', s.display_name,
                          'revising', m.revising) order by s.display_name), '[]'::jsonb)
                      from hf_pair_members m join hf_students s on s.id = m.student_id
                      where m.pair_id = p.id))
        order by p.pair_number)
      from hf_pairs p
      where p.term_id = p_term_id
        and (not v_student_mode or exists (select 1 from hf_pair_members m where m.pair_id = p.id and m.student_id = p_student_id))),
      '[]'::jsonb),
    'notes', coalesce((
      select jsonb_agg(to_jsonb(n) order by n.created_at desc)
      from hf_notes n
      where n.student_id in (select student_id from hf_enrolments where term_id = p_term_id)
        and (not v_student_mode or (n.student_id = p_student_id and n.visible_to_student))), '[]'::jsonb),
    'selfchecks', coalesce((
      select jsonb_agg(jsonb_build_object('line_id', c.line_id, 'week', c.week, 'checked_at', c.checked_at))
      from hf_selfchecks c join hf_lines l on l.id = c.line_id
      where l.term_id = p_term_id and (not v_student_mode or l.student_id = p_student_id)), '[]'::jsonb)
  );
end;
$$;

-- ============================================================
-- Staff login: a group code (or the admin code), then pick your name
-- ============================================================

create or replace function hf_match_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_settings settings;
  v_group hf_groups;
  v_failures int;
begin
  select count(*) into v_failures from login_attempts
  where kind = 'staff_login' and identifier = 'hifdh-code' and success = false
    and attempted_at > now() - interval '15 minutes';
  if v_failures >= 25 then
    return jsonb_build_object('error', 'Too many attempts. Please try again in a few minutes.');
  end if;

  select * into v_settings from settings where id = 1;
  if v_settings.admin_code_hash is not null and crypt(p_code, v_settings.admin_code_hash) = v_settings.admin_code_hash then
    return jsonb_build_object('role', 'admin', 'group_id', null);
  end if;

  for v_group in select * from hf_groups order by sort_order loop
    if v_group.teacher_code_hash is not null and crypt(p_code, v_group.teacher_code_hash) = v_group.teacher_code_hash then
      return jsonb_build_object('role', 'teacher', 'group_id', v_group.id);
    end if;
  end loop;

  -- Returned, not raised, so the failed attempt is kept for the lockout count.
  insert into login_attempts (kind, identifier, success) values ('staff_login', 'hifdh-code', false);
  return jsonb_build_object('error', 'That code did not work. Please check it and try again.');
end;
$$;

-- Step 1: check the code and return the names to pick from.
create or replace function hf_login_start(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match jsonb := hf_match_code(trim(p_code));
  v_group smallint := (v_match ->> 'group_id')::smallint;
begin
  if v_match ? 'error' then
    return v_match;
  end if;
  return v_match || jsonb_build_object(
    'group_name', (select name from hf_groups where id = v_group),
    'teachers', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'initials', t.initials, 'group_id', t.group_id,
                                          'group_name', g.name) order by g.sort_order, t.name)
      from hf_teachers t join hf_groups g on g.id = t.group_id
      where t.active and (v_group is null or t.group_id = v_group)), '[]'::jsonb));
end;
$$;

grant execute on function hf_login_start(text) to anon;

-- Step 2: create the 12-hour session for the chosen teacher. If the group
-- has no teachers yet (or for the admin), a name and initials can be typed.
create or replace function hf_login(p_code text, p_teacher_id uuid, p_name text, p_initials text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match jsonb := hf_match_code(trim(p_code));
  v_role text := v_match ->> 'role';
  v_group smallint := (v_match ->> 'group_id')::smallint;
  v_teacher hf_teachers;
  v_name text;
  v_initials text;
  v_token uuid := gen_random_uuid();
  v_expires timestamptz := now() + interval '12 hours';
begin
  if v_match ? 'error' then
    return v_match;
  end if;
  if p_teacher_id is not null then
    select * into v_teacher from hf_teachers where id = p_teacher_id and active;
    if v_teacher.id is null or (v_group is not null and v_teacher.group_id <> v_group) then
      raise exception 'Please pick your name from the list.';
    end if;
    v_name := v_teacher.name;
    v_initials := v_teacher.initials;
  else
    if v_role = 'teacher' and exists (select 1 from hf_teachers where group_id = v_group and active) then
      raise exception 'Please pick your name from the list.';
    end if;
    v_name := nullif(trim(coalesce(p_name, '')), '');
    v_initials := upper(nullif(trim(coalesce(p_initials, '')), ''));
    if v_name is null or v_initials is null then
      raise exception 'Please enter your name and initials.';
    end if;
  end if;

  insert into login_attempts (kind, identifier, success) values ('staff_login', 'hifdh-code', true);
  insert into auth_sessions (token, role, display_name, expires_at, group_id, teacher_id, initials)
  values (v_token, v_role, v_name, v_expires, v_group, v_teacher.id, v_initials);

  return jsonb_build_object('token', v_token, 'role', v_role, 'group_id', v_group, 'display_name', v_name,
                            'initials', v_initials, 'teacher_id', v_teacher.id, 'expires_at', v_expires);
end;
$$;

grant execute on function hf_login(text, uuid, text, text) to anon;

-- ============================================================
-- Reading
-- ============================================================

create or replace function hf_bootstrap(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_s auth_sessions := hf_session(p_token);
begin
  return jsonb_build_object(
    'groups', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name) order by g.sort_order)
                        from hf_groups g where v_s.role = 'admin' or g.id = v_s.group_id), '[]'::jsonb),
    'terms', coalesce((select jsonb_agg(to_jsonb(t) order by t.start_date desc)
                       from hf_terms t where v_s.role = 'admin' or t.group_id = v_s.group_id), '[]'::jsonb),
    'teachers', coalesce((select jsonb_agg(to_jsonb(t) order by t.name)
                          from hf_teachers t where v_s.role = 'admin' or t.group_id = v_s.group_id), '[]'::jsonb)
  );
end;
$$;

grant execute on function hf_bootstrap(uuid) to anon;

create or replace function hf_term_data(p_token uuid, p_term_id int)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_s auth_sessions := hf_session(p_token);
begin
  perform hf_check_group(v_s, hf_term_group(p_term_id));
  return hf_term_payload(p_term_id);
end;
$$;

grant execute on function hf_term_data(uuid, int) to anon;

-- Every term a student has been in, newest first (staff view of one student's history).
create or replace function hf_student_history(p_token uuid, p_student_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_s auth_sessions := hf_session(p_token);
begin
  perform hf_check_group(v_s, hf_student_group(p_student_id));
  return coalesce((
    select jsonb_agg(hf_term_payload(t.id, p_student_id) order by t.start_date desc)
    from hf_terms t join hf_enrolments e on e.term_id = t.id
    where e.student_id = p_student_id), '[]'::jsonb);
end;
$$;

grant execute on function hf_student_history(uuid, uuid) to anon;

-- ============================================================
-- Recording (teachers and admin)
-- ============================================================

create or replace function hf_set_result(
  p_token uuid, p_line_id uuid, p_week int, p_value text, p_initials text, p_note text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_s auth_sessions := hf_session(p_token);
  v_before hf_results;
  v_student uuid;
  v_value text := nullif(trim(coalesce(p_value, '')), '');
begin
  perform hf_check_group(v_s, hf_line_group(p_line_id));
  select student_id into v_student from hf_lines where id = p_line_id;
  select * into v_before from hf_results where line_id = p_line_id and week = p_week;

  if v_value is null then
    delete from hf_results where line_id = p_line_id and week = p_week;
  else
    insert into hf_results (line_id, week, value, initials, note, updated_by, updated_at)
    values (p_line_id, p_week, v_value, upper(nullif(trim(coalesce(p_initials, '')), '')), nullif(trim(coalesce(p_note, '')), ''),
            hf_actor(v_s), now())
    on conflict (line_id, week) do update set
      value = excluded.value, initials = excluded.initials, note = excluded.note,
      updated_by = excluded.updated_by, updated_at = excluded.updated_at;
  end if;

  perform hf_log(hf_actor(v_s), 'set', 'result', jsonb_build_object('line_id', p_line_id, 'week', p_week), v_student,
                 case when v_before.line_id is null then null else jsonb_build_object('value', v_before.value, 'initials', v_before.initials, 'note', v_before.note) end,
                 case when v_value is null then null else jsonb_build_object('value', v_value, 'initials', upper(p_initials), 'note', p_note) end);
end;
$$;

grant execute on function hf_set_result(uuid, uuid, int, text, text, text) to anon;

-- "Absent" on the student marks every line for that week as Absent in one tap.
create or replace function hf_set_absent(
  p_token uuid, p_term_id int, p_student_id uuid, p_week int, p_absent boolean, p_initials text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_s auth_sessions := hf_session(p_token);
  v_initials text := upper(nullif(trim(coalesce(p_initials, '')), ''));
  v_before boolean;
begin
  perform hf_check_group(v_s, hf_term_group(p_term_id));
  if hf_student_group(p_student_id) <> hf_term_group(p_term_id) then
    raise exception 'Student not in this term.';
  end if;
  select absent into v_before from hf_attendance where term_id = p_term_id and student_id = p_student_id and week = p_week;

  if p_absent then
    insert into hf_attendance (term_id, student_id, week, absent, initials, updated_by, updated_at)
    values (p_term_id, p_student_id, p_week, true, v_initials, hf_actor(v_s), now())
    on conflict (term_id, student_id, week) do update set
      absent = true, initials = excluded.initials, updated_by = excluded.updated_by, updated_at = excluded.updated_at;

    insert into hf_results (line_id, week, value, initials, updated_by, updated_at)
    select l.id, p_week, 'Absent', v_initials, hf_actor(v_s), now()
    from hf_lines l where l.term_id = p_term_id and l.student_id = p_student_id and l.has_done
    on conflict (line_id, week) do update set
      value = 'Absent', initials = excluded.initials, updated_by = excluded.updated_by, updated_at = excluded.updated_at;
  else
    delete from hf_attendance where term_id = p_term_id and student_id = p_student_id and week = p_week;
    delete from hf_results r using hf_lines l
    where r.line_id = l.id and l.term_id = p_term_id and l.student_id = p_student_id and r.week = p_week and r.value = 'Absent';
  end if;

  perform hf_log(hf_actor(v_s), 'set', 'attendance',
                 jsonb_build_object('term_id', p_term_id, 'student_id', p_student_id, 'week', p_week), p_student_id,
                 case when v_before is null then null else jsonb_build_object('absent', v_before) end,
                 jsonb_build_object('absent', p_absent));
end;
$$;

grant execute on function hf_set_absent(uuid, int, uuid, int, boolean, text) to anon;

-- Sets plan or override targets for one line. p_targets: [{"week": 1, "text": "2.5"}, ...];
-- an empty text clears that week.
create or replace function hf_set_targets(p_token uuid, p_line_id uuid, p_field text, p_targets jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_s auth_sessions := hf_session(p_token);
  v_item jsonb;
  v_week int;
  v_text text;
  v_before hf_targets;
  v_student uuid;
begin
  perform hf_check_group(v_s, hf_line_group(p_line_id));
  if p_field not in ('plan', 'override') then
    raise exception 'Unknown target field.';
  end if;
  select student_id into v_student from hf_lines where id = p_line_id;

  for v_item in select * from jsonb_array_elements(p_targets) loop
    v_week := (v_item ->> 'week')::int;
    v_text := nullif(trim(coalesce(v_item ->> 'text', '')), '');
    select * into v_before from hf_targets where line_id = p_line_id and week = v_week;

    insert into hf_targets (line_id, week, plan, override, updated_by, updated_at)
    values (p_line_id, v_week,
            case when p_field = 'plan' then v_text end,
            case when p_field = 'override' then v_text end,
            hf_actor(v_s), now())
    on conflict (line_id, week) do update set
      plan = case when p_field = 'plan' then v_text else hf_targets.plan end,
      override = case when p_field = 'override' then v_text else hf_targets.override end,
      updated_by = excluded.updated_by, updated_at = excluded.updated_at;

    delete from hf_targets where line_id = p_line_id and week = v_week and plan is null and override is null;

    if (case when p_field = 'plan' then v_before.plan else v_before.override end) is distinct from v_text then
      perform hf_log(hf_actor(v_s), 'set', 'target',
                     jsonb_build_object('line_id', p_line_id, 'week', v_week, 'field', p_field), v_student,
                     jsonb_build_object('text', case when p_field = 'plan' then v_before.plan else v_before.override end),
                     jsonb_build_object('text', v_text));
    end if;
  end loop;
end;
$$;

grant execute on function hf_set_targets(uuid, uuid, text, jsonb) to anon;

create or replace function hf_add_note(p_token uuid, p_student_id uuid, p_text text, p_visible boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_s auth_sessions := hf_session(p_token);
begin
  perform hf_check_group(v_s, hf_student_group(p_student_id));
  if nullif(trim(coalesce(p_text, '')), '') is null then
    raise exception 'Please write a note.';
  end if;
  -- Only the admin decides whether a note is visible to the student.
  insert into hf_notes (student_id, author, text, visible_to_student)
  values (p_student_id, coalesce(v_s.initials, v_s.display_name), trim(p_text), v_s.role = 'admin' and coalesce(p_visible, false));
end;
$$;

grant execute on function hf_add_note(uuid, uuid, text, boolean) to anon;

create or replace function hf_set_note_visibility(p_token uuid, p_note_id uuid, p_visible boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform hf_session(p_token, 'admin');
  update hf_notes set visible_to_student = p_visible where id = p_note_id;
end;
$$;

grant execute on function hf_set_note_visibility(uuid, uuid, boolean) to anon;

create or replace function hf_delete_note(p_token uuid, p_note_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_s auth_sessions := hf_session(p_token);
  v_note hf_notes;
begin
  select * into v_note from hf_notes where id = p_note_id;
  perform hf_check_group(v_s, hf_student_group(v_note.student_id));
  if v_s.role <> 'admin' and v_note.author not in (coalesce(v_s.initials, ''), v_s.display_name) then
    raise exception 'Only the admin or the note''s author can delete it.';
  end if;
  delete from hf_notes where id = p_note_id;
end;
$$;

grant execute on function hf_delete_note(uuid, uuid) to anon;

-- ============================================================
-- Admin: students, enrolments and lines
-- ============================================================

create or replace function hf_admin_students(p_token uuid, p_group_id smallint)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform hf_session(p_token, 'admin');
  return coalesce((
    select jsonb_agg(jsonb_build_object(
        'id', s.id, 'group_id', s.group_id, 'code', s.code, 'display_name', s.display_name, 'status', s.status,
        'notes', s.notes, 'link_token', s.link_token, 'pin', s.pin,
        'term_ids', coalesce((select jsonb_agg(e.term_id) from hf_enrolments e where e.student_id = s.id), '[]'::jsonb)))
    from hf_students s where s.group_id = p_group_id), '[]'::jsonb);
end;
$$;

grant execute on function hf_admin_students(uuid, smallint) to anon;

-- Adds or edits a student. For a new student, p_term_id + p_lines enrol them
-- into a term and create their lines from the chosen templates.
create or replace function hf_upsert_student(
  p_token uuid, p_id uuid, p_group_id smallint, p_code text, p_display_name text, p_notes text,
  p_term_id int, p_pages_before numeric, p_starting_juz int, p_lines jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_s auth_sessions := hf_session(p_token, 'admin');
  v_id uuid := p_id;
  v_name text := nullif(trim(coalesce(p_display_name, '')), '');
  v_code text := upper(nullif(trim(coalesce(p_code, '')), ''));
  v_line jsonb;
  v_line_id uuid;
  v_order int := 0;
  v_row hf_students;
begin
  if v_name is null or v_code is null then
    raise exception 'Name and ID are required.';
  end if;
  if exists (select 1 from hf_students where group_id = p_group_id and code = v_code and id is distinct from v_id) then
    raise exception 'ID % is already used in this group.', v_code;
  end if;

  if v_id is null then
    insert into hf_students (group_id, code, display_name, notes, link_token, pin)
    values (p_group_id, v_code, v_name, nullif(trim(coalesce(p_notes, '')), ''), hf_random_link(), hf_random_pin())
    returning id into v_id;
    perform hf_log(hf_actor(v_s), 'add', 'student', jsonb_build_object('id', v_id), v_id, null,
                   jsonb_build_object('display_name', v_name, 'code', v_code));
  else
    select * into v_row from hf_students where id = v_id;
    -- The personal link and PIN stay the same when a student is renamed.
    update hf_students set code = v_code, display_name = v_name, notes = nullif(trim(coalesce(p_notes, '')), ''),
                           group_id = p_group_id
    where id = v_id;
    perform hf_log(hf_actor(v_s), 'edit', 'student', jsonb_build_object('id', v_id), v_id,
                   jsonb_build_object('display_name', v_row.display_name, 'code', v_row.code),
                   jsonb_build_object('display_name', v_name, 'code', v_code));
  end if;

  if p_term_id is not null then
    if hf_term_group(p_term_id) <> p_group_id then
      raise exception 'That term belongs to the other group.';
    end if;
    insert into hf_enrolments (term_id, student_id, pages_before)
    values (p_term_id, v_id, coalesce(p_pages_before, 0))
    on conflict (term_id, student_id) do update set pages_before = coalesce(p_pages_before, hf_enrolments.pages_before);

    select coalesce(max(sort_order), 0) into v_order from hf_lines where term_id = p_term_id and student_id = v_id;
    for v_line in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) loop
      v_order := v_order + 1;
      insert into hf_lines (term_id, student_id, label, type, sort_order, has_done, done_label)
      values (p_term_id, v_id, v_line ->> 'label', v_line ->> 'type', v_order,
              coalesce((v_line ->> 'has_done')::boolean, true), v_line ->> 'done_label')
      returning id into v_line_id;
      if v_line ->> 'type' = 'juz' and p_starting_juz is not null then
        insert into hf_targets (line_id, week, plan, updated_by) values (v_line_id, 1, 'Juz ' || p_starting_juz, hf_actor(v_s));
      end if;
    end loop;
  end if;

  return (select jsonb_build_object('id', s.id, 'code', s.code, 'link_token', s.link_token, 'pin', s.pin)
          from hf_students s where s.id = v_id);
end;
$$;

grant execute on function hf_upsert_student(uuid, uuid, smallint, text, text, text, int, numeric, int, jsonb) to anon;

-- Active / left / archived. A leaver is taken out of revision pairs in
-- current (non-archived) terms but keeps their record.
create or replace function hf_set_student_status(p_token uuid, p_student_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_s auth_sessions := hf_session(p_token, 'admin');
  v_before text;
begin
  select status into v_before from hf_students where id = p_student_id;
  update hf_students set status = p_status where id = p_student_id;
  if p_status in ('left', 'archived') then
    delete from hf_pair_members m using hf_pairs p, hf_terms t
    where m.pair_id = p.id and p.term_id = t.id and not t.archived and m.student_id = p_student_id;
  end if;
  perform hf_log(hf_actor(v_s), 'status', 'student', jsonb_build_object('id', p_student_id), p_student_id,
                 jsonb_build_object('status', v_before), jsonb_build_object('status', p_status));
end;
$$;

grant execute on function hf_set_student_status(uuid, uuid, text) to anon;

create or replace function hf_reset_pin(p_token uuid, p_student_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pin text := hf_random_pin();
begin
  perform hf_session(p_token, 'admin');
  update hf_students set pin = v_pin where id = p_student_id;
  return v_pin;
end;
$$;

grant execute on function hf_reset_pin(uuid, uuid) to anon;

-- UK GDPR: permanently deletes a student and everything about them.
create or replace function hf_delete_student(p_token uuid, p_student_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_s auth_sessions := hf_session(p_token, 'admin');
  v_name text;
begin
  select display_name into v_name from hf_students where id = p_student_id;
  update hf_teachers set student_id = null where student_id = p_student_id;
  delete from hf_students where id = p_student_id;
  delete from hf_audit where student_id = p_student_id;
  perform hf_log(hf_actor(v_s), 'delete', 'student', jsonb_build_object('id', p_student_id), null, null, null);
end;
$$;

grant execute on function hf_delete_student(uuid, uuid) to anon;

-- UK GDPR: everything held about one student, for a subject access request.
create or replace function hf_export_student(p_token uuid, p_student_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform hf_session(p_token, 'admin');
  return jsonb_build_object(
    'student', (select to_jsonb(s) - 'pin' - 'link_token' from hf_students s where s.id = p_student_id),
    'notes', coalesce((select jsonb_agg(to_jsonb(n)) from hf_notes n where n.student_id = p_student_id), '[]'::jsonb),
    'terms', coalesce((select jsonb_agg(hf_term_payload(e.term_id, p_student_id)) from hf_enrolments e where e.student_id = p_student_id), '[]'::jsonb),
    'audit', coalesce((select jsonb_agg(to_jsonb(a) order by a.at) from hf_audit a where a.student_id = p_student_id), '[]'::jsonb)
  );
end;
$$;

grant execute on function hf_export_student(uuid, uuid) to anon;

create or replace function hf_set_enrolment(
  p_token uuid, p_term_id int, p_student_id uuid, p_pages_before numeric, p_projected_override numeric,
  p_paid boolean, p_exception_from date, p_exception_until date
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_s auth_sessions := hf_session(p_token, 'admin');
begin
  if hf_student_group(p_student_id) <> hf_term_group(p_term_id) then
    raise exception 'That student is in the other group.';
  end if;
  insert into hf_enrolments (term_id, student_id, pages_before, projected_override, paid, exception_from, exception_until)
  values (p_term_id, p_student_id, coalesce(p_pages_before, 0), p_projected_override, coalesce(p_paid, false),
          p_exception_from, p_exception_until)
  on conflict (term_id, student_id) do update set
    pages_before = excluded.pages_before, projected_override = excluded.projected_override, paid = excluded.paid,
    exception_from = excluded.exception_from, exception_until = excluded.exception_until;
  perform hf_log(hf_actor(v_s), 'edit', 'enrolment', jsonb_build_object('term_id', p_term_id, 'student_id', p_student_id),
                 p_student_id, null, jsonb_build_object('pages_before', p_pages_before, 'paid', p_paid,
                 'projected_override', p_projected_override, 'exception_until', p_exception_until));
end;
$$;

grant execute on function hf_set_enrolment(uuid, int, uuid, numeric, numeric, boolean, date, date) to anon;

create or replace function hf_set_paid(p_token uuid, p_term_id int, p_student_id uuid, p_paid boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform hf_session(p_token, 'admin');
  update hf_enrolments set paid = p_paid where term_id = p_term_id and student_id = p_student_id;
end;
$$;

grant execute on function hf_set_paid(uuid, int, uuid, boolean) to anon;

create or replace function hf_remove_enrolment(p_token uuid, p_term_id int, p_student_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform hf_session(p_token, 'admin');
  delete from hf_lines where term_id = p_term_id and student_id = p_student_id;
  delete from hf_attendance where term_id = p_term_id and student_id = p_student_id;
  delete from hf_enrolments where term_id = p_term_id and student_id = p_student_id;
end;
$$;

grant execute on function hf_remove_enrolment(uuid, int, uuid) to anon;

create or replace function hf_upsert_line(
  p_token uuid, p_id uuid, p_term_id int, p_student_id uuid, p_label text, p_type text, p_has_done boolean, p_done_label text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid := p_id;
begin
  perform hf_session(p_token, 'admin');
  if nullif(trim(coalesce(p_label, '')), '') is null then
    raise exception 'Line label is required.';
  end if;
  if v_id is null then
    insert into hf_lines (term_id, student_id, label, type, sort_order, has_done, done_label)
    values (p_term_id, p_student_id, trim(p_label), p_type,
            (select coalesce(max(sort_order), 0) + 1 from hf_lines where term_id = p_term_id and student_id = p_student_id),
            coalesce(p_has_done, true), nullif(trim(coalesce(p_done_label, '')), ''))
    returning id into v_id;
  else
    update hf_lines set label = trim(p_label), type = p_type, has_done = coalesce(p_has_done, true),
                        done_label = nullif(trim(coalesce(p_done_label, '')), '')
    where id = v_id;
  end if;
  return v_id;
end;
$$;

grant execute on function hf_upsert_line(uuid, uuid, int, uuid, text, text, boolean, text) to anon;

create or replace function hf_delete_line(p_token uuid, p_line_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform hf_session(p_token, 'admin');
  delete from hf_lines where id = p_line_id;
end;
$$;

grant execute on function hf_delete_line(uuid, uuid) to anon;

create or replace function hf_reorder_lines(p_token uuid, p_line_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform hf_session(p_token, 'admin');
  update hf_lines l set sort_order = x.ord
  from unnest(p_line_ids) with ordinality as x(id, ord)
  where l.id = x.id;
end;
$$;

grant execute on function hf_reorder_lines(uuid, uuid[]) to anon;

-- ============================================================
-- Admin: terms, teachers, codes, partners
-- ============================================================

-- Creates a 10-week term. Optionally copies every active student's
-- enrolment and lines (not targets or results) from an earlier term.
create or replace function hf_create_term(
  p_token uuid, p_group_id smallint, p_name text, p_start_date date, p_weeks int, p_copy_from int
)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_s auth_sessions := hf_session(p_token, 'admin');
  v_id int;
begin
  if nullif(trim(coalesce(p_name, '')), '') is null or p_start_date is null then
    raise exception 'Term name and first class date are required.';
  end if;
  insert into hf_terms (group_id, name, start_date) values (p_group_id, trim(p_name), p_start_date) returning id into v_id;
  insert into hf_term_weeks (term_id, week_number, class_date)
  select v_id, gs, p_start_date + (gs - 1) * 7 from generate_series(1, coalesce(p_weeks, 10)) gs;

  if p_copy_from is not null then
    if hf_term_group(p_copy_from) <> p_group_id then
      raise exception 'You can only copy from a term in the same group.';
    end if;
    insert into hf_enrolments (term_id, student_id, pages_before, paid)
    select v_id, e.student_id, e.pages_before, false
    from hf_enrolments e join hf_students s on s.id = e.student_id
    where e.term_id = p_copy_from and s.status = 'active';

    insert into hf_lines (term_id, student_id, label, type, sort_order, has_done, done_label)
    select v_id, l.student_id, l.label, l.type, l.sort_order, l.has_done, l.done_label
    from hf_lines l join hf_students s on s.id = l.student_id
    where l.term_id = p_copy_from and s.status = 'active';
  end if;

  perform hf_log(hf_actor(v_s), 'add', 'term', jsonb_build_object('id', v_id), null, null,
                 jsonb_build_object('name', p_name, 'start_date', p_start_date));
  return v_id;
end;
$$;

grant execute on function hf_create_term(uuid, smallint, text, date, int, int) to anon;

create or replace function hf_update_term(p_token uuid, p_term_id int, p_name text, p_archived boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform hf_session(p_token, 'admin');
  update hf_terms set name = coalesce(nullif(trim(p_name), ''), name), archived = coalesce(p_archived, archived)
  where id = p_term_id;
end;
$$;

grant execute on function hf_update_term(uuid, int, text, boolean) to anon;

create or replace function hf_delete_term(p_token uuid, p_term_id int)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_s auth_sessions := hf_session(p_token, 'admin');
begin
  perform hf_log(hf_actor(v_s), 'delete', 'term', jsonb_build_object('id', p_term_id), null,
                 (select to_jsonb(t) from hf_terms t where t.id = p_term_id), null);
  delete from hf_terms where id = p_term_id;
end;
$$;

grant execute on function hf_delete_term(uuid, int) to anon;

create or replace function hf_update_week(p_token uuid, p_term_id int, p_week int, p_class_date date, p_cancelled boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform hf_session(p_token, 'admin');
  update hf_term_weeks set class_date = coalesce(p_class_date, class_date), cancelled = coalesce(p_cancelled, cancelled)
  where term_id = p_term_id and week_number = p_week;
end;
$$;

grant execute on function hf_update_week(uuid, int, int, date, boolean) to anon;

create or replace function hf_upsert_teacher(
  p_token uuid, p_id uuid, p_group_id smallint, p_name text, p_initials text, p_colour text, p_student_id uuid, p_active boolean
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid := p_id;
begin
  perform hf_session(p_token, 'admin');
  if nullif(trim(coalesce(p_name, '')), '') is null or nullif(trim(coalesce(p_initials, '')), '') is null then
    raise exception 'Name and initials are required.';
  end if;
  if v_id is null then
    insert into hf_teachers (group_id, name, initials, colour, student_id, active)
    values (p_group_id, trim(p_name), upper(trim(p_initials)), p_colour, p_student_id, coalesce(p_active, true))
    returning id into v_id;
  else
    update hf_teachers set group_id = p_group_id, name = trim(p_name), initials = upper(trim(p_initials)),
                           colour = p_colour, student_id = p_student_id, active = coalesce(p_active, true)
    where id = v_id;
  end if;
  return v_id;
end;
$$;

grant execute on function hf_upsert_teacher(uuid, uuid, smallint, text, text, text, uuid, boolean) to anon;

create or replace function hf_delete_teacher(p_token uuid, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform hf_session(p_token, 'admin');
  delete from hf_teachers where id = p_id;
end;
$$;

grant execute on function hf_delete_teacher(uuid, uuid) to anon;

create or replace function hf_set_group_code(p_token uuid, p_group_id smallint, p_code text)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_s auth_sessions := hf_session(p_token, 'admin');
begin
  if length(trim(coalesce(p_code, ''))) < 6 then
    raise exception 'Codes must be at least 6 characters.';
  end if;
  update hf_groups set teacher_code_hash = crypt(trim(p_code), gen_salt('bf')) where id = p_group_id;
  perform hf_log(hf_actor(v_s), 'edit', 'group_code', jsonb_build_object('group_id', p_group_id), null, null, null);
end;
$$;

grant execute on function hf_set_group_code(uuid, smallint, text) to anon;

-- Replaces a term's revision pairs. p_pairs: [{"pair_number": 1, "members": [{"student_id": "...", "revising": "30 1st 1/4"}]}]
create or replace function hf_set_pairs(p_token uuid, p_term_id int, p_pairs jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_s auth_sessions := hf_session(p_token, 'admin');
  v_pair jsonb;
  v_member jsonb;
  v_pair_id int;
begin
  delete from hf_pairs where term_id = p_term_id;
  for v_pair in select * from jsonb_array_elements(coalesce(p_pairs, '[]'::jsonb)) loop
    if jsonb_array_length(coalesce(v_pair -> 'members', '[]'::jsonb)) = 0 then
      continue;
    end if;
    insert into hf_pairs (term_id, pair_number) values (p_term_id, (v_pair ->> 'pair_number')::int) returning id into v_pair_id;
    for v_member in select * from jsonb_array_elements(v_pair -> 'members') loop
      if hf_student_group((v_member ->> 'student_id')::uuid) <> hf_term_group(p_term_id) then
        raise exception 'Partners must be in the same group.';
      end if;
      insert into hf_pair_members (pair_id, student_id, revising)
      values (v_pair_id, (v_member ->> 'student_id')::uuid, nullif(trim(coalesce(v_member ->> 'revising', '')), ''))
      on conflict do nothing;
    end loop;
  end loop;
  perform hf_log(hf_actor(v_s), 'edit', 'pairs', jsonb_build_object('term_id', p_term_id), null, null, p_pairs);
end;
$$;

grant execute on function hf_set_pairs(uuid, int, jsonb) to anon;

-- ============================================================
-- Admin: audit trail
-- ============================================================

create or replace function hf_audit_list(p_token uuid, p_limit int, p_student_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform hf_session(p_token, 'admin');
  return coalesce((
    select jsonb_agg(x order by x.at desc) from (
      select a.*, s.display_name as student_name,
             (select l.label from hf_lines l where l.id = (a.entity_key ->> 'line_id')::uuid) as line_label
      from hf_audit a left join hf_students s on s.id = a.student_id
      where p_student_id is null or a.student_id = p_student_id
      order by a.at desc
      limit least(coalesce(p_limit, 200), 1000)
    ) x), '[]'::jsonb);
end;
$$;

grant execute on function hf_audit_list(uuid, int, uuid) to anon;

-- Puts a result, target or attendance mark back to what it was before an audit entry.
create or replace function hf_audit_undo(p_token uuid, p_audit_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_s auth_sessions := hf_session(p_token, 'admin');
  v_a hf_audit;
  v_key jsonb;
begin
  select * into v_a from hf_audit where id = p_audit_id;
  v_key := v_a.entity_key;
  if v_a.entity = 'result' then
    perform hf_set_result(p_token, (v_key ->> 'line_id')::uuid, (v_key ->> 'week')::int,
                          v_a.before ->> 'value', v_a.before ->> 'initials', v_a.before ->> 'note');
  elsif v_a.entity = 'target' then
    perform hf_set_targets(p_token, (v_key ->> 'line_id')::uuid, v_key ->> 'field',
                           jsonb_build_array(jsonb_build_object('week', (v_key ->> 'week')::int, 'text', v_a.before ->> 'text')));
  elsif v_a.entity = 'attendance' then
    perform hf_set_absent(p_token, (v_key ->> 'term_id')::int, (v_key ->> 'student_id')::uuid, (v_key ->> 'week')::int,
                          coalesce((v_a.before ->> 'absent')::boolean, false), v_s.initials);
  else
    raise exception 'This change cannot be undone automatically.';
  end if;
end;
$$;

grant execute on function hf_audit_undo(uuid, bigint) to anon;

-- ============================================================
-- Admin: one-time import from the Excel record sheets
-- ============================================================
-- p_payload: {
--   "group_id": 1, "term_name": "...", "dates": ["2026-10-15", ...],
--   "students": [{ "code": "B06", "display_name": "...", "pages_before": 12, "absent_weeks": [3],
--                  "lines": [{ "label": "New Hifdh", "type": "new_hifdh", "has_done": true, "done_label": "New Hifdh done",
--                              "targets": {"1": "2.5"}, "results": {"1": {"value": "Y", "initials": "MMA"}} }],
--                  "notes": [{ "author": "MMA", "text": "..." }] }],
--   "pairs": [{ "pair_number": 1, "members": [{ "code": "B06", "revising": "30 1st 1/4" }] }]
-- }
-- Students are matched by ID within the group. If a term with the same name
-- already exists in the group, the imported students' lines in it are replaced.
create or replace function hf_import(p_token uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_s auth_sessions := hf_session(p_token, 'admin');
  v_group smallint := (p_payload ->> 'group_id')::smallint;
  v_term int;
  v_stu jsonb;
  v_line jsonb;
  v_student_id uuid;
  v_line_id uuid;
  v_order int;
  v_key text;
  v_val jsonb;
  v_pair jsonb;
  v_member jsonb;
  v_pair_id int;
  v_counts jsonb := jsonb_build_object('students', 0, 'lines', 0, 'targets', 0, 'results', 0, 'notes', 0, 'pairs', 0);
  i int;
begin
  select id into v_term from hf_terms where group_id = v_group and name = p_payload ->> 'term_name';
  if v_term is null then
    insert into hf_terms (group_id, name, start_date)
    values (v_group, p_payload ->> 'term_name', (p_payload -> 'dates' ->> 0)::date)
    returning id into v_term;
  end if;

  for i in 0 .. jsonb_array_length(p_payload -> 'dates') - 1 loop
    insert into hf_term_weeks (term_id, week_number, class_date)
    values (v_term, i + 1, (p_payload -> 'dates' ->> i)::date)
    on conflict (term_id, week_number) do update set class_date = excluded.class_date;
  end loop;

  for v_stu in select * from jsonb_array_elements(p_payload -> 'students') loop
    select id into v_student_id from hf_students where group_id = v_group and code = upper(v_stu ->> 'code');
    if v_student_id is null then
      insert into hf_students (group_id, code, display_name, link_token, pin)
      values (v_group, upper(v_stu ->> 'code'), v_stu ->> 'display_name', hf_random_link(), hf_random_pin())
      returning id into v_student_id;
    else
      update hf_students set display_name = v_stu ->> 'display_name' where id = v_student_id;
    end if;
    v_counts := jsonb_set(v_counts, '{students}', to_jsonb((v_counts ->> 'students')::int + 1));

    insert into hf_enrolments (term_id, student_id, pages_before)
    values (v_term, v_student_id, coalesce((v_stu ->> 'pages_before')::numeric, 0))
    on conflict (term_id, student_id) do update set pages_before = excluded.pages_before;

    delete from hf_lines where term_id = v_term and student_id = v_student_id;
    delete from hf_attendance where term_id = v_term and student_id = v_student_id;

    v_order := 0;
    for v_line in select * from jsonb_array_elements(coalesce(v_stu -> 'lines', '[]'::jsonb)) loop
      v_order := v_order + 1;
      insert into hf_lines (term_id, student_id, label, type, sort_order, has_done, done_label)
      values (v_term, v_student_id, v_line ->> 'label', coalesce(v_line ->> 'type', 'custom'), v_order,
              coalesce((v_line ->> 'has_done')::boolean, false), v_line ->> 'done_label')
      returning id into v_line_id;
      v_counts := jsonb_set(v_counts, '{lines}', to_jsonb((v_counts ->> 'lines')::int + 1));

      for v_key, v_val in select * from jsonb_each(coalesce(v_line -> 'targets', '{}'::jsonb)) loop
        insert into hf_targets (line_id, week, plan, updated_by) values (v_line_id, v_key::int, v_val #>> '{}', 'Excel import');
        v_counts := jsonb_set(v_counts, '{targets}', to_jsonb((v_counts ->> 'targets')::int + 1));
      end loop;

      for v_key, v_val in select * from jsonb_each(coalesce(v_line -> 'results', '{}'::jsonb)) loop
        insert into hf_results (line_id, week, value, initials, note, updated_by)
        values (v_line_id, v_key::int, v_val ->> 'value', v_val ->> 'initials', v_val ->> 'note', 'Excel import');
        v_counts := jsonb_set(v_counts, '{results}', to_jsonb((v_counts ->> 'results')::int + 1));
      end loop;
    end loop;

    insert into hf_attendance (term_id, student_id, week, absent, updated_by)
    select v_term, v_student_id, w::int, true, 'Excel import'
    from jsonb_array_elements_text(coalesce(v_stu -> 'absent_weeks', '[]'::jsonb)) w
    on conflict do nothing;

    for v_val in select * from jsonb_array_elements(coalesce(v_stu -> 'notes', '[]'::jsonb)) loop
      insert into hf_notes (student_id, author, text) values (v_student_id, coalesce(v_val ->> 'author', 'MMA'), v_val ->> 'text');
      v_counts := jsonb_set(v_counts, '{notes}', to_jsonb((v_counts ->> 'notes')::int + 1));
    end loop;
  end loop;

  if jsonb_array_length(coalesce(p_payload -> 'pairs', '[]'::jsonb)) > 0 then
    delete from hf_pairs where term_id = v_term;
    for v_pair in select * from jsonb_array_elements(p_payload -> 'pairs') loop
      insert into hf_pairs (term_id, pair_number) values (v_term, (v_pair ->> 'pair_number')::int) returning id into v_pair_id;
      for v_member in select * from jsonb_array_elements(v_pair -> 'members') loop
        insert into hf_pair_members (pair_id, student_id, revising)
        select v_pair_id, s.id, v_member ->> 'revising' from hf_students s
        where s.group_id = v_group and s.code = upper(v_member ->> 'code')
        on conflict do nothing;
      end loop;
      v_counts := jsonb_set(v_counts, '{pairs}', to_jsonb((v_counts ->> 'pairs')::int + 1));
    end loop;
  end if;

  perform hf_log(hf_actor(v_s), 'import', 'term', jsonb_build_object('id', v_term), null, null, v_counts);
  return v_counts || jsonb_build_object('term_id', v_term);
end;
$$;

grant execute on function hf_import(uuid, jsonb) to anon;

-- ============================================================
-- Students: personal link + 4-digit PIN
-- ============================================================

create or replace function hf_student_check(p_link text, p_pin text)
returns hf_students
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_student hf_students;
  v_failures int;
begin
  select count(*) into v_failures from login_attempts
  where kind = 'student_code' and identifier = 'link:' || coalesce(p_link, '') and success = false
    and attempted_at > now() - interval '15 minutes';
  if v_failures >= 8 then
    return null;
  end if;

  select * into v_student from hf_students where link_token = p_link and status <> 'archived';
  if v_student.id is null or v_student.pin <> trim(coalesce(p_pin, '')) then
    -- Returning (not raising) keeps this failed attempt for the lockout count.
    insert into login_attempts (kind, identifier, success) values ('student_code', 'link:' || coalesce(p_link, ''), false);
    return null;
  end if;
  return v_student;
end;
$$;

create or replace function hf_student_open(p_link text, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_student hf_students := hf_student_check(p_link, p_pin);
begin
  if v_student.id is null then
    return jsonb_build_object('error', 'That PIN did not match, or there have been too many tries. Please check it, or wait 15 minutes.');
  end if;
  return jsonb_build_object(
    'student', jsonb_build_object('id', v_student.id, 'code', v_student.code, 'display_name', v_student.display_name,
                                  'group', (select name from hf_groups where id = v_student.group_id)),
    'terms', coalesce((
      select jsonb_agg(hf_term_payload(t.id, v_student.id) order by t.start_date desc)
      from hf_terms t join hf_enrolments e on e.term_id = t.id
      where e.student_id = v_student.id), '[]'::jsonb));
end;
$$;

grant execute on function hf_student_open(text, text) to anon;

-- Stage 3: the student ticks that they revised with their partner. A
-- teacher still has to confirm it; this never sets a result.
create or replace function hf_student_selfcheck(p_link text, p_pin text, p_line_id uuid, p_week int, p_checked boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_student hf_students := hf_student_check(p_link, p_pin);
begin
  if v_student.id is null then
    raise exception 'Please open your record again.';
  end if;
  if not exists (select 1 from hf_lines where id = p_line_id and student_id = v_student.id) then
    raise exception 'Not your line.';
  end if;
  if p_checked then
    insert into hf_selfchecks (line_id, week) values (p_line_id, p_week) on conflict do nothing;
  else
    delete from hf_selfchecks where line_id = p_line_id and week = p_week;
  end if;
end;
$$;

grant execute on function hf_student_selfcheck(text, text, uuid, int, boolean) to anon;

-- ============================================================
-- Lock down internal helpers
-- ============================================================
-- PostgreSQL lets everyone (PUBLIC) execute a new function, and Supabase
-- also grants anon/authenticated by default. These helpers skip the login
-- checks (they are only meant to be called from inside the functions
-- above), so take that permission away explicitly. This also fixes the
-- same gap in setup.sql, where set_initial_codes and build_student_bundle
-- were reachable with the public key.
revoke execute on function validate_session(uuid, text) from public, anon, authenticated;
revoke execute on function build_student_bundle(uuid) from public, anon, authenticated;
revoke execute on function set_initial_codes(text, text) from public, anon, authenticated;
revoke execute on function hf_session(uuid, text) from public, anon, authenticated;
revoke execute on function hf_check_group(auth_sessions, smallint) from public, anon, authenticated;
revoke execute on function hf_line_group(uuid) from public, anon, authenticated;
revoke execute on function hf_term_group(int) from public, anon, authenticated;
revoke execute on function hf_student_group(uuid) from public, anon, authenticated;
revoke execute on function hf_actor(auth_sessions) from public, anon, authenticated;
revoke execute on function hf_log(text, text, text, jsonb, uuid, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function hf_random_link() from public, anon, authenticated;
revoke execute on function hf_random_pin() from public, anon, authenticated;
revoke execute on function hf_term_payload(int, uuid) from public, anon, authenticated;
revoke execute on function hf_match_code(text) from public, anon, authenticated;
revoke execute on function hf_student_check(text, text) from public, anon, authenticated;
