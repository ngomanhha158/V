-- Smoke test cho phần rủi ro nhất: RLS + hết hạn hợp đồng thuê.
-- Chạy: psql -f schema.sql && psql -1 -f test_rls.sql
--   (-1 = bọc trong 1 transaction; assert fail -> raise exception -> rollback toàn bộ)
-- ponytail: 1 file assert, không framework. Chỉ test 10 invariant dễ vỡ nhất.
--
-- HAI CÁI BẪY LÀM TEST PASS GIẢ:
--   1. Table owner mặc định BYPASS RLS -> phải FORCE ROW LEVEL SECURITY.
--   2. Superuser bypass RLS kể cả khi đã FORCE -> phải SET ROLE sang role thường.
--      (Trên Supabase, client thật chạy dưới role `authenticated`, không phải postgres.)

create schema if not exists auth;
-- Stub auth.uid() để chạy được trên Postgres thuần (Supabase đã có sẵn hàm này).
create or replace function auth.uid() returns uuid language sql stable as $fn$
  select nullif(current_setting('test.uid', true), '')::uuid;
$fn$;

do $test$
declare
  v_project uuid; v_building uuid; v_unit uuid; v_invoice uuid;
  u_owner    uuid := '11111111-1111-1111-1111-111111111111';
  u_family   uuid := '22222222-2222-2222-2222-222222222222';
  u_tenant   uuid := '33333333-3333-3333-3333-333333333333';
  u_stranger uuid := '44444444-4444-4444-4444-444444444444';
  n int;
begin
  -- ── seed, chạy quyền cao ──
  insert into projects (name) values ('Test Complex') returning id into v_project;
  insert into buildings (project_id, code, name) values (v_project,'P3','Park 3') returning id into v_building;
  insert into units (building_id, code, floor_no) values (v_building,'P3-12.05',12) returning id into v_unit;

  insert into profiles (id, full_name) values
    (u_owner,'Chu ho'), (u_family,'Con'), (u_tenant,'Nguoi thue'), (u_stranger,'Nguoi la');

  insert into unit_memberships (unit_id, user_id, role, status, valid_from, valid_to, can_view_finance) values
    (v_unit, u_owner,  'owner',  'active', current_date, null, true),
    (v_unit, u_family, 'family', 'active', current_date, null, false),
    -- HĐ thuê 1 năm, hết hạn hôm qua. valid_from phải lùi về quá khứ,
    -- nếu không constraint valid_range chặn (valid_to >= valid_from).
    (v_unit, u_tenant, 'tenant', 'active', current_date - 365, current_date - 1, false);

  insert into invoices (unit_id, project_id, period, total_amount, due_date, status)
    values (v_unit, v_project, date_trunc('month', current_date), 1500000, current_date + 10, 'issued')
    returning id into v_invoice;

  insert into invoice_lines (invoice_id, description, quantity, unit_price, amount)
    values (v_invoice, 'Phi quan ly', 1, 1500000, 1500000);

  -- Thông báo của người lạ: dùng làm mồi, chủ hộ KHÔNG được thấy dòng này.
  insert into notifications (user_id, kind, title) values
    (u_owner,    'invoice', 'Hoa don thang nay'),
    (u_stranger, 'invoice', 'Hoa don cua nguoi khac');

  -- ── bật RLS thật ──
  execute 'alter table invoices force row level security';
  execute 'alter table unit_memberships force row level security';
  execute 'alter table notifications force row level security';
  execute 'alter table invoice_lines force row level security';

  begin execute 'create role vb_rls_test nologin'; exception when duplicate_object then null; end;
  execute 'grant usage on schema public to vb_rls_test';
  execute 'grant select on invoices to vb_rls_test';
  execute 'grant select on notifications, invoice_lines to vb_rls_test';
  execute 'grant select, insert, update on unit_memberships to vb_rls_test';
  execute 'set local role vb_rls_test';   -- từ đây RLS mới thực sự có hiệu lực

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

  -- 5. Người lạ tự xin gia nhập chỉ tạo được 'pending', không tự cấp 'active'
  perform set_config('test.uid', u_stranger::text, true);
  begin
    insert into unit_memberships (unit_id, user_id, role, status)
      values (v_unit, u_stranger, 'tenant', 'active');
    raise exception 'FAIL 5: tu cap duoc quyen active, khong can chu ho duyet';
  exception when insufficient_privilege then null;
  end;
  insert into unit_memberships (unit_id, user_id, role, status, valid_from, valid_to)
    values (v_unit, u_stranger, 'tenant', 'pending', current_date, current_date + 180);

  -- 6. Thành viên gia đình KHÔNG duyệt được yêu cầu (không phải owner/authorized)
  perform set_config('test.uid', u_family::text, true);
  update unit_memberships set status = 'active'
   where unit_id = v_unit and user_id = u_stranger and status = 'pending';
  if found then raise exception 'FAIL 6: family member duyet duoc thanh vien moi'; end if;

  -- 7. Chủ hộ duyệt được
  perform set_config('test.uid', u_owner::text, true);
  update unit_memberships set status = 'active'
   where unit_id = v_unit and user_id = u_stranger and status = 'pending';
  if not found then raise exception 'FAIL 7: chu ho khong duyet duoc thanh vien'; end if;

  -- 8. Thông báo là dữ liệu riêng: chủ hộ chỉ thấy thông báo của chính mình.
  --    Bảng này có grant select cho `authenticated`, nên thiếu RLS là cư dân nào
  --    cũng đọc được thông báo của toàn khu.
  perform set_config('test.uid', u_owner::text, true);
  select count(*) into n from notifications;
  if n <> 1 then raise exception 'FAIL 8: chu ho thay % thong bao, phai thay dung 1 cua minh', n; end if;

  -- 9. invoice_lines thừa hưởng quyền của invoices. Không có RLS ở đây thì đọc
  --    thẳng invoice_lines là vòng qua được RLS của invoices (xem FAIL 2).
  perform set_config('test.uid', u_owner::text, true);
  select count(*) into n from invoice_lines;
  if n <> 1 then raise exception 'FAIL 9a: chu ho phai thay dong hoa don, thay % dong', n; end if;

  perform set_config('test.uid', u_family::text, true);
  select count(*) into n from invoice_lines;
  if n <> 0 then raise exception 'FAIL 9b: family member doc duoc chi tiet hoa don qua invoice_lines'; end if;

  -- 10. Không cho 2 chủ hộ active trên cùng 1 căn (test constraint, không phải RLS)
  execute 'reset role';
  begin
    insert into unit_memberships (unit_id, user_id, role, status)
      values (v_unit, u_stranger, 'owner', 'active');
    raise exception 'FAIL 10: cho phep 2 chu ho active tren cung 1 can';
  exception when unique_violation then null;
  end;

  raise notice 'ALL RLS TESTS PASSED';
end $test$;

rollback;
