-- Smoke test ca trực và biên bản bàn giao ca. Chạy sau schema.sql + seed.sql.
--
-- Cả tính năng dựng lên để một câu không còn xảy ra: "ca trước không nói gì với
-- tôi cả". Muốn câu đó có sức nặng thì biên bản phải có HAI người, việc chuyển
-- tiếp phải neo vào yêu cầu có thật, và người NHẬN ca phải là người ký.

do $test$
declare
  p_c  uuid := 'aaaaaaaa-0000-0000-0000-000000120000';
  t_c  uuid := 'bbbbbbbb-0000-0000-0000-000000120001';
  p_x  uuid := 'aaaaaaaa-0000-0000-0000-000000120009';   -- dự án khác
  t_x  uuid := 'bbbbbbbb-0000-0000-0000-000000120009';
  bql  uuid := '99990000-0000-0000-0000-000000120001';
  dem  uuid := '99990000-0000-0000-0000-000000120002';   -- bảo vệ ca đêm
  ngay uuid := '99990000-0000-0000-0000-000000120003';   -- bảo vệ ca ngày
  ba   uuid := '99990000-0000-0000-0000-000000120004';   -- người thứ ba
  cu   uuid := '99990000-0000-0000-0000-00000012000a';   -- cư dân
  la   uuid := '99990000-0000-0000-0000-00000012000b';   -- nhân sự dự án khác
  u1 uuid; ux uuid;
  ca_d uuid; ca_n uuid; ca_x uuid;
  p_dem uuid; p_ngay uuid; p_ba uuid; p_la uuid; p_dem2 uuid; bg2 uuid;
  yc1 uuid; yc2 uuid; yc_xong uuid; yc_khac uuid;
  bg uuid; r record; n int;
begin
  insert into projects (id, name) values (p_c, 'Khu ca truc'), (p_x, 'Khu khac');
  insert into buildings (id, project_id, code, name) values
    (t_c, p_c, 'C1', 'Toa C1'), (t_x, p_x, 'X1', 'Toa X1');
  insert into units (building_id, code, floor_no) values (t_c,'C1-01.01',1), (t_x,'X1-01.01',1);
  select id into u1 from units where building_id = t_c;
  select id into ux from units where building_id = t_x;

  insert into profiles (id, full_name, phone) values
    (bql,'Truong BQL C','0900000160'), (dem,'Bao ve ca dem','0900000161'),
    (ngay,'Bao ve ca ngay','0900000162'), (ba,'Bao ve thu ba','0900000163'),
    (cu,'Cu dan','0900000164'), (la,'Nhan su du an khac','0900000165');
  insert into staff_assignments (user_id, project_id, role) values
    (bql, p_c, 'bql_manager'), (dem, p_c, 'security'),
    (ngay, p_c, 'security'), (ba, p_c, 'security'), (la, p_x, 'security');
  insert into unit_memberships (unit_id, user_id, role, status) values (u1, cu, 'owner', 'active');

  insert into ca_truc (project_id, ten, bat_dau, ket_thuc) values
    (p_c, 'Ca dem', time '18:00', time '06:00') returning id into ca_d;
  insert into ca_truc (project_id, ten, bat_dau, ket_thuc) values
    (p_c, 'Ca ngay', time '06:00', time '18:00') returning id into ca_n;
  insert into ca_truc (project_id, ten, bat_dau, ket_thuc) values
    (p_x, 'Ca ngay X', time '06:00', time '18:00') returning id into ca_x;

  insert into tickets (unit_id, building_id, project_id, reporter_id, category, title, status)
    values (u1, t_c, p_c, cu, 'dien_nuoc', 'Bom tang ham keu bat thuong', 'new')
    returning id into yc1;
  insert into tickets (unit_id, building_id, project_id, reporter_id, category, title, status)
    values (u1, t_c, p_c, cu, 've_sinh', 'Rac tang 12 chua don', 'assigned')
    returning id into yc2;
  insert into tickets (unit_id, building_id, project_id, reporter_id, category, title, status)
    values (u1, t_c, p_c, cu, 'khac', 'Viec da xong dem qua', 'resolved')
    returning id into yc_xong;
  insert into tickets (unit_id, building_id, project_id, reporter_id, category, title, status)
    values (ux, t_x, p_x, cu, 'khac', 'Viec cua du an khac', 'new')
    returning id into yc_khac;

  -- ── 1. Ai vào ca được ──
  perform set_config('test.uid', cu::text, true);
  begin
    perform vao_ca(ca_d);
    raise exception 'FAIL 1: cu dan vao ca truc duoc';
  exception when sqlstate '42501' then null;
  end;
  perform set_config('test.uid', la::text, true);
  begin
    perform vao_ca(ca_d);
    raise exception 'FAIL 1b: nhan su du an KHAC vao ca duoc';
  exception when sqlstate '42501' then null;
  end;

  perform set_config('test.uid', dem::text, true);
  p_dem := vao_ca(ca_d);
  if p_dem is null then raise exception 'FAIL 1c: bao ve khong vao ca duoc'; end if;
  -- Một người không trực hai chỗ cùng lúc.
  begin
    perform vao_ca(ca_n);
    raise exception 'FAIL 1d: vao duoc ca thu hai khi ca thu nhat chua ket';
  exception when sqlstate '23505' then null;
  end;
  -- Ca đã ngừng dùng thì không vào được.
  update ca_truc set dang_dung = false where id = ca_n;
  perform set_config('test.uid', ngay::text, true);
  begin
    perform vao_ca(ca_n);
    raise exception 'FAIL 1e: vao duoc ca da ngung dung';
  exception when check_violation then null;
  end;
  update ca_truc set dang_dung = true where id = ca_n;
  p_ngay := vao_ca(ca_n);

  -- ── 2. Ai viết biên bản ──
  -- Trưởng BQL viết hộ thì dòng "ca đêm đã báo" thành lời của người không có mặt.
  perform set_config('test.uid', bql::text, true);
  begin
    perform ban_giao_ca(p_dem, p_ngay, 'BQL viet ho');
    raise exception 'FAIL 2: nguoi khac viet duoc bien ban cua ca dem';
  exception when sqlstate '42501' then null;
  end;
  perform set_config('test.uid', dem::text, true);
  begin
    perform ban_giao_ca(p_dem, p_ngay, '   ');
    raise exception 'FAIL 2b: ban giao duoc ma khong ghi tinh hinh';
  exception when sqlstate '22023' then null;
  end;
  -- Bàn giao cho chính mình là một biên bản không chứng minh được gì.
  begin
    perform ban_giao_ca(p_dem, p_dem, 'Toi ban giao cho toi');
    raise exception 'FAIL 2c: ban giao duoc cho chinh phien cua minh';
  exception when check_violation then null;
  end;

  -- ── 3. Việc chuyển tiếp phải là YÊU CẦU CÓ THẬT và CÒN MỞ ──
  begin
    perform ban_giao_ca(p_dem, p_ngay, 'Co viec chuyen tiep', array[yc_khac]);
    raise exception 'FAIL 3: chuyen tiep duoc yeu cau cua du an khac';
  exception when sqlstate '42501' then null;
  end;
  begin
    perform ban_giao_ca(p_dem, p_ngay, 'Co viec chuyen tiep', array[yc_xong]);
    raise exception 'FAIL 3b: chuyen tiep duoc yeu cau da xong (rac trong danh sach)';
  exception when sqlstate '42501' then null;
  end;

  bg := ban_giao_ca(p_dem, p_ngay,
    'Bom tang ham keu bat thuong tu 2h. Da tat luan phien, cho ky thuat sang.',
    array[yc1, yc2]);
  select count(*) into n from ban_giao_ca_viec where ban_giao_id = bg;
  if n <> 2 then raise exception 'FAIL 3c: luu % viec chuyen tiep thay vi 2', n; end if;
  -- Con số việc chuyển tiếp phải ĐẾM RA TỪ DỮ LIỆU. Một ô chữ tự do thì "3 việc"
  -- chỉ là một số người ta tự gõ, và ca sau không bấm mở được việc nào.
  select so_viec into r from ban_giao_chua_ky(p_c) where id = bg;
  if r.so_viec <> 2 then raise exception 'FAIL 3d: dem % viec thay vi 2', r.so_viec; end if;
  select count(*) into n from viec_ban_giao(bg);
  if n <> 2 then raise exception 'FAIL 3e: viec_ban_giao tra ve % dong thay vi 2', n; end if;

  -- ── 4. RA CA gắn liền với ĐÃ BÀN GIAO ──
  -- Tách hai việc đó là mở đúng cánh cửa mà tính năng này sinh ra để đóng.
  select ra_luc into r from phien_truc where id = p_dem;
  if r.ra_luc is null then
    raise exception 'FAIL 4: ban giao xong ma ca dem van dang truc';
  end if;
  select count(*) into n from dang_truc(p_c);
  if n <> 1 then raise exception 'FAIL 4b: dang_truc bao % nguoi thay vi 1', n; end if;
  select nguoi_id into r from dang_truc(p_c);
  if r.nguoi_id <> ngay then raise exception 'FAIL 4c: dang_truc chi sai nguoi'; end if;
  -- Ca đã kết thì không bàn giao lần nữa.
  begin
    perform ban_giao_ca(p_dem, p_ngay, 'Ban giao lan hai');
    raise exception 'FAIL 4d: ban giao duoc hai lan tu mot phien da ket';
  exception when check_violation then null;
  end;

  -- ── 5. NGƯỜI NHẬN ca ký, không phải người giao ──
  -- Ký một mình thì "tôi đã báo rồi" và "tôi chưa nghe ai nói gì" vẫn là hai lời
  -- khai không có gì phân xử.
  perform set_config('test.uid', dem::text, true);
  begin
    perform ky_nhan_ca(bg);
    raise exception 'FAIL 5: nguoi GIAO ca ky nhan duoc bien ban cua chinh minh';
  exception when sqlstate '42501' then null;
  end;
  perform set_config('test.uid', bql::text, true);
  begin
    perform ky_nhan_ca(bg);
    raise exception 'FAIL 5b: nguoi ngoai cuoc ky nhan duoc';
  exception when sqlstate '42501' then null;
  end;
  perform set_config('test.uid', ngay::text, true);
  perform ky_nhan_ca(bg);
  select ky_nhan_luc, ky_nhan_boi into r from ban_giao_ca where id = bg;
  if r.ky_nhan_luc is null or r.ky_nhan_boi <> ngay then
    raise exception 'FAIL 5c: khong ghi lai ai ky nhan';
  end if;
  begin
    perform ky_nhan_ca(bg);
    raise exception 'FAIL 5d: ky nhan duoc hai lan';
  exception when sqlstate '23505' then null;
  end;

  -- ── 6. Biên bản CHƯA KÝ là màn quan trọng nhất ──
  select count(*) into n from ban_giao_chua_ky(p_c);
  if n <> 0 then raise exception 'FAIL 6: da ky ma van nam trong danh sach chua ky (%)', n; end if;
  -- Dựng một biên bản nữa và để nguyên không ký.
  perform set_config('test.uid', ba::text, true);
  p_ba := vao_ca(ca_d, current_date + 1);
  perform set_config('test.uid', ngay::text, true);
  bg2 := ban_giao_ca(p_ngay, p_ba, 'Ban giao chieu, chua ai ky', array[yc2]);
  select count(*) into n from ban_giao_chua_ky(p_c);
  if n <> 1 then raise exception 'FAIL 6b: bien ban chua ky khong hien ra (% dong)', n; end if;
  select gio_cho into r from ban_giao_chua_ky(p_c);
  if r.gio_cho is null then raise exception 'FAIL 6c: khong noi da cho bao lau'; end if;
  -- Nút "ký nhận" chỉ được hiện cho ĐÚNG người nhận ca. Hiện cho cả tòa thì
  -- người khác bấm vào và chỉ nhận về một lỗi quyền — màn hình hứa một việc rồi
  -- từ chối làm việc đó.
  perform set_config('test.uid', ba::text, true);
  select cho_toi_ky into r from ban_giao_chua_ky(p_c);
  if not r.cho_toi_ky then raise exception 'FAIL 6g: nguoi nhan ca khong duoc moi ky'; end if;
  perform set_config('test.uid', dem::text, true);
  select cho_toi_ky into r from ban_giao_chua_ky(p_c);
  if r.cho_toi_ky then raise exception 'FAIL 6h: moi ca nguoi khong lien quan ky nhan'; end if;
  -- Việc của biên bản NÀO thì thuộc biên bản đó. Trộn chung là ca sau mở biên
  -- bản của mình ra rồi đi làm việc của một ca khác.
  select count(*) into n from viec_ban_giao(bg2);
  if n <> 1 then raise exception 'FAIL 6d: bien ban thu hai co % viec thay vi 1', n; end if;
  select ticket_id into r from viec_ban_giao(bg2);
  if r.ticket_id <> yc2 then raise exception 'FAIL 6e: viec cua bien ban khac lot sang'; end if;
  select count(*) into n from viec_ban_giao(bg);
  if n <> 2 then raise exception 'FAIL 6f: bien ban dau con % viec thay vi 2', n; end if;

  -- ── 7. Kết ca không bàn giao: có lối thoát, nhưng để lại dấu ──
  perform set_config('test.uid', ba::text, true);
  begin
    perform ket_ca_khong_ban_giao(p_ba, '  ');
    raise exception 'FAIL 7: ket ca duoc ma khong ghi ly do';
  exception when sqlstate '22023' then null;
  end;
  perform set_config('test.uid', dem::text, true);
  begin
    perform ket_ca_khong_ban_giao(p_ba, 'Toi ket ho ca cua nguoi khac');
    raise exception 'FAIL 7b: ket duoc ca cua nguoi khac';
  exception when sqlstate '42501' then null;
  end;
  perform set_config('test.uid', ba::text, true);
  perform ket_ca_khong_ban_giao(p_ba, 'Ca sau khong ai toi, da bao truong BQL');
  select ra_luc, ly_do_khong_ban_giao into r from phien_truc where id = p_ba;
  if r.ra_luc is null or r.ly_do_khong_ban_giao is null then
    raise exception 'FAIL 7c: ket ca ma khong luu lai ly do';
  end if;
  begin
    perform ket_ca_khong_ban_giao(p_ba, 'Ket lan hai');
    raise exception 'FAIL 7d: ket duoc mot ca hai lan';
  exception when sqlstate '23505' then null;
  end;

  -- ── 7b. Không bàn giao được vào chỗ trống ──
  -- Người ca sau đã kết ca rồi thì biên bản gửi cho họ là gửi vào hư không, và
  -- ca ra vẫn yên tâm là "đã bàn giao xong".
  perform set_config('test.uid', la::text, true);
  p_la := vao_ca(ca_x);
  perform set_config('test.uid', dem::text, true);
  p_dem2 := vao_ca(ca_d, current_date + 2);
  begin
    perform ban_giao_ca(p_dem2, p_ba, 'Nguoi kia da ket ca roi');
    raise exception 'FAIL 7e: ban giao duoc cho nguoi da ket ca';
  exception when check_violation then null;
  end;
  -- Và không bàn giao xuyên dự án: hai tòa khác nhau thì ca của bên này không
  -- nhận được việc của bên kia.
  begin
    perform ban_giao_ca(p_dem2, p_la, 'Ban giao sang du an khac');
    raise exception 'FAIL 7f: ban giao duoc cho phien truc cua du an khac';
  exception when sqlstate '42501' then null;
  end;
  perform ket_ca_khong_ban_giao(p_dem2, 'Ca thu nghiem, dong lai');

  -- ── 8. Sổ bàn giao đọc được theo khoảng ngày ──
  perform set_config('test.uid', bql::text, true);
  select count(*) into n from so_ban_giao_ca(p_c, current_date - 1, current_date + 1);
  if n <> 2 then raise exception 'FAIL 8: so ban giao co % bien ban thay vi 2', n; end if;
  select count(*) into n from so_ban_giao_ca(p_c, current_date - 30, current_date - 20);
  if n <> 0 then raise exception 'FAIL 8b: khoang ngay khong loc gi (% dong)', n; end if;

  -- ── 9. Neo vào nhật ký kiểm toán ──
  select count(*) into n from audit_log where project_id = p_c and bang = 'ban_giao_ca';
  if n = 0 then raise exception 'FAIL 9: ban giao ca khong vao nhat ky'; end if;
  select count(*) into n from audit_log where project_id = p_c and bang = 'phien_truc';
  if n = 0 then raise exception 'FAIL 9b: vao/ra ca khong vao nhat ky'; end if;

  -- ── 10. RLS: cư dân không đọc được gì của khối này ──
  -- Công khai ai trực đêm nào là công khai lúc nào tòa nhà mỏng người nhất.
  begin execute 'create role vb_ct_test nologin'; exception when duplicate_object then null; end;
  execute 'grant usage on schema public to vb_ct_test';
  execute 'grant select on ca_truc, phien_truc, ban_giao_ca, ban_giao_ca_viec to vb_ct_test';
  execute 'grant execute on function is_staff(uuid) to vb_ct_test';
  execute 'set local role vb_ct_test';

  perform set_config('test.uid', cu::text, true);
  select count(*) into n from phien_truc;
  if n <> 0 then raise exception 'FAIL 10: cu dan doc duoc % phien truc', n; end if;
  select count(*) into n from ban_giao_ca;
  if n <> 0 then raise exception 'FAIL 10b: cu dan doc duoc % bien ban ban giao', n; end if;
  select count(*) into n from ca_truc;
  if n <> 0 then raise exception 'FAIL 10c: cu dan doc duoc % ca truc', n; end if;
  -- Nhân sự dự án khác cũng không thấy gì của dự án này.
  perform set_config('test.uid', la::text, true);
  select count(*) into n from ban_giao_ca;
  if n <> 0 then raise exception 'FAIL 10d: nhan su du an khac doc duoc % bien ban', n; end if;
  -- BQL của đúng dự án thì thấy.
  perform set_config('test.uid', bql::text, true);
  select count(*) into n from ban_giao_ca;
  if n <> 2 then raise exception 'FAIL 10e: BQL chi doc duoc % bien ban thay vi 2', n; end if;
  execute 'reset role';

  raise notice 'TEST CA TRUC PASSED — hai ben hai nguoi, viec chuyen tiep neo vao yeu cau that, nguoi NHAN ca ky, va ket ca khong ban giao van de lai dau';
end $test$;
