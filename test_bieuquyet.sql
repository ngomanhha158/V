-- Smoke test biểu quyết hội nghị nhà chung cư. Chạy sau schema.sql + seed.sql.
--
-- Cả tính năng chỉ để trả lời được MỘT câu hỏi trước mặt 468 hộ dân: "nghị
-- quyết này thông qua chưa, và dựa vào đâu mà nói thế". Bài test này vì thế
-- xoáy vào ba chỗ mà kiểm phiếu tay hay sai và sai xong không ai phát hiện:
--   · lấy nhầm mẫu số giữa HAI ngưỡng (dự họp / thông qua);
--   · bỏ phiếu trắng ra khỏi mẫu số thông qua;
--   · để diện tích đổi giữa chừng làm kết quả đổi qua đêm.

do $test$
declare
  p_h  uuid := 'aaaaaaaa-0000-0000-0000-000000100000';
  t_h  uuid := 'bbbbbbbb-0000-0000-0000-000000100001';
  p_x  uuid := 'aaaaaaaa-0000-0000-0000-000000100009';   -- dự án khác
  t_x  uuid := 'bbbbbbbb-0000-0000-0000-000000100009';
  bql  uuid := '99990000-0000-0000-0000-000000100001';
  bqt  uuid := '99990000-0000-0000-0000-000000100002';
  cu1  uuid := '99990000-0000-0000-0000-00000010000a';
  cu2  uuid := '99990000-0000-0000-0000-00000010000b';
  cu3  uuid := '99990000-0000-0000-0000-00000010000c';
  cu4  uuid := '99990000-0000-0000-0000-00000010000d';
  thue uuid := '99990000-0000-0000-0000-00000010000e';   -- người thuê u1
  ngoai uuid := '99990000-0000-0000-0000-00000010000f';  -- chủ căn dự án khác
  u1 uuid; u2 uuid; u3 uuid; u4 uuid; u5 uuid; ux uuid;
  bq1 uuid; bq2 uuid; bq3 uuid; ph uuid; kq jsonb;
  k record; r record; n int; d numeric;
begin
  insert into projects (id, name) values (p_h, 'Khu hoi nghi'), (p_x, 'Khu khac');
  insert into buildings (id, project_id, code, name) values
    (t_h, p_h, 'H1', 'Toa H1'), (t_x, p_x, 'X1', 'Toa X1');
  -- Diện tích cố ý LỆCH NHAU HẲN: 100/50/30/20 trên tổng 200. Bốn căn bằng
  -- nhau thì phiếu theo diện tích và phiếu một-căn-một-lá cho ra cùng một con
  -- số, và bài test không phân biệt được hai luật.
  insert into units (building_id, code, floor_no, area_m2) values
    (t_h,'H1-01.01',1,100), (t_h,'H1-01.02',1,50),
    (t_h,'H1-02.01',2,30),  (t_h,'H1-02.02',2,20);
  insert into units (building_id, code, floor_no, area_m2) values (t_x,'X1-01.01',1,70);
  select id into u1 from units where building_id = t_h and code = 'H1-01.01';
  select id into u2 from units where building_id = t_h and code = 'H1-01.02';
  select id into u3 from units where building_id = t_h and code = 'H1-02.01';
  select id into u4 from units where building_id = t_h and code = 'H1-02.02';
  select id into ux from units where building_id = t_x and code = 'X1-01.01';

  insert into profiles (id, full_name, phone) values
    (bql,'Truong BQL H','0900000140'), (bqt,'Thanh vien BQT H','0900000141'),
    (cu1,'Chu can 1','0900000142'), (cu2,'Chu can 2','0900000143'),
    (cu3,'Chu can 3','0900000144'), (cu4,'Chu can 4','0900000145'),
    (thue,'Nguoi thue can 1','0900000146'), (ngoai,'Chu can du an khac','0900000147');
  insert into staff_assignments (user_id, project_id, role) values
    (bql, p_h, 'bql_manager'), (bqt, p_h, 'bqt');
  insert into unit_memberships (unit_id, user_id, role, status) values
    (u1, cu1, 'owner', 'active'), (u2, cu2, 'owner', 'active'),
    (u3, cu3, 'owner', 'active'), (u4, cu4, 'owner', 'active'),
    (u1, thue, 'tenant', 'active'), (ux, ngoai, 'owner', 'active'),
    -- cu1 còn được ủy quyền cho căn 3: chủ nhiều căn là người dễ bỏ sót nhất.
    (u3, cu1, 'authorized', 'active');

  -- ── 1. Thiếu diện tích một căn là CHẶN, không phải cảnh báo ──
  -- Mẫu số sai thì mọi tỷ lệ tính ra đều cãi được. Thà không mở được cuộc họp
  -- còn hơn mở xong rồi cả hội nghị tranh nhau con số.
  insert into units (building_id, code, floor_no, area_m2)
    values (t_h,'H1-03.01',3,null) returning id into u5;
  perform set_config('test.uid', bql::text, true);
  begin
    perform mo_bieu_quyet(p_h, 'Thu mo khi thieu dien tich');
    raise exception 'FAIL 1: mo duoc bieu quyet khi con can chua co dien tich';
  exception when sqlstate '22023' then null;
  end;
  -- Diện tích 0 cũng là thiếu: nhập 0 để "cho qua màn hình" là cách phổ biến
  -- nhất để lách một ô bắt buộc.
  update units set area_m2 = 0 where id = u5;
  begin
    perform mo_bieu_quyet(p_h, 'Thu mo khi dien tich bang 0');
    raise exception 'FAIL 1b: mo duoc bieu quyet khi co can dien tich 0';
  exception when sqlstate '22023' then null;
  end;
  delete from units where id = u5;

  -- ── 2. Ai mở được ──
  perform set_config('test.uid', cu1::text, true);
  begin
    perform mo_bieu_quyet(p_h, 'Cu dan tu mo hoi nghi');
    raise exception 'FAIL 2: cu dan mo duoc cuoc bieu quyet';
  exception when sqlstate '42501' then null;
  end;
  perform set_config('test.uid', bql::text, true);
  begin
    perform mo_bieu_quyet(p_h, '   ');
    raise exception 'FAIL 2b: mo duoc cuoc bieu quyet khong co tieu de';
  exception when sqlstate '22023' then null;
  end;

  -- ── 3. Mở cuộc: mẫu số đóng băng ngay lúc mở ──
  bq1 := mo_bieu_quyet(p_h, 'Thay don vi quan ly', 'Nhiem ky 2026-2028', 50, 60);
  select tong_dien_tich, so_can into r from bieu_quyet where id = bq1;
  if r.tong_dien_tich <> 200 then
    raise exception 'FAIL 3: tong dien tich dong bang la % thay vi 200', r.tong_dien_tich;
  end if;
  if r.so_can <> 4 then raise exception 'FAIL 3b: so can la % thay vi 4', r.so_can; end if;
  select count(*) into n from bieu_quyet_can where bieu_quyet_id = bq1;
  if n <> 4 then raise exception 'FAIL 3c: danh sach can dong bang co % dong thay vi 4', n; end if;

  -- ── 4. Ai bỏ phiếu được ──
  -- Người thuê KHÔNG bỏ phiếu. Nghị quyết có phiếu của người thuê là nghị quyết
  -- bị bác ngay khi có người soi lại.
  perform set_config('test.uid', thue::text, true);
  begin
    perform bo_phieu_bieu_quyet(bq1, u1, 'tan_thanh');
    raise exception 'FAIL 4: nguoi thue bo phieu duoc';
  exception when sqlstate '42501' then null;
  end;
  -- Chủ căn của DỰ ÁN KHÁC: qua được cửa "có phải chủ không" nhưng phải chết ở
  -- cửa "căn này có trong danh sách không". Hai cửa khác nhau, và lời báo lỗi
  -- phải nói đúng cửa nào — nếu không thì ngày có sự cố không ai lần được.
  perform set_config('test.uid', ngoai::text, true);
  begin
    perform bo_phieu_bieu_quyet(bq1, ux, 'tan_thanh');
    raise exception 'FAIL 4b: bo phieu duoc cho can ngoai danh sach';
  exception when sqlstate '42501' then
    if sqlerrm not like '%khong nam trong danh sach%' then
      raise exception 'FAIL 4c: chan dung nhung bao sai cua: %', sqlerrm;
    end if;
  end;
  perform set_config('test.uid', cu1::text, true);
  begin
    perform bo_phieu_bieu_quyet(bq1, u1, 'phan_doi');
    raise exception 'FAIL 4d: nhan y kien khong hop le';
  exception when sqlstate '22023' then null;
  end;

  -- ── 5. HAI NGƯỠNG, HAI MẪU SỐ ──
  perform bo_phieu_bieu_quyet(bq1, u1, 'tan_thanh');       -- 100 m2
  perform set_config('test.uid', cu2::text, true);
  perform bo_phieu_bieu_quyet(bq1, u2, 'khong_tan_thanh'); -- 50 m2
  select * into k from kiem_phieu_bieu_quyet(bq1);
  if k.dien_tich_bo_phieu <> 150 then
    raise exception 'FAIL 5: dien tich da bo phieu la % thay vi 150', k.dien_tich_bo_phieu;
  end if;
  if k.so_can_da_bo <> 2 then raise exception 'FAIL 5b: dem % can thay vi 2', k.so_can_da_bo; end if;
  -- Dự họp = 150/200 toàn khu.
  if k.ty_le_du_hop <> 75.00 then
    raise exception 'FAIL 5c: ty le du hop % thay vi 75.00', k.ty_le_du_hop;
  end if;
  -- Thông qua = 100/150 ĐÃ BỎ PHIẾU. Lấy nhầm mẫu số toàn khu ra 50.00, và
  -- 50.00 < 60 nên nghị quyết bị đánh trượt oan.
  if k.ty_le_tan_thanh <> 66.67 then
    raise exception 'FAIL 5d: ty le tan thanh % thay vi 66.67 (lay nham mau so?)', k.ty_le_tan_thanh;
  end if;
  if not k.du_hop then raise exception 'FAIL 5e: 75%% dien tich ma bao chua du hop'; end if;
  if not k.thong_qua then raise exception 'FAIL 5f: 66.67%% tan thanh tren nguong 60 ma bao khong thong qua'; end if;

  -- ── 6. Một căn một phiếu còn hiệu lực ──
  perform set_config('test.uid', cu1::text, true);
  begin
    perform bo_phieu_bieu_quyet(bq1, u1, 'khong_tan_thanh');
    raise exception 'FAIL 6: mot can bo duoc hai phieu';
  exception when unique_violation then null;
  end;

  -- ── 7. Hủy phiếu: có tên người hủy, và phiếu đã hủy KHÔNG còn được đếm ──
  select id into ph from phieu_bieu_quyet
   where bieu_quyet_id = bq1 and unit_id = u1 and huy_luc is null;
  begin
    perform huy_phieu_bieu_quyet(ph, 'Toi doi y');
    raise exception 'FAIL 7: cu dan tu huy duoc phieu';
  exception when sqlstate '42501' then null;
  end;
  perform set_config('test.uid', bqt::text, true);
  begin
    perform huy_phieu_bieu_quyet(ph, '  ');
    raise exception 'FAIL 7b: huy phieu duoc ma khong ghi ly do';
  exception when sqlstate '22023' then null;
  end;
  perform huy_phieu_bieu_quyet(ph, 'Chu can bao bam nham nut');
  begin
    perform huy_phieu_bieu_quyet(ph, 'Huy lan hai');
    raise exception 'FAIL 7c: huy duoc mot phieu hai lan';
  exception when sqlstate '23505' then null;
  end;
  -- Bỏ lại được, và lần này khác ý.
  perform set_config('test.uid', cu1::text, true);
  perform bo_phieu_bieu_quyet(bq1, u1, 'khong_tan_thanh');
  select * into k from kiem_phieu_bieu_quyet(bq1);
  -- Phiếu cũ còn được đếm thì ra 200 m2 trên tổng 200 — tức 4 căn bỏ phiếu
  -- trong khi mới có 2 căn bỏ.
  if k.dien_tich_bo_phieu <> 150 then
    raise exception 'FAIL 7d: phieu da huy van duoc dem (% m2)', k.dien_tich_bo_phieu;
  end if;
  if k.tan_thanh <> 0 or k.khong_tan_thanh <> 150 then
    raise exception 'FAIL 7e: tan thanh % / khong tan thanh % thay vi 0 / 150',
      k.tan_thanh, k.khong_tan_thanh;
  end if;
  if k.thong_qua then raise exception 'FAIL 7f: 0%% tan thanh ma bao thong qua'; end if;

  -- ── 8. Đóng cuộc: kết quả CHỐT lại, không tính lại về sau ──
  perform set_config('test.uid', cu1::text, true);
  begin
    perform dong_bieu_quyet(bq1);
    raise exception 'FAIL 8: cu dan dong duoc cuoc bieu quyet';
  exception when sqlstate '42501' then null;
  end;
  perform set_config('test.uid', bql::text, true);
  kq := dong_bieu_quyet(bq1);
  if (kq ->> 'du_hop')::boolean is not true then raise exception 'FAIL 8b: dong xong bao chua du hop'; end if;
  if (kq ->> 'thong_qua')::boolean is not false then raise exception 'FAIL 8c: dong xong bao thong qua'; end if;
  select kq_dien_tich_bo_phieu, kq_tan_thanh, kq_khong_tan_thanh, kq_trang,
         kq_du_hop, kq_thong_qua into r from bieu_quyet where id = bq1;
  if r.kq_dien_tich_bo_phieu <> 150 or r.kq_tan_thanh <> 0
     or r.kq_khong_tan_thanh <> 150 or r.kq_trang <> 0 then
    raise exception 'FAIL 8d: ket qua chot khong khop voi kiem phieu';
  end if;
  if r.kq_du_hop is not true or r.kq_thong_qua is not false then
    raise exception 'FAIL 8e: co ket qua chot nhung sai';
  end if;
  -- Đóng rồi là đóng: mọi cửa ghi đều khóa.
  begin
    perform dong_bieu_quyet(bq1);
    raise exception 'FAIL 8f: dong duoc hai lan';
  exception when sqlstate '23505' then null;
  end;
  begin
    perform huy_bieu_quyet(bq1, 'Doi y sau khi cong bo');
    raise exception 'FAIL 8g: huy duoc cuoc da dong (xoa mot nghi quyet da co hieu luc)';
  exception when check_violation then null;
  end;
  select id into ph from phieu_bieu_quyet
   where bieu_quyet_id = bq1 and unit_id = u2 and huy_luc is null;
  begin
    perform huy_phieu_bieu_quyet(ph, 'Sua ket qua da cong bo');
    raise exception 'FAIL 8h: huy duoc phieu sau khi da dong';
  exception when check_violation then null;
  end;
  perform set_config('test.uid', cu3::text, true);
  begin
    perform bo_phieu_bieu_quyet(bq1, u3, 'tan_thanh');
    raise exception 'FAIL 8i: bo phieu duoc sau khi da dong';
  exception when check_violation then null;
  end;

  -- ── 9. Không đủ dự họp thì KHÔNG thông qua, dù 100% tán thành ──
  -- Đây là chỗ mà gộp hai ngưỡng làm một sẽ lộ: 30/200 = 15% dự họp, nhưng
  -- 30/30 = 100% tán thành. Bỏ điều kiện dự họp là 8 căn quyết thay 468 hộ.
  perform set_config('test.uid', bqt::text, true);
  bq2 := mo_bieu_quyet(p_h, 'Nghi quyet it nguoi bo phieu', null, 50, 50);
  perform set_config('test.uid', cu3::text, true);
  perform bo_phieu_bieu_quyet(bq2, u3, 'tan_thanh');
  select * into k from kiem_phieu_bieu_quyet(bq2);
  if k.ty_le_du_hop <> 15.00 then
    raise exception 'FAIL 9: ty le du hop % thay vi 15.00', k.ty_le_du_hop;
  end if;
  if k.ty_le_tan_thanh <> 100.00 then
    raise exception 'FAIL 9b: ty le tan thanh % thay vi 100.00', k.ty_le_tan_thanh;
  end if;
  if k.du_hop then raise exception 'FAIL 9c: 15%% dien tich ma bao du hop'; end if;
  if k.thong_qua then raise exception 'FAIL 9d: chua du dieu kien hop ma da bao thong qua'; end if;

  -- ── 10. Phiếu trắng có mặt trong MẪU SỐ thông qua ──
  -- Bỏ trắng không phải là "không bỏ phiếu": người ta có đi họp, có ký nhận
  -- phiếu. Gạt phiếu trắng ra khỏi mẫu số là biến 83.33% thành 100% và một
  -- nghị quyết trượt thành một nghị quyết đậu.
  perform set_config('test.uid', bql::text, true);
  bq3 := mo_bieu_quyet(p_h, 'Nghi quyet can 90 phan tram', null, 50, 90);
  perform set_config('test.uid', cu1::text, true);
  perform bo_phieu_bieu_quyet(bq3, u1, 'tan_thanh');   -- 100
  perform set_config('test.uid', cu4::text, true);
  perform bo_phieu_bieu_quyet(bq3, u4, 'trang');       -- 20
  select * into k from kiem_phieu_bieu_quyet(bq3);
  if k.trang <> 20 then raise exception 'FAIL 10: phieu trang % thay vi 20', k.trang; end if;
  if k.dien_tich_bo_phieu <> 120 then
    raise exception 'FAIL 10b: mau so thong qua la % thay vi 120 (bo phieu trang ra ngoai?)',
      k.dien_tich_bo_phieu;
  end if;
  if k.ty_le_tan_thanh <> 83.33 then
    raise exception 'FAIL 10c: ty le tan thanh % thay vi 83.33', k.ty_le_tan_thanh;
  end if;
  if not k.du_hop then raise exception 'FAIL 10d: 60%% dien tich ma bao chua du hop'; end if;
  if k.thong_qua then raise exception 'FAIL 10e: 83.33%% ma vuot duoc nguong 90'; end if;

  -- ── 11. Diện tích đổi giữa chừng KHÔNG làm kết quả đổi ──
  -- BQL đo lại và sửa diện tích một căn trong lúc cuộc đang mở. Nếu phép tính
  -- đọc lại units.area_m2 thì kết quả đổi qua đêm mà không ai chạm vào lá phiếu
  -- nào — thứ không giải thích nổi trước hội nghị.
  update units set area_m2 = 999 where id = u2;
  select tong_dien_tich into d from bieu_quyet where id = bq3;
  if d <> 200 then raise exception 'FAIL 11: mau so doi thanh % sau khi sua dien tich', d; end if;
  select dien_tich into d from bieu_quyet_can where bieu_quyet_id = bq3 and unit_id = u2;
  if d <> 50 then raise exception 'FAIL 11b: danh sach dong bang doi thanh %', d; end if;
  perform set_config('test.uid', cu2::text, true);
  perform bo_phieu_bieu_quyet(bq3, u2, 'tan_thanh');
  select dien_tich into d from phieu_bieu_quyet
   where bieu_quyet_id = bq3 and unit_id = u2 and huy_luc is null;
  if d <> 50 then
    raise exception 'FAIL 11c: phieu ghi trong so % thay vi 50 (doc lai area_m2?)', d;
  end if;
  select * into k from kiem_phieu_bieu_quyet(bq3);
  if k.dien_tich_bo_phieu <> 170 then
    raise exception 'FAIL 11d: dien tich da bo phieu % thay vi 170', k.dien_tich_bo_phieu;
  end if;
  if k.ty_le_tan_thanh <> 88.24 then
    raise exception 'FAIL 11e: ty le tan thanh % thay vi 88.24', k.ty_le_tan_thanh;
  end if;
  update units set area_m2 = 50 where id = u2;

  -- ── 12. Hủy cả cuộc ──
  perform set_config('test.uid', cu1::text, true);
  begin
    perform huy_bieu_quyet(bq2, 'Toi khong thich');
    raise exception 'FAIL 12: cu dan huy duoc cuoc bieu quyet';
  exception when sqlstate '42501' then null;
  end;
  perform set_config('test.uid', bqt::text, true);
  begin
    perform huy_bieu_quyet(bq2, '');
    raise exception 'FAIL 12b: huy duoc ma khong ghi ly do';
  exception when sqlstate '22023' then null;
  end;
  perform huy_bieu_quyet(bq2, 'Sai noi dung nghi quyet, mo lai cuoc khac');
  perform set_config('test.uid', cu4::text, true);
  begin
    perform bo_phieu_bieu_quyet(bq2, u4, 'tan_thanh');
    raise exception 'FAIL 12c: bo phieu duoc vao cuoc da huy';
  exception when check_violation then null;
  end;
  perform set_config('test.uid', bqt::text, true);
  begin
    perform huy_bieu_quyet(bq2, 'Huy lan hai');
    raise exception 'FAIL 12d: huy duoc mot cuoc hai lan';
  exception when sqlstate '23505' then null;
  end;

  -- ── 13. "Căn nào của tôi chưa bỏ phiếu" ──
  perform set_config('test.uid', cu1::text, true);
  select count(*) into n from bieu_quyet_cua_toi(bq3);
  if n <> 2 then
    raise exception 'FAIL 13: cu1 (chu can 1 + duoc uy quyen can 3) thay % can thay vi 2', n;
  end if;
  select count(*) into n from bieu_quyet_cua_toi(bq3) where da_bo;
  if n <> 1 then raise exception 'FAIL 13b: dem % can da bo thay vi 1', n; end if;
  select y_kien into r from bieu_quyet_cua_toi(bq3) where da_bo;
  if r.y_kien <> 'tan_thanh' then raise exception 'FAIL 13c: y kien tra ve %', r.y_kien; end if;
  -- Người thuê không có căn nào để bỏ phiếu — danh sách rỗng chứ không phải
  -- danh sách có nút bấm rồi bấm mới báo lỗi.
  perform set_config('test.uid', thue::text, true);
  select count(*) into n from bieu_quyet_cua_toi(bq3);
  if n <> 0 then raise exception 'FAIL 13d: nguoi thue thay % can de bo phieu', n; end if;

  -- ── 14. Neo vào nhật ký kiểm toán ──
  select count(*) into n from audit_log
   where project_id = p_h and bang = 'bieu_quyet';
  if n = 0 then raise exception 'FAIL 14: mo/dong cuoc bieu quyet khong vao nhat ky'; end if;
  select count(*) into n from audit_log where bang = 'phieu_bieu_quyet';
  if n = 0 then raise exception 'FAIL 14b: bo phieu khong vao nhat ky'; end if;

  -- ── 15. RLS: kết quả công khai, LÁ PHIẾU thì không ──
  begin execute 'create role vb_bq_test nologin'; exception when duplicate_object then null; end;
  execute 'grant usage on schema public to vb_bq_test';
  execute 'grant select on bieu_quyet, bieu_quyet_can, phieu_bieu_quyet to vb_bq_test';
  execute 'grant select on units, buildings, unit_memberships to vb_bq_test';
  execute 'grant execute on function is_staff(uuid), current_unit_ids(), o_trong_du_an(uuid) to vb_bq_test';
  execute 'set local role vb_bq_test';

  perform set_config('test.uid', cu4::text, true);
  select count(*) into n from bieu_quyet where project_id = p_h;
  if n < 3 then raise exception 'FAIL 15: cu dan doc duoc % cuoc thay vi 3', n; end if;
  select count(*) into n from bieu_quyet_can where bieu_quyet_id = bq3;
  if n <> 4 then raise exception 'FAIL 15b: cu dan doc duoc % dong mau so thay vi 4', n; end if;
  -- cu4 chỉ có căn 4, nên chỉ thấy đúng lá phiếu của mình trong bq3.
  select count(*) into n from phieu_bieu_quyet where bieu_quyet_id = bq3;
  if n <> 1 then raise exception 'FAIL 15c: cu dan nhin duoc % la phieu thay vi 1', n; end if;
  select unit_id into r from phieu_bieu_quyet where bieu_quyet_id = bq3;
  if r.unit_id <> u4 then raise exception 'FAIL 15d: cu dan nhin duoc phieu hang xom'; end if;
  execute 'reset role';

  raise notice 'TEST BIEU QUYET PASSED — hai nguong hai mau so, phieu trang van tinh, dien tich dong bang, va la phieu khong lo ra hang xom';
end $test$;
