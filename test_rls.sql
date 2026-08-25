-- Smoke test cho phần rủi ro nhất: RLS + hết hạn hợp đồng thuê.
-- Chạy: psql -f schema.sql && psql -1 -f test_rls.sql
--   (-1 = bọc trong 1 transaction; assert fail -> raise exception -> rollback toàn bộ)
-- ponytail: 1 file assert, không framework. Chỉ test 5 invariant dễ vỡ nhất.
--
-- LƯU Ý: table owner mặc định BYPASS RLS -> phải FORCE, nếu không test pass giả.

create schema if not exists auth;
-- Stub auth.uid() để chạy được trên Postgres thuần (Supabase đã có sẵn hàm này).
create or replace function auth.uid() returns uuid language sql stable as $fn$
  select nullif(current_setting('test.uid', true), '')::uuid;
$fn$;

do $test$
declare
  v_project uuid; v_building uuid; v_unit uuid;
  u_owner    uuid := '11111111-1111-1111-1111-111111111111';
  u_family   uuid := '22222222-2222-2222-2222-222222222222';
  u_tenant   uuid := '33333333-3333-3333-3333-333333333333';
  u_stranger uuid := '44444444-4444-4444-4444-444444444444';
  n int;
begin
  -- ── seed (RLS chưa force) ──
  insert into projects (name) values ('Test Complex') returning id into v_project;
  insert into buildings (project_id, code, name) values (v_project,'P3','Park 3') returning id into v_building;
  insert into units (building_id, code, floor_no) values (v_building,'P3-12.05',12) returning id into v_unit;

  insert into profiles (id, full_name) values
    (u_owner,'Chu ho'), (u_family,'Con'), (u_tenant,'Nguoi thue'), (u_stranger,'Nguoi la');

  insert into unit_memberships (unit_id, user_id, role, status, valid_to, can_view_finance) values
    (v_unit, u_owner,  'owner',  'active', null, true),
    (v_unit, u_family, 'family', 'active', null, false),
    (v_unit, u_tenant, 'tenant', 'active', current_date - 1, false);  -- HĐ hết hạn hôm qua

  insert into invoices (unit_id, project_id, period, total_amount, due_date, status)
    values (v_unit, v_project, date_trunc('month', current_date), 1500000, current_date + 10, 'issued');

  execute 'alter table invoices force row level security';
  execute 'alter table unit_memberships force row level security';

  -- 1. Chủ hộ thấy hóa đơn
  perform set_config('test.uid', u_owner::text, true);
  select count(*) into n from invoices where unit_id = v_unit;
  if n <> 1 then raise exception 'FAIL 1: chu ho phai thay hoa don, thay % dong', n; end if;

  -- 2. Thành viên gia đình KHÔNG thấy công nợ (can_view_finance = false)
  perform set_config('test.uid', u_family::text, true);
  select count(*) into n from invoices where unit_id = v_unit;
  if n <> 0 then raise exception 'FAIL 2: family member khong duoc thay hoa don'; end if;

  -- 3. Người thuê hết hạn hợp đồng -> mất quyền NGAY, không chờ cron
  perform set_config('test.uid', u_tenant::text, true);
  select count(*) into n from invoices where unit_id = v_unit;
  if n <> 0 then raise exception 'FAIL 3: tenant het han van truy cap duoc'; end if;

  -- 4. Người lạ không thấy gì
  perform set_config('test.uid', u_stranger::text, true);
  select count(*) into n from invoices where unit_id = v_unit;
  if n <> 0 then raise exception 'FAIL 4: nguoi la truy cap duoc du lieu can ho'; end if;

  -- 5. Không cho 2 chủ hộ active trên cùng 1 căn
  begin
    insert into unit_memberships (unit_id, user_id, role, status)
      values (v_unit, u_stranger, 'owner', 'active');
    raise exception 'FAIL 5: cho phep 2 chu ho active tren cung 1 can';
  exception when unique_violation then null;
  end;

  raise notice 'ALL RLS TESTS PASSED';
end $test$;

rollback;
