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
-- N19–N20 — SỔ TIỀN VỀ. Đây là thứ NGÂN HÀNG nói, tách khỏi `payments` là thứ
-- MÌNH đã gạch cho căn nào. Hai chuyện khác nhau, và đối soát chính là việc so
-- hai cái đó với nhau — gộp làm một bảng thì không còn gì để so.
--
-- Mọi giao dịch tiền vào đều nằm ở đây, kể cả cái không khớp được căn nào.
-- Chỉ lưu cái khớp được thì tiền của người ghi sai nội dung biến mất khỏi hệ
-- thống, mà đó lại đúng là loại giao dịch cần người nhìn nhất.
create table bank_transactions (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references projects(id) on delete cascade,
  provider       text not null,              -- 'sepay' | 'casso'
  provider_ref   text not null,              -- id giao dịch phía nhà cung cấp
  bank_ref       text,                       -- mã tham chiếu của ngân hàng
  account_number text,
  amount         bigint not null check (amount > 0),
  content        text not null default '',   -- nội dung chuyển khoản, thô
  paid_at        timestamptz not null,
  raw_payload    jsonb not null default '{}'::jsonb,
  trang_thai     text not null default 'chua_khop'
                 check (trang_thai in ('chua_khop','da_khop','bo_qua')),
  cach_khop      text,                       -- 'ma_can' (tự động) | 'thu_cong'
  unit_id        uuid references units(id),  -- căn được gạch, null nếu chưa khớp
  con_du         bigint not null default 0,  -- tiền chưa gạch vào hóa đơn nào
  ghi_chu        text,
  received_at    timestamptz not null default now(),
  -- CHỐNG BẮN TRÙNG. Nhà cung cấp webhook nào cũng retry khi không nhận được
  -- 200, nên cùng một giao dịch đến vài lần là chuyện thường ngày. Khóa ở đây
  -- chứ không ở payments: một lần chuyển khoản có thể gạch cho NHIỀU hóa đơn,
  -- tức nhiều dòng payments cùng một bank_ref.
  unique (provider, provider_ref)
);
create index on bank_transactions (project_id, trang_thai, paid_at desc);

create table payments (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid references invoices(id),
  unit_id     uuid not null references units(id),
  amount      bigint not null check (amount > 0),
  method      text not null default 'bank_transfer',
  -- KHÔNG unique: một lần chuyển khoản trả cho 2 hóa đơn thì sinh 2 dòng cùng
  -- bank_ref. Chống bắn trùng nằm ở bank_transactions(provider, provider_ref).
  bank_ref    text,
  bank_txn_id uuid references bank_transactions(id) on delete set null,
  raw_payload jsonb,
  paid_at     timestamptz not null default now(),
  matched_by  text not null default 'auto'  -- 'auto' | 'manual'
);
create index on payments (bank_ref);
create index on payments (bank_txn_id);

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

-- ── Biểu phí: cư dân đọc (để đối chiếu hóa đơn), chỉ BQL sửa ──
alter table fee_types enable row level security;
create policy fee_type_read on fee_types for select using (true);
create policy fee_type_staff_write on fee_types for all
  using (is_staff(project_id)) with check (is_staff(project_id));

-- ── Chỉ số công tơ: cư dân xem được chỉ số căn mình (để cãi lại khi hóa đơn
--    sai), chỉ BQL ghi. Ghi hàng loạt vài trăm dòng nên đi qua RLS chứ không
--    bọc RPC — mỗi căn một lời gọi thì nhập xong một tòa mất cả buổi.
alter table meter_readings enable row level security;
create policy reading_read on meter_readings for select
  using (unit_id in (select current_unit_ids()) or is_staff(unit_project(unit_id)));
create policy reading_staff_write on meter_readings for all
  using (is_staff(unit_project(unit_id)))
  with check (is_staff(unit_project(unit_id)));

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

-- ── Thanh toán: CHỈ BQL đọc, không ai ghi từ phía client ──
-- payments.raw_payload giữ nguyên gói tin ngân hàng gửi về — trong đó có tên
-- người chuyển, số tài khoản nguồn, nội dung giao dịch. RLS không lọc được theo
-- CỘT, nên cho cư dân đọc bảng này là cho họ đọc luôn dữ liệu ngân hàng của
-- hàng xóm. Cư dân không cần: số đã trả hiện sẵn ở invoices.paid_amount, mà
-- hóa đơn thì họ đọc được rồi.
--
-- Không có policy GHI cho bất kỳ ai. Ghi vào bảng này là việc của webhook đối
-- soát chạy bằng service_role (có BYPASSRLS) — đường tiền vào không đi qua
-- trình duyệt của ai cả.
alter table payments enable row level security;
create policy payment_staff_read on payments for select
  using (is_staff(unit_project(unit_id)));

-- Sổ tiền về cũng chỉ BQL đọc, cùng lý do như payments: raw_payload giữ nguyên
-- gói tin ngân hàng, trong đó có TÊN NGƯỜI CHUYỂN. Mở cho cư dân là ai cũng
-- tra được hàng xóm chuyển tiền cho ai. Không có policy ghi cho bất kỳ ai —
-- mọi đường ghi đều đi qua hàm definer ở dưới.
alter table bank_transactions enable row level security;
create policy bank_txn_staff_read on bank_transactions for select
  using (is_staff(project_id));

-- ── Dữ liệu dùng chung: ai đăng nhập cũng ĐỌC, chỉ BQL GHI ──
-- Ba bảng này ai cũng đọc được là ĐÚNG ý đồ: cư dân phải xem được nội quy, biết
-- BQL cam kết bao lâu, và duyệt danh sách căn để xin gia nhập.
--
-- Vậy bật RLS làm gì khi policy là `using (true)`? Vì tắt RLS và "đọc mở" là hai
-- chuyện khác nhau. Tắt RLS nghĩa là NGÀY NÀO ĐÓ ai cấp thêm quyền ghi cho
-- authenticated — thêm một dòng grant, hoặc Supabase đổi mặc định — thì cả khu
-- sửa được nội quy và biểu SLA mà không có gì chặn. Bật RLS khóa cửa đó lại
-- trước, đúng như đã làm với buildings/units.
alter table projects enable row level security;
create policy project_read on projects for select using (true);
create policy project_staff_write on projects for all
  using (is_staff(id)) with check (is_staff(id));

alter table sla_policies enable row level security;
create policy sla_read on sla_policies for select using (true);
create policy sla_staff_write on sla_policies for all
  using (is_staff(project_id)) with check (is_staff(project_id));

alter table documents enable row level security;
create policy document_read on documents for select using (true);
create policy document_staff_write on documents for all
  using (is_staff(project_id)) with check (is_staff(project_id));

-- ── Thông báo: bảng DUY NHẤT trong nhóm này có nhắm đối tượng ──
-- announcements có building_id / floor_no / unit_id để gửi riêng một tòa, một
-- tầng, hay một căn. Không có RLS thì mấy cột đó chỉ là trang trí: thông báo
-- "mời anh chị lên làm việc về khoản nợ" gửi riêng căn 10.01 mà cả khu đọc
-- được. Đó là lộ dữ liệu, không phải phiền toái.
--
-- Quy tắc: cột nào để NULL là không giới hạn theo chiều đó. Cả ba cùng NULL =
-- toàn dự án. Điều kiện dưới đây đọc đúng như vậy — mỗi cột chỉ lọc khi nó có
-- giá trị.
-- SECURITY DEFINER, không viết thẳng phép join vào policy: biểu thức policy
-- chạy dưới quyền NGƯỜI TRUY VẤN, nên join sang units/buildings ngay trong
-- policy sẽ vỡ thành 'permission denied for table buildings' nếu ngày nào đó
-- thu hồi quyền đọc buildings. Bọc vào hàm definer là chỗ này tự đứng được,
-- đúng như current_unit_ids() và unit_project().
create or replace function announcement_targets_me(
  p_project uuid, p_building uuid, p_floor int, p_unit uuid
) returns boolean
language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1
      from units u
      join buildings b on b.id = u.building_id
     where u.id in (select current_unit_ids())
       and b.project_id = p_project
       and (p_unit     is null or u.id          = p_unit)
       and (p_building is null or u.building_id = p_building)
       and (p_floor    is null or u.floor_no    = p_floor)
  );
$fn$;

alter table announcements enable row level security;
create policy announcement_read on announcements for select
  using (
    is_staff(project_id)
    or (
      -- Cư dân chỉ thấy bản ĐÃ phát hành. published_at null = bản nháp BQL đang
      -- soạn; hẹn giờ tương lai thì chưa tới giờ chưa được thấy.
      published_at is not null and published_at <= now()
      and announcement_targets_me(project_id, building_id, floor_no, unit_id)
    )
  );
-- Chưa cấp quyền ghi bảng cho authenticated (xem auth_hooks.sql) nên policy này
-- hiện chưa dùng tới. Để sẵn cho đúng: lúc có màn soạn thông báo thì chỉ cần
-- thêm grant, không phải nghĩ lại chuyện ai được ghi.
create policy announcement_staff_write on announcements for all
  using (is_staff(project_id)) with check (is_staff(project_id));

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
-- p_photo_urls phải truyền NGAY LÚC TẠO: cư dân không có policy update trên
-- tickets nên không thể gắn ảnh sau. Ảnh upload lên Storage trước, lấy đường
-- dẫn rồi mới gọi hàm này (xem storage.sql).
create or replace function create_ticket(
  p_unit        uuid,
  p_category    text,
  p_priority    ticket_priority,
  p_title       text,
  p_description text default null,
  p_photo_urls  text[] default '{}'
) returns uuid language sql set search_path = public as $fn$
  insert into tickets (unit_id, reporter_id, category, priority, title, description, photo_urls)
  values (p_unit, auth.uid(), p_category, p_priority, p_title, nullif(p_description, ''),
          coalesce(p_photo_urls, '{}'))
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

-- ── Đường tiền: mặt tiếp xúc hẹp nhất có thể ──
-- KHÔNG cấp update trên invoices cho `authenticated`. Role đó dùng chung cho cả
-- cư dân lẫn BQL, mà quyền theo cột thì không phân biệt được hai bên — cấp một
-- lần là cư dân cũng có. Chuyển trạng thái tiền đi qua RPC definer, mỗi hàm tự
-- kiểm tra is_staff và chỉ làm đúng một việc.

create or replace function bql_generate_invoices(p_project uuid, p_period date)
returns int language plpgsql security definer set search_path = public as $fn$
begin
  if not is_staff(p_project) then
    raise exception 'Chi BQL cua du an nay moi sinh duoc hoa don' using errcode = '42501';
  end if;
  -- Kỳ phải là ngày đầu tháng: unique (unit_id, period) tính theo đúng giá trị
  -- này, lệch một ngày là sinh ra kỳ thứ hai của cùng tháng.
  if p_period <> date_trunc('month', p_period)::date then
    raise exception 'Ky phai la ngay dau thang' using errcode = '22023';
  end if;
  return generate_invoices(p_project, p_period);
end $fn$;

-- Phát hành: draft -> issued. Sau bước này generate_invoices không đụng vào nữa
-- (nó chỉ tính lại hóa đơn còn draft), nên đây là mốc chốt số.
create or replace function bql_issue_invoices(p_project uuid, p_period date)
returns int language plpgsql security definer set search_path = public as $fn$
declare v_count int;
begin
  if not is_staff(p_project) then
    raise exception 'Chi BQL cua du an nay moi phat hanh duoc hoa don' using errcode = '42501';
  end if;

  -- Bỏ qua hóa đơn 0đ (căn chưa có phí nào áp dụng): phát hành giấy báo nợ 0
  -- đồng chỉ làm cư dân hoang mang và làm nhiễu báo cáo công nợ.
  update invoices set status = 'issued', issued_at = now()
   where project_id = p_project and period = p_period
     and status = 'draft' and total_amount > 0;
  get diagnostics v_count = row_count;
  return v_count;
end $fn$;

-- N21 — nhắc nợ 3 mốc: trước hạn 3 ngày, đúng ngày hạn, quá hạn 3 ngày.
-- Chỉ nhắc người ĐƯỢC XEM công nợ (cùng quy tắc với policy invoice_read): con
-- cái trong nhà không cần nhận tin nhắn đòi tiền.
create or replace function remind_unpaid_invoices() returns int
language plpgsql security definer set search_path = public as $fn$
declare v_count int;
begin
  insert into notifications (user_id, kind, ref_id, title, body)
  select m.user_id, 'invoice', i.id,
         case
           when i.due_date - current_date = 3 then 'Hoa don ' || to_char(i.period,'MM/YYYY') || ' sap den han'
           when i.due_date = current_date     then 'Hoa don ' || to_char(i.period,'MM/YYYY') || ' den han hom nay'
           else 'Hoa don ' || to_char(i.period,'MM/YYYY') || ' da qua han'
         end,
         -- 'G' lay dau phan nhom theo lc_numeric cua server -> ra '1,500,000'
         -- kieu My. Dung dau phay LITERAL roi doi sang '.' cho dung kieu VN va
         -- khong phu thuoc locale cua may chu.
         'Con lai ' || replace(to_char(i.total_amount - i.paid_amount, 'FM999,999,999,999'), ',', '.')
           || 'd, han ' || to_char(i.due_date,'DD/MM/YYYY')
    from invoices i
    join unit_memberships m on m.unit_id = i.unit_id
   where i.status in ('issued','partial')
     and i.total_amount > i.paid_amount
     and (i.due_date - current_date) in (3, 0, -3)
     and m.status = 'active'
     and (m.valid_to is null or m.valid_to >= current_date)
     and (m.role in ('owner','authorized','tenant') or m.can_view_finance)
     -- Không nhắc lại trong 20 giờ. Cron chạy lại (retry, hoặc BQL bấm tay)
     -- không được bắn hai lần vào điện thoại cư dân — đó là cách nhanh nhất để
     -- họ tắt thông báo và không bao giờ bật lại. Dùng khoảng thời gian chứ
     -- không dùng current_date: mốc 'sang ngày mới' phụ thuộc TimeZone của
     -- server (Supabase để UTC), mà cron lại chạy 01:00 UTC — chỉ cần lệch nửa
     -- tiếng là qua ngày và nhắc lại lần hai. 20h < 24h nên hôm sau vẫn nhắc.
     and not exists (
       select 1 from notifications n
        where n.user_id = m.user_id and n.kind = 'invoice' and n.ref_id = i.id
          and n.created_at > now() - interval '20 hours'
     );
  get diagnostics v_count = row_count;
  return v_count;
end $fn$;

-- N21 — báo cáo công nợ cho BQL, gộp theo căn.
-- Phải là SECURITY DEFINER: policy membership_read chỉ cho chính chủ và người
-- trong căn đọc unit_memberships, BQL KHÔNG đọc được roster. Mà đi đòi nợ thì
-- bắt buộc phải có tên + số điện thoại người liên hệ. Đổi lại, hàm tự kiểm
-- is_staff và khóa cứng vào p_project — definer mà quên hai thứ đó là dựng sẵn
-- một API dump công nợ toàn hệ thống.
create or replace function bql_debt_report(p_project uuid)
returns table (
  unit_id         uuid,
  unit_code       text,
  building_code   text,
  so_hoa_don      int,
  con_no          bigint,
  han_cu_nhat     date,
  so_ngay_qua_han int,     -- âm = chưa tới hạn, còn ngần đó ngày
  ten_lien_he     text,
  dien_thoai      text
)
language plpgsql stable security definer set search_path = public as $fn$
begin
  if not is_staff(p_project) then
    raise exception 'Chi BQL cua du an nay moi xem duoc cong no' using errcode = '42501';
  end if;

  return query
    select u.id, u.code, b.code,
           count(*)::int,
           sum(i.total_amount - i.paid_amount)::bigint,
           min(i.due_date),
           -- Tuổi nợ tính theo hóa đơn CŨ NHẤT còn thiếu, không phải mới nhất.
           (current_date - min(i.due_date))::int,
           o.full_name, o.phone
      from invoices i
      join units u     on u.id = i.unit_id
      join buildings b on b.id = u.building_id
      -- left join: căn chưa có chủ hộ hoạt động vẫn phải hiện ra. Nợ không tự
      -- mất đi vì thiếu người đứng tên.
      left join lateral (
        select p.full_name, p.phone
          from unit_memberships m
          join profiles p on p.id = m.user_id
         where m.unit_id = u.id and m.role = 'owner' and m.status = 'active'
           and (m.valid_to is null or m.valid_to >= current_date)
         limit 1
      ) o on true
     where i.project_id = p_project
       and i.status in ('issued','partial')
       and i.total_amount > i.paid_amount
     group by u.id, u.code, b.code, o.full_name, o.phone
     order by sum(i.total_amount - i.paid_amount) desc, u.code;
end $fn$;

-- N25–N26 — dashboard KPI cho BQT. Chỉ đọc, không một nút bấm nào.
--
-- Bốn quy ước dưới đây quyết định con số có dùng được hay không, nên viết ra
-- thay vì để người đọc đoán:
--
-- 1. MỘT TICKET CHỈ TÍNH SLA KHI ĐÃ NGÃ NGŨ. Xong rồi thì so resolved_at với
--    hạn; còn đang mở mà đã quá hạn thì tính TRỄ ngay, không đợi nó đóng. Cách
--    làm quen thuộc là chỉ lấy ticket đã đóng làm mẫu số — nhưng như thế cái để
--    treo mãi không bao giờ thành lỗi, và tỷ lệ đẹp dần lên đúng vào lúc dịch
--    vụ tệ đi. Ticket còn trong hạn thì chưa kết luận: để ngoài cả tử lẫn mẫu.
-- 2. TICKET BỊ TỪ CHỐI KHÔNG TÍNH SLA, nhưng đếm riêng. Từ chối là lối thoát
--    hợp lệ (trùng, spam, không thuộc phạm vi) và cũng là chỗ lách dễ nhất:
--    từ chối hết thì SLA 100%. Đếm ra thì cái lách nhìn thấy được.
-- 3. DANH MỤC CHƯA CÓ sla_policies -> sla_resolve_due NULL -> không có gì để so.
--    Đếm riêng thành ticket_khong_co_sla: đó là vùng mù, không phải điểm tuyệt đối.
-- 4. GIỜ VIỆT NAM. Server chạy UTC; cắt tháng bằng created_at::date thì ticket
--    báo lúc 6h sáng ngày 1 rơi về tháng trước và không ai phát hiện ra.
--
-- Công nợ là ẢNH CHỤP hiện tại, cố tình không theo kỳ: "đang bị nợ bao nhiêu"
-- không phải câu hỏi về tháng 8, nó là câu hỏi về hôm nay.
--
-- SECURITY DEFINER + tự kiểm is_staff: hàm gộp số của cả dự án, không policy
-- nào lọc hộ được. Quên self-guard là dựng sẵn API dump KPI toàn hệ thống.
create or replace function bql_dashboard(
  p_project uuid,
  p_tu      date default null,
  p_den     date default null
)
returns table (
  tu_ngay              date,
  den_ngay             date,
  -- Ticket trong kỳ (theo ngày TẠO: một ticket không nhảy tháng về sau)
  tong_ticket          int,
  ticket_tu_choi       int,
  ticket_khong_co_sla  int,
  ticket_co_ket_luan   int,
  ticket_dung_sla      int,
  ticket_chua_ket_luan int,
  ty_le_dung_sla       numeric,
  gio_phan_hoi_trung_vi numeric,
  gio_xu_ly_trung_vi   numeric,
  gio_xu_ly_trung_binh numeric,
  gio_xu_ly_p90        numeric,
  diem_hai_long        numeric,
  so_luot_danh_gia     int,
  ty_le_danh_gia       numeric,
  -- Ảnh chụp hiện tại, KHÔNG theo kỳ
  dang_mo_hien_tai     int,
  qua_han_hien_tai     int,
  cong_no              bigint,
  cong_no_qua_han      bigint,
  so_can_no            int,
  -- Tiền trong kỳ
  phai_thu_ky          bigint,
  da_thu_ky            bigint,
  tien_ve_ky           bigint
)
language plpgsql stable security definer set search_path = public as $fn$
declare
  v_hom_nay date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_tu   date;
  v_den  date;
  v_tu_ts  timestamptz;
  v_den_ts timestamptz;
begin
  if not is_staff(p_project) then
    raise exception 'Chi BQL cua du an nay moi xem duoc dashboard' using errcode = '42501';
  end if;

  v_tu  := coalesce(p_tu, date_trunc('month', v_hom_nay)::date);
  v_den := coalesce(p_den, v_hom_nay);
  if v_den < v_tu then
    raise exception 'Khoang thoi gian nguoc: % den %', v_tu, v_den using errcode = '22007';
  end if;

  -- Đổi mốc ngày VN sang timestamptz MỘT LẦN, để so sánh dùng được index thay
  -- vì bọc hàm quanh created_at của từng dòng.
  v_tu_ts  := (v_tu::timestamp)        at time zone 'Asia/Ho_Chi_Minh';
  v_den_ts := ((v_den + 1)::timestamp) at time zone 'Asia/Ho_Chi_Minh';

  return query
  with tk as (
    select k.status, k.rating,
           (k.sla_resolve_due is not null) as co_sla,
           extract(epoch from (k.responded_at - k.created_at)) / 3600.0 as gio_phan_hoi,
           extract(epoch from (k.resolved_at  - k.created_at)) / 3600.0 as gio_xu_ly,
           case
             when k.status = 'rejected' or k.sla_resolve_due is null then null
             when k.resolved_at is not null then k.resolved_at <= k.sla_resolve_due
             when k.sla_resolve_due < now() then false
             else null                       -- còn hạn, chưa ngã ngũ
           end as dung_han
      from tickets k
     where k.project_id = p_project
       and k.created_at >= v_tu_ts and k.created_at < v_den_ts
  ),
  -- Ảnh chụp: mọi ticket còn mở của dự án, bất kể tạo từ bao giờ. Ticket mở từ
  -- tháng trước vẫn đang làm phiền người ta trong tháng này.
  mo as (
    select count(*)::int as dang_mo,
           count(*) filter (where k.sla_resolve_due < now())::int as qua_han
      from tickets k
     where k.project_id = p_project
       and k.status in ('new','assigned','in_progress')
  ),
  no as (
    select coalesce(sum(i.total_amount - i.paid_amount), 0)::bigint as tong,
           coalesce(sum(i.total_amount - i.paid_amount)
                    filter (where i.due_date < v_hom_nay), 0)::bigint as qua_han,
           count(distinct i.unit_id)::int as so_can
      from invoices i
     where i.project_id = p_project
       and i.status in ('issued','partial')
       and i.total_amount > i.paid_amount
  ),
  -- phai_thu/da_thu bám theo KỲ HÓA ĐƠN: "tháng 8 thu được bao nhiêu phần của
  -- tháng 8". Hóa đơn nháp chưa phát hành thì chưa ai nợ ai.
  hd as (
    select coalesce(sum(i.total_amount), 0)::bigint as phai_thu,
           coalesce(sum(i.paid_amount),  0)::bigint as da_thu
      from invoices i
     where i.project_id = p_project
       and i.status <> 'draft'
       and i.period >= date_trunc('month', v_tu)::date
       and i.period <= v_den
  ),
  -- tien_ve bám theo NGÀY TIỀN VÀO, cố ý khác hd.da_thu: tiền nhận trong tháng
  -- 8 có thể đang trả cho hóa đơn tháng 6. Gộp hai số này lại là cách quen
  -- thuộc để một dashboard nói dối mà vẫn cộng đúng.
  pm as (
    select coalesce(sum(p.amount), 0)::bigint as tien_ve
      from payments p
      join units u     on u.id = p.unit_id
      join buildings b on b.id = u.building_id
     where b.project_id = p_project
       and p.paid_at >= v_tu_ts and p.paid_at < v_den_ts
  ),
  -- Gom số ticket thành CTE riêng thay vì group by ở câu ngoài: aggregate
  -- không GROUP BY luôn trả về đúng một dòng kể cả khi tk rỗng. Nối thẳng tk
  -- vào thì tháng không có ticket nào sẽ ra BẢNG TRỐNG — công nợ, tiền thu
  -- biến mất theo, và BQT tưởng hệ thống hỏng.
  tk_agg as (
    select
      count(*)::int as tong,
      count(*) filter (where tk.status = 'rejected')::int as tu_choi,
      count(*) filter (where tk.status <> 'rejected' and not tk.co_sla)::int as khong_co_sla,
      count(*) filter (where tk.dung_han is not null)::int as co_ket_luan,
      count(*) filter (where tk.dung_han)::int as dung_sla,
      count(*) filter (where tk.status <> 'rejected' and tk.co_sla
                         and tk.dung_han is null)::int as chua_ket_luan,
      round(100.0 * count(*) filter (where tk.dung_han)
                  / nullif(count(*) filter (where tk.dung_han is not null), 0), 1) as ty_le,
      -- Trung vị làm số chính chứ không phải trung bình: một ticket bị bỏ quên
      -- qua Tết kéo trung bình đi đâu không biết, còn trung vị vẫn tả đúng cái
      -- đa số cư dân gặp. Trung bình vẫn trả ra để đối chiếu — hai số lệch
      -- nhau nhiều chính là dấu hiệu có ticket đang bị treo.
      round(percentile_cont(0.5) within group (order by tk.gio_phan_hoi)::numeric, 1) as ph_tv,
      round(percentile_cont(0.5) within group (order by tk.gio_xu_ly)::numeric, 1)   as xl_tv,
      round(avg(tk.gio_xu_ly)::numeric, 1)                                           as xl_tb,
      round(percentile_cont(0.9) within group (order by tk.gio_xu_ly)::numeric, 1)   as xl_p90,
      round(avg(tk.rating)::numeric, 2) as diem,
      count(tk.rating)::int as so_danh_gia,
      -- Mẫu số là ticket đã xong: chỉ ticket xong mới có gì để chấm. 4.9 điểm
      -- từ 3 lượt trên 200 ticket không phải 4.9 điểm.
      round(100.0 * count(tk.rating)
                  / nullif(count(*) filter (where tk.status in ('resolved','closed')), 0), 1)
        as ty_le_danh_gia
    from tk
  )
  select
    v_tu, v_den,
    a.tong, a.tu_choi, a.khong_co_sla, a.co_ket_luan, a.dung_sla, a.chua_ket_luan, a.ty_le,
    a.ph_tv, a.xl_tv, a.xl_tb, a.xl_p90,
    a.diem, a.so_danh_gia, a.ty_le_danh_gia,
    mo.dang_mo, mo.qua_han,
    no.tong, no.qua_han, no.so_can,
    hd.phai_thu, hd.da_thu, pm.tien_ve
  from tk_agg a, mo, no, hd, pm;
end $fn$;

-- Chuỗi theo tháng để vẽ biểu đồ. Tách khỏi bql_dashboard vì một bên là "hôm
-- nay thế nào", một bên là "đang tốt lên hay xấu đi" — gộp vào một hàm thì
-- mỗi lần đổi khoảng ngày lại phải tính lại cả chuỗi.
--
-- generate_series dựng đủ tháng kể cả tháng trắng: biểu đồ thiếu cột đọc ra
-- "không có dữ liệu", trong khi sự thật là "tháng đó không ai báo hỏng". Hai
-- chuyện khác hẳn nhau.
create or replace function bql_dashboard_thang(p_project uuid, p_so_thang int default 6)
returns table (
  thang              date,
  ticket_moi         int,
  ticket_co_ket_luan int,
  ticket_dung_sla    int,
  ty_le_dung_sla     numeric,
  gio_xu_ly_trung_vi numeric,
  phai_thu           bigint,
  da_thu             bigint,
  tien_ve            bigint
)
language plpgsql stable security definer set search_path = public as $fn$
declare
  v_n       int  := least(greatest(coalesce(p_so_thang, 6), 1), 36);
  v_dau     date;
  v_cuoi    date;
  v_dau_ts  timestamptz;
begin
  if not is_staff(p_project) then
    raise exception 'Chi BQL cua du an nay moi xem duoc dashboard' using errcode = '42501';
  end if;

  v_cuoi := date_trunc('month', (now() at time zone 'Asia/Ho_Chi_Minh'))::date;
  v_dau  := (v_cuoi - make_interval(months => v_n - 1))::date;
  v_dau_ts := (v_dau::timestamp) at time zone 'Asia/Ho_Chi_Minh';

  return query
  with thang_list as (
    select generate_series(v_dau, v_cuoi, interval '1 month')::date as m
  ),
  tk as (
    select date_trunc('month', k.created_at at time zone 'Asia/Ho_Chi_Minh')::date as m,
           extract(epoch from (k.resolved_at - k.created_at)) / 3600.0 as gio_xu_ly,
           case
             when k.status = 'rejected' or k.sla_resolve_due is null then null
             when k.resolved_at is not null then k.resolved_at <= k.sla_resolve_due
             when k.sla_resolve_due < now() then false
             else null
           end as dung_han
      from tickets k
     where k.project_id = p_project and k.created_at >= v_dau_ts
  ),
  hd as (
    select i.period as m,
           sum(i.total_amount)::bigint as phai_thu,
           sum(i.paid_amount)::bigint  as da_thu
      from invoices i
     where i.project_id = p_project and i.status <> 'draft' and i.period >= v_dau
     group by i.period
  ),
  pm as (
    select date_trunc('month', p.paid_at at time zone 'Asia/Ho_Chi_Minh')::date as m,
           sum(p.amount)::bigint as tien_ve
      from payments p
      join units u     on u.id = p.unit_id
      join buildings b on b.id = u.building_id
     where b.project_id = p_project and p.paid_at >= v_dau_ts
     group by 1
  )
  select tl.m,
         coalesce(t.so_ticket, 0),
         coalesce(t.ket_luan, 0),
         coalesce(t.dung_sla, 0),
         round(100.0 * t.dung_sla / nullif(t.ket_luan, 0), 1),
         t.gio_tv,
         coalesce(hd.phai_thu, 0)::bigint,
         coalesce(hd.da_thu, 0)::bigint,
         coalesce(pm.tien_ve, 0)::bigint
    from thang_list tl
    left join (
      select tk.m,
             count(*)::int as so_ticket,
             count(*) filter (where tk.dung_han is not null)::int as ket_luan,
             count(*) filter (where tk.dung_han)::int as dung_sla,
             round(percentile_cont(0.5) within group (order by tk.gio_xu_ly)::numeric, 1) as gio_tv
        from tk group by tk.m
    ) t  on t.m  = tl.m
    left join hd on hd.m = tl.m
    left join pm on pm.m = tl.m
   order by tl.m;
end $fn$;

-- N24 — đánh dấu thông báo đã đọc.
-- Vì sao là RPC chứ không phải cấp update thẳng lên bảng: `authenticated` là
-- một role dùng chung, mà quyền theo CỘT thì không phân biệt được ai. Cấp
-- update cả dòng nghĩa là người ta sửa được luôn title/body thông báo của
-- chính mình — tưởng vô hại, cho tới lúc BQL chụp màn hình đối chất "tôi có
-- nhắc anh rồi" và cư dân chìa ra bản đã sửa. Hàm này chỉ đụng đúng read_at.
--
-- p_ids để null = đánh dấu tất cả. Khóa cứng vào auth.uid() nên truyền id của
-- người khác cũng không ăn thua.
create or replace function mark_notifications_read(p_ids bigint[] default null)
returns int language plpgsql security definer set search_path = public as $fn$
declare v_count int;
begin
  if auth.uid() is null then
    raise exception 'Chua dang nhap' using errcode = '42501';
  end if;
  update notifications
     set read_at = now()
   where user_id = auth.uid()
     and read_at is null
     and (p_ids is null or id = any(p_ids));
  get diagnostics v_count = row_count;
  return v_count;
end $fn$;

-- ══════════════ N19–N20 — ĐỐI SOÁT TIỀN VỀ ══════════════════════════════
--
-- Ngân hàng bóp nội dung chuyển khoản đủ kiểu: mất dấu chấm, mất khoảng trắng,
-- chèn "CT DEN:" phía trước, cắt đuôi. Nên mọi phép so đều làm trên bản đã bỏ
-- hết ký tự không phải chữ-số, ở CẢ HAI phía.
create or replace function chuan_hoa_ck(p_text text)
returns text language sql immutable set search_path = public as $fn$
  select regexp_replace(upper(coalesce(p_text, '')), '[^A-Z0-9]', '', 'g');
$fn$;

-- Tìm căn từ nội dung chuyển khoản, để TỰ ĐỘNG gạch nợ.
--
-- BẮT BUỘC có tiền tố VB và 6 chữ số kỳ ngay sau mã căn — đúng chuỗi mà
-- lib/vietqr.ts in ra QR. Dò mã căn trần trong nội dung thì một mã tham chiếu
-- ngân hàng ngẫu nhiên cũng khớp được, và tiền chạy sang nhà hàng xóm.
-- Không khớp chặt thì THÀ ĐỂ NGƯỜI THẬT QUYẾT: kế hoạch đã nói trước là luôn
-- có người ghi sai nội dung, nên màn đối soát thủ công là bắt buộc, không phải
-- phương án dự phòng.
create or replace function tach_ma_can(p_project uuid, p_content text)
returns uuid language sql stable security definer set search_path = public as $fn$
  select u.id
    from units u
    join buildings b on b.id = u.building_id
   where b.project_id = p_project
     and chuan_hoa_ck(p_content) ~ ('VB' || chuan_hoa_ck(u.code) || '[0-9]{6}')
   -- Mã dài khớp trước: 'P1-10.1' không được cướp giao dịch của 'P1-10.12'.
   order by length(chuan_hoa_ck(u.code)) desc
   limit 1;
$fn$;

-- Dò LỎNG, chỉ để GỢI Ý cho người thật. Không có tiền tố VB, không cần kỳ.
-- Tuyệt đối không dùng để tự gạch — dò lỏng mà tự gạch là tiền chạy nhầm căn.
create or replace function goi_y_can(p_project uuid, p_content text)
returns table (unit_id uuid, unit_code text)
language sql stable security definer set search_path = public as $fn$
  select u.id, u.code
    from units u
    join buildings b on b.id = u.building_id
   where b.project_id = p_project
     and length(chuan_hoa_ck(u.code)) >= 4   -- mã quá ngắn thì khớp bừa
     and chuan_hoa_ck(p_content) like '%' || chuan_hoa_ck(u.code) || '%'
   order by length(chuan_hoa_ck(u.code)) desc
   limit 3;
$fn$;

-- Gạch một giao dịch vào công nợ của một căn. Dùng chung cho cả đường tự động
-- lẫn đường BQL bấm tay — hai đường phải cho ra cùng một kết quả, tách hai bản
-- cài đặt là sớm muộn chúng lệch nhau.
create or replace function gach_no(p_txn uuid, p_unit uuid, p_cach text)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  t       bank_transactions;
  v_con   bigint;
  v_hd    record;
  v_tra   bigint;
  v_so_hd int := 0;
begin
  -- for update: hai webhook cùng căn bắn song song thì đứa sau xếp hàng đợi,
  -- không cùng đọc một paid_amount cũ rồi cùng cộng vào.
  select * into t from bank_transactions where id = p_txn for update;
  if not found then
    raise exception 'Khong tim thay giao dich %', p_txn using errcode = '02000';
  end if;
  if t.trang_thai = 'da_khop' then
    raise exception 'Giao dich nay da gach roi' using errcode = '23505';
  end if;

  v_con := t.amount;

  -- Gạch hóa đơn CŨ NHẤT trước. Đây là thông lệ công nợ, và nó làm tuổi nợ
  -- giảm đúng chỗ: trả vào hóa đơn mới nhất thì nợ cũ nằm đó mãi dù người ta
  -- đã nộp đủ tiền, rồi báo cáo công nợ báo động nhầm.
  for v_hd in
    select id, total_amount - paid_amount as thieu
      from invoices
     where unit_id = p_unit
       and status in ('issued','partial')
       and total_amount > paid_amount
     order by due_date, period
     for update
  loop
    exit when v_con <= 0;
    -- least(): không cho một hóa đơn thu quá số tiền của nó. Phần thừa chảy
    -- sang hóa đơn kế tiếp trong vòng lặp.
    v_tra := least(v_con, v_hd.thieu);

    insert into payments (invoice_id, unit_id, amount, bank_ref, bank_txn_id,
                          raw_payload, paid_at, matched_by)
      values (v_hd.id, p_unit, v_tra, t.bank_ref, t.id, t.raw_payload, t.paid_at,
              case when p_cach = 'thu_cong' then 'manual' else 'auto' end);

    update invoices
       set paid_amount = paid_amount + v_tra,
           status = (case when paid_amount + v_tra >= total_amount then 'paid'
                          else 'partial' end)::invoice_status
     where id = v_hd.id;

    v_con   := v_con - v_tra;
    v_so_hd := v_so_hd + 1;
  end loop;

  -- Tiền dư KHÔNG sinh dòng payments treo lơ lửng: payments.invoice_id trỏ vào
  -- đâu? Nó là tiền trả trước, ghi lại ở đây để BQL nhìn thấy và quyết định,
  -- chứ hệ thống không tự nuốt.
  update bank_transactions
     set trang_thai = 'da_khop', unit_id = p_unit, cach_khop = p_cach,
         con_du = v_con
   where id = p_txn;

  return jsonb_build_object(
    'txn_id', p_txn, 'trang_thai', 'da_khop', 'so_hoa_don', v_so_hd,
    'da_gach', t.amount - v_con, 'con_du', v_con);
end $fn$;

-- Cửa vào của webhook. CHỈ service_role gọi được (không cấp cho authenticated):
-- ai gọi được hàm này là tự ghi tiền vào hệ thống mà không cần chuyển khoản.
create or replace function ghi_nhan_tien_ve(
  p_project      uuid,
  p_provider     text,
  p_provider_ref text,
  p_amount       bigint,
  p_content      text,
  p_paid_at      timestamptz,
  p_bank_ref     text  default null,
  p_account      text  default null,
  p_raw          jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path = public as $fn$
declare v_txn uuid; v_unit uuid; v_cu jsonb;
begin
  insert into bank_transactions (project_id, provider, provider_ref, bank_ref,
                                 account_number, amount, content, paid_at, raw_payload)
    values (p_project, p_provider, p_provider_ref, p_bank_ref, p_account,
            p_amount, coalesce(p_content, ''), p_paid_at,
            coalesce(p_raw, '{}'::jsonb))
    on conflict (provider, provider_ref) do nothing
    returning id into v_txn;

  -- ĐÃ NHẬN RỒI -> dừng, trả về trạng thái đang có. Nhà cung cấp nào cũng bắn
  -- lại khi chưa thấy 200, và gạch nợ hai lần là mất tiền thật của cư dân.
  if v_txn is null then
    select jsonb_build_object('trung', true, 'txn_id', id,
                              'trang_thai', trang_thai, 'con_du', con_du)
      into v_cu
      from bank_transactions
     where provider = p_provider and provider_ref = p_provider_ref;
    return v_cu;
  end if;

  v_unit := tach_ma_can(p_project, p_content);
  if v_unit is null then
    return jsonb_build_object('trung', false, 'txn_id', v_txn,
                              'trang_thai', 'chua_khop', 'so_hoa_don', 0,
                              'da_gach', 0, 'con_du', 0);
  end if;

  return jsonb_build_object('trung', false) || gach_no(v_txn, v_unit, 'ma_can');
end $fn$;

-- BQL gạch tay giao dịch mà máy không khớp được.
create or replace function bql_gan_giao_dich(p_txn uuid, p_unit uuid)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare v_du_an_gd uuid; v_du_an_can uuid;
begin
  select project_id into v_du_an_gd from bank_transactions where id = p_txn;
  if v_du_an_gd is null then
    raise exception 'Khong co giao dich nay' using errcode = '02000';
  end if;
  if not is_staff(v_du_an_gd) then
    raise exception 'Chi BQL cua du an nay moi doi soat duoc' using errcode = '42501';
  end if;

  -- Căn phải thuộc CHÍNH dự án của giao dịch. Thiếu chốt này là BQL khu A gạch
  -- được tiền của khu A vào căn của khu B.
  select b.project_id into v_du_an_can
    from units u join buildings b on b.id = u.building_id
   where u.id = p_unit;
  if v_du_an_can is null or v_du_an_can <> v_du_an_gd then
    raise exception 'Can ho khong thuoc du an cua giao dich' using errcode = '42501';
  end if;

  return gach_no(p_txn, p_unit, 'thu_cong');
end $fn$;

-- Đánh dấu giao dịch không phải tiền cư dân (hoàn tiền, nhà thầu, chuyển nhầm).
-- Bắt buộc có ghi chú: một giao dịch biến mất khỏi danh sách mà không ai biết
-- vì sao thì lần đối soát cuối năm không dựng lại được.
create or replace function bql_bo_qua_giao_dich(p_txn uuid, p_ghi_chu text)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_du_an uuid; v_trang_thai text;
begin
  select project_id, trang_thai into v_du_an, v_trang_thai
    from bank_transactions where id = p_txn;
  if v_du_an is null then
    raise exception 'Khong co giao dich nay' using errcode = '02000';
  end if;
  if not is_staff(v_du_an) then
    raise exception 'Chi BQL cua du an nay moi doi soat duoc' using errcode = '42501';
  end if;
  if v_trang_thai = 'da_khop' then
    raise exception 'Giao dich da gach vao hoa don, khong bo qua duoc' using errcode = '23505';
  end if;
  if coalesce(btrim(p_ghi_chu), '') = '' then
    raise exception 'Phai ghi ly do bo qua' using errcode = '22023';
  end if;

  update bank_transactions
     set trang_thai = 'bo_qua', ghi_chu = btrim(p_ghi_chu)
   where id = p_txn;
end $fn$;

-- Danh sách cho màn đối soát. Kèm gợi ý căn để BQL không phải tự dò mã trong
-- một chuỗi ngân hàng dài ngoằng.
create or replace function bql_doi_soat(p_project uuid, p_trang_thai text default 'chua_khop')
returns table (
  id         uuid,
  provider   text,
  bank_ref   text,
  amount     bigint,
  content    text,
  paid_at    timestamptz,
  trang_thai text,
  cach_khop  text,
  con_du     bigint,
  unit_code  text,
  ghi_chu    text,
  goi_y      text[]
) language plpgsql stable security definer set search_path = public as $fn$
begin
  if not is_staff(p_project) then
    raise exception 'Chi BQL cua du an nay moi doi soat duoc' using errcode = '42501';
  end if;

  return query
    select t.id, t.provider, t.bank_ref, t.amount, t.content, t.paid_at,
           t.trang_thai, t.cach_khop, t.con_du, u.code, t.ghi_chu,
           -- Gợi ý chỉ tính cho giao dịch chưa khớp: đã gạch rồi thì gợi ý là
           -- nhiễu, mà tính nó cho cả bảng là quét units cho từng dòng.
           case when t.trang_thai = 'chua_khop'
                then array(select g.unit_code from goi_y_can(p_project, t.content) g)
           end
      from bank_transactions t
      left join units u on u.id = t.unit_id
     where t.project_id = p_project
       and case p_trang_thai
             when 'con_du'  then t.trang_thai = 'da_khop' and t.con_du > 0
             when 'tat_ca'  then true
             else t.trang_thai = p_trang_thai
           end
     order by t.paid_at desc, t.received_at desc;
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
