-- VBuilding — Core schema (PostgreSQL 15 / Supabase)
-- Chạy: psql -f schema.sql  |  hoặc dán vào Supabase SQL Editor
-- Nguyên tắc: 3NF cho Master Data, RLS ở DB thay vì check quyền rải rác trong app.


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
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  address     text,
  timezone    text not null default 'Asia/Ho_Chi_Minh',
  created_at  timestamptz not null default now()
);

create table buildings (
  id          uuid primary key default gen_random_uuid(),
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
  id           uuid primary key default gen_random_uuid(),
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
  id           uuid primary key default gen_random_uuid(),
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
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  project_id  uuid not null references projects(id) on delete cascade,
  building_id uuid references buildings(id) on delete cascade,
  role        staff_role not null,
  is_active   boolean not null default true,
  unique (user_id, project_id, role)
);

-- Tài sản gắn căn hộ (đối chiếu đỗ xe sai / chó thả rông)
create table unit_vehicles (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id) on delete cascade,
  plate text not null, vehicle_type text, card_no text,
  unique (unit_id, plate)
);
create table unit_pets (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id) on delete cascade,
  name text, species text, photo_url text, vaccinated_until date
);

-- ─────────────────────── 3. TICKETING & SLA ──────────────────────────
create table sla_policies (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  category      text not null,            -- 'water_outage','elevator','plumbing'
  priority      ticket_priority not null default 'normal',
  respond_mins  int not null,             -- hạn tiếp nhận
  resolve_mins  int not null,             -- hạn hoàn thành
  escalate_to   staff_role not null default 'bql_manager',
  unique (project_id, category, priority)
);

create table tickets (
  id            uuid primary key default gen_random_uuid(),
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
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  code text not null, name text not null,
  unit_price bigint,                         -- VND, không lẻ xu
  calc_method text not null default 'fixed', -- 'fixed' | 'per_m2' | 'metered'
  unique (project_id, code)
);

create table invoices (
  id           uuid primary key default gen_random_uuid(),
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
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references invoices(id) on delete cascade,
  fee_type_id uuid references fee_types(id),
  description text not null,
  quantity    numeric(12,3) not null default 1,
  unit_price  bigint not null,
  amount      bigint not null
);

-- Chỉ số điện/nước theo kỳ. consumption = curr_index - prev_index.
create table meter_readings (
  id          uuid primary key default gen_random_uuid(),
  unit_id     uuid not null references units(id) on delete cascade,
  fee_type_id uuid not null references fee_types(id) on delete cascade,
  period      date not null,
  prev_index  numeric(12,2) not null,
  curr_index  numeric(12,2) not null,
  recorded_by uuid references profiles(id),
  recorded_at timestamptz not null default now(),
  unique (unit_id, fee_type_id, period),
  constraint reading_not_backwards check (curr_index >= prev_index)
);

-- Idempotent: bank_ref unique -> webhook bắn lại KHÔNG gạch nợ 2 lần
create table payments (
  id          uuid primary key default gen_random_uuid(),
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
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  section    text not null,                -- 'Thú cưng', 'Rác thải', 'Sửa chữa'
  title      text not null,
  body       text not null,
  version    int not null default 1,
  search_tsv tsvector generated always as (to_tsvector('simple', title || ' ' || body)) stored
);
create index on documents using gin (search_tsv);

create table announcements (
  id            uuid primary key default gen_random_uuid(),
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

-- Suy ra dự án từ tòa/căn để policy khỏi lặp subquery. DEFINER để không phụ
-- thuộc quyền đọc buildings của người gọi.
create or replace function building_project(p_building uuid)
returns uuid language sql stable security definer set search_path = public as $fn$
  select project_id from buildings where id = p_building;
$fn$;

create or replace function unit_project(p_unit uuid)
returns uuid language sql stable security definer set search_path = public as $fn$
  select b.project_id from units u join buildings b on b.id = u.building_id where u.id = p_unit;
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

-- Timeline của cư dân đọc từ đây. Thừa hưởng quyền của chính ticket: subquery
-- dưới đây bị policy ticket_resident_read lọc lại, nên ai thấy ticket nào mới
-- thấy diễn biến ticket đó. KHÔNG cấp quyền ghi cho ai — audit trail chỉ được
-- viết bởi trigger ticket_log_change (SECURITY DEFINER).
alter table ticket_events enable row level security;
create policy ticket_event_read on ticket_events for select
  using (exists (select 1 from tickets t where t.id = ticket_events.ticket_id));

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

-- BQL cần thấy danh sách nhân sự để phân công. KHÔNG cấp quyền ghi cho ai: tự
-- ghi được bảng này là tự phong BQL, vượt luôn RLS của tickets/invoices. Bản
-- ghi đầu tiên tạo bằng quyền postgres (bootstrap_bql.sql).
alter table staff_assignments enable row level security;
create policy staff_read on staff_assignments for select
  using (user_id = auth.uid() or is_staff(project_id));

-- Thông báo là dữ liệu riêng từng người. Có grant select mà không có RLS thì
-- cư dân nào đăng nhập cũng đọc được thông báo của toàn khu.
alter table notifications enable row level security;
create policy notification_own_read on notifications for select
  using (user_id = auth.uid());

-- Dòng hóa đơn thừa hưởng quyền của chính hóa đơn: subquery dưới đây bị policy
-- invoice_read lọc lại, nên ai thấy hóa đơn nào mới thấy chi tiết hóa đơn đó.
-- Thiếu RLS ở đây = đọc thẳng invoice_lines là vòng qua được RLS của invoices.
alter table invoice_lines enable row level security;
create policy invoice_line_read on invoice_lines for select
  using (exists (select 1 from invoices i where i.id = invoice_lines.invoice_id));

-- SECURITY DEFINER bắt buộc: policy trên unit_memberships mà truy vấn thẳng
-- unit_memberships sẽ đệ quy vô hạn. Hàm definer bỏ qua RLS nên cắt được vòng lặp.
create or replace function is_unit_manager(p_unit uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (select 1 from unit_memberships
                  where unit_id = p_unit and user_id = auth.uid()
                    and status = 'active' and role in ('owner','authorized')
                    and (valid_to is null or valid_to >= current_date));
$fn$;

-- Tự xin gia nhập: chỉ được tạo bản ghi 'pending' cho chính mình.
-- Không tự đặt 'active' được -> phải qua chủ hộ duyệt.
create policy membership_self_request on unit_memberships for insert
  with check (user_id = auth.uid() and status = 'pending');

-- Chủ hộ / người được ủy quyền duyệt hoặc thu hồi thành viên căn hộ mình quản lý.
create policy membership_manager_write on unit_memberships for update
  using (is_unit_manager(unit_id));

-- Chủ hộ phải đọc được tên/SĐT của người xin gia nhập căn mình, nếu không màn
-- duyệt chỉ hiện một dòng trống. Nhưng mở select cả bảng profiles = lộ danh bạ
-- toàn khu (họ tên, SĐT, email). Giới hạn đúng phạm vi cần:
--   - profile của chính mình
--   - profile của người có bản ghi thành viên trên căn mình đang quản lý
-- SECURITY DEFINER vì hàm đọc unit_memberships, mà unit_memberships lại có
-- policy đọc ngược về đây — invoker sẽ đệ quy.
create or replace function can_see_profile(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select p_user = auth.uid()
      -- chủ hộ xem được thành viên căn mình quản lý
      or exists (
           select 1
             from unit_memberships them
             join unit_memberships mine on mine.unit_id = them.unit_id
            where them.user_id = p_user
              and mine.user_id = auth.uid()
              and mine.status = 'active'
              and mine.role in ('owner','authorized')
              and (mine.valid_to is null or mine.valid_to >= current_date)
         )
      -- BQL xem được cư dân trong dự án mình phụ trách: nhận ticket mà không
      -- biết ai báo, gọi lại số nào thì không xử lý được việc gì.
      or exists (
           select 1 from unit_memberships m
            where m.user_id = p_user and is_staff(unit_project(m.unit_id))
         )
      -- và xem được đồng nghiệp, để còn phân công cho nhau
      or exists (
           select 1 from staff_assignments s
            where s.user_id = p_user and is_staff(s.project_id)
         );
$fn$;

alter table profiles enable row level security;
create policy profile_read on profiles for select using (can_see_profile(id));

-- ── Cây tài sản: ai đăng nhập cũng ĐỌC được (cư dân phải chọn căn để xin gia
--    nhập), nhưng chỉ BQL mới GHI. Bật RLS ở đây còn để tránh cảnh: sau này cấp
--    thêm quyền ghi cho authenticated là cả khu sửa được danh sách căn hộ.
alter table buildings enable row level security;
create policy building_read on buildings for select using (true);
create policy building_staff_write on buildings for all
  using (is_staff(project_id)) with check (is_staff(project_id));

alter table units enable row level security;
create policy unit_read on units for select using (true);
create policy unit_staff_write on units for all
  using (is_staff(building_project(building_id)))
  with check (is_staff(building_project(building_id)));

-- ── Xe và thú cưng: chủ hộ / người được ủy quyền tự quản lý căn mình.
--    BQL đọc được để đối chiếu đỗ xe sai, chó thả rông — nhưng không sửa hộ.
alter table unit_vehicles enable row level security;
create policy vehicle_resident_read on unit_vehicles for select
  using (unit_id in (select current_unit_ids()) or is_staff(unit_project(unit_id)));
create policy vehicle_manager_write on unit_vehicles for all
  using (is_unit_manager(unit_id)) with check (is_unit_manager(unit_id));

alter table unit_pets enable row level security;
create policy pet_resident_read on unit_pets for select
  using (unit_id in (select current_unit_ids()) or is_staff(unit_project(unit_id)));
create policy pet_manager_write on unit_pets for all
  using (is_unit_manager(unit_id)) with check (is_unit_manager(unit_id));

-- ──────────────── 7. JOBS: hết hạn thuê + leo thang SLA ──────────────
-- pg_cron 5 phút/lần. escalate ghi ticket_events -> Edge Function đọc & push ZNS.
create or replace function expire_memberships() returns void
language sql set search_path = public as $fn$
  update unit_memberships set status = 'expired'
   where status = 'active' and valid_to is not null and valid_to < current_date;
$fn$;

-- ── Ticket: suy ra vị trí + hạn SLA ở DB, không để app tự tính ──
-- App chỉ gửi unit_id/category/priority. Suy ra building_id, project_id ở đây thì
-- không bao giờ có ticket gắn sai dự án (gắn sai = RLS lọc sai = rò dữ liệu).
-- SECURITY DEFINER: hàm đọc units/buildings/sla_policies để suy ra vị trí và
-- hạn SLA. Để invoker thì việc tạo ticket phụ thuộc ngầm vào quyền đọc 3 bảng
-- đó của cư dân — hôm nay tình cờ có, mai siết quyền là gãy mà không rõ vì sao.
create or replace function ticket_fill_defaults() returns trigger
language plpgsql security definer set search_path = public as $fn$
declare v_policy sla_policies%rowtype;
begin
  select b.id, b.project_id into new.building_id, new.project_id
    from units u join buildings b on b.id = u.building_id
   where u.id = new.unit_id;

  select * into v_policy from sla_policies
   where project_id = new.project_id and category = new.category
     and priority = new.priority;

  -- Không có policy khớp -> để hạn NULL, ticket vẫn tạo được.
  -- Cron escalate bỏ qua hạn NULL, nên chỉ mất cảnh báo, không mất báo cáo.
  if found then
    new.sla_respond_due := now() + make_interval(mins => v_policy.respond_mins);
    new.sla_resolve_due := now() + make_interval(mins => v_policy.resolve_mins);
  end if;
  return new;
end $fn$;

create trigger trg_ticket_fill before insert on tickets
  for each row execute function ticket_fill_defaults();

-- API tạo ticket cho app. Vì sao cần hàm này thay vì insert thẳng:
-- building_id/project_id là NOT NULL không default, nên type sinh từ DB bắt
-- app phải gửi — đúng cái mà trigger sinh ra để app KHỎI phải gửi. Trình sinh
-- type không biết có trigger. Bọc lại thành hàm thì hợp đồng "app chỉ gửi
-- unit/category/priority" thành hợp đồng có kiểu, không phải ép kiểu cho qua.
-- KHÔNG phải security definer: insert chạy dưới quyền người gọi nên policy
-- ticket_resident_insert vẫn là chốt chặn.
create or replace function create_ticket(
  p_unit        uuid,
  p_category    text,
  p_priority    ticket_priority,
  p_title       text,
  p_description text default null
) returns uuid language sql set search_path = public as $fn$
  insert into tickets (unit_id, reporter_id, category, priority, title, description)
  values (p_unit, auth.uid(), p_category, p_priority, p_title, nullif(p_description, ''))
  returning id;
$fn$;

-- Audit trail viết bằng trigger, không viết ở app: nhiều nơi ghi ticket (app BQL,
-- app cư dân, cron) — để app tự log thì sớm muộn có nhánh quên log, và KPI của
-- BQT tính từ ticket_events sẽ sai mà không ai biết.
-- SECURITY DEFINER: cư dân KHÔNG được cấp quyền ghi ticket_events (audit trail
-- mà người bị audit ghi được thì vô nghĩa). Trigger chạy dưới quyền owner nên
-- vẫn ghi được, còn cư dân không insert thẳng vào bảng này được.
create or replace function ticket_log_change() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  if tg_op = 'INSERT' then
    insert into ticket_events (ticket_id, actor_id, event_type, to_value)
      values (new.id, new.reporter_id, 'created', new.status::text);
  elsif new.status is distinct from old.status then
    insert into ticket_events (ticket_id, actor_id, event_type, from_value, to_value)
      values (new.id, new.assignee_id, 'status_changed', old.status::text, new.status::text);
  end if;
  return new;
end $fn$;

create trigger trg_ticket_log after insert or update on tickets
  for each row execute function ticket_log_change();

-- Mốc thời gian đo SLA: đóng dấu lần đầu, không ghi đè khi đổi trạng thái tiếp.
create or replace function ticket_stamp_times() returns trigger
language plpgsql set search_path = public as $fn$
begin
  if new.status in ('assigned','in_progress') and new.responded_at is null then
    new.responded_at := now();
  end if;
  if new.status in ('resolved','closed') and new.resolved_at is null then
    new.resolved_at := now();
  end if;
  return new;
end $fn$;

create trigger trg_ticket_stamp before update on tickets
  for each row execute function ticket_stamp_times();

-- N13 — cư dân chấm điểm sau khi việc xong.
-- Vì sao là hàm chứ không phải update thẳng: cư dân phải sửa được rating nhưng
-- KHÔNG được đụng status/assignee. `authenticated` là một role dùng chung cho
-- cả cư dân lẫn BQL nên grant theo cột không phân biệt được hai bên. Hàm ghi
-- đúng hai cột đánh giá là cách duy nhất giữ được ranh giới đó.
-- SECURITY DEFINER nên hàm BỎ QUA RLS -> phải tự kiểm tra quyền, không được
-- dựa vào policy như create_ticket.
create or replace function rate_ticket(p_ticket uuid, p_rating int, p_note text default null)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_unit uuid; v_status ticket_status;
begin
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    -- Bảo đảm thật là CHECK constraint trên cột rating; dòng này chỉ để trả về
    -- lỗi đọc được thay vì ném nguyên constraint violation lên mặt người dùng.
    -- SQLSTATE riêng cho từng loại từ chối, để test bắt được ĐÚNG loại thay vì
    -- nuốt bừa mọi lỗi (nuốt bừa thì chính dòng assert cũng bị nuốt).
    raise exception 'Diem danh gia phai tu 1 den 5' using errcode = '22023';
  end if;

  select unit_id, status into v_unit, v_status from tickets where id = p_ticket;
  if v_unit is null then
    raise exception 'Khong tim thay yeu cau' using errcode = '42501';
  end if;

  if not exists (
    select 1 from unit_memberships
     where unit_id = v_unit and user_id = auth.uid() and status = 'active'
       and valid_from <= current_date
       and (valid_to is null or valid_to >= current_date)
  ) then
    raise exception 'Ban khong thuoc can ho cua yeu cau nay' using errcode = '42501';
  end if;

  -- Chấm điểm khi việc chưa xong thì điểm đo cái gì?
  if v_status not in ('resolved', 'closed') then
    raise exception 'Chi danh gia duoc khi yeu cau da xong' using errcode = '55000';
  end if;

  update tickets set rating = p_rating, rating_note = nullif(p_note, '')
   where id = p_ticket;
end $fn$;

-- Sinh hóa đơn 1 kỳ cho toàn dự án. CHẠY LẠI ĐƯỢC: chỉ đụng hóa đơn còn 'draft',
-- hóa đơn đã 'issued' trở lên không bị ghi đè -> không nhân đôi tiền của cư dân.
-- ponytail: điện tính 1 giá phẳng. Điện VN thực tế là bậc thang — khi cần, đổi
-- nhánh 'metered' sang bảng fee_tiers, phần còn lại của hàm giữ nguyên.
create or replace function generate_invoices(p_project uuid, p_period date)
returns int language plpgsql set search_path = public as $fn$
declare v_count int;
begin
  insert into invoices (unit_id, project_id, period, due_date, status)
  select u.id, p_project, p_period, p_period + interval '15 day', 'draft'
    from units u join buildings b on b.id = u.building_id
   where b.project_id = p_project
  on conflict (unit_id, period) do nothing;

  delete from invoice_lines l using invoices i
   where l.invoice_id = i.id and i.project_id = p_project
     and i.period = p_period and i.status = 'draft';

  insert into invoice_lines (invoice_id, fee_type_id, description, quantity, unit_price, amount)
  select i.id, f.id, f.name,
         case f.calc_method
           when 'per_m2'  then coalesce(u.area_m2, 0)
           when 'metered' then coalesce(r.curr_index - r.prev_index, 0)
           else 1
         end as qty,
         f.unit_price,
         round(f.unit_price * case f.calc_method
           when 'per_m2'  then coalesce(u.area_m2, 0)
           when 'metered' then coalesce(r.curr_index - r.prev_index, 0)
           else 1
         end)::bigint
    from invoices i
    join units u on u.id = i.unit_id
    join fee_types f on f.project_id = i.project_id
    left join meter_readings r
           on r.unit_id = u.id and r.fee_type_id = f.id and r.period = i.period
   where i.project_id = p_project and i.period = p_period and i.status = 'draft'
     -- không sinh dòng 0đ cho căn chưa có chỉ số công tơ
     and (f.calc_method <> 'metered' or r.id is not null);

  update invoices i set total_amount = coalesce(
      (select sum(l.amount) from invoice_lines l where l.invoice_id = i.id), 0)
   where i.project_id = p_project and i.period = p_period and i.status = 'draft';

  get diagnostics v_count = row_count;
  return v_count;
end $fn$;

create or replace function escalate_overdue_tickets() returns void
language plpgsql set search_path = public as $fn$
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
