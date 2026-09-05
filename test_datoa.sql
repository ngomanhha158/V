-- Smoke test "nhiều tòa, nhiều khu trong một tài khoản". Chạy sau schema.sql + seed.sql.
--
-- Lời hứa: khu đang xem là một LỰA CHỌN CÓ THẬT, kiểm lại được, và danh sách
-- khu không phải là chỗ liệt kê tên khách hàng cho bất kỳ ai đăng nhập.

do $test$
declare
  p_a  uuid := 'aaaaaaaa-0000-0000-0000-000000160001';   -- khu người này quản lý
  p_b  uuid := 'aaaaaaaa-0000-0000-0000-000000160002';   -- khu thứ hai, cũng của người này
  p_c  uuid := 'aaaaaaaa-0000-0000-0000-000000160003';   -- khu của KHÁCH HÀNG KHÁC
  t_a1 uuid := 'bbbbbbbb-0000-0000-0000-000000160001';
  t_a2 uuid := 'bbbbbbbb-0000-0000-0000-000000160002';
  t_b1 uuid := 'bbbbbbbb-0000-0000-0000-000000160003';
  t_c1 uuid := 'bbbbbbbb-0000-0000-0000-000000160004';
  gd   uuid := '99990000-0000-0000-0000-000000160001';   -- giám đốc vận hành: 2 khu
  kt   uuid := '99990000-0000-0000-0000-000000160002';   -- kỹ thuật: chỉ khu A
  nghi uuid := '99990000-0000-0000-0000-000000160003';   -- đã nghỉ việc khu B
  cu_a uuid := '99990000-0000-0000-0000-000000160004';   -- cư dân khu A
  cu_c uuid := '99990000-0000-0000-0000-000000160005';   -- cư dân khu C
  u_a  uuid; u_c uuid;
  r record; n int;
begin
  -- ── Fixture: hai khu của cùng một đơn vị vận hành, một khu của bên khác ──
  insert into projects (id, name) values
    (p_a, 'Zeta Riverside'), (p_b, 'Alpha Garden'), (p_c, 'Khu cua khach khac');
  insert into buildings (id, project_id, code, name) values
    (t_a1, p_a, 'Z1', 'Toa Z1'), (t_a2, p_a, 'Z2', 'Toa Z2'),
    (t_b1, p_b, 'A1', 'Toa A1'), (t_c1, p_c, 'C1', 'Toa C1');
  insert into units (building_id, code, floor_no) values
    (t_a1, 'Z1-01.01', 1), (t_a1, 'Z1-01.02', 1), (t_a2, 'Z2-01.01', 1),
    (t_b1, 'A1-01.01', 1),
    (t_c1, 'C1-01.01', 1);
  select id into u_a from units where building_id = t_a1 and code = 'Z1-01.01';
  select id into u_c from units where building_id = t_c1 and code = 'C1-01.01';

  insert into profiles (id, full_name, phone) values
    (gd,'Giam doc van hanh','0900000200'), (kt,'Ky thuat','0900000201'),
    (nghi,'Da nghi viec','0900000202'), (cu_a,'Cu dan khu A','0900000203'),
    (cu_c,'Cu dan khu C','0900000204');

  -- Giám đốc: quản lý cả hai khu. Ở khu A anh ta vừa là BQL vừa là BQT —
  -- đúng tình huống làm màn chọn khu hiện hai dòng cho một khu nếu quên `limit 1`.
  insert into staff_assignments (user_id, project_id, role) values
    (gd, p_a, 'bqt'), (gd, p_a, 'bql_manager'), (gd, p_b, 'bql_staff');
  insert into staff_assignments (user_id, project_id, role) values (kt, p_a, 'technician');
  -- Kỹ thuật này TỪNG được cất nhắc lên trưởng BQL rồi bị rút lại. Dòng cũ vẫn
  -- nằm đó với is_active = false; nếu chỗ chọn vai trò quên lọc is_active thì
  -- một chức vụ đã bị rút vẫn hiện lên màn chọn khu.
  insert into staff_assignments (user_id, project_id, role, is_active) values
    (kt, p_a, 'bql_manager', false);
  insert into staff_assignments (user_id, project_id, role, is_active) values
    (nghi, p_b, 'bql_staff', false);
  insert into unit_memberships (unit_id, user_id, role, status) values
    (u_a, cu_a, 'owner', 'active'), (u_c, cu_c, 'owner', 'active');

  -- ── 1. Danh sách khu = đúng những khu người này được phân công ──
  perform set_config('test.uid', gd::text, true);
  select count(*) into n from du_an_cua_toi();
  if n <> 2 then
    raise exception 'FAIL 1: giam doc thay % khu thay vi 2', n;
  end if;
  select count(*) into n from du_an_cua_toi() where id = p_c;
  if n <> 0 then
    raise exception 'FAIL 1b: khu cua khach hang khac lot vao danh sach';
  end if;

  -- ── 2. Sắp theo TÊN, không theo thứ tự Postgres trả về ──
  -- 'Alpha Garden' được tạo SAU 'Zeta Riverside'; nếu bỏ order by thì dòng đầu
  -- là Zeta, và "khu mặc định" của mỗi lần đăng nhập thành chuyện may rủi.
  select id into r from du_an_cua_toi() limit 1;
  if r.id <> p_b then
    raise exception 'FAIL 2: khu dau danh sach khong phai khu co ten dau bang chu cai';
  end if;

  -- ── 3. Vai trò hiển thị là vai trò CAO NHẤT, chỉ một dòng cho một khu ──
  select * into r from du_an_cua_toi() where id = p_a;
  if r.vai_tro <> 'bql_manager' then
    raise exception 'FAIL 3: khu A hien vai tro % thay vi bql_manager (cao nhat)', r.vai_tro;
  end if;
  select count(*) into n from du_an_cua_toi() where id = p_a;
  if n <> 1 then
    raise exception 'FAIL 3b: khu A hien % dong — mot nguoi hai vai tro khong duoc thanh hai khu', n;
  end if;
  select * into r from du_an_cua_toi() where id = p_b;
  if r.vai_tro <> 'bql_staff' then
    raise exception 'FAIL 3c: khu B hien vai tro % thay vi bql_staff', r.vai_tro;
  end if;
  -- Chức vụ đã bị rút không phải là chức vụ.
  perform set_config('test.uid', kt::text, true);
  select * into r from du_an_cua_toi() where id = p_a;
  if r.vai_tro <> 'technician' then
    raise exception 'FAIL 3d: ky thuat hien vai tro % — chuc vu da rut van hien', r.vai_tro;
  end if;
  select count(*) into n from du_an_cua_toi();
  if n <> 1 then raise exception 'FAIL 3e: ky thuat thay % khu thay vi 1', n; end if;
  perform set_config('test.uid', gd::text, true);

  -- ── 4. Con số nhận dạng đúng: người trực nhớ "khu 3 căn", không nhớ uuid ──
  select * into r from du_an_cua_toi() where id = p_a;
  if r.so_toa <> 2 or r.so_can <> 3 then
    raise exception 'FAIL 4: khu A dem % toa / % can, dung ra la 2 toa / 3 can', r.so_toa, r.so_can;
  end if;
  select * into r from du_an_cua_toi() where id = p_b;
  if r.so_toa <> 1 or r.so_can <> 1 then
    raise exception 'FAIL 4b: khu B dem % toa / % can, dung ra la 1 toa / 1 can', r.so_toa, r.so_can;
  end if;
  if r.name <> 'Alpha Garden' then
    raise exception 'FAIL 4c: ten khu B tra ve %', r.name;
  end if;

  -- ── 5. Phân công đã tắt thì khu biến mất khỏi danh sách ──
  -- Nghỉ việc mà vẫn thấy khu trong hộp chọn là một lời mời bấm vào.
  perform set_config('test.uid', nghi::text, true);
  select count(*) into n from du_an_cua_toi();
  if n <> 0 then
    raise exception 'FAIL 5: nguoi da nghi viec van thay % khu', n;
  end if;

  -- ── 6. Cư dân không phải nhân sự: danh sách khu rỗng ──
  -- Cư dân có khu của mình, nhưng /bql không phải chỗ của họ và hộp chọn khu
  -- của BQL không được coi "ở trong khu" là "quản lý khu".
  perform set_config('test.uid', cu_a::text, true);
  select count(*) into n from du_an_cua_toi();
  if n <> 0 then
    raise exception 'FAIL 6: cu dan thay % khu trong danh sach quan ly', n;
  end if;

  -- ── 7. duoc_quan_ly: cửa kiểm lại cookie ──
  perform set_config('test.uid', gd::text, true);
  if not duoc_quan_ly(p_a) then raise exception 'FAIL 7: giam doc khong quan ly duoc khu A'; end if;
  if not duoc_quan_ly(p_b) then raise exception 'FAIL 7b: giam doc khong quan ly duoc khu B'; end if;
  if duoc_quan_ly(p_c) then
    raise exception 'FAIL 7c: giam doc quan ly duoc khu cua khach hang khac';
  end if;
  -- Cookie bịa: một uuid không ứng với khu nào. Phải trả false chứ không nổ,
  -- vì trình duyệt gửi lên gì là chuyện của trình duyệt.
  if duoc_quan_ly('aaaaaaaa-0000-0000-0000-0000000000ff') then
    raise exception 'FAIL 7d: uuid bia van duoc coi la khu quan ly duoc';
  end if;
  -- Cookie TRỐNG. `is_staff(null)` trả false, nhưng nếu ai đó viết lại hàm
  -- thành `exists(... where project_id is not distinct from p_project)` thì
  -- null lại khớp. Chốt lại bằng một dòng test.
  if duoc_quan_ly(null) then raise exception 'FAIL 7e: cookie trong van duoc coi la mot khu'; end if;
  perform set_config('test.uid', kt::text, true);
  if duoc_quan_ly(p_b) then
    raise exception 'FAIL 7f: ky thuat khu A quan ly duoc ca khu B';
  end if;
  -- Cư dân Ở TRONG khu không phải là người QUẢN LÝ khu. Hai chuyện này dùng
  -- chung một chữ "thuộc về" trong tiếng Việt nhưng là hai cửa khác nhau: cửa
  -- này gác /bql, và ở-trong-khu không mở được nó.
  perform set_config('test.uid', cu_a::text, true);
  if duoc_quan_ly(p_a) then
    raise exception 'FAIL 7g: cu dan qua duoc cua kiem cookie cua khu minh o';
  end if;

  -- ── 8. RLS projects: tên khu là thông tin thương mại ──
  begin execute 'create role vb_dt_test nologin'; exception when duplicate_object then null; end;
  execute 'grant usage on schema public to vb_dt_test';
  execute 'grant select on projects to vb_dt_test';
  execute 'grant execute on function is_staff(uuid), o_trong_du_an(uuid) to vb_dt_test';
  execute 'set local role vb_dt_test';

  -- Giám đốc: đúng 2 khu mình quản lý, không thấy khu khách hàng khác.
  perform set_config('test.uid', gd::text, true);
  select count(*) into n from projects where id in (p_a, p_b, p_c);
  if n <> 2 then
    raise exception 'FAIL 8: giam doc doc duoc % du an thay vi 2', n;
  end if;

  -- Cư dân khu C: thấy khu C (để màn hình của họ có tên khu), KHÔNG thấy A/B.
  perform set_config('test.uid', cu_c::text, true);
  select count(*) into n from projects where id in (p_a, p_b, p_c);
  if n <> 1 then
    raise exception 'FAIL 8b: cu dan khu C doc duoc % du an thay vi 1', n;
  end if;
  select count(*) into n from projects where id = p_c;
  if n <> 1 then
    raise exception 'FAIL 8c: cu dan khu C khong doc duoc chinh khu minh o';
  end if;

  -- Người lạ đăng nhập: không thấy tên khu nào cả. Đây là dòng test thay thế
  -- cho `using (true)` cũ — nó xanh trước đây chỉ vì cả hệ thống có một khu.
  perform set_config('test.uid', nghi::text, true);
  select count(*) into n from projects;
  if n <> 0 then
    raise exception 'FAIL 8d: nguoi khong lam o dau doc duoc % ten khu', n;
  end if;
  execute 'reset role';

  raise notice 'TEST DA TOA PASSED — khu dang xem la mot lua chon kiem lai duoc, va danh sach khu khong phai danh ba khach hang';
end $test$;
