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
grant select, insert on tickets to authenticated;
grant select on invoices, invoice_lines, announcements, notifications to authenticated;

-- Không cấp gì trên profiles, staff_assignments, ticket_events, meter_readings,
-- payments, unit_vehicles, unit_pets: đây là dữ liệu cá nhân / tài chính / audit,
-- app đọc qua service_role ở phía server, client không đụng thẳng.

-- ──────────────────────────── EXECUTE trên function ──────────────────────────
-- BẪY: Postgres mặc định cấp EXECUTE cho PUBLIC trên MỌI function mới (ACL hiện
-- ra dưới dạng `=X/postgres`, grantee rỗng = PUBLIC). Revoke từ anon/authenticated
-- KHÔNG đủ — nó chỉ xóa dòng thừa, PUBLIC vẫn cho tất cả gọi được. Phải revoke
-- từ PUBLIC rồi cấp lại đúng chỗ cần.
revoke execute on all functions in schema public from public, anon, authenticated;

-- Chỉ 3 helper này cần: policy RLS gọi chúng dưới quyền chính người đang truy
-- vấn, mất execute là policy tự lỗi permission denied và cư dân không đọc được gì.
grant execute on function current_unit_ids()    to authenticated;
grant execute on function is_staff(uuid)        to authenticated;
grant execute on function is_unit_manager(uuid) to authenticated;
grant execute on function can_see_profile(uuid)  to authenticated;
grant execute on function building_project(uuid) to authenticated;
grant execute on function unit_project(uuid)     to authenticated;

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
