-- VBuilding — Core schema (PostgreSQL 15+)
-- Chạy: psql -f schema.sql
-- Trên Postgres thuần thì chạy railway/00_compat.sql trước: nó dựng auth.uid()
-- và ba role mà các policy bên dưới đứng lên.
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
-- profiles.id = auth.users.id
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

-- AI TRONG CĂN ĐƯỢC NHÌN TIỀN. Family member KHÔNG thấy công nợ trừ khi chủ hộ
-- bật can_view_finance.
--
-- Một hàm chứ không phải chép tay ở mỗi bảng tiền: hóa đơn, dòng hóa đơn và
-- phiếu thu đều hiện CÙNG một con số. Hai bản chép tay của cùng một luật là hai
-- bản sẽ lệch, và lệch ở đây nghĩa là đóng cửa trước rồi để ngỏ cửa sau — người
-- nhà không xem được hóa đơn vẫn đọc được phiếu thu của chính hóa đơn đó.
--
-- SECURITY DEFINER: policy chạy dưới quyền người đang truy vấn, mà cư dân không
-- có quyền đọc unit_memberships của người khác trong căn.
create or replace function xem_duoc_tien_cua_can(p_unit uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (select 1 from unit_memberships m
                  where m.unit_id = p_unit and m.user_id = auth.uid()
                    and m.status = 'active'
                    and (m.valid_to is null or m.valid_to >= current_date)
                    and (m.role in ('owner','authorized','tenant') or m.can_view_finance));
$fn$;

create policy invoice_read on invoices for select
  using (is_staff(project_id) or xem_duoc_tien_cua_can(unit_id));

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
  select i.id, f.id, f.name, q.so_luong, f.unit_price,
         round(f.unit_price * q.so_luong)::bigint
    from invoices i
    join units u on u.id = i.unit_id
    join fee_types f on f.project_id = i.project_id
    left join meter_readings r
           on r.unit_id = u.id and r.fee_type_id = f.id and r.period = i.period
    -- Số lượng tính MỘT lần rồi dùng cho cả cột quantity lẫn cột amount. Trước
    -- đây cùng một biểu thức CASE viết hai lần, và hai bản sao của một công
    -- thức TIỀN là chỗ chờ sẵn để sửa một bên rồi quên bên kia — hóa đơn ghi
    -- 14 m³ mà tính tiền 12 m³ thì không có test nào của bảng này bắt được.
    cross join lateral (
      select case f.calc_method
               when 'per_m2'  then coalesce(u.area_m2, 0)
               when 'metered' then coalesce(r.curr_index - r.prev_index, 0)
               -- Chỉ đếm xe ĐÃ DUYỆT. Thu tiền của một chiếc đang xếp hàng chờ
               -- là thu tiền một chỗ đỗ chưa hề có.
               when 'per_vehicle' then (
                 select count(*) from unit_vehicles v
                  where v.unit_id = u.id and v.trang_thai = 'da_duyet'
                    and (f.loai_xe is null or v.loai = f.loai_xe))
               else 1
             end as so_luong
    ) q
   where i.project_id = p_project and i.period = p_period and i.status = 'draft'
     -- không sinh dòng 0đ cho căn chưa có chỉ số công tơ
     and (f.calc_method <> 'metered' or r.id is not null)
     -- ...và không sinh dòng 0đ phí gửi xe cho căn không đăng ký chiếc nào
     and (f.calc_method <> 'per_vehicle' or q.so_luong > 0);

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
  v_phieu uuid;
  v_so_phieu text;
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

  -- Phiếu thu lập NGAY TẠI ĐÂY, trong cùng transaction (§15). Để app gọi thêm
  -- một lượt sau khi gạch xong thì có hai đường: lượt đó hỏng, hoặc webhook gọi
  -- gach_no mà không gọi tiếp — và cư dân chuyển khoản xong không có chứng từ,
  -- đúng cái vấn đề cần giải. Cùng transaction còn giữ dãy số kín: gạch hỏng
  -- thì số phiếu cuốn theo.
  v_phieu := lap_phieu_thu(p_txn);
  select so_phieu into v_so_phieu from phieu_thu where id = v_phieu;

  return jsonb_build_object(
    'txn_id', p_txn, 'trang_thai', 'da_khop', 'so_hoa_don', v_so_hd,
    'da_gach', t.amount - v_con, 'con_du', v_con,
    'phieu_thu', v_phieu, 'so_phieu', v_so_phieu);
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

-- ══════════════ N29 — MỞ KHÓA CHỦ HỘ ĐẦU TIÊN ═══════════════════════════
--
-- Vòng luẩn quẩn của ngày đầu: duyệt thành viên cần is_unit_manager, mà
-- is_unit_manager cần đã có một chủ hộ 'active' — thứ chỉ sinh ra được bằng
-- một lần duyệt. Căn hộ vừa import thì KHÔNG AI duyệt được ai. Dán poster QR
-- lên sảnh là cả tòa đăng ký rồi kẹt ở 'pending' hết.
--
-- Lối ra hẹp nhất có thể, cố ý KHÔNG cho BQL quyền duyệt chung:
--   - chỉ duyệt được vai CHỦ HỘ (người thuê / thành viên vẫn do chủ hộ duyệt),
--   - và chỉ khi căn CHƯA có chủ hộ hoạt động nào.
-- Duyệt xong là cửa này đóng lại với chính căn đó, quyền trả về cho chủ hộ.
-- Mở rộng hơn thì BQL tự thêm mình vào căn bất kỳ và đọc được dữ liệu của nó,
-- đúng thứ mà cả tầng RLS dựng ra để chặn.
--
-- BQL có hợp đồng mua bán / biên bản bàn giao trong tay nên đối chiếu được
-- danh tính — đó là lý do việc này giao cho họ chứ không tự động duyệt.
create or replace function bql_duyet_chu_ho_dau_tien(p_membership uuid)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare m unit_memberships; v_du_an uuid; v_da_co int;
begin
  select * into m from unit_memberships where id = p_membership for update;
  if not found then
    raise exception 'Khong co yeu cau nay' using errcode = '02000';
  end if;

  v_du_an := unit_project(m.unit_id);
  if not is_staff(v_du_an) then
    raise exception 'Chi BQL cua du an nay moi duyet duoc' using errcode = '42501';
  end if;

  if m.status <> 'pending' then
    raise exception 'Yeu cau nay khong con cho duyet' using errcode = '22023';
  end if;

  if m.role <> 'owner' then
    raise exception 'BQL chi duyet duoc CHU HO dau tien. Nguoi thue va thanh vien gia dinh do chinh chu ho duyet'
      using errcode = '42501';
  end if;

  -- Chốt hẹp: căn đã có người quản lý thì việc duyệt thuộc về người đó.
  select count(*) into v_da_co
    from unit_memberships
   where unit_id = m.unit_id
     and status = 'active'
     and role in ('owner','authorized')
     and (valid_to is null or valid_to >= current_date);
  if v_da_co > 0 then
    raise exception 'Can nay da co chu ho, viec duyet thuoc ve chu ho' using errcode = '42501';
  end if;

  update unit_memberships
     set status = 'active', approved_by = auth.uid(), approved_at = now()
   where id = p_membership;

  return jsonb_build_object('unit_id', m.unit_id, 'user_id', m.user_id);
end $fn$;

-- Danh sách chờ. Definer vì BQL cố ý KHÔNG đọc được unit_memberships và
-- profiles của người lạ — nhưng để đối chiếu với hợp đồng thì phải thấy tên
-- và số điện thoại. Khóa cứng vào p_project, và chỉ trả về đúng những yêu cầu
-- mà BQL thật sự có quyền duyệt.
create or replace function bql_cho_duyet_chu_ho(p_project uuid)
returns table (
  membership_id uuid,
  unit_id       uuid,
  unit_code     text,
  building_code text,
  ho_ten        text,
  dien_thoai    text,
  email         text,
  xin_luc       timestamptz
) language plpgsql stable security definer set search_path = public as $fn$
begin
  if not is_staff(p_project) then
    raise exception 'Chi BQL cua du an nay moi xem duoc' using errcode = '42501';
  end if;

  return query
    select m.id, u.id, u.code, b.code, p.full_name, p.phone, p.email, m.created_at
      from unit_memberships m
      join units u     on u.id = m.unit_id
      join buildings b on b.id = u.building_id
      join profiles p  on p.id = m.user_id
     where b.project_id = p_project
       and m.status = 'pending'
       and m.role = 'owner'
       -- Cùng điều kiện với hàm duyệt. Hiện ra một yêu cầu mà bấm vào lại báo
       -- lỗi là cách nhanh nhất để người trực mất niềm tin vào màn hình.
       and not exists (
         select 1 from unit_memberships x
          where x.unit_id = m.unit_id and x.status = 'active'
            and x.role in ('owner','authorized')
            and (x.valid_to is null or x.valid_to >= current_date))
     order by b.code, u.code, m.created_at;
end $fn$;

-- Một truy vấn cho cả màn tiền kiểm go-live. Gộp lại thay vì mười câu đếm rời
-- vì đây là màn người ta mở đúng vài lần, và mười vòng gọi PostgREST cho một
-- màn hình tĩnh là lãng phí không đổi lại được gì.
--
-- Definer: BQL cố ý không đọc được unit_memberships, mà "bao nhiêu căn đã có
-- chủ hộ" lại chính là con số quyết định có mở cho cư dân hay chưa.
create or replace function bql_san_sang_go_live(p_project uuid)
returns table (
  so_toa               int,
  so_can                int,
  so_can_co_chu         int,
  so_cho_duyet          int,
  so_bieu_phi           int,
  so_sla                int,
  so_nhan_su            int,
  so_noi_quy            int,
  so_hoa_don_ky_nay     int,
  so_hoa_don_da_phat    int
) language plpgsql stable security definer set search_path = public as $fn$
declare v_ky date := date_trunc('month', (now() at time zone 'Asia/Ho_Chi_Minh'))::date;
begin
  if not is_staff(p_project) then
    raise exception 'Chi BQL cua du an nay moi xem duoc' using errcode = '42501';
  end if;

  return query
  select
    (select count(*)::int from buildings where project_id = p_project),
    (select count(*)::int from units u join buildings b on b.id = u.building_id
      where b.project_id = p_project),
    -- "Đã có chủ hộ" = có người quản lý ĐANG hiệu lực. Đếm theo membership sẽ
    -- ra số lớn hơn số căn khi một căn có nhiều thành viên — mà câu hỏi ở đây
    -- là bao nhiêu CĂN đã có người đứng tên.
    (select count(distinct u.id)::int
       from units u
       join buildings b on b.id = u.building_id
       join unit_memberships m on m.unit_id = u.id
      where b.project_id = p_project
        and m.status = 'active' and m.role in ('owner','authorized')
        and (m.valid_to is null or m.valid_to >= current_date)),
    (select count(*)::int from bql_cho_duyet_chu_ho(p_project)),
    (select count(*)::int from fee_types    where project_id = p_project),
    (select count(*)::int from sla_policies where project_id = p_project),
    (select count(*)::int from staff_assignments where project_id = p_project and is_active),
    (select count(*)::int from documents    where project_id = p_project),
    (select count(*)::int from invoices where project_id = p_project and period = v_ky),
    (select count(*)::int from invoices where project_id = p_project and period = v_ky
       and status <> 'draft');
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

-- ─────────────────────── Quản lý người dùng (BQL) ────────────────────────────
-- Vì sao cần: cư dân không tự đăng ký được — email/số điện thoại phải do BQL
-- ghi nhận trước. Trước đây việc đó chỉ làm được bằng tay trong dashboard
-- Supabase, nghĩa là mỗi lần thêm một hộ là một lần mở console quản trị ra.
-- Và nó phụ thuộc vào việc gửi được thư mời, mà hạn thư mặc định là 2/giờ cho
-- CẢ dự án.

-- Quản lý người dùng chỉ dành cho TRƯỞNG BQL, không phải mọi nhân sự.
-- is_staff() gộp cả bảo vệ và kỹ thuật — những người cần xem yêu cầu sửa chữa
-- chứ không cần tạo được tài khoản cho người khác. Ai tạo được tài khoản thì
-- tạo được tài khoản có quyền BQL, tức là tự nhân bản quyền của mình.
create or replace function is_bql_manager(p_project uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (select 1 from staff_assignments
                  where user_id = auth.uid() and project_id = p_project
                    and role = 'bql_manager' and is_active);
$fn$;

-- Danh sách người dùng của một dự án: nhân sự BQL và cư dân trong cùng một bảng.
-- CỐ Ý không đọc auth.users. Trạng thái đăng nhập (đã vào lần nào chưa, có mật
-- khẩu chưa) lấy qua Admin API ở tầng ứng dụng: mở một hàm definer đọc
-- auth.users là mở một cửa mà sai một dòng grant là lộ dữ liệu xác thực của
-- toàn hệ thống, để đổi lấy một tiện lợi không đáng.
create or replace function bql_danh_sach_nguoi_dung(p_project uuid)
returns table (
  user_id     uuid,
  ho_ten      text,
  email       text,
  phone       text,
  vai_tro_bql text[],
  can_ho      text[],
  tao_luc     timestamptz
) language plpgsql stable security definer set search_path = public as $fn$
begin
  if not is_staff(p_project) then
    raise exception 'Chi BQL cua du an nay moi xem duoc' using errcode = '42501';
  end if;

  return query
  with nhan_su as (
    select sa.user_id, array_agg(sa.role::text order by sa.role::text) as roles
      from staff_assignments sa
     where sa.project_id = p_project and sa.is_active
     group by sa.user_id
  ),
  cu_dan as (
    select m.user_id,
           array_agg(u.code || ' (' || m.role::text || ')' order by u.code) as cans
      from unit_memberships m
      join units u     on u.id = m.unit_id
      join buildings b on b.id = u.building_id
     where b.project_id = p_project
       and m.status = 'active'
       and (m.valid_to is null or m.valid_to >= current_date)
     group by m.user_id
  )
  select p.id, p.full_name, p.email, p.phone,
         ns.roles, cd.cans, p.created_at
    from profiles p
    left join nhan_su ns on ns.user_id = p.id
    left join cu_dan  cd on cd.user_id = p.id
   -- Chỉ người CÓ liên hệ với dự án này. Thiếu mệnh đề này thì màn quản lý
   -- người dùng của khu A liệt kê luôn cư dân khu B.
   where ns.user_id is not null or cd.user_id is not null
   order by (ns.user_id is null), p.full_name;
end $fn$;

-- Gán / thu hồi vai trò nhân sự. Đi qua RPC chứ không phải ghi thẳng bảng:
-- chốt is_bql_manager nằm ở đây, một chỗ, thay vì rải trong từng server action.
create or replace function bql_gan_nhan_su(p_user uuid, p_project uuid, p_role staff_role)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  if not is_bql_manager(p_project) then
    raise exception 'Chi truong ban quan ly moi gan duoc nhan su' using errcode = '42501';
  end if;
  insert into staff_assignments (user_id, project_id, role, is_active)
  values (p_user, p_project, p_role, true)
  on conflict (user_id, project_id, role) do update set is_active = true;
end $fn$;

create or replace function bql_ngung_nhan_su(p_user uuid, p_project uuid, p_role staff_role)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_con int;
begin
  if not is_bql_manager(p_project) then
    raise exception 'Chi truong ban quan ly moi thu hoi duoc nhan su' using errcode = '42501';
  end if;

  -- Không cho gỡ trưởng BQL cuối cùng. Gỡ được là khu không còn ai tạo được
  -- tài khoản, không còn ai gán lại được quyền — và cửa duy nhất mở lại là
  -- SQL editor của Supabase. Rất dễ xảy ra: người sắp nghỉ tự gỡ mình ra.
  if p_role = 'bql_manager' then
    select count(*) into v_con from staff_assignments
     where project_id = p_project and role = 'bql_manager' and is_active
       and user_id <> p_user;
    if v_con = 0 then
      raise exception 'Day la truong ban quan ly duy nhat cua du an' using errcode = '42501';
    end if;
  end if;

  update staff_assignments set is_active = false
   where user_id = p_user and project_id = p_project and role = p_role;
end $fn$;

-- Gán chủ hộ đầu tiên cho một căn, ngay lúc tạo tài khoản.
--
-- GIỮ NGUYÊN bất biến của bql_duyet_chu_ho_dau_tien: BQL chỉ mở được cánh cửa
-- ĐẦU TIÊN của mỗi căn, và chỉ với vai trò chủ hộ. Người thuê, thành viên gia
-- đình, người được ủy quyền vẫn do chính chủ hộ duyệt. Nếu để BQL gán ai vào
-- căn nào cũng được thì toàn bộ lý do tồn tại của hàng chờ duyệt biến mất, và
-- BQL tự thêm mình vào căn của cư dân được.
create or replace function bql_gan_chu_ho_dau_tien(p_user uuid, p_unit uuid)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_project uuid; v_da_co int;
begin
  v_project := unit_project(p_unit);
  if v_project is null then
    raise exception 'Khong tim thay can ho' using errcode = '22023';
  end if;
  if not is_bql_manager(v_project) then
    raise exception 'Chi truong ban quan ly moi gan duoc chu ho' using errcode = '42501';
  end if;

  select count(*) into v_da_co from unit_memberships
   where unit_id = p_unit and status = 'active'
     and role in ('owner','authorized')
     and (valid_to is null or valid_to >= current_date);
  if v_da_co > 0 then
    raise exception 'Can nay da co chu ho, nguoi sau do chu ho tu duyet'
      using errcode = '42501';
  end if;

  insert into unit_memberships (unit_id, user_id, role, status, approved_by, approved_at)
  values (p_unit, p_user, 'owner', 'active', auth.uid(), now());
end $fn$;

-- ═══════════════════════ 10. NHẬT KÝ KIỂM TOÁN ═══════════════════════
-- Câu hỏi mà sổ này trả lời: "ai đổi đơn giá phí quản lý hôm 12?", "ai gỡ
-- quyền của chị Lan?", "hóa đơn này ai sửa thành đã trả?". Không có sổ thì câu
-- trả lời là suy đoán, và lúc bàn giao giữa hai đơn vị quản lý thì suy đoán
-- không đủ.
--
-- Viết bằng TRIGGER chứ không viết ở app, cùng lý do như ticket_events: nhiều
-- nơi ghi vào các bảng này (màn BQL, webhook ngân hàng, cron, SQL editor) — để
-- app tự log thì sớm muộn có nhánh quên log, mà một sổ kiểm toán thủng lỗ chỗ
-- còn tệ hơn không có sổ, vì nó tạo cảm giác an toàn giả.

create table audit_log (
  id          bigserial primary key,
  at          timestamptz not null default now(),
  -- Ai. null = không có phiên đăng nhập (cron, webhook, service_role, SQL editor).
  actor_id    uuid,
  -- Vai trò hiệu lực lúc ghi. Không có cột này thì actor_id null là mơ hồ:
  -- không phân biệt được cron chạy với người vào SQL editor gõ tay.
  actor_role  text not null,
  bang        text not null,
  ban_ghi     text not null,             -- khóa chính, để text vì có bảng dùng bigint
  thao_tac    text not null check (thao_tac in ('INSERT','UPDATE','DELETE')),
  -- Phi chuẩn hóa có chủ ý: RLS phải lọc theo dự án, mà mỗi bảng lại có một
  -- đường đi tới project khác nhau. Bắt policy tự lần đường là vừa mong manh
  -- vừa chậm; trigger tính một lần lúc ghi thì rẻ hơn nhiều.
  project_id  uuid references projects(id) on delete set null,
  -- CHỈ những cột ĐỔI, không phải cả dòng. Chụp cả dòng hai lần thì sổ không
  -- đọc được — người xem phải tự dò mắt xem cái gì khác. Và nó phình rất nhanh.
  truoc       jsonb not null default '{}'::jsonb,
  sau         jsonb not null default '{}'::jsonb
);
create index on audit_log (project_id, at desc);
create index on audit_log (bang, ban_ghi, at desc);
create index on audit_log (actor_id, at desc);

-- Cột không bao giờ chép nội dung sang sổ. raw_payload giữ nguyên gói tin ngân
-- hàng (có tên người chuyển), id_number là số CCCD, qr_payload dựng lại được
-- mã thanh toán. Sổ kiểm toán vẫn ghi LÀ CÓ ĐỔI, chỉ không nhân bản giá trị —
-- chép sang đây là tăng gấp đôi số nơi những thứ đó có thể rò ra.
create or replace function audit_cot_an() returns text[]
language sql immutable set search_path = public as $fn$
  select array['raw_payload','id_number','qr_payload']::text[];
$fn$;

/*
 * Trigger chung. Tham số duy nhất cho biết tìm project_id bằng đường nào:
 *   'project_id'  — bảng có sẵn cột
 *   'unit_id'     — đi qua unit_project()
 *   'building_id' — đi qua building_project()
 *   'invoice_id'  — đi qua invoices
 *
 * SECURITY DEFINER: `authenticated` KHÔNG được cấp quyền ghi audit_log (sổ mà
 * người bị ghi sổ sửa được thì vô nghĩa), nên trigger phải chạy dưới quyền
 * owner mới ghi được.
 *
 * Không bắt lỗi: nếu ghi sổ hỏng thì lệnh ghi dữ liệu cũng hỏng theo. Với dữ
 * liệu tiền và quyền, một thay đổi không ghi được vào sổ là một thay đổi không
 * nên xảy ra.
 */
create or replace function ghi_nhat_ky() returns trigger
language plpgsql security definer set search_path = public as $fn$
declare
  v_cu    jsonb := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  v_moi   jsonb := case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end;
  v_hang  jsonb := case when tg_op = 'DELETE' then v_cu else v_moi end;
  v_an    text[] := audit_cot_an();
  v_duan  uuid;
  v_truoc jsonb := '{}'::jsonb;
  v_sau   jsonb := '{}'::jsonb;
  k       text;
begin
  v_duan := case tg_argv[0]
    when 'project_id'  then (v_hang->>'project_id')::uuid
    when 'unit_id'     then unit_project((v_hang->>'unit_id')::uuid)
    when 'building_id' then building_project((v_hang->>'building_id')::uuid)
    when 'invoice_id'  then (select i.project_id from invoices i
                              where i.id = (v_hang->>'invoice_id')::uuid)
  end;

  for k in select jsonb_object_keys(v_cu || v_moi) loop
    if v_cu->k is distinct from v_moi->k then
      if k = any (v_an) then
        v_truoc := v_truoc || jsonb_build_object(k, to_jsonb('(đã ẩn)'::text));
        v_sau   := v_sau   || jsonb_build_object(k, to_jsonb('(đã ẩn)'::text));
      else
        v_truoc := v_truoc || jsonb_build_object(k, v_cu->k);
        v_sau   := v_sau   || jsonb_build_object(k, v_moi->k);
      end if;
    end if;
  end loop;

  -- UPDATE không đổi cột nào thì không ghi. Cron chạy 5 phút một lần mà lần nào
  -- cũng đẻ một dòng "đã sửa, không có gì khác" là sổ ngập rác trong một tuần.
  if tg_op = 'UPDATE' and v_truoc = '{}'::jsonb then
    return new;
  end if;

  insert into audit_log (actor_id, actor_role, bang, ban_ghi, thao_tac, project_id, truoc, sau)
  values (
    auth.uid(),
    -- current_user bên trong hàm definer trả về CHỦ hàm, không phải người gọi.
    -- current_setting('role') mới là vai trò đang SET ROLE (PostgREST đặt thành
    -- 'authenticated' hoặc 'service_role'); 'none' nghĩa là chưa SET ROLE.
    coalesce(nullif(current_setting('role', true), 'none'), session_user),
    tg_table_name, coalesce(v_hang->>'id', '?'), tg_op, v_duan, v_truoc, v_sau
  );

  return case when tg_op = 'DELETE' then old else new end;
end $fn$;

-- Chín bảng đáng ghi sổ: tiền, quyền, và những con số đẻ ra tiền. KHÔNG ghi
-- notifications (rác), ticket_events (đã là sổ), meter_readings (đổi mỗi kỳ,
-- và số cuối đã nằm trong hóa đơn).
create trigger trg_audit_units after insert or update or delete on units
  for each row execute function ghi_nhat_ky('building_id');
create trigger trg_audit_memberships after insert or update or delete on unit_memberships
  for each row execute function ghi_nhat_ky('unit_id');
create trigger trg_audit_staff after insert or update or delete on staff_assignments
  for each row execute function ghi_nhat_ky('project_id');
create trigger trg_audit_fee_types after insert or update or delete on fee_types
  for each row execute function ghi_nhat_ky('project_id');
create trigger trg_audit_sla after insert or update or delete on sla_policies
  for each row execute function ghi_nhat_ky('project_id');
create trigger trg_audit_invoices after insert or update or delete on invoices
  for each row execute function ghi_nhat_ky('project_id');
create trigger trg_audit_invoice_lines after insert or update or delete on invoice_lines
  for each row execute function ghi_nhat_ky('invoice_id');
create trigger trg_audit_payments after insert or update or delete on payments
  for each row execute function ghi_nhat_ky('unit_id');
create trigger trg_audit_bank_txn after insert or update or delete on bank_transactions
  for each row execute function ghi_nhat_ky('project_id');

-- RLS: chỉ BQL của đúng dự án đọc được. Không có policy ghi nào cả — trigger
-- chạy security definer nên nó vẫn ghi được, còn mọi role khác thì không.
--
-- KHÔNG force row level security, cùng lý do như bank_transactions: force áp
-- cả lên chủ bảng, mà trigger definer chính là chạy dưới quyền chủ bảng — bật
-- lên là trigger tự chặn chính nó và MỌI lệnh ghi vào chín bảng kia đều hỏng.
alter table audit_log enable row level security;
create policy audit_staff_read on audit_log for select using (is_staff(project_id));

-- ═════════════════════ 11. BẢO TRÌ ĐỊNH KỲ ═════════════════════
-- Thang máy, PCCC, bơm nước có hạn kiểm định theo luật. Quên hạn là bị phạt,
-- và tệ hơn là mất an toàn. Đây là nhóm rủi ro có hậu quả nặng nhất trong
-- vận hành, mà chi phí xây lại thấp vì hạ tầng cron đã có sẵn.
--
-- KHÔNG tự tạo ticket cho kỹ thuật, dù kế hoạch ban đầu định thế. tickets.unit_id
-- là NOT NULL và tickets.reporter_id cũng vậy — mà "kiểm định thang máy tháp P1"
-- không thuộc căn nào và không do ai báo. Nới hai ràng buộc đó là đụng vào RLS
-- của luồng cư dân báo sự cố, thứ vừa mới thông lại. Nên lần bảo trì TỰ NÓ là
-- việc: có người nhận, có trạng thái, hiện trên màn kỹ thuật. Sạch hơn là bẻ
-- cong bảng ticket cho vừa.

create table maintenance_plans (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  building_id   uuid references buildings(id) on delete cascade,   -- null = cả khu
  ten           text not null,
  hang_muc      text not null,            -- 'thang_may','pccc','bom_nuoc','dien','thang_bo','khac'
  chu_ky_ngay   int  not null check (chu_ky_ngay between 1 and 3650),
  han_ke_tiep   date not null,
  nhac_truoc_ngay int not null default 7 check (nhac_truoc_ngay between 0 and 180),
  -- Hạng mục bắt buộc theo luật thì quá hạn là bị phạt, không phải chỉ bất tiện.
  -- Màn tô đỏ riêng nhóm này, và không cho tắt nhắc.
  bat_buoc_phap_ly boolean not null default false,
  nha_thau      text,
  ghi_chu       text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);
create index on maintenance_plans (project_id, is_active, han_ke_tiep);

-- Mỗi hạn là một dòng. unique (plan_id, han) là chốt chống trùng: cron chạy
-- lại (retry, hoặc hai bản sao cùng chạy) không đẻ ra hai lần bảo trì cho cùng
-- một hạn. Cùng kiểu chốt như unique (unit_id, period) bên hóa đơn.
create table maintenance_runs (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references maintenance_plans(id) on delete cascade,
  han         date not null,
  mo_luc      timestamptz not null default now(),
  nguoi_lam   uuid references profiles(id),
  lam_luc     timestamptz,               -- null = chưa làm xong
  ket_qua     text,
  unique (plan_id, han)
);
create index on maintenance_runs (plan_id, han desc);
create index on maintenance_runs (lam_luc) where lam_luc is null;

alter table maintenance_plans enable row level security;
alter table maintenance_plans force row level security;
create policy mp_staff on maintenance_plans for all
  using (is_staff(project_id)) with check (is_staff(project_id));

alter table maintenance_runs enable row level security;
alter table maintenance_runs force row level security;
create policy mr_staff on maintenance_runs for all
  using (is_staff((select p.project_id from maintenance_plans p where p.id = plan_id)))
  with check (is_staff((select p.project_id from maintenance_plans p where p.id = plan_id)));

/*
 * Mở lần bảo trì cho những kế hoạch đã tới cửa sổ nhắc. Chạy 1 lần/ngày.
 *
 * Chỉ mở, không đóng: đóng là việc của người làm. Trả về số lần vừa mở để
 * job_run_details có con số đọc được thay vì chỉ "thành công".
 */
create or replace function mo_ky_bao_tri() returns int
language plpgsql set search_path = public as $fn$
declare v_n int;
begin
  with can_mo as (
    select p.id, p.han_ke_tiep
      from maintenance_plans p
     where p.is_active
       and p.han_ke_tiep - p.nhac_truoc_ngay <= current_date
  )
  insert into maintenance_runs (plan_id, han)
  select id, han_ke_tiep from can_mo
  -- Chốt chống trùng nằm ở unique (plan_id, han); on conflict để cron chạy lại
  -- được mà không nổ. Bỏ dòng này thì một lần retry là cả job hỏng.
  on conflict (plan_id, han) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $fn$;

/*
 * Đóng một lần bảo trì và dời hạn kế tiếp.
 *
 * Hạn mới = NGÀY LÀM THẬT + chu kỳ, không phải hạn cũ + chu kỳ.
 *
 * Với hạng mục kiểm định, giấy chứng nhận có hiệu lực tính từ ngày kiểm định
 * chứ không từ ngày lẽ ra phải kiểm. Dời theo hạn cũ thì làm muộn 10 ngày là
 * lần sau nhắc sớm hơn hạn giấy 10 ngày — nhắc thừa thì chỉ phiền, nhưng cùng
 * công thức đó ở chiều ngược lại (giấy hết hạn trước khi nhắc) là bị phạt.
 * Đổi lấy: đội làm muộn kinh niên sẽ thấy lịch trôi dần. Phiền, nhưng nhìn
 * thấy được — khác với hết hạn giấy tờ mà không ai biết.
 */
create or replace function xong_bao_tri(p_run uuid, p_ket_qua text default null)
returns date language plpgsql security definer set search_path = public as $fn$
declare v_plan maintenance_plans; v_run maintenance_runs; v_han date;
begin
  select * into v_run from maintenance_runs where id = p_run;
  if not found then
    raise exception 'Khong co lan bao tri nay' using errcode = 'P0002';
  end if;
  select * into v_plan from maintenance_plans where id = v_run.plan_id;
  if not is_staff(v_plan.project_id) then
    raise exception 'Chi BQL cua du an nay moi dong duoc lan bao tri'
      using errcode = '42501';
  end if;
  if v_run.lam_luc is not null then
    raise exception 'Lan bao tri nay da dong roi' using errcode = '22023';
  end if;

  update maintenance_runs
     set lam_luc = now(), nguoi_lam = auth.uid(), ket_qua = p_ket_qua
   where id = p_run;

  v_han := current_date + v_plan.chu_ky_ngay;
  update maintenance_plans set han_ke_tiep = v_han where id = v_plan.id;
  return v_han;
end $fn$;

-- ═══════════════ 12. BÌNH LUẬN VÀ THĂM DÒ TRÊN BẢNG TIN ═══════════════
-- Thông báo đang là một chiều. Ý kiến cư dân vẫn nằm ở nhóm Zalo mà BQL không
-- đọc hết được — và không lưu lại được để đối chiếu về sau.

create table announcement_comments (
  id              bigserial primary key,
  announcement_id uuid not null references announcements(id) on delete cascade,
  author_id       uuid not null references profiles(id) on delete cascade,
  -- Căn của người viết, chốt tại lúc viết. Người đó có thể chuyển đi sau này,
  -- nhưng bình luận vẫn phải đọc được là "căn nào nói câu này".
  unit_id         uuid references units(id) on delete set null,
  body            text not null check (length(btrim(body)) between 1 and 2000),
  -- BQL ẨN chứ không XÓA. Xóa được là BQL xóa sạch lời chê mà không để lại dấu;
  -- ẩn thì dòng vẫn còn, nhật ký kiểm toán vẫn ghi, và màn vẫn hiện "đã ẩn".
  an_luc          timestamptz,
  an_boi          uuid references profiles(id),
  an_ly_do        text,
  created_at      timestamptz not null default now()
);
create index on announcement_comments (announcement_id, created_at);

create table announcement_polls (
  -- unique: một thông báo một cuộc thăm dò. Hai cuộc trên cùng một thông báo là
  -- người đọc không biết đang bỏ phiếu cho cái nào.
  announcement_id uuid primary key references announcements(id) on delete cascade,
  cau_hoi         text not null,
  lua_chon        text[] not null check (array_length(lua_chon, 1) between 2 and 8),
  -- Kín = giấu kết quả cho tới khi đóng. Hiện số đang chạy làm người bỏ sau
  -- nghiêng theo số đông; nhưng giấu thì mất tính minh bạch. Để BQL chọn.
  kin             boolean not null default false,
  dong_luc        timestamptz,
  created_at      timestamptz not null default now()
);

/*
 * MỘT CĂN MỘT PHIẾU, không phải một người một phiếu.
 *
 * Đây là quyết định mô hình quan trọng nhất ở đây. Chung cư ra quyết định theo
 * hộ: một căn có bốn người lớn đã đăng ký không được lấn phiếu căn chỉ có một.
 * Khóa chính (poll_id, unit_id) làm điều đó thành bất biến của database chứ
 * không phải một phép kiểm ở tầng app mà nhánh nào đó quên gọi.
 *
 * Đây là thăm dò KHÔNG chính thức trên bảng tin. Biểu quyết hội nghị nhà chung
 * cư là chuyện khác — có trọng số theo diện tích, có biên bản — và là một tính
 * năng riêng.
 */
create table announcement_votes (
  poll_id   uuid not null references announcement_polls(announcement_id) on delete cascade,
  unit_id   uuid not null references units(id) on delete cascade,
  user_id   uuid not null references profiles(id) on delete cascade,
  chon      int  not null check (chon >= 0),
  bo_luc    timestamptz not null default now(),
  primary key (poll_id, unit_id)
);
create index on announcement_votes (poll_id, chon);

alter table announcement_comments enable row level security;
alter table announcement_polls    enable row level security;
alter table announcement_votes    enable row level security;

/*
 * Ai thấy thông báo thì thấy bình luận của thông báo đó — dùng lại đúng policy
 * announcement_read qua một truy vấn con, không chép lại luật hiển thị. Chép
 * lại là hai bộ luật, và sớm muộn sửa một bên quên bên kia.
 *
 * Bình luận đã ẩn: chỉ BQL còn thấy nội dung. Cư dân thấy dòng trống chỗ (màn
 * hiện "đã ẩn") chứ không thấy bình luận biến mất không dấu vết.
 */
create policy ac_read on announcement_comments for select using (
  announcement_id in (select id from announcements)
);
create policy ac_viet on announcement_comments for insert with check (
  author_id = auth.uid()
  and announcement_id in (select id from announcements)
  and (unit_id is null or unit_id in (select current_unit_ids()))
);
-- Sửa/ẩn: BQL của dự án chứa thông báo đó. Cư dân KHÔNG sửa được lời mình đã
-- nói — sửa sau khi người khác đã trả lời là bẻ cong cả mạch hội thoại.
create policy ac_bql on announcement_comments for update using (
  is_staff((select a.project_id from announcements a where a.id = announcement_id))
) with check (
  is_staff((select a.project_id from announcements a where a.id = announcement_id))
);

create policy ap_read on announcement_polls for select using (
  announcement_id in (select id from announcements)
);
create policy ap_bql on announcement_polls for all using (
  is_staff((select a.project_id from announcements a where a.id = announcement_id))
) with check (
  is_staff((select a.project_id from announcements a where a.id = announcement_id))
);

-- Phiếu: đọc được thì đếm được. Cuộc thăm dò KÍN che kết quả ở tầng hàm
-- ket_qua_tham_do() chứ không ở tầng RLS — che bằng RLS thì chính người bỏ
-- phiếu cũng không đọc lại được phiếu của mình.
create policy av_read on announcement_votes for select using (
  poll_id in (select announcement_id from announcement_polls)
);
create policy av_bo on announcement_votes for all using (
  unit_id in (select current_unit_ids())
) with check (
  unit_id in (select current_unit_ids())
);

/*
 * Bỏ phiếu, hoặc đổi phiếu đã bỏ.
 *
 * Đổi được cho tới khi đóng là CỐ Ý: người ta đọc bình luận rồi mới nghĩ lại,
 * mà đó chính là lý do đặt thăm dò cạnh phần thảo luận. Khóa phiếu đầu tiên
 * thì phần thảo luận chỉ còn để trang trí.
 */
create or replace function bo_phieu(p_poll uuid, p_unit uuid, p_chon int)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_poll announcement_polls;
begin
  select * into v_poll from announcement_polls where announcement_id = p_poll;
  if not found then
    raise exception 'Khong co cuoc tham do nay' using errcode = 'P0002';
  end if;
  if v_poll.dong_luc is not null and v_poll.dong_luc <= now() then
    raise exception 'Cuoc tham do da dong' using errcode = '22023';
  end if;
  if p_chon < 0 or p_chon >= array_length(v_poll.lua_chon, 1) then
    raise exception 'Lua chon khong hop le' using errcode = '22023';
  end if;
  if p_unit not in (select current_unit_ids()) then
    raise exception 'Ban khong thuoc can ho nay' using errcode = '42501';
  end if;

  insert into announcement_votes (poll_id, unit_id, user_id, chon)
  values (p_poll, p_unit, auth.uid(), p_chon)
  on conflict (poll_id, unit_id)
  do update set chon = excluded.chon, user_id = excluded.user_id, bo_luc = now();
end $fn$;

/*
 * Kết quả: số phiếu theo từng lựa chọn.
 *
 * Cuộc KÍN chưa đóng thì chỉ BQL thấy số. Cư dân nhận về mảng rỗng — màn hiện
 * "kết quả công bố khi đóng" chứ không hiện 0 phiếu, vì 0 phiếu là một con số
 * sai chứ không phải một lời từ chối.
 */
create or replace function ket_qua_tham_do(p_poll uuid)
returns table (chon int, so_phieu bigint)
language plpgsql stable security definer set search_path = public as $fn$
declare v_poll announcement_polls; v_project uuid;
begin
  select * into v_poll from announcement_polls where announcement_id = p_poll;
  if not found then return; end if;
  select a.project_id into v_project from announcements a where a.id = p_poll;

  if v_poll.kin and (v_poll.dong_luc is null or v_poll.dong_luc > now())
     and not is_staff(v_project) then
    return;
  end if;

  return query
    select v.chon, count(*)::bigint from announcement_votes v
     where v.poll_id = p_poll group by v.chon;
end $fn$;

-- ══════════════════════ 13. THẺ CƯ DÂN ĐIỆN TỬ ══════════════════════
-- Thẻ từ mất là phải làm lại, mất phí và mất thời gian. Nặng hơn: người thuê
-- trả nhà rồi vẫn còn thẻ vào được, vì thu hồi thẻ nhựa là một việc phải NHỚ
-- LÀM, mà không ai nhớ.
--
-- Thẻ điện tử đảo ngược điều đó: mã QR trên máy cư dân chỉ nói "người này, căn
-- này, còn hiệu lực 60 giây". Việc "có được vào không" hỏi lại đúng hàm dưới
-- đây MỖI LẦN QUÉT. Hợp đồng thuê hết hạn thì valid_to đã qua, thẻ chết ngay
-- lần quét kế tiếp — không phải chờ ai nhớ ra.
--
-- KHÔNG có bảng ghi lượt quét, cố ý. Sổ ra vào là tính năng riêng (QR khách
-- thăm), và một bảng lần-lượt-ai-đi-qua-cửa-nào là dữ liệu theo dõi đường đi
-- của cư dân: nó cần chính sách lưu trữ, cần RLS riêng, cần nói với cư dân là
-- có. Dựng nó như một tác dụng phụ của tính năng thẻ là dựng lén.

create or replace function kiem_the(p_uid uuid, p_unit uuid)
returns table (
  ho_ten text, anh text, can text, toa text,
  vai_tro unit_role, con_hieu_luc boolean, ly_do text
)
language plpgsql stable security definer set search_path = public as $fn$
declare
  v_du_an uuid;
  v_can   record;
  v_tv    record;
begin
  select u.id, u.code, b.name as toa, b.project_id
    into v_can
    from units u join buildings b on b.id = u.building_id
   where u.id = p_unit;
  if not found then
    raise exception 'khong co can ho nay' using errcode = 'P0002';
  end if;
  v_du_an := v_can.project_id;

  -- Chỉ nhân sự của ĐÚNG dự án đó mới tra được thẻ. Thiếu chốt này thì bất kỳ
  -- ai đăng nhập cũng dựng được một trang quét và tra ra họ tên cư dân của mọi
  -- khu chỉ bằng cách đoán id căn hộ.
  if not is_staff(v_du_an) then
    raise exception 'chi nhan su cua du an moi tra duoc the' using errcode = '42501';
  end if;

  -- Ưu tiên dòng ĐANG hiệu lực. Một người có thể có nhiều dòng cho cùng một
  -- căn: thuê một kỳ, nghỉ, rồi thuê lại. Lấy bừa dòng đầu tiên là có lúc đọc
  -- trúng hợp đồng cũ và từ chối một người đang ở thật.
  select m.role, m.status, m.valid_from, m.valid_to,
         (m.status = 'active'
          and m.valid_from <= current_date
          and (m.valid_to is null or m.valid_to >= current_date)) as con
    into v_tv
    from unit_memberships m
   where m.unit_id = p_unit and m.user_id = p_uid
   order by (m.status = 'active'
             and m.valid_from <= current_date
             and (m.valid_to is null or m.valid_to >= current_date)) desc,
            m.valid_from desc
   limit 1;

  return query
  select p.full_name, p.avatar_url, v_can.code, v_can.toa,
         v_tv.role,
         coalesce(v_tv.con, false),
         case
           when v_tv is null                     then 'khong_thuoc'
           when v_tv.con                         then 'ok'
           when v_tv.status = 'revoked'          then 'da_thu_hoi'
           when v_tv.status = 'pending'          then 'cho_duyet'
           when v_tv.valid_to < current_date     then 'het_han'
           when v_tv.valid_from > current_date   then 'chua_toi_han'
           else 'ngung'
         end
    from profiles p where p.id = p_uid;
end $fn$;

-- ══════════════════════ 14. CHỖ ĐỖ XE VÀ HÀNG CHỜ ══════════════════════
-- Hầm để xe luôn thiếu chỗ. Không có hạn mức theo căn thì hộ đăng ký trước
-- chiếm hết, và người đến sau không có cách nào biết mình đang đứng thứ mấy —
-- nên họ gọi điện hỏi BQL, mỗi tuần một lần.
--
-- Hai ràng buộc khác nhau, phải tách bạch:
--   • moi_can  — CÔNG BẰNG. Một hộ không được ôm năm chỗ ô tô.
--   • tong_cho — VẬT LÝ. Hầm có bấy nhiêu chỗ thì có bấy nhiêu.
-- Gộp làm một là lúc BQL muốn nới cho một hộ thì phải sửa luôn sức chứa hầm.
--
-- Và vì thế có HAI kiểu chờ, không phải một:
--   • hang_cho     — chờ hầm có chỗ. Xếp theo giờ đăng ký, gọi lần lượt.
--   • qua_han_muc  — vượt hạn mức của chính căn mình. Chờ BQL nới, không phải
--                    chờ hầm.
-- Nhét chung một hàng thì chiếc xe thứ hai của một hộ đã kín hạn mức sẽ đứng
-- đầu hàng vĩnh viễn: không bao giờ gọi lên được, mà cũng chặn luôn mọi người
-- phía sau. Con số "bạn đứng thứ 14" khi đó là một lời nói dối.

do $$ begin
  create type loai_xe as enum ('o_to', 'xe_may', 'xe_dap', 'khac');
exception when duplicate_object then null; end $$;

create table if not exists bai_xe (
  building_id uuid not null references buildings(id) on delete cascade,
  loai        loai_xe not null,
  tong_cho    int not null check (tong_cho >= 0),
  moi_can     int not null check (moi_can >= 0),
  ghi_chu     text,
  primary key (building_id, loai)
);

-- Cột thêm cho bảng xe đã có. `add column if not exists` chứ không dựng lại
-- bảng: khu đang chạy đã có dữ liệu xe thật trong đó.
alter table unit_vehicles add column if not exists loai loai_xe;
alter table unit_vehicles add column if not exists trang_thai text not null default 'da_duyet';
-- clock_timestamp() chứ KHÔNG phải now(): now() trả về giờ MỞ TRANSACTION, nên
-- hai lượt đăng ký trong cùng một transaction nhận đúng một mốc thời gian và
-- hàng chờ mất thứ tự — lúc đó ai đứng trước chỉ còn phụ thuộc vào uuid ngẫu
-- nhiên. Với một cái hàng mà cả tính năng dựng lên để giữ công bằng thì đó là
-- hỏng ở đúng chỗ quan trọng nhất.
alter table unit_vehicles add column if not exists dang_ky_luc timestamptz not null default clock_timestamp();
alter table unit_vehicles alter column dang_ky_luc set default clock_timestamp();
do $$ begin
  alter table unit_vehicles add constraint xe_trang_thai
    check (trang_thai in ('da_duyet', 'hang_cho', 'qua_han_muc'));
exception when duplicate_object then null; end $$;

-- Xếp hàng theo GIỜ ĐĂNG KÝ — đó là toàn bộ lời hứa công bằng của tính năng
-- này. Chỉ số để câu "tôi đứng thứ mấy" trả lời được mà không quét cả bảng.
create index if not exists xe_hang_cho on unit_vehicles (loai, dang_ky_luc)
  where trang_thai = 'hang_cho';

-- Chuyển dữ liệu cũ: `vehicle_type` là text tự do nên có đủ kiểu viết, mà đếm
-- hạn mức thì không đếm được trên text tự do. Từ nay `loai` là nguồn sự thật
-- duy nhất; cột cũ giữ lại vì nó chứa nguyên văn thứ người ta đã gõ, nhưng app
-- không ghi vào nó nữa.
update unit_vehicles set loai = case
    when vehicle_type is null then 'khac'
    when lower(vehicle_type) ~ 'ô ?tô|o ?to|oto|car|hơi|hoi' then 'o_to'
    when lower(vehicle_type) ~ 'máy|may|moto|motor|scooter' then 'xe_may'
    when lower(vehicle_type) ~ 'đạp|dap|bike|bicycle' then 'xe_dap'
    else 'khac' end::loai_xe
 where loai is null;

alter table bai_xe enable row level security;
-- Cư dân ĐỌC được hạn mức của tòa: không thấy con số thì "còn 3 chỗ" chỉ là
-- lời nói miệng, và hàng chờ mất hết sức thuyết phục.
create policy bai_xe_read on bai_xe for select
  using (building_project(building_id) is not null);
create policy bai_xe_staff on bai_xe for all
  using (is_staff(building_project(building_id)))
  with check (is_staff(building_project(building_id)));

-- ─────────────────────────── ĐĂNG KÝ MỘT CHIẾC XE ───────────────────────────
-- Trả ('da_duyet', 0) | ('hang_cho', <vị trí>) | ('qua_han_muc', 0).
--
-- SECURITY DEFINER vì nó phải ĐẾM xe của cả tòa để biết còn chỗ không, mà RLS
-- chỉ cho cư dân thấy xe của căn mình. Không có nó thì mọi hộ đều tưởng hầm
-- còn trống.
create or replace function dang_ky_xe(
  p_unit uuid, p_bien_so text, p_loai loai_xe, p_the text default null)
returns table (trang_thai text, vi_tri int)
language plpgsql volatile security definer set search_path = public as $fn$
declare v_toa uuid; v_ch record; v_cua_can int; v_ca_toa int; v_id uuid; v_tt text;
begin
  if not is_unit_manager(p_unit) then
    raise exception 'chi chu ho hoac nguoi duoc uy quyen moi dang ky xe' using errcode = '42501';
  end if;
  select u.building_id into v_toa from units u where u.id = p_unit;
  if v_toa is null then raise exception 'khong co can ho nay' using errcode = 'P0002'; end if;
  if coalesce(trim(p_bien_so), '') = '' then
    raise exception 'thieu bien so' using errcode = '23514';
  end if;

  select * into v_ch from bai_xe b where b.building_id = v_toa and b.loai = p_loai;

  if not found then
    -- BQL chưa đặt hạn mức cho loại xe này. GHI NHẬN chứ không từ chối: một hệ
    -- thống chặn hết vì thiếu một dòng cấu hình thì tệ hơn hẳn một hệ thống ghi
    -- lại rồi để BQL dọn sau. Màn bãi xe của BQL nói rõ tòa nào chưa đặt.
    v_tt := 'da_duyet';
  else
    select count(*) into v_cua_can from unit_vehicles v
     where v.unit_id = p_unit and v.loai = p_loai and v.trang_thai = 'da_duyet';
    select count(*) into v_ca_toa from unit_vehicles v join units u on u.id = v.unit_id
     where u.building_id = v_toa and v.loai = p_loai and v.trang_thai = 'da_duyet';
    v_tt := case
      when v_cua_can >= v_ch.moi_can  then 'qua_han_muc'
      when v_ca_toa  >= v_ch.tong_cho then 'hang_cho'
      else 'da_duyet' end;
  end if;

  insert into unit_vehicles (unit_id, plate, loai, card_no, trang_thai)
  values (p_unit, upper(trim(p_bien_so)), p_loai, nullif(trim(p_the), ''), v_tt)
  returning id into v_id;

  return query
  select v_tt, case when v_tt <> 'hang_cho' then 0 else (
    select count(*)::int from unit_vehicles v
     join units u on u.id = v.unit_id
     join unit_vehicles t on t.id = v_id
     where u.building_id = v_toa and v.loai = p_loai and v.trang_thai = 'hang_cho'
       and (v.dang_ky_luc, v.id) <= (t.dang_ky_luc, t.id)
  ) end;
end $fn$;

-- ──────────────────── GỌI NGƯỜI ĐẦU HÀNG CHỜ KHI CÓ CHỖ ─────────────────────
-- Nhận TÒA và LOẠI xe, không nhận id chiếc xe — cố ý. Nhận id thì BQL chọn được
-- ai lên trước, và cái hàng chờ vốn sinh ra để công bằng trở thành danh sách
-- xin-cho. Ai không cần nữa thì tự rút, người kế tiếp thành người đầu hàng.
create or replace function duyet_xe_tiep(p_building uuid, p_loai loai_xe)
returns table (bien_so text, can text)
language plpgsql volatile security definer set search_path = public as $fn$
declare v_du_an uuid; v_id uuid; v_unit uuid; v_ch record; v_ca_toa int; v_cua_can int;
begin
  v_du_an := building_project(p_building);
  if v_du_an is null then raise exception 'khong co toa nay' using errcode = 'P0002'; end if;
  if not is_staff(v_du_an) then
    raise exception 'chi ban quan ly moi duyet hang cho' using errcode = '42501';
  end if;

  select * into v_ch from bai_xe b where b.building_id = p_building and b.loai = p_loai;
  if not found then raise exception 'toa nay chua dat han muc cho loai xe do' using errcode = 'P0002'; end if;

  select count(*) into v_ca_toa from unit_vehicles v join units u on u.id = v.unit_id
   where u.building_id = p_building and v.loai = p_loai and v.trang_thai = 'da_duyet';
  if v_ca_toa >= v_ch.tong_cho then
    -- Duyệt khi chưa có chỗ là bán một chỗ không tồn tại, và người ta xuống hầm
    -- rồi mới biết.
    raise exception 'chua con cho trong' using errcode = '23514';
  end if;

  -- Đi từ đầu hàng xuống. Căn nào trong lúc chờ đã kín hạn mức (BQL siết
  -- moi_can, hoặc căn đó vừa được duyệt một chiếc khác) thì ĐẨY SANG
  -- qua_han_muc chứ không dừng cả hàng lại ở đó.
  for v_id, v_unit in
    select v.id, v.unit_id from unit_vehicles v join units u on u.id = v.unit_id
     where u.building_id = p_building and v.loai = p_loai and v.trang_thai = 'hang_cho'
     order by v.dang_ky_luc, v.id
  loop
    select count(*) into v_cua_can from unit_vehicles v
     where v.unit_id = v_unit and v.loai = p_loai and v.trang_thai = 'da_duyet';
    if v_cua_can >= v_ch.moi_can then
      update unit_vehicles set trang_thai = 'qua_han_muc' where id = v_id;
    else
      update unit_vehicles set trang_thai = 'da_duyet' where id = v_id;
      return query select v.plate, u.code from unit_vehicles v
        join units u on u.id = v.unit_id where v.id = v_id;
      return;
    end if;
  end loop;

  raise exception 'hang cho dang trong' using errcode = 'P0002';
end $fn$;

-- ───────────────────── ĐẶT HẠN MỨC, VÀ XÉT LẠI HÀNG CHỜ ─────────────────────
-- Nới moi_can mà không xét lại thì những chiếc đang `qua_han_muc` nằm đó mãi:
-- chúng không nằm trong hàng chờ nên duyet_xe_tiep() không bao giờ nhìn tới, và
-- chủ xe thì thấy trạng thái đứng yên sau khi BQL đã hứa nới. GIỮ NGUYÊN
-- dang_ky_luc khi chuyển sang hàng chờ — họ đã đợi từ hôm đó, không phải hôm nay.
create or replace function dat_han_muc_bai_xe(
  p_building uuid, p_loai loai_xe, p_tong_cho int, p_moi_can int, p_ghi_chu text default null)
returns int
language plpgsql volatile security definer set search_path = public as $fn$
declare v_du_an uuid; n int;
begin
  v_du_an := building_project(p_building);
  if v_du_an is null then raise exception 'khong co toa nay' using errcode = 'P0002'; end if;
  if not is_staff(v_du_an) then
    raise exception 'chi ban quan ly moi dat han muc' using errcode = '42501';
  end if;
  if p_tong_cho < 0 or p_moi_can < 0 then
    raise exception 'so cho khong the am' using errcode = '23514';
  end if;

  insert into bai_xe (building_id, loai, tong_cho, moi_can, ghi_chu)
  values (p_building, p_loai, p_tong_cho, p_moi_can, nullif(trim(p_ghi_chu), ''))
  on conflict (building_id, loai) do update
    set tong_cho = excluded.tong_cho, moi_can = excluded.moi_can, ghi_chu = excluded.ghi_chu;

  with dem as (
    select v.id, row_number() over (partition by v.unit_id order by v.dang_ky_luc, v.id)
           + (select count(*) from unit_vehicles w
               where w.unit_id = v.unit_id and w.loai = p_loai and w.trang_thai = 'da_duyet') as thu
      from unit_vehicles v join units u on u.id = v.unit_id
     where u.building_id = p_building and v.loai = p_loai and v.trang_thai = 'qua_han_muc'
  )
  update unit_vehicles x set trang_thai = 'hang_cho'
    from dem d where d.id = x.id and d.thu <= p_moi_can;
  get diagnostics n = row_count;
  return n;
end $fn$;

-- ─────────────────── TÌNH TRẠNG CHỖ ĐỖ CỦA MỘT CĂN (cư dân) ─────────────────
-- Một dòng cho mỗi loại xe mà tòa có đặt hạn mức, HOẶC căn đang có xe loại đó.
-- Không liệt kê cả bốn loại: dòng "xe đạp 0/0" ở một tòa không quản lý xe đạp
-- chỉ làm người đọc tưởng mình bị cấm để xe đạp.
--
-- SECURITY DEFINER vì nó đếm xe của CẢ TÒA để trả lời "còn mấy chỗ" và "tôi
-- đứng thứ mấy", mà RLS chỉ cho cư dân thấy xe của căn mình. Chốt quyền nằm
-- ngay đầu hàm.
create or replace function cho_do_cua_can(p_unit uuid)
returns table (
  loai loai_xe, da_dung int, moi_can int, co_han_muc boolean,
  tong_cho int, ca_toa_dang_dung int,
  toi_dang_cho int, vi_tri_dau int, hang_cho_ca_toa int, toi_qua_han_muc int
)
language plpgsql stable security definer set search_path = public as $fn$
declare v_toa uuid;
begin
  select u.building_id into v_toa from units u where u.id = p_unit;
  if v_toa is null then raise exception 'khong co can ho nay' using errcode = 'P0002'; end if;
  if not (p_unit in (select current_unit_ids()) or is_staff(building_project(v_toa))) then
    raise exception 'khong xem duoc cho do cua can khac' using errcode = '42501';
  end if;

  return query
  with co as (
    select b.loai from bai_xe b where b.building_id = v_toa
    union
    select v.loai from unit_vehicles v where v.unit_id = p_unit and v.loai is not null
  )
  select
    c.loai,
    (select count(*)::int from unit_vehicles v
      where v.unit_id = p_unit and v.loai = c.loai and v.trang_thai = 'da_duyet'),
    coalesce(b.moi_can, 0),
    (b.building_id is not null),
    coalesce(b.tong_cho, 0),
    (select count(*)::int from unit_vehicles v join units u on u.id = v.unit_id
      where u.building_id = v_toa and v.loai = c.loai and v.trang_thai = 'da_duyet'),
    (select count(*)::int from unit_vehicles v
      where v.unit_id = p_unit and v.loai = c.loai and v.trang_thai = 'hang_cho'),
    -- Vị trí của chiếc SỚM NHẤT căn này đang chờ. Căn không chờ gì thì min() ra
    -- null, phép so sánh thành null, kết quả 0 — đúng nghĩa "không đứng hàng nào".
    (select count(*)::int from unit_vehicles v join units u on u.id = v.unit_id
      where u.building_id = v_toa and v.loai = c.loai and v.trang_thai = 'hang_cho'
        and v.dang_ky_luc <= (select min(x.dang_ky_luc) from unit_vehicles x
                               where x.unit_id = p_unit and x.loai = c.loai
                                 and x.trang_thai = 'hang_cho')),
    (select count(*)::int from unit_vehicles v join units u on u.id = v.unit_id
      where u.building_id = v_toa and v.loai = c.loai and v.trang_thai = 'hang_cho'),
    (select count(*)::int from unit_vehicles v
      where v.unit_id = p_unit and v.loai = c.loai and v.trang_thai = 'qua_han_muc')
  from co c left join bai_xe b on b.building_id = v_toa and b.loai = c.loai
  order by c.loai;
end $fn$;

-- ───────────────────── TOÀN CẢNH BÃI XE CỦA DỰ ÁN (BQL) ─────────────────────
-- Liệt kê cả những loại xe ĐANG CÓ mà tòa chưa đặt hạn mức — đó chính là chỗ
-- BQL cần nhìn thấy: dang_ky_xe() cho qua khi chưa có cấu hình, nên một tòa
-- quên đặt hạn mức sẽ âm thầm nhận xe không giới hạn cho tới lúc hầm đầy thật.
create or replace function bai_xe_tong_quan(p_project uuid)
returns table (
  building_id uuid, toa text, loai loai_xe, co_han_muc boolean,
  tong_cho int, moi_can int, dang_dung int, hang_cho int, qua_han_muc int
)
language plpgsql stable security definer set search_path = public as $fn$
begin
  if not is_staff(p_project) then
    raise exception 'chi ban quan ly moi xem duoc bai xe' using errcode = '42501';
  end if;
  return query
  with co as (
    select b.building_id, b.loai from bai_xe b
     join buildings g on g.id = b.building_id where g.project_id = p_project
    union
    select u.building_id, v.loai from unit_vehicles v
     join units u on u.id = v.unit_id
     join buildings g on g.id = u.building_id
     where g.project_id = p_project and v.loai is not null
  )
  select c.building_id, g.name, c.loai,
         (b.building_id is not null), coalesce(b.tong_cho, 0), coalesce(b.moi_can, 0),
         (select count(*)::int from unit_vehicles v join units u on u.id = v.unit_id
           where u.building_id = c.building_id and v.loai = c.loai and v.trang_thai = 'da_duyet'),
         (select count(*)::int from unit_vehicles v join units u on u.id = v.unit_id
           where u.building_id = c.building_id and v.loai = c.loai and v.trang_thai = 'hang_cho'),
         (select count(*)::int from unit_vehicles v join units u on u.id = v.unit_id
           where u.building_id = c.building_id and v.loai = c.loai and v.trang_thai = 'qua_han_muc')
    from co c
    join buildings g on g.id = c.building_id
    left join bai_xe b on b.building_id = c.building_id and b.loai = c.loai
   order by g.code, c.loai;
end $fn$;

-- ──────────────────── PHÍ GỬI XE TÍNH THEO ĐẦU XE ĐÃ DUYỆT ──────────────────
-- calc_method mới: 'per_vehicle' (xử lý trong generate_invoices ở §6).
-- fee_types.loai_xe nói loại nào được đếm — để trống là đếm tất cả, thường
-- không phải điều người ta muốn, nên màn biểu phí bắt chọn.
alter table fee_types add column if not exists loai_xe loai_xe;

-- ═════════════════════ 15. PHIẾU THU ĐIỆN TỬ ═════════════════════
-- Cư dân chuyển khoản xong không có gì cầm tay, và kế toán không có số chứng
-- từ nào để tra khi đối chiếu. Hóa đơn nói "phải trả bao nhiêu"; phiếu thu nói
-- "đã nhận bao nhiêu, vào ngày nào, mang số mấy". Hai chứng từ khác nhau.
--
-- ĐIỀU KIỆN CỦA MỘT SỐ CHỨNG TỪ: liên tục, không đứt quãng trong kỳ. Kiểm toán
-- hỏi thẳng câu đó, và một lỗ trống trong dãy số là câu hỏi "phiếu PT-2609-0137
-- đâu rồi" mà không ai trả lời được.
--
-- Vì thế KHÔNG dùng sequence. `nextval()` cố ý nằm ngoài transaction để hai
-- lệnh insert song song khỏi chờ nhau — hệ quả trực tiếp là transaction nào
-- rollback vẫn tiêu mất số nó đã lấy, để lại đúng cái lỗ trống trên. Đổi lại
-- bằng một dòng đếm có khóa: phiếu thu mỗi tháng vài trăm cái, xếp hàng ở đây
-- không tốn gì, mà dãy số thì kín.
create table if not exists phieu_thu_dem (
  project_id uuid not null references projects(id) on delete cascade,
  ky         date not null,               -- ngày đầu tháng LẬP PHIẾU
  so_cuoi    int  not null default 0,
  primary key (project_id, ky)
);

-- ĐÁNH SỐ THEO NGÀY LẬP PHIẾU, KHÔNG THEO NGÀY TIỀN VỀ. Webhook về muộn là
-- chuyện thường: tiền ngày 31/08 mà giao dịch bắn tới ngày 02/09. Đánh theo
-- ngày tiền về thì phải chèn một số vào giữa dãy tháng 8 đã in xong và đã đưa
-- cho cư dân — tức là hoặc trùng số, hoặc phải đánh lại cả dãy. Ngày tiền về
-- vẫn ghi nguyên trong `bank_transactions.paid_at` và hiện trên phiếu.
create table if not exists phieu_thu (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  so_phieu    text not null,              -- PT-2609-0184
  ky          date not null,
  stt         int  not null,              -- thứ tự trong kỳ; có cột này mới dò được chỗ đứt
  unit_id     uuid not null references units(id),
  -- Chép tên tại thời điểm lập, không join lúc đọc. Chứng từ đã đưa cho người
  -- ta thì về sau đổi chủ hộ, đổi tên trong hồ sơ đều không được làm chữ trên
  -- phiếu tự đổi theo. Một tờ phiếu thu tự viết lại chính nó không phải chứng từ.
  nguoi_nop   text not null default '',
  ma_can      text not null default '',
  tong_thu    bigint not null check (tong_thu > 0),
  hinh_thuc   text not null default 'chuyen_khoan'
              check (hinh_thuc in ('chuyen_khoan','tien_mat')),
  bank_txn_id uuid references bank_transactions(id) on delete set null,
  nhan_luc    timestamptz not null,       -- ngày tiền thật sự về
  lap_luc     timestamptz not null default clock_timestamp(),
  lap_boi     uuid references profiles(id),
  -- HỦY chứ không XÓA, và số KHÔNG được dùng lại. Xóa một dòng là tạo ra đúng
  -- cái lỗ trống mà cả thiết kế trên kia dựng ra để tránh; cấp lại số đã hủy là
  -- hai tờ giấy khác nhau mang cùng một số.
  huy_luc     timestamptz,
  huy_boi     uuid references profiles(id),
  ly_do_huy   text,
  unique (project_id, so_phieu),
  unique (project_id, ky, stt),
  constraint huy_phai_co_ly_do check ((huy_luc is null) = (ly_do_huy is null))
);
create index if not exists phieu_thu_can_idx on phieu_thu (unit_id, nhan_luc desc);
create index if not exists phieu_thu_ky_idx  on phieu_thu (project_id, ky, stt);
create unique index if not exists phieu_thu_txn_idx
  on phieu_thu (bank_txn_id) where huy_luc is null and bank_txn_id is not null;

-- `loai`:
--   hoa_don   — một hóa đơn được gạch bằng chính lần thu này
--   chi_tiet  — dòng phí bên trong hóa đơn đó, KHÔNG cộng vào tổng
--   nop_truoc — tiền về nhiều hơn số nợ, phần chưa gạch vào đâu
create table if not exists phieu_thu_dong (
  id         uuid primary key default gen_random_uuid(),
  phieu_id   uuid not null references phieu_thu(id) on delete cascade,
  thu_tu     int  not null,
  loai       text not null check (loai in ('hoa_don','chi_tiet','nop_truoc')),
  dien_giai  text not null,
  so_tien    bigint not null check (so_tien >= 0),
  invoice_id uuid references invoices(id) on delete set null,
  payment_id uuid references payments(id) on delete set null,
  unique (phieu_id, thu_tu)
);

create or replace function tien_chu(p bigint)
returns text language sql immutable set search_path = public as $fn$
  select replace(to_char(p, 'FM999,999,999,999'), ',', '.') || 'đ';
$fn$;

-- ─────────────────────────── LẬP PHIẾU ───────────────────────────
-- Gọi trong CÙNG transaction với gach_no. Đó là cả điểm mấu chốt: lệnh gạch nợ
-- hỏng và rollback thì số phiếu vừa cấp cũng cuốn theo, dãy số vẫn kín.
create or replace function lap_phieu_thu(p_txn uuid)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  t       bank_transactions;
  v_ky    date;
  v_stt   int;
  v_so    text;
  v_phieu uuid;
  v_nguoi text;
  v_ma    text;
  v_tt    int    := 0;
  v_tong  bigint := 0;
  r       record;
  l       record;
begin
  select * into t from bank_transactions where id = p_txn;
  if not found then
    raise exception 'Khong tim thay giao dich %', p_txn using errcode = '02000';
  end if;
  if t.unit_id is null then
    raise exception 'Giao dich chua gach vao can nao thi chua lap duoc phieu thu'
      using errcode = '22023';
  end if;

  -- MỘT LẦN TIỀN VỀ MỘT PHIẾU. Webhook bắn lại, hay BQL bấm gạch thêm lần nữa,
  -- đều không được đẻ ra số chứng từ thứ hai cho cùng một khoản tiền.
  select id into v_phieu from phieu_thu
   where bank_txn_id = p_txn and huy_luc is null;
  if found then return v_phieu; end if;

  select u.code into v_ma from units u where u.id = t.unit_id;
  select p.full_name into v_nguoi
    from unit_memberships m join profiles p on p.id = m.user_id
   where m.unit_id = t.unit_id and m.status = 'active'
     and m.role in ('owner','authorized')
     and (m.valid_to is null or m.valid_to >= current_date)
   order by (m.role = 'owner') desc, m.valid_from
   limit 1;

  v_ky := date_trunc('month', current_date)::date;
  insert into phieu_thu_dem (project_id, ky, so_cuoi) values (t.project_id, v_ky, 1)
    on conflict (project_id, ky)
    do update set so_cuoi = phieu_thu_dem.so_cuoi + 1
    returning so_cuoi into v_stt;
  v_so := 'PT-' || to_char(v_ky, 'YYMM') || '-' || lpad(v_stt::text, 4, '0');

  insert into phieu_thu (project_id, so_phieu, ky, stt, unit_id, nguoi_nop, ma_can,
                         tong_thu, hinh_thuc, bank_txn_id, nhan_luc, lap_boi)
    values (t.project_id, v_so, v_ky, v_stt, t.unit_id,
            coalesce(v_nguoi, ''), coalesce(v_ma, ''),
            t.amount, 'chuyen_khoan', t.id, t.paid_at, auth.uid())
    returning id into v_phieu;

  for r in
    select p.id as payment_id, p.amount, i.id as invoice_id, i.period,
           i.total_amount, i.paid_amount
      from payments p join invoices i on i.id = p.invoice_id
     where p.bank_txn_id = p_txn
     order by i.due_date, i.period
  loop
    v_tt   := v_tt + 1;
    v_tong := v_tong + r.amount;
    insert into phieu_thu_dong (phieu_id, thu_tu, loai, dien_giai, so_tien,
                                invoice_id, payment_id)
      values (v_phieu, v_tt, 'hoa_don',
              'Hóa đơn kỳ ' || to_char(r.period, 'MM/YYYY')
              || case when r.amount >= r.total_amount then ''
                      when r.paid_amount >= r.total_amount
                        then ' — trả nốt phần còn thiếu'
                      else ' — trả một phần, còn thiếu '
                           || tien_chu(r.total_amount - r.paid_amount) end,
              r.amount, r.invoice_id, r.payment_id);

    -- Chi tiết từng khoản phí CHỈ khi chính lần thu này trả trọn hóa đơn. Trả
    -- một phần thì không có câu trả lời thật cho "tiền này vào phí nào": chia
    -- 900.000đ cho ba dòng phí là bịa ra một phép phân bổ mà kế toán không ký
    -- được. Khi đó phiếu nói đúng cái nó biết — trả một phần, còn thiếu bao
    -- nhiêu — và im lặng về phần nó không biết.
    if r.amount >= r.total_amount then
      for l in select description, amount from invoice_lines
                where invoice_id = r.invoice_id order by amount desc, description
      loop
        v_tt := v_tt + 1;
        insert into phieu_thu_dong (phieu_id, thu_tu, loai, dien_giai, so_tien, invoice_id)
          values (v_phieu, v_tt, 'chi_tiet', l.description, l.amount, r.invoice_id);
      end loop;
    end if;
  end loop;

  -- Tiền về nhiều hơn nợ. Phiếu vẫn ghi đủ số ngân hàng báo chứ không chỉ ghi
  -- phần gạch được: cư dân đối chiếu tờ phiếu với app ngân hàng của họ, hai con
  -- số lệch nhau là họ tưởng mình bị thu thiếu.
  if t.con_du > 0 then
    v_tt   := v_tt + 1;
    v_tong := v_tong + t.con_du;
    insert into phieu_thu_dong (phieu_id, thu_tu, loai, dien_giai, so_tien)
      values (v_phieu, v_tt, 'nop_truoc', 'Nộp trước, chưa gạch vào hóa đơn nào', t.con_du);
  end if;

  -- Phiếu không cân thì không được phép tồn tại. Đây là chốt tự kiểm: nếu vòng
  -- lặp trên sót một dòng payments, lỗi nổ ngay lúc lập chứ không nằm im tới
  -- lúc kế toán cộng tay ra số khác.
  if v_tong <> t.amount then
    raise exception 'Phieu thu % khong can: tong dong = %, tien ve = %',
      v_so, v_tong, t.amount using errcode = '23514';
  end if;

  return v_phieu;
end $fn$;

-- Hủy phiếu KHÔNG đụng vào tiền. Phiếu là chứng từ, tiền là tiền: ghi sai căn
-- thì hủy phiếu rồi gạch lại cho đúng căn, còn tiền vẫn đã về tài khoản. Gộp
-- hai việc vào một nút là một cú bấm nhầm xóa mất một khoản thu có thật.
create or replace function huy_phieu_thu(p_phieu uuid, p_ly_do text)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare v uuid; v_so text; v_pj uuid;
begin
  select id, so_phieu, project_id into v, v_so, v_pj
    from phieu_thu where id = p_phieu for update;
  if not found then
    raise exception 'Khong tim thay phieu thu %', p_phieu using errcode = '02000';
  end if;
  if not is_staff(v_pj) then
    raise exception 'Chi BQL huy duoc phieu thu' using errcode = '42501';
  end if;
  if coalesce(btrim(p_ly_do), '') = '' then
    raise exception 'Phai ghi ly do huy' using errcode = '22023';
  end if;

  update phieu_thu
     set huy_luc = clock_timestamp(), huy_boi = auth.uid(), ly_do_huy = btrim(p_ly_do)
   where id = p_phieu and huy_luc is null;
  if not found then
    raise exception 'Phieu % da huy roi', v_so using errcode = '23505';
  end if;
  return jsonb_build_object('id', p_phieu, 'so_phieu', v_so, 'da_huy', true);
end $fn$;

-- Câu hỏi đầu tiên của kiểm toán, trả lời bằng một lời gọi. Dãy đúng thì trả về
-- RỖNG; có dòng nào là có số chứng từ biến mất khỏi sổ.
create or replace function kiem_lien_tuc_phieu_thu(p_project uuid, p_ky date)
returns table (thieu_stt int)
language sql stable security definer set search_path = public as $fn$
  select s.i
    from phieu_thu_dem d, generate_series(1, d.so_cuoi) as s(i)
   where d.project_id = p_project and d.ky = date_trunc('month', p_ky)::date
     and not exists (select 1 from phieu_thu p
                      where p.project_id = d.project_id and p.ky = d.ky and p.stt = s.i)
   order by s.i;
$fn$;

create or replace function bql_so_phieu_thu(p_project uuid, p_ky date)
returns table (id uuid, so_phieu text, stt int, nhan_luc timestamptz, lap_luc timestamptz,
               ma_can text, nguoi_nop text, tong_thu bigint,
               da_huy boolean, ly_do_huy text)
language sql stable security definer set search_path = public as $fn$
  select p.id, p.so_phieu, p.stt, p.nhan_luc, p.lap_luc, p.ma_can, p.nguoi_nop,
         p.tong_thu, (p.huy_luc is not null), p.ly_do_huy
    from phieu_thu p
   where p.project_id = p_project
     and p.ky = date_trunc('month', p_ky)::date
     and is_staff(p_project)
   order by p.stt;
$fn$;

-- ── RLS ──
-- Phiếu thu hiện đúng những con số của hóa đơn, nên nó dùng LẠI luật của hóa
-- đơn (xem_duoc_tien_cua_can) chứ không viết luật riêng. Viết riêng là mở một
-- cửa sau vào cùng dữ liệu đó.
alter table phieu_thu      enable row level security;
alter table phieu_thu_dong enable row level security;
create policy phieu_thu_read on phieu_thu for select
  using (is_staff(project_id) or xem_duoc_tien_cua_can(unit_id));
create policy phieu_thu_dong_read on phieu_thu_dong for select
  using (exists (select 1 from phieu_thu p where p.id = phieu_thu_dong.phieu_id));

-- KHÔNG force row level security, cùng lý do như bank_transactions và audit_log:
-- force áp cả lên chủ bảng, mà lap_phieu_thu chạy security definer đúng dưới
-- quyền chủ bảng — bật lên là hàm tự chặn chính nó và mọi lần gạch nợ đều hỏng.
-- Không có policy INSERT/UPDATE/DELETE nào cho bất kỳ role nào: sổ chứng từ chỉ
-- được viết bởi hàm definer.

create trigger trg_audit_phieu_thu after insert or update or delete on phieu_thu
  for each row execute function ghi_nhat_ky('project_id');
