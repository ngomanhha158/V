-- Smoke test kho vật tư. Chạy sau schema.sql + seed.sql.
--
-- Một lời hứa duy nhất: cuối tháng trả lời được "hết 12 triệu tiền vật tư, dùng
-- cho căn nào". Muốn thế thì tồn phải là TỔNG CỦA SỔ chứ không phải một cột ai
-- cũng sửa được, giá phải đóng băng lúc xuất, và mỗi lần xuất phải neo vào một
-- yêu cầu hoặc ít nhất một dòng lý do.

do $test$
declare
  p_k  uuid := 'aaaaaaaa-0000-0000-0000-000000130000';
  t_k  uuid := 'bbbbbbbb-0000-0000-0000-000000130001';
  p_x  uuid := 'aaaaaaaa-0000-0000-0000-000000130009';
  t_x  uuid := 'bbbbbbbb-0000-0000-0000-000000130009';
  bql  uuid := '99990000-0000-0000-0000-000000130001';
  ky   uuid := '99990000-0000-0000-0000-000000130002';   -- kỹ thuật
  cu   uuid := '99990000-0000-0000-0000-00000013000a';
  u1 uuid; ux uuid; vt_led uuid; vt_gioang uuid; vt_x uuid;
  yc uuid; yc2 uuid; yc_x uuid; pn uuid; pn2 uuid; px uuid; kq jsonb;
  r record; n int; m numeric;
begin
  insert into projects (id, name) values (p_k, 'Khu kho'), (p_x, 'Khu khac');
  insert into buildings (id, project_id, code, name) values
    (t_k, p_k, 'K1', 'Toa K1'), (t_x, p_x, 'X1', 'Toa X1');
  insert into units (building_id, code, floor_no) values (t_k,'K1-01.01',1), (t_x,'X1-01.01',1);
  select id into u1 from units where building_id = t_k;
  select id into ux from units where building_id = t_x;

  insert into profiles (id, full_name, phone) values
    (bql,'Truong BQL K','0900000170'), (ky,'Ky thuat','0900000171'), (cu,'Cu dan','0900000172');
  insert into staff_assignments (user_id, project_id, role) values
    (bql, p_k, 'bql_manager'), (ky, p_k, 'technician');
  insert into unit_memberships (unit_id, user_id, role, status) values (u1, cu, 'owner', 'active');

  insert into vat_tu (project_id, ma, ten, don_vi, ton_toi_thieu)
    values (p_k, 'LED9', 'Bong LED 9W', 'cai', 10) returning id into vt_led;
  insert into vat_tu (project_id, ma, ten, don_vi, ton_toi_thieu)
    values (p_k, 'GIOANG', 'Gioang voi nuoc', 'cai', 5) returning id into vt_gioang;
  insert into vat_tu (project_id, ma, ten, don_vi)
    values (p_x, 'XX', 'Vat tu du an khac', 'cai') returning id into vt_x;

  insert into tickets (unit_id, building_id, project_id, reporter_id, category, title, status)
    values (u1, t_k, p_k, cu, 'dien_nuoc', 'Bong den hanh lang chay', 'assigned')
    returning id into yc;
  insert into tickets (unit_id, building_id, project_id, reporter_id, category, title, status)
    values (ux, t_x, p_x, cu, 'khac', 'Viec du an khac', 'new') returning id into yc_x;

  -- ── 1. Ai nhập/xuất được ──
  perform set_config('test.uid', cu::text, true);
  begin
    perform nhap_kho(p_k, 'Cu dan tu nhap', jsonb_build_array(
      jsonb_build_object('vat_tu', vt_led, 'so_luong', 10, 'don_gia', 20000)));
    raise exception 'FAIL 1: cu dan nhap kho duoc';
  exception when sqlstate '42501' then null;
  end;
  perform set_config('test.uid', ky::text, true);
  begin
    perform nhap_kho(p_k, 'Phieu rong', '[]'::jsonb);
    raise exception 'FAIL 1b: nhap duoc mot phieu khong co dong nao';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform nhap_kho(p_k, 'Nhap vat tu du an khac', jsonb_build_array(
      jsonb_build_object('vat_tu', vt_x, 'so_luong', 5, 'don_gia', 1000)));
    raise exception 'FAIL 1c: nhap duoc vat tu cua du an khac';
  exception when sqlstate '42501' then null;
  end;

  -- ── 2. TỒN LÀ TỔNG CỦA SỔ ──
  pn := nhap_kho(p_k, 'Lo dau, hoa don 001', jsonb_build_array(
    jsonb_build_object('vat_tu', vt_led, 'so_luong', 40, 'don_gia', 20000),
    jsonb_build_object('vat_tu', vt_gioang, 'so_luong', 10, 'don_gia', 8000)));
  m := ton_vat_tu(vt_led);
  if m <> 40 then raise exception 'FAIL 2: ton LED la % thay vi 40', m; end if;
  select tong_tien into r from phieu_kho where id = pn;
  if r.tong_tien <> 880000 then
    raise exception 'FAIL 2b: tong phieu nhap % thay vi 880000', r.tong_tien;
  end if;

  -- ── 3. BÌNH QUÂN GIA QUYỀN, không lấy thẳng giá lô mới ──
  -- 40 cái giá 20.000 + 20 cái giá 26.000 = 60 cái giá 22.000. Lấy thẳng 26.000
  -- là để một lô nhỏ mua đắt kéo giá của cả kho lên theo.
  perform nhap_kho(p_k, 'Lo hai, gia tang', jsonb_build_array(
    jsonb_build_object('vat_tu', vt_led, 'so_luong', 20, 'don_gia', 26000)));
  select don_gia into r from vat_tu where id = vt_led;
  if r.don_gia <> 22000 then
    raise exception 'FAIL 3: gia binh quan la % thay vi 22000', r.don_gia;
  end if;
  m := ton_vat_tu(vt_led);
  if m <> 60 then raise exception 'FAIL 3b: ton sau hai lo la % thay vi 60', m; end if;

  -- ── 4. Xuất phải neo vào YÊU CẦU hoặc ít nhất một lý do ──
  begin
    perform xuat_kho(p_k, null, null, jsonb_build_array(
      jsonb_build_object('vat_tu', vt_led, 'so_luong', 2)));
    raise exception 'FAIL 4: xuat duoc ma khong gan yeu cau lan khong ghi ly do';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform xuat_kho(p_k, yc_x, null, jsonb_build_array(
      jsonb_build_object('vat_tu', vt_led, 'so_luong', 2)));
    raise exception 'FAIL 4b: gan duoc yeu cau cua du an khac';
  exception when sqlstate '42501' then null;
  end;
  begin
    perform xuat_kho(p_k, yc, null, jsonb_build_array(
      jsonb_build_object('vat_tu', vt_x, 'so_luong', 1)));
    raise exception 'FAIL 4b1: xuat duoc vat tu cua du an khac';
  exception when sqlstate '42501' then null;
  end;

  px := xuat_kho(p_k, yc, null, jsonb_build_array(
    jsonb_build_object('vat_tu', vt_led, 'so_luong', 2),
    jsonb_build_object('vat_tu', vt_gioang, 'so_luong', 1)));
  m := ton_vat_tu(vt_led);
  if m <> 58 then raise exception 'FAIL 4c: ton sau khi xuat la % thay vi 58', m; end if;
  -- Giá xuất CHÉP từ giá kho lúc xuất: 2 x 22.000 + 1 x 8.000 = 52.000.
  select tong_tien into r from phieu_kho where id = px;
  if r.tong_tien <> 52000 then
    raise exception 'FAIL 4d: gia tri xuat % thay vi 52000', r.tong_tien;
  end if;
  -- Dòng xuất phải mang dấu ÂM: tồn là tổng cột này, không có phép trừ nào khác.
  select so_luong into r from phieu_kho_dong where phieu_id = px and vat_tu_id = vt_led;
  if r.so_luong <> -2 then
    raise exception 'FAIL 4e: dong xuat luu % thay vi -2', r.so_luong;
  end if;

  -- ── 5. GIÁ ĐÃ XUẤT KHÔNG ĐỔI THEO GIÁ KHO ──
  -- Nhập thêm một lô rất đắt: phiếu xuất cũ phải giữ nguyên giá trị của nó.
  perform nhap_kho(p_k, 'Lo ba, rat dat', jsonb_build_array(
    jsonb_build_object('vat_tu', vt_led, 'so_luong', 58, 'don_gia', 100000)));
  select tong_tien into r from phieu_kho where id = px;
  if r.tong_tien <> 52000 then
    raise exception 'FAIL 5: gia tri phieu xuat cu doi thanh % khi gia kho thay doi', r.tong_tien;
  end if;

  -- ── 6. TỒN ÂM LÀ MỘT LỜI NÓI DỐI ──
  begin
    perform xuat_kho(p_k, yc, null, jsonb_build_array(
      jsonb_build_object('vat_tu', vt_gioang, 'so_luong', 999)));
    raise exception 'FAIL 6: xuat duoc nhieu hon ton';
  exception when check_violation then
    -- Và câu lỗi phải nói ra CÒN BAO NHIÊU: người đứng ở kho cần con số đó để
    -- đi mua, không cần một chữ "lỗi".
    if sqlerrm not like '%chi con 9%' then
      raise exception 'FAIL 6b: chan dung nhung khong noi con bao nhieu: %', sqlerrm;
    end if;
  end;
  -- Và không có dòng rác nào ở lại từ lần xuất hỏng đó.
  m := ton_vat_tu(vt_gioang);
  if m <> 9 then raise exception 'FAIL 6c: ton gioang la % thay vi 9', m; end if;

  -- ── 7. "Đã dùng gì cho căn nào" — câu hỏi cả tính năng sinh ra để trả lời ──
  select count(*) into n from vat_tu_da_dung(yc);
  if n <> 2 then raise exception 'FAIL 7: yeu cau nay dung % vat tu thay vi 2', n; end if;
  select so_luong into r from vat_tu_da_dung(yc) where ma = 'LED9';
  if r.so_luong <> 2 then
    raise exception 'FAIL 7b: bao dung % bong den thay vi 2 (dau am lot ra man hinh?)', r.so_luong;
  end if;

  -- ── 8. Cảnh báo sắp hết ──
  select ton, sap_het into r from ton_kho(p_k) where ma = 'GIOANG';
  if r.ton <> 9 then raise exception 'FAIL 8: ton_kho bao % gioang thay vi 9', r.ton; end if;
  if r.sap_het then raise exception 'FAIL 8b: 9 tren nguong 5 ma bao sap het'; end if;
  perform xuat_kho(p_k, yc, null, jsonb_build_array(
    jsonb_build_object('vat_tu', vt_gioang, 'so_luong', 5)));
  select ton, sap_het into r from ton_kho(p_k) where ma = 'GIOANG';
  if not r.sap_het then raise exception 'FAIL 8c: con 4 duoi nguong 5 ma khong bao sap het'; end if;

  -- ── 9. Kiểm kê: sổ nói một đằng, kệ hàng nói một nẻo ──
  perform set_config('test.uid', ky::text, true);
  begin
    perform kiem_ke_kho(p_k, 'Ky thuat tu kiem ke', jsonb_build_array(
      jsonb_build_object('vat_tu', vt_led, 'thuc_te', 1)));
    raise exception 'FAIL 9: ky thuat kiem ke duoc (day la buoc sua so sach)';
  exception when sqlstate '42501' then null;
  end;
  perform set_config('test.uid', bql::text, true);
  begin
    perform kiem_ke_kho(p_k, '  ', '[]'::jsonb);
    raise exception 'FAIL 9b: kiem ke duoc ma khong ghi ly do';
  exception when sqlstate '22023' then null;
  end;
  -- LED sổ đang 116, đếm thật được 110; gioăng khớp.
  m := ton_vat_tu(vt_led);
  if m <> 116 then raise exception 'FAIL 9c: ton LED truoc kiem ke la % thay vi 116', m; end if;
  kq := kiem_ke_kho(p_k, 'Kiem ke quy III', jsonb_build_array(
    jsonb_build_object('vat_tu', vt_led, 'thuc_te', 110),
    jsonb_build_object('vat_tu', vt_gioang, 'thuc_te', 4)));
  if (kq ->> 'so_vat_tu_lech')::int <> 1 then
    raise exception 'FAIL 9d: bao % vat tu lech thay vi 1 (ghi ca dong khop?)',
      kq ->> 'so_vat_tu_lech';
  end if;
  m := ton_vat_tu(vt_led);
  if m <> 110 then raise exception 'FAIL 9e: sau kiem ke ton la % thay vi 110', m; end if;
  -- Vật tư khớp thì KHÔNG có dòng nào: ghi dòng 0 cho mỗi vật tư là làm ngập sổ
  -- và chôn mất mấy dòng thật sự lệch.
  select count(*) into n from phieu_kho p join phieu_kho_dong d on d.phieu_id = p.id
   where p.loai = 'kiem_ke' and d.vat_tu_id = vt_gioang;
  if n <> 0 then raise exception 'FAIL 9f: ghi dong kiem ke cho vat tu khong lech'; end if;

  -- ── 9b. "Đã dùng cho yêu cầu NÀY" phải lọc đúng hai chiều ──
  insert into tickets (unit_id, building_id, project_id, reporter_id, category, title, status)
    values (u1, t_k, p_k, cu, 'khac', 'Viec thu hai cung du an', 'assigned')
    returning id into yc2;
  perform set_config('test.uid', ky::text, true);
  perform xuat_kho(p_k, yc2, null, jsonb_build_array(
    jsonb_build_object('vat_tu', vt_led, 'so_luong', 3)));
  -- Yêu cầu 1 đã dùng: 2 LED + 1 gioăng (phiếu px) + 5 gioăng (bài 8) = 3 dòng.
  -- Ba LED của yêu cầu 2 KHÔNG được lọt sang.
  select count(*) into n from vat_tu_da_dung(yc);
  if n <> 3 then raise exception 'FAIL 9g: yeu cau 1 dung % dong thay vi 3', n; end if;
  select count(*) into n from vat_tu_da_dung(yc2);
  if n <> 1 then raise exception 'FAIL 9h: yeu cau 2 dung % dong thay vi 1', n; end if;

  -- Dựng THẲNG bằng SQL một phiếu NHẬP có gắn yêu cầu. API không tạo ra ca này,
  -- nhưng cột ticket_id có mặt trên MỌI loại phiếu, nên hàm đọc phải lọc theo
  -- `loai` chứ không chỉ theo ticket — nếu không thì hàng nhập về kho sẽ hiện ra
  -- như hàng đã dùng cho căn đó.
  insert into phieu_kho (project_id, loai, ticket_id, nguoi_id)
    values (p_k, 'nhap', yc, bql) returning id into pn2;
  insert into phieu_kho_dong (phieu_id, vat_tu_id, so_luong, don_gia, thanh_tien)
    values (pn2, vt_led, 5, 22000, 110000);
  select count(*) into n from vat_tu_da_dung(yc);
  if n <> 3 then
    raise exception 'FAIL 9i: phieu NHAP lot vao danh sach da dung (% dong)', n;
  end if;

  -- ── 10. Sổ kho lọc theo khoảng ngày và nói ra phiếu gắn với căn nào ──
  select count(*) into n from so_kho(p_k, current_date, current_date);
  if n < 6 then raise exception 'FAIL 10: so kho co % phieu, it hon thuc te', n; end if;
  select count(*) into n from so_kho(p_k, current_date - 30, current_date - 20);
  if n <> 0 then raise exception 'FAIL 10b: khoang ngay khong loc gi (% phieu)', n; end if;
  select ma_can, tieu_de_yc into r from so_kho(p_k, current_date, current_date)
   where phieu_id = px;
  if r.ma_can is distinct from 'K1-01.01' then
    raise exception 'FAIL 10c: phieu xuat khong noi duoc dung cho can nao (%)', r.ma_can;
  end if;
  select count(*) into n from dong_phieu_kho(px);
  if n <> 2 then raise exception 'FAIL 10d: phieu xuat co % dong thay vi 2', n; end if;

  -- ── 11. Neo vào nhật ký kiểm toán ──
  select count(*) into n from audit_log where project_id = p_k and bang = 'phieu_kho';
  if n = 0 then raise exception 'FAIL 11: phieu kho khong vao nhat ky'; end if;

  -- ── 12. RLS: cư dân không thấy gì của kho ──
  begin execute 'create role vb_kho_test nologin'; exception when duplicate_object then null; end;
  execute 'grant usage on schema public to vb_kho_test';
  execute 'grant select on vat_tu, phieu_kho, phieu_kho_dong to vb_kho_test';
  execute 'grant execute on function is_staff(uuid) to vb_kho_test';
  execute 'set local role vb_kho_test';

  perform set_config('test.uid', cu::text, true);
  select count(*) into n from vat_tu;
  if n <> 0 then raise exception 'FAIL 12: cu dan doc duoc % vat tu', n; end if;
  select count(*) into n from phieu_kho;
  if n <> 0 then raise exception 'FAIL 12b: cu dan doc duoc % phieu kho', n; end if;
  select count(*) into n from phieu_kho_dong;
  if n <> 0 then raise exception 'FAIL 12c: cu dan doc duoc % dong phieu kho', n; end if;
  perform set_config('test.uid', bql::text, true);
  select count(*) into n from vat_tu;
  if n <> 2 then raise exception 'FAIL 12d: BQL chi doc duoc % vat tu thay vi 2', n; end if;
  execute 'reset role';

  raise notice 'TEST KHO PASSED — ton la tong cua so, gia dong bang luc xuat, khong xuat qua ton, va moi lan xuat deu tra loi duoc dung cho can nao';
end $test$;
