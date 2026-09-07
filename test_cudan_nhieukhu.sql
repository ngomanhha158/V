-- Smoke test "cư dân ở nhiều khu" (§29). Chạy sau schema.sql + seed.sql.
--
-- Lời hứa: người có căn ở hai khu nhìn thấy CẢ HAI. Hỏng ở đây không kêu lên
-- thành lỗi — nó chỉ làm một nửa tài sản của người ta biến mất khỏi màn hình.

do $test$
declare
  p_1  uuid := 'aaaaaaaa-0000-0000-0000-000000180001';
  p_2  uuid := 'aaaaaaaa-0000-0000-0000-000000180002';
  p_3  uuid := 'aaaaaaaa-0000-0000-0000-000000180003';
  t_1  uuid := 'bbbbbbbb-0000-0000-0000-000000180001';
  t_2  uuid := 'bbbbbbbb-0000-0000-0000-000000180002';
  t_3  uuid := 'bbbbbbbb-0000-0000-0000-000000180003';
  hai  uuid := '99990000-0000-0000-0000-000000180001';  -- có căn ở CẢ HAI khu
  mot  uuid := '99990000-0000-0000-0000-000000180002';  -- chỉ một khu
  cu   uuid := '99990000-0000-0000-0000-000000180003';  -- hợp đồng đã hết hạn
  nv   uuid := '99990000-0000-0000-0000-000000180004';  -- nhân sự, không ở đâu
  u1 uuid; u2 uuid; u3 uuid; n int; r record;
begin
  insert into projects (id, name) values
    (p_1, 'Zeta Home'), (p_2, 'Alpha Home'), (p_3, 'Khu khong lien quan');
  insert into buildings (id, project_id, code, name) values
    (t_1, p_1, 'Z9', 'Toa Z9'), (t_2, p_2, 'A9', 'Toa A9'), (t_3, p_3, 'K9', 'Toa K9');
  insert into units (building_id, code, floor_no) values
    (t_1, 'Z9-01.01', 1), (t_2, 'A9-01.01', 1), (t_3, 'K9-01.01', 1);
  select id into u1 from units where building_id = t_1;
  select id into u2 from units where building_id = t_2;
  select id into u3 from units where building_id = t_3;

  insert into profiles (id, full_name, phone) values
    (hai,'Chu hai can','0900000220'), (mot,'Chu mot can','0900000221'),
    (cu,'Da het han','0900000222'), (nv,'Nhan su','0900000223');
  insert into staff_assignments (user_id, project_id, role) values (nv, p_1, 'bql_staff');

  insert into unit_memberships (unit_id, user_id, role, status) values
    (u1, hai, 'owner', 'active'), (u2, hai, 'owner', 'active'),
    (u1, mot, 'tenant', 'active');
  -- Hợp đồng thuê ĐÃ HẾT HẠN: ngày tháng còn nằm trong bảng, nhưng người này
  -- không còn ở đó nữa.
  insert into unit_memberships (unit_id, user_id, role, status, valid_from, valid_to)
    values (u2, cu, 'tenant', 'active', current_date - 365, current_date - 1);

  -- ── 1. Người có căn ở hai khu thấy ĐỦ HAI ──
  perform set_config('test.uid', hai::text, true);
  select count(*) into n from khu_toi_o();
  if n <> 2 then
    raise exception 'FAIL 1: chu hai can thay % khu thay vi 2 — mot nua tai san bien mat', n;
  end if;
  select count(*) into n from khu_toi_o() where id = p_3;
  if n <> 0 then raise exception 'FAIL 1b: khu khong lien quan lot vao danh sach'; end if;

  -- ── 2. Sắp theo TÊN, để thứ tự không đổi giữa hai lần mở ──
  -- 'Alpha Home' tạo SAU 'Zeta Home'; không sắp thì khối nào lên trước là tùy
  -- Postgres, và người dùng thấy trang mình nhảy chỗ mỗi lần tải lại.
  select id into r from khu_toi_o() limit 1;
  if r.id <> p_2 then raise exception 'FAIL 2: khong sap theo ten'; end if;

  -- ── 3. Một khu thì vẫn đúng một khu, không nhân đôi ──
  -- Người này có tư cách ở u1; khu đó chỉ được đếm MỘT lần dù có bao nhiêu căn.
  perform set_config('test.uid', mot::text, true);
  select count(*) into n from khu_toi_o();
  if n <> 1 then raise exception 'FAIL 3: chu mot can thay % khu thay vi 1', n; end if;

  -- ── 4. Hợp đồng hết hạn thì khu đó biến mất ──
  -- Cùng một luật với current_unit_ids(): hết hạn là hết quyền, và màn hình
  -- phải theo đúng luật đó chứ không giữ lại vì "đã từng ở".
  perform set_config('test.uid', cu::text, true);
  select count(*) into n from khu_toi_o();
  if n <> 0 then raise exception 'FAIL 4: hop dong het han van thay % khu', n; end if;

  -- ── 5. Nhân sự KHÔNG ở khu nào thì danh sách rỗng ──
  -- khu_toi_o là "khu tôi Ở", không phải "khu tôi quản lý". Gộp hai thứ đó là
  -- đưa sổ quỹ của khu vào màn cư dân của một người không sống ở đó.
  perform set_config('test.uid', nv::text, true);
  select count(*) into n from khu_toi_o();
  if n <> 0 then
    raise exception 'FAIL 5: nhan su khong o khu nao van thay % khu', n;
  end if;

  -- ── 6. Nhiều căn trong CÙNG một khu vẫn chỉ ra một dòng ──
  insert into units (building_id, code, floor_no) values (t_1, 'Z9-02.02', 2);
  insert into unit_memberships (unit_id, user_id, role, status)
    select id, hai, 'owner', 'active' from units where building_id = t_1 and code = 'Z9-02.02';
  perform set_config('test.uid', hai::text, true);
  select count(*) into n from khu_toi_o();
  if n <> 2 then
    raise exception 'FAIL 6: hai can cung khu lam khu do hien % lan', n;
  end if;

  raise notice 'TEST CU DAN NHIEU KHU PASSED — o hai khu thi thay ca hai, va khong khu nao hien hai lan';
end $test$;
