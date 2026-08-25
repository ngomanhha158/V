-- VBuilding — Core schema (PostgreSQL 15 / Supabase)
-- Chạy: psql -f schema.sql  |  hoặc dán vào Supabase SQL Editor
-- Nguyên tắc: 3NF cho Master Data, RLS ở DB thay vì check quyền rải rác trong app.

create extension if not exists "uuid-ossp";
create extension if not exists pg_trgm;

-- ─────────────────────────────── ENUMS ───────────────────────────────
create type unit_role       as enum ('owner','authorized','tenant','family');
create type member_status   as enum ('pending','active','revoked','expired');
create type staff_role      as enum ('bql_manager','bql_staff','technician','security','bqt');
create type unit_kind       as enum ('apartment','shophouse','office','penthouse');
create type unit_state      as enum ('vacant','owner_occupied','rented');
create type ticket_status   as enum ('new','assigned','in_progress','resolved','closed','rejected');
create type ticket_priority as enum ('low','normal','high','urgent');
create type invoice_status  as enum ('draft','issued','partial','paid','void');

-- ──────────────────────── 1. SPATIAL HIERARCHY ───────────────────────
create table projects (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  address     text,
  timezone    text not null default 'Asia/Ho_Chi_Minh',
  created_at  timestamptz not null default now()
);

create table buildings (
  id          uuid primary key default uuid_generate_v4(),
  project_id  uuid not null references projects(id) on delete cascade,
  code        text not null,              -- 'P3', 'L81'
  name        text not null,
  floor_count int,
  unique (project_id, code)
);

-- ponytail: Tầng = cột floor_no trên units, KHÔNG tách bảng floors.
-- Đủ để lọc "gửi thông báo cắt nước toàn tầng 12 tòa P3". Tách bảng khi tầng
-- có thuộc tính riêng thật (đồng hồ tổng, chủ mặt bằng, hợp đồng thuê nguyên tầng).
create table units (
  id           uuid primary key default uuid_generate_v4(),
  building_id  uuid not null references buildings(id) on delete cascade,
  code         text not null,             -- 'P3-12.05'
  floor_no     int  not null,
  area_m2      numeric(8,2),
  kind         unit_kind  not null default 'apartment',
  state        unit_state not null default 'vacant',
  created_at   timestamptz not null default now(),
  unique (building_id, code)
);
create index on units (building_id, floor_no);

-- ────────────────── 2. USERS / RESIDENT MATRIX ───────────────────────
-- Supabase: profiles.id = auth.users.id
create table profiles (
  id          uuid primary key,
  full_name   text not null,
  phone       text unique,               -- định danh chính ở VN
  email       text,
  id_number   text,                      -- CCCD, mã hóa ở tầng app
  avatar_url  text,
  created_at  timestamptz not null default now()
);

-- JUNCTION TABLE — 1 user nhiều vai trò ở nhiều căn hộ.
-- valid_to = ngày hết hợp đồng thuê / hết ủy quyền -> tự thu hồi quyền.
create table unit_memberships (
  id           uuid primary key default uuid_generate_v4(),
  unit_id      uuid not null references units(id) on delete cascade,
  user_id      uuid not null references profiles(id) on delete cascade,
  role         unit_role  not null,
  status       member_status not null default 'pending',
  valid_from   date not null default current_date,
  valid_to     date,                      -- null = vô thời hạn (owner)
  approved_by  uuid references profiles(id),
  approved_at  timestamptz,
  can_view_finance boolean not null default false,
  created_at   timestamptz not null default now(),
  constraint valid_range check (valid_to is null or valid_to >= valid_from)
);
-- Mỗi căn chỉ 1 chủ hộ đang hoạt động
create unique index one_active_owner on unit_memberships (unit_id)
  where role = 'owner' and status = 'active';
create index on unit_memberships (user_id, status);
create index on unit_memberships (valid_to) where status = 'active';

-- Nhân sự BQL/BQT — phạm vi project hoặc riêng 1 tòa
create table staff_assignments (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references profiles(id) on delete cascade,
  project_id  uuid not null references projects(id) on delete cascade,
  building_id uuid references buildings(id) on delete cascade,
  role        staff_role not null,
  is_active   boolean not null default true,
  unique (user_id, project_id, role)
);

-- Tài sản gắn căn hộ (đối chiếu đỗ xe sai / chó thả rông)
create table unit_vehicles (
  id uuid primary key default uuid_generate_v4(),
  unit_id uuid not null references units(id) on delete cascade,
  plate text not null, vehicle_type text, card_no text,
  unique (unit_id, plate)
);
create table unit_pets (
  id uuid primary key default uuid_generate_v4(),
  unit_id uuid not null references units(id) on delete cascade,
  name text, species text, photo_url text, vaccinated_until date
);

-- ─────────────────────── 3. TICKETING & SLA ──────────────────────────
create table sla_policies (
  id            uuid primary key default uuid_generate_v4(),
  project_id    uuid not null references projects(id) on delete cascade,
  category      text not null,            -- 'water_outage','elevator','plumbing'
  priority      ticket_priority not null default 'normal',
  respond_mins  int not null,             -- hạn tiếp nhận
  resolve_mins  int not null,             -- hạn hoàn thành
  escalate_to   staff_role not null default 'bql_manager',
  unique (project_id, category, priority)
);

create table tickets (
  id            uuid primary key default uuid_generate_v4(),
  unit_id       uuid not null references units(id),
  building_id   uuid not null references buildings(id),
  project_id    uuid not null references projects(id),
  reporter_id   uuid not null references profiles(id),
  category      text not null,
  priority      ticket_priority not null default 'normal',
  title         text not null,
  description   text,
  photo_urls    text[] not null default '{}',
  status        ticket_status not null default 'new',
  assignee_id   uuid references profiles(id),
  sla_respond_due timestamptz,
  sla_resolve_due timestamptz,
  responded_at  timestamptz,
  resolved_at   timestamptz,
  escalated_at  timestamptz,
  rating        int check (rating between 1 and 5),
  rating_note   text,
  created_at    timestamptz not null default now()
);
create index on tickets (project_id, status, sla_resolve_due);
create index on tickets (unit_id, created_at desc);
create index on tickets (assignee_id) where status in ('assigned','in_progress');

-- Audit trail bất biến -> nguồn dữ liệu duy nhất cho KPI dashboard của BQT
create table ticket_events (
  id         bigserial primary key,
  ticket_id  uuid not null references tickets(id) on delete cascade,
  actor_id   uuid references profiles(id),
  event_type text not null,               -- 'created','assigned','status_changed','escalated','commented'
  from_value text, to_value text, note text,
  created_at timestamptz not null default now()
);
create index on ticket_events (ticket_id, created_at);

-- ────────────────────── 4. BILLING & PAYMENTS ────────────────────────
create table fee_types (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  code text not null, name text not null,
  unit_price bigint,                         -- VND, không lẻ xu
  calc_method text not null default 'fixed', -- 'fixed' | 'per_m2' | 'metered'
  unique (project_id, code)
);

create table invoices (
  id           uuid primary key default uuid_generate_v4(),
  unit_id      uuid not null references units(id),
  project_id   uuid not null references projects(id),
  period       date not null,              -- ngày đầu tháng
  total_amount bigint not null default 0,  -- VND
  paid_amount  bigint not null default 0,
  status       invoice_status not null default 'draft',
  due_date     date not null,
  qr_payload   text,                       -- VietQR động
  issued_at    timestamptz,
  created_at   timestamptz not null default now(),
  unique (unit_id, period)
);
create index on invoices (project_id, status, due_date);

create table invoice_lines (
  id          uuid primary key default uuid_generate_v4(),
  invoice_id  uuid not null references invoices(id) on delete cascade,
  fee_type_id uuid references fee_types(id),
  description text not null,
  quantity    numeric(12,3) not null default 1,
  unit_price  bigint not null,
  amount      bigint not null
);

-- Idempotent: bank_ref unique -> webhook bắn lại KHÔNG gạch nợ 2 lần
create table payments (
  id          uuid primary key default uuid_generate_v4(),
  invoice_id  uuid references invoices(id),
  unit_id     uuid not null references units(id),
  amount      bigint not null check (amount > 0),
  method      text not null default 'bank_transfer',
  bank_ref    text unique,
  raw_payload jsonb,
  paid_at     timestamptz not null default now(),
  matched_by  text not null default 'auto'  -- 'auto' | 'manual'
);

-- ─────────────── 5. THÔNG BÁO & CẨM NANG SỐ ──────────────────────────
-- ponytail: target bằng cột nullable thay vì bảng announcement_targets.
-- null = áp dụng toàn bộ cấp cha. Đủ cho "toàn tầng 12 tòa P3".
create table documents (                    -- cẩm nang / nội quy số
  id         uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  section    text not null,                -- 'Thú cưng', 'Rác thải', 'Sửa chữa'
  title      text not null,
  body       text not null,
  version    int not null default 1,
  search_tsv tsvector generated always as (to_tsvector('simple', title || ' ' || body)) stored
);
create index on documents using gin (search_tsv);

create table announcements (
  id            uuid primary key default uuid_generate_v4(),
  project_id    uuid not null references projects(id) on delete cascade,
  building_id   uuid references buildings(id),
  floor_no      int,
  unit_id       uuid references units(id),
  title         text not null,
  body          text not null,
  document_id   uuid references documents(id) on delete set null,  -- nút "trích dẫn nội quy"
  is_urgent     boolean not null default false,
  published_at  timestamptz,
  author_id     uuid not null references profiles(id),
  created_at    timestamptz not null default now()
);

create table notifications (
  id          bigserial primary key,
  user_id     uuid not null references profiles(id) on delete cascade,
  kind        text not null,               -- 'ticket','invoice','announcement','approval'
  ref_id      uuid,
  title       text not null, body text,
  read_at     timestamptz,
  sent_zns_at timestamptz,
  created_at  timestamptz not null default now()
);
create index on notifications (user_id, read_at, created_at desc);

-- ─────────────────── 6. RLS: quyền ở DB, không ở app ─────────────────
create or replace function current_unit_ids()
returns setof uuid language sql stable security definer set search_path = public as $fn$
  select unit_id from unit_memberships
   where user_id = auth.uid() and status = 'active'
     and valid_from <= current_date
     and (valid_to is null or valid_to >= current_date);
$fn$;

create or replace function is_staff(p_project uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (select 1 from staff_assignments
                  where user_id = auth.uid() and project_id = p_project and is_active);
$fn$;

alter table tickets          enable row level security;
alter table invoices         enable row level security;
alter table unit_memberships enable row level security;

create policy ticket_resident_read on tickets for select
  using (unit_id in (select current_unit_ids()) or is_staff(project_id));
create policy ticket_resident_insert on tickets for insert
  with check (unit_id in (select current_unit_ids()) and reporter_id = auth.uid());
create policy ticket_staff_write on tickets for update
  using (is_staff(project_id));

-- Family member KHÔNG thấy công nợ trừ khi chủ hộ bật can_view_finance
create policy invoice_read on invoices for select
  using (
    is_staff(project_id)
    or exists (select 1 from unit_memberships m
                where m.unit_id = invoices.unit_id and m.user_id = auth.uid()
                  and m.status = 'active'
                  and (m.valid_to is null or m.valid_to >= current_date)
                  and (m.role in ('owner','authorized','tenant') or m.can_view_finance))
  );

create policy membership_read on unit_memberships for select
  using (user_id = auth.uid() or unit_id in (select current_unit_ids()));

-- ──────────────── 7. JOBS: hết hạn thuê + leo thang SLA ──────────────
-- pg_cron 5 phút/lần. escalate ghi ticket_events -> Edge Function đọc & push ZNS.
create or replace function expire_memberships() returns void
language sql as $fn$
  update unit_memberships set status = 'expired'
   where status = 'active' and valid_to is not null and valid_to < current_date;
$fn$;

create or replace function escalate_overdue_tickets() returns void
language plpgsql as $fn$
begin
  with overdue as (
    update tickets set escalated_at = now()
     where status in ('new','assigned','in_progress')
       and sla_resolve_due < now() and escalated_at is null
    returning id
  )
  insert into ticket_events (ticket_id, event_type, note)
  select id, 'escalated', 'Quá hạn SLA - tự động leo thang' from overdue;
end $fn$;
