-- CHỈ chạy trên Supabase — cần schema auth.users và các role anon/authenticated
-- (không có ở Postgres thuần, nên file này không nằm trong npm run verify).
-- Chạy sau schema.sql và seed.sql.

-- Tạo profiles tự động khi có user mới, nếu không FK unit_memberships.user_id sẽ gãy.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  insert into profiles (id, full_name, phone, email)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name', 'Cư dân'),
          new.phone,
          new.email)
  on conflict (id) do nothing;
  return new;
end $fn$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ─────────────────────── DENY BY DEFAULT (bắt buộc trước) ────────────────────
-- Supabase cấp sẵn ALL trên MỌI bảng public cho anon + authenticated bằng
-- default privileges (pg_default_acl, cả role postgres lẫn supabase_admin).
-- Không thu hồi nền đó thì danh sách grant bên dưới VÔ NGHĨA — nó chỉ cộng thêm
-- vào một nền đã mở toang: ai cầm publishable key (khóa công khai, nằm trong
-- bundle JS) cũng đọc/ghi được profiles, payments, staff_assignments...
-- Và ghi được staff_assignments nghĩa là tự phong mình làm BQL: is_staff() trả
-- true, RLS của tickets/invoices bị vượt qua luôn.
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- ─────────────────────────── Cấp lại đúng phần cần ───────────────────────────
-- Role `authenticated` của Supabase cần quyền bảng; RLS mới là lớp lọc dòng.
-- anon giữ usage trên schema nhưng không có bảng nào -> PostgREST không trả dữ liệu.
grant usage on schema public to anon, authenticated;
grant select on units, buildings, projects, documents, sla_policies, fee_types to authenticated;
-- profiles có RLS (policy profile_read): chỉ thấy chính mình và thành viên
-- các căn mình quản lý, không phải cả danh bạ khu.
grant select on profiles to authenticated;
grant select, insert, update on unit_memberships to authenticated;
-- Ghi cây tài sản: chỉ BQL qua policy is_staff(). Cấp quyền bảng ở đây là chưa
-- đủ để ai cũng sửa được — RLS mới là lớp quyết định.
grant insert, update, delete on units, buildings to authenticated;
-- Xe/thú cưng: chủ hộ tự quản, policy dùng is_unit_manager().
grant select, insert, update, delete on unit_vehicles, unit_pets to authenticated;
-- update cho BQL đổi trạng thái/phân công. Policy ticket_staff_write mới quyết
-- định ai được đụng dòng nào — cư dân không có policy update nên vẫn bị chặn.
grant select, insert, update on tickets to authenticated;
grant select on staff_assignments to authenticated;
-- Biểu phí và chỉ số công tơ: RLS quyết định ai ghi (chỉ BQL).
grant insert, update, delete on fee_types to authenticated;
grant select, insert, update, delete on meter_readings to authenticated;
-- CỐ Ý không cấp update/insert trên invoices, invoice_lines, payments cho
-- authenticated: đường tiền đi qua RPC definer (bql_generate_invoices,
-- bql_issue_invoices) để cư dân không bao giờ có quyền ghi bảng tiền.
-- Chỉ ĐỌC ticket_events: audit trail mà người bị audit ghi được thì vô nghĩa.
grant select on ticket_events to authenticated;
grant select on invoices, invoice_lines, announcements, notifications to authenticated;
-- Bảng tin và cẩm nang: RLS (announcement_staff_write / document_staff_write)
-- quyết định chỉ BQL ghi được. Cấp quyền bảng ở đây là chưa đủ để ai cũng sửa.
grant insert, update, delete on announcements, documents to authenticated;
-- KHÔNG cấp update trên notifications: đánh dấu đã đọc đi qua RPC
-- mark_notifications_read để không ai sửa được nội dung thông báo của mình.

-- Không cấp gì trên profiles, staff_assignments, ticket_events, meter_readings,
-- payments, unit_vehicles, unit_pets: đây là dữ liệu cá nhân / tài chính / audit,
-- app đọc qua service_role ở phía server, client không đụng thẳng.

-- ──────────────────────────── EXECUTE trên function ──────────────────────────
-- BẪY: Postgres mặc định cấp EXECUTE cho PUBLIC trên MỌI function mới (ACL hiện
-- ra dưới dạng `=X/postgres`, grantee rỗng = PUBLIC). Revoke từ anon/authenticated
-- KHÔNG đủ — nó chỉ xóa dòng thừa, PUBLIC vẫn cho tất cả gọi được. Phải revoke
-- từ PUBLIC rồi cấp lại đúng chỗ cần.
revoke execute on all functions in schema public from public, anon, authenticated;

-- Helper của RLS: policy gọi chúng dưới quyền chính người đang truy vấn, mất
-- execute là policy tự lỗi permission denied và cư dân không đọc được gì.
grant execute on function current_unit_ids()     to authenticated;
grant execute on function is_staff(uuid)         to authenticated;
grant execute on function is_unit_manager(uuid)  to authenticated;
grant execute on function can_see_profile(uuid)  to authenticated;
grant execute on function building_project(uuid) to authenticated;
grant execute on function unit_project(uuid)     to authenticated;
grant execute on function announcement_targets_me(uuid, uuid, int, uuid) to authenticated;

-- RPC app gọi thẳng. Security invoker nên RLS vẫn là chốt chặn.
grant execute on function create_ticket(uuid, text, ticket_priority, text, text, text[]) to authenticated;
grant execute on function rate_ticket(uuid, int, text) to authenticated;
grant execute on function bql_generate_invoices(uuid, date) to authenticated;
grant execute on function bql_issue_invoices(uuid, date)   to authenticated;
grant execute on function bql_debt_report(uuid)            to authenticated;
grant execute on function mark_notifications_read(bigint[]) to authenticated;


-- Còn lại là trigger function và job nền: không phải RPC endpoint, để nguyên là
-- chúng nằm chình ình ở /rest/v1/rpc/...

-- ────────────────────────────────── FORCE RLS ────────────────────────────────
-- Bắt buộc: bảng chưa bật RLS mà đã grant = ai đăng nhập cũng đọc được toàn bộ.
alter table tickets          force row level security;
alter table invoices         force row level security;
alter table unit_memberships force row level security;
alter table notifications    force row level security;
alter table invoice_lines    force row level security;
alter table profiles         force row level security;
alter table unit_vehicles    force row level security;
alter table unit_pets        force row level security;
alter table ticket_events    force row level security;
alter table staff_assignments force row level security;
alter table meter_readings   force row level security;
-- Bốn bảng dữ liệu dùng chung + bảng tiền. FORCE hiện chưa đổi gì vì chủ bảng
-- là postgres và role đó có BYPASSRLS, nhưng để sót thì ngày đổi chủ bảng sang
-- role thường là RLS im lặng ngừng áp cho chính chủ.
alter table buildings        force row level security;
alter table units            force row level security;
alter table fee_types        force row level security;
alter table payments         force row level security;
