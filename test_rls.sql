-- Smoke test cho phần rủi ro nhất: RLS + hết hạn hợp đồng thuê.
-- Chạy: psql -f schema.sql && psql -1 -f test_rls.sql
--   (-1 = bọc trong 1 transaction; assert fail -> raise exception -> rollback toàn bộ)
-- ponytail: 1 file assert, không framework. Chỉ test 13 invariant dễ vỡ nhất.
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
  u_thu_hoi  uuid := '44444444-4444-4444-4444-444444444440';
  u_cho_duyet uuid := '44444444-4444-4444-4444-444444444441';
  v_unit2 uuid; v_bld2 uuid; n_ann int;
  p_khac uuid; b_khac uuid; u_khac uuid;
  u_bql      uuid := '55555555-5555-5555-5555-555555555550';
  n int;
begin
  -- ── seed, chạy quyền cao ──
  insert into projects (name) values ('Test Complex') returning id into v_project;
  insert into buildings (project_id, code, name) values (v_project,'P3','Park 3') returning id into v_building;
  insert into units (building_id, code, floor_no) values (v_building,'P3-12.05',12) returning id into v_unit;

  insert into profiles (id, full_name) values
    (u_owner,'Chu ho'), (u_family,'Con'), (u_tenant,'Nguoi thue'), (u_stranger,'Nguoi la'),
    (u_bql,'Nhan vien BQL'), (u_thu_hoi,'Da bi thu hoi'), (u_cho_duyet,'Cho BQL duyet');

  insert into staff_assignments (user_id, project_id, role) values (u_bql, v_project, 'bql_manager');

  insert into unit_memberships (unit_id, user_id, role, status, valid_from, valid_to, can_view_finance) values
    (v_unit, u_owner,  'owner',  'active', current_date, null, true),
    (v_unit, u_family, 'family', 'active', current_date, null, false),
    -- HĐ thuê 1 năm, hết hạn hôm qua. valid_from phải lùi về quá khứ,
    -- nếu không constraint valid_range chặn (valid_to >= valid_from).
    (v_unit, u_tenant, 'tenant', 'active', current_date - 365, current_date - 1, false),
    -- Bị thu hồi GIỮA CHỪNG hợp đồng: ngày tháng vẫn còn hiệu lực và
    -- can_view_finance vẫn bật, nên chỉ cột status chặn được họ. Nếu quên
    -- lọc status thì người đã bị đuổi vẫn đọc được công nợ của căn.
    (v_unit, u_thu_hoi, 'tenant', 'revoked', current_date - 30, current_date + 300, true),
    -- Mới xin gia nhập, BQL chưa duyệt. 'pending' chưa phải là quyền.
    (v_unit, u_cho_duyet,'tenant', 'pending', current_date - 1, null, true);

  -- Tòa thứ hai + căn ở tầng khác: không có hai thứ này thì mọi thông báo đều
  -- trúng đích một cách tình cờ và test không chứng minh được gì.
  insert into buildings (project_id, code, name) values (v_project,'P4','Park 4') returning id into v_bld2;
  insert into units (building_id, code, floor_no) values (v_bld2,'P4-05.01',5) returning id into v_unit2;

  -- Dự án KHÁC. Nếu thiếu, mọi thông báo trong test đều cùng dự án nên điều
  -- kiện khóa dự án không bao giờ được kiểm — bỏ nó đi test vẫn xanh, mà thực
  -- tế là cư dân khu này đọc được thông báo của khu kia.
  insert into projects (name) values ('Khu khac') returning id into p_khac;
  insert into buildings (project_id, code, name) values (p_khac,'X1','Toa X1') returning id into b_khac;
  insert into units (building_id, code, floor_no) values (b_khac,'X1-12.05',12) returning id into u_khac;

  insert into announcements (project_id, building_id, floor_no, unit_id, title, body, author_id, published_at) values
    -- Toàn dự án KHÁC: cùng số tầng 12, cùng mã căn, chỉ khác dự án. Nhắm đúng
    -- vào kiểu lỗi so tầng/mã mà quên so dự án.
    (p_khac, null, null, null, 'Khu khac toan du an', 'x', u_bql, now() - interval '1 hour'),
    (p_khac, null, 12,   null, 'Khu khac tang 12',    'x', u_bql, now() - interval '1 hour'),
    (v_project, null,      null, null,    'Toan du an',        'x', u_bql, now() - interval '1 hour'),
    (v_project, v_building,null, null,    'Rieng toa P3',      'x', u_bql, now() - interval '1 hour'),
    (v_project, v_building,12,   null,    'Rieng tang 12 P3',  'x', u_bql, now() - interval '1 hour'),
    (v_project, null,      null, v_unit,  'Rieng can 12.05',   'x', u_bql, now() - interval '1 hour'),
    -- Nhắm sang tòa/căn KHÁC: chủ hộ P3-12.05 không được thấy.
    (v_project, v_bld2,    null, null,    'Rieng toa P4',      'x', u_bql, now() - interval '1 hour'),
    (v_project, v_building,7,    null,    'Rieng tang 7 P3',   'x', u_bql, now() - interval '1 hour'),
    (v_project, null,      null, v_unit2, 'Rieng can P4-05.01','x', u_bql, now() - interval '1 hour'),
    -- Chưa phát hành và hẹn giờ tương lai: bản nháp của BQL, cư dân chưa được thấy.
    (v_project, null,      null, null,    'Con nhap',          'x', u_bql, null),
    (v_project, null,      null, null,    'Hen gio mai',       'x', u_bql, now() + interval '1 day');

  insert into invoices (unit_id, project_id, period, total_amount, due_date, status)
    values (v_unit, v_project, date_trunc('month', current_date), 1500000, current_date + 10, 'issued')
    returning id into v_invoice;

  insert into invoice_lines (invoice_id, description, quantity, unit_price, amount)
    values (v_invoice, 'Phi quan ly', 1, 1500000, 1500000);

  -- Gói tin ngân hàng thật: có tên và số tài khoản người chuyển.
  insert into payments (invoice_id, unit_id, amount, bank_ref, raw_payload)
    values (v_invoice, v_unit, 500000, 'FT99001',
            '{"nguoi_chuyen":"NGUYEN VAN A","stk_nguon":"0011002233"}'::jsonb);

  -- Thông báo của người lạ: dùng làm mồi, chủ hộ KHÔNG được thấy dòng này.
  insert into notifications (user_id, kind, title) values
    (u_owner,    'invoice', 'Hoa don thang nay'),
    (u_stranger, 'invoice', 'Hoa don cua nguoi khac');

  -- ── bật RLS thật ──
  execute 'alter table announcements force row level security';
  execute 'alter table payments force row level security';
  execute 'alter table invoices force row level security';
  execute 'alter table unit_memberships force row level security';
  execute 'alter table notifications force row level security';
  execute 'alter table invoice_lines force row level security';
  execute 'alter table profiles force row level security';
  execute 'alter table units force row level security';
  execute 'alter table unit_vehicles force row level security';

  begin execute 'create role vb_rls_test nologin'; exception when duplicate_object then null; end;
  execute 'grant usage on schema public to vb_rls_test';
  execute 'grant select on invoices to vb_rls_test';
  execute 'grant select on notifications, invoice_lines to vb_rls_test';
  execute 'grant select on announcements to vb_rls_test';
  execute 'grant select on payments to vb_rls_test';
  execute 'grant execute on function announcement_targets_me(uuid, uuid, int, uuid) to vb_rls_test';
  execute 'grant select on profiles to vb_rls_test';
  execute 'grant select, insert on units to vb_rls_test';
  execute 'grant select, insert, delete on unit_vehicles to vb_rls_test';
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

  -- 3b. Bị thu hồi quyền giữa chừng -> mất quyền ngay, dù hợp đồng còn hạn
  perform set_config('test.uid', u_thu_hoi::text, true);
  select count(*) into n from invoices where unit_id = v_unit;
  if n <> 0 then raise exception 'FAIL 3b: nguoi da bi thu hoi van doc duoc hoa don'; end if;

  -- 3c. Chờ BQL duyệt -> chưa có quyền. Đây là mặt sau của FAIL 5: người lạ chỉ
  --     tạo được bản ghi 'pending', nên 'pending' bắt buộc phải là vô hiệu.
  perform set_config('test.uid', u_cho_duyet::text, true);
  select count(*) into n from invoices where unit_id = v_unit;
  if n <> 0 then raise exception 'FAIL 3c: don cho duyet da doc duoc hoa don'; end if;

  -- 3d. Thông báo nhắm đối tượng. Chủ hộ P3-12.05 phải thấy ĐÚNG 4 bản:
  --     toàn dự án, riêng tòa P3, riêng tầng 12 P3, riêng căn mình.
  --     Không thấy: tòa P4, tầng 7, căn P4-05.01, bản nháp, bản hẹn giờ mai.
  perform set_config('test.uid', u_owner::text, true);
  select count(*) into n_ann from announcements;
  if n_ann <> 4 then
    raise exception 'FAIL 3d: chu ho thay % thong bao, phai thay dung 4', n_ann;
  end if;
  -- Đếm đúng nhưng trúng nhầm bản thì vẫn hỏng, nên soi thẳng tiêu đề.
  select count(*) into n_ann from announcements
   where title in ('Rieng toa P4','Rieng tang 7 P3','Rieng can P4-05.01','Con nhap','Hen gio mai',
                   'Khu khac toan du an','Khu khac tang 12');
  if n_ann <> 0 then
    raise exception 'FAIL 3e: lo % thong bao khong danh cho chu ho nay', n_ann;
  end if;

  -- 3f. Người lạ (không có căn nào) không thấy thông báo nào, kể cả bản toàn dự án
  perform set_config('test.uid', u_stranger::text, true);
  select count(*) into n_ann from announcements;
  if n_ann <> 0 then raise exception 'FAIL 3f: nguoi la doc duoc % thong bao', n_ann; end if;

  -- 3g. Chủ hộ KHÔNG đọc được bảng payments, dù đó là thanh toán căn mình.
  --     raw_payload có tên và số tài khoản người chuyển; RLS không lọc theo cột
  --     nên mở bảng này là mở luôn dữ liệu ngân hàng. Số đã trả cư dân xem ở
  --     invoices.paid_amount là đủ.
  perform set_config('test.uid', u_owner::text, true);
  select count(*) into n from payments;
  if n <> 0 then raise exception 'FAIL 3g: chu ho doc duoc % dong payments', n; end if;

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

  -- 10. profiles: chủ hộ đọc được thành viên căn mình, người khác thì không.
  --     Mở cả bảng = lộ danh bạ toàn khu; đóng hẳn = màn duyệt hiện dòng trống.
  --     (Tới đây u_stranger đã là tenant active trên v_unit nhờ assert 7.)
  perform set_config('test.uid', u_owner::text, true);
  select count(*) into n from profiles where id = u_stranger;
  if n <> 1 then raise exception 'FAIL 10a: chu ho khong doc duoc profile thanh vien can minh'; end if;

  -- Family member không phải người quản lý căn -> không được xem profile người khác
  perform set_config('test.uid', u_family::text, true);
  select count(*) into n from profiles where id = u_stranger;
  if n <> 0 then raise exception 'FAIL 10b: family member doc duoc profile nguoi khac'; end if;

  -- Nhưng ai cũng đọc được profile của chính mình
  select count(*) into n from profiles where id = u_family;
  if n <> 1 then raise exception 'FAIL 10c: khong doc duoc profile cua chinh minh'; end if;

  -- 11. Cây tài sản: chỉ BQL được ghi. Cư dân sửa được danh sách căn hộ thì
  --     toàn bộ phân quyền phía dưới (RLS lọc theo unit) mất ý nghĩa.
  perform set_config('test.uid', u_owner::text, true);
  begin
    insert into units (building_id, code, floor_no) values (v_building, 'P3-99.99', 99);
    raise exception 'FAIL 11a: cu dan thuong tao duoc can ho moi';
  exception when insufficient_privilege then null;
  end;

  perform set_config('test.uid', u_bql::text, true);
  insert into units (building_id, code, floor_no) values (v_building, 'P3-99.99', 99);
  select count(*) into n from units where code = 'P3-99.99';
  if n <> 1 then raise exception 'FAIL 11b: BQL khong tao duoc can ho'; end if;

  -- 12. Xe: chủ hộ tự quản căn mình; thành viên gia đình không được thêm.
  perform set_config('test.uid', u_family::text, true);
  begin
    insert into unit_vehicles (unit_id, plate) values (v_unit, '51A-11111');
    raise exception 'FAIL 12a: family member them duoc xe';
  exception when insufficient_privilege then null;
  end;

  perform set_config('test.uid', u_owner::text, true);
  insert into unit_vehicles (unit_id, plate) values (v_unit, '51A-22222');
  select count(*) into n from unit_vehicles where unit_id = v_unit;
  if n <> 1 then raise exception 'FAIL 12b: chu ho khong them duoc xe cho can minh'; end if;

  -- Người lạ ở căn khác không được thêm xe vào căn này
  perform set_config('test.uid', u_bql::text, true);
  begin
    insert into unit_vehicles (unit_id, plate) values (v_unit, '51A-33333');
    raise exception 'FAIL 12c: BQL ghi de duoc tai san cua can ho';
  exception when insufficient_privilege then null;
  end;

  -- 12d/e. XÓA: RLS chặn delete bằng cách khớp 0 dòng, KHÔNG báo lỗi. Nên nếu
  --     policy sai thì app vẫn chạy êm, chỉ là dữ liệu người khác bốc hơi.
  perform set_config('test.uid', u_family::text, true);
  delete from unit_vehicles where unit_id = v_unit;
  select count(*) into n from unit_vehicles where unit_id = v_unit;
  if n <> 1 then raise exception 'FAIL 12d: family member xoa duoc xe cua can ho'; end if;

  perform set_config('test.uid', u_owner::text, true);
  delete from unit_vehicles where unit_id = v_unit;
  select count(*) into n from unit_vehicles where unit_id = v_unit;
  if n <> 0 then raise exception 'FAIL 12e: chu ho khong xoa duoc xe cua can minh'; end if;

  -- 13. Không cho 2 chủ hộ active trên cùng 1 căn (test constraint, không phải RLS)
  execute 'reset role';
  begin
    insert into unit_memberships (unit_id, user_id, role, status)
      values (v_unit, u_stranger, 'owner', 'active');
    raise exception 'FAIL 13: cho phep 2 chu ho active tren cung 1 can';
  exception when unique_violation then null;
  end;

  raise notice 'ALL RLS TESTS PASSED';
end $test$;

rollback;
