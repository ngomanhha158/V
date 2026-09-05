-- Smoke test thu theo đợt cho khoản lớn. Chạy sau schema.sql + seed.sql.
--
-- Cả tính năng đứng trên MỘT lời hứa số học: tổng tiền thu của tất cả các căn
-- qua tất cả các đợt phải bằng ĐÚNG hóa đơn của nhà thầu, không thừa không
-- thiếu một đồng. Lệch vài trăm đồng nghe thì nhỏ, nhưng đó là con số ban quản
-- trị phải đứng lên giải trình trước hội nghị, và không giải trình được.
--
-- Và MỘT lời hứa kiến trúc: đợt thu là một DÒNG trên hóa đơn tháng, không phải
-- một loại tiền thứ hai. Hỏng lời hứa này thì công nợ, phiếu thu, đối soát ngân
-- hàng và chốt sổ bàn giao đều đang đọc một nửa sự thật.

do $test$
declare
  p_g  uuid := 'aaaaaaaa-0000-0000-0000-000000110000';
  t_g  uuid := 'bbbbbbbb-0000-0000-0000-000000110001';
  bql  uuid := '99990000-0000-0000-0000-000000110001';
  bqt  uuid := '99990000-0000-0000-0000-000000110002';
  cu   uuid := '99990000-0000-0000-0000-00000011000a';
  cu2  uuid := '99990000-0000-0000-0000-00000011000b';
  thue uuid := '99990000-0000-0000-0000-00000011000c';
  con  uuid := '99990000-0000-0000-0000-00000011000d';
  u1 uuid; u2 uuid; u3 uuid; ft uuid;
  kh uuid; kh2 uuid; ky1 date; hd uuid; kq jsonb;
  r record; n int; m bigint;
begin
  ky1 := (date_trunc('month', current_date) + interval '1 month')::date;

  insert into projects (id, name) values (p_g, 'Khu tra gop');
  insert into buildings (id, project_id, code, name) values (t_g, p_g, 'K1', 'Toa K1');
  -- Ba căn, diện tích LẺ và KHÔNG chia hết: 70 / 45,5 / 34,5 trên tổng 150.
  -- Diện tích tròn trịa thì phép chia nào cũng ra số đẹp, và bài test không
  -- phân biệt được cách chia đúng với cách chia làm rơi mất tiền.
  insert into units (building_id, code, floor_no, area_m2) values
    (t_g,'K1-01.01',1,70), (t_g,'K1-01.02',1,45.5), (t_g,'K1-02.01',2,34.5);
  select id into u1 from units where building_id = t_g and code = 'K1-01.01';
  select id into u2 from units where building_id = t_g and code = 'K1-01.02';
  select id into u3 from units where building_id = t_g and code = 'K1-02.01';

  insert into profiles (id, full_name, phone) values
    (bql,'Truong BQL K','0900000150'), (bqt,'Thanh vien BQT K','0900000151'),
    (cu,'Chu can 1','0900000152'), (cu2,'Chu can 2','0900000153'),
    (thue,'Nguoi thue can 1','0900000154'), (con,'Nguoi nha can 1','0900000155');
  insert into staff_assignments (user_id, project_id, role) values
    (bql, p_g, 'bql_manager'), (bqt, p_g, 'bqt');
  insert into unit_memberships (unit_id, user_id, role, status) values
    (u1, cu, 'owner', 'active'), (u2, cu2, 'owner', 'active'),
    (u1, thue, 'tenant', 'active'), (u1, con, 'family', 'active');

  insert into fee_types (project_id, code, name, calc_method, unit_price)
    values (p_g, 'QLY-K', 'Phi quan ly', 'per_unit', 100000) returning id into ft;

  -- ── 1. Ai lập được, và cái gì bắt buộc ──
  perform set_config('test.uid', cu::text, true);
  begin
    perform lap_ke_hoach_thu(p_g, 'Cu dan tu lap', 1000000, 'theo_can', 3, ky1, 'NQ-01');
    raise exception 'FAIL 1: cu dan lap duoc ke hoach thu';
  exception when sqlstate '42501' then null;
  end;
  perform set_config('test.uid', bql::text, true);
  -- Nghị quyết BẮT BUỘC. Khoản lớn phân bổ cho cả tòa mà không có nghị quyết
  -- thì đó là một khoản thu do một người quyết định.
  begin
    perform lap_ke_hoach_thu(p_g, 'Son mat ngoai', 1000000, 'theo_can', 3, ky1, '  ');
    raise exception 'FAIL 1b: lap duoc ma khong co nghi quyet';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform lap_ke_hoach_thu(p_g, '   ', 1000000, 'theo_can', 3, ky1, 'NQ-01');
    raise exception 'FAIL 1c: lap duoc ma khong co ten khoan thu';
  exception when sqlstate '22023' then null;
  end;
  -- Kỳ đã qua thì thu vào đâu?
  begin
    perform lap_ke_hoach_thu(p_g, 'Son mat ngoai', 1000000, 'theo_can', 3,
                             (date_trunc('month', current_date) - interval '1 month')::date, 'NQ-01');
    raise exception 'FAIL 1d: lap duoc ke hoach thu cho ky da qua';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform lap_ke_hoach_thu(p_g, 'Son mat ngoai', 1000000, 'theo_can', 3, ky1 + 5, 'NQ-01');
    raise exception 'FAIL 1e: nhan ky khong phai ngay dau thang';
  exception when sqlstate '22023' then null;
  end;

  -- ── 2. CHIA THEO CĂN: tổng phải khớp tuyệt đối ──
  -- 1.000.000 chia 3 căn = 333.333,33. Làm tròn từng căn rồi cộng lại ra
  -- 999.999 — thiếu 1 đồng. Phương pháp phần dư lớn nhất phải bù đúng 1 đồng
  -- cho một căn, không hơn không kém.
  kh := lap_ke_hoach_thu(p_g, 'Thay bom PCCC', 1000000, 'theo_can', 3, ky1, 'NQ-05/2026',
                         current_date - 10, 'Bom cu chay tu thang 6');
  select coalesce(sum(c.so_tien), 0) into m
    from dot_thu_can c join ke_hoach_thu_dot d on d.id = c.dot_id
   where d.ke_hoach_id = kh;
  if m <> 1000000 then
    raise exception 'FAIL 2: tong cac dot la % thay vi 1000000 (roi mat tien khi lam tron)', m;
  end if;
  select count(*) into n from ke_hoach_thu_dot where ke_hoach_id = kh;
  if n <> 3 then raise exception 'FAIL 2b: sinh % dot thay vi 3', n; end if;
  -- Ba căn chia đều: hai căn 333.333, một căn 333.334. Chênh lệch giữa căn cao
  -- nhất và thấp nhất phải là ĐÚNG 1 đồng — chia lệch hơn thế là chia sai.
  select max(t) - min(t) into m from (
    select sum(c.so_tien) as t from dot_thu_can c
      join ke_hoach_thu_dot d on d.id = c.dot_id
     where d.ke_hoach_id = kh group by c.unit_id) x;
  if m <> 1 then
    raise exception 'FAIL 2c: chia deu ma lech % dong giua cac can', m;
  end if;
  -- Trong một căn, các đợt cộng lại đúng bằng phần của căn đó.
  for r in select c.unit_id, sum(c.so_tien) as tong from dot_thu_can c
             join ke_hoach_thu_dot d on d.id = c.dot_id
            where d.ke_hoach_id = kh group by c.unit_id
  loop
    if r.tong not in (333333, 333334) then
      raise exception 'FAIL 2d: can % phai tra % , khong phai 333.333 hay 333.334', r.unit_id, r.tong;
    end if;
  end loop;
  -- Đợt CUỐI ôm phần lẻ, không phải đợt đầu: ai cũng hiểu đợt cuối là đợt lệch.
  select c.so_tien into m from dot_thu_can c join ke_hoach_thu_dot d on d.id = c.dot_id
   where d.ke_hoach_id = kh and c.unit_id = u1 and d.thu_tu = 1;
  if m <> 111111 then raise exception 'FAIL 2e: dot 1 cua can 1 la % thay vi 111111', m; end if;
  select c.so_tien into m from dot_thu_can c join ke_hoach_thu_dot d on d.id = c.dot_id
   where d.ke_hoach_id = kh and c.unit_id = u1 and d.thu_tu = 3;
  if m not in (111111, 111112) then
    raise exception 'FAIL 2f: dot cuoi cua can 1 la %, khong phai phan con lai', m;
  end if;

  -- Phần lẻ TRÊN 0,5. Fixture 1.000.000/3 có mọi phần lẻ là 0,33 nên làm tròn
  -- lên hay xuống đều ra cùng một kết quả — bài test không phân biệt được. Với
  -- 1.000.001/3 = 333.333,67 thì làm tròn thường cho ra 1.000.002, tức TẠO RA
  -- một đồng không ai phải trả, và tổng lệch hóa đơn nhà thầu.
  declare kh3 uuid;
  begin
    kh3 := lap_ke_hoach_thu(p_g, 'Kiem lam tron', 1000001, 'theo_can', 2, ky1, 'NQ-99');
    select coalesce(sum(c.so_tien), 0) into m
      from dot_thu_can c join ke_hoach_thu_dot d on d.id = c.dot_id
     where d.ke_hoach_id = kh3;
    if m <> 1000001 then
      raise exception 'FAIL 2g: phan le tren 0,5 lam tong ra % thay vi 1000001', m;
    end if;
    perform huy_ke_hoach_thu(kh3, 'Chi de kiem phep lam tron');
  end;

  -- ── 3. CHIA THEO M²: mẫu số đóng băng, tổng vẫn khớp ──
  perform set_config('test.uid', bqt::text, true);
  kh2 := lap_ke_hoach_thu(p_g, 'Son mat ngoai', 999999997, 'theo_m2', 4, ky1, 'NQ-06/2026');
  select coalesce(sum(c.so_tien), 0) into m
    from dot_thu_can c join ke_hoach_thu_dot d on d.id = c.dot_id
   where d.ke_hoach_id = kh2;
  if m <> 999999997 then
    raise exception 'FAIL 3: chia theo m2 ra tong % thay vi 999999997', m;
  end if;
  select tong_dien_tich into r from ke_hoach_thu where id = kh2;
  -- `is distinct from` chứ không phải `<>`: cột này nullable, mà `null <> 150`
  -- ra NULL, và `if NULL then` thì không chạy — bài test im lặng bỏ qua đúng
  -- cái nó sinh ra để bắt.
  if r.tong_dien_tich is distinct from 150 then
    raise exception 'FAIL 3b: khong dong bang tong dien tich (%)', r.tong_dien_tich;
  end if;
  -- Căn 70 m² phải trả nhiều hơn căn 34,5 m². Chia theo m² mà ra bằng nhau thì
  -- nó chỉ là chia đều đội lốt.
  select sum(c.so_tien) into m from dot_thu_can c join ke_hoach_thu_dot d on d.id = c.dot_id
   where d.ke_hoach_id = kh2 and c.unit_id = u1;
  select sum(c.so_tien) into n from dot_thu_can c join ke_hoach_thu_dot d on d.id = c.dot_id
   where d.ke_hoach_id = kh2 and c.unit_id = u3;
  if m <= n then
    raise exception 'FAIL 3c: can 70m2 tra % , can 34,5m2 tra % — khong theo dien tich', m, n;
  end if;
  -- Và đúng tỷ lệ: 70/150 của 999.999.997 ≈ 466.666.665.
  if abs(m - 466666665) > 2 then
    raise exception 'FAIL 3d: can 70m2 phai tra khoang 466.666.665, dang la %', m;
  end if;
  -- Sửa diện tích SAU KHI lập không được làm đổi số tiền đã chốt.
  update units set area_m2 = 999 where id = u3;
  select sum(c.so_tien) into m from dot_thu_can c join ke_hoach_thu_dot d on d.id = c.dot_id
   where d.ke_hoach_id = kh2 and c.unit_id = u3;
  if m > 300000000 then
    raise exception 'FAIL 3e: sua dien tich lam doi so tien da chot (%)', m;
  end if;
  update units set area_m2 = 34.5 where id = u3;
  -- Thiếu diện tích thì KHÔNG chia theo m² được.
  update units set area_m2 = null where id = u3;
  begin
    perform lap_ke_hoach_thu(p_g, 'Thu khi thieu dien tich', 1000000, 'theo_m2', 2, ky1, 'NQ-07');
    raise exception 'FAIL 3f: chia theo m2 duoc khi con can chua co dien tich';
  exception when sqlstate '22023' then null;
  end;
  update units set area_m2 = 34.5 where id = u3;

  -- ── 4. ĐỢT THU LÀ MỘT DÒNG TRÊN HÓA ĐƠN THÁNG ──
  -- Đây là chốt kiến trúc quan trọng nhất. Nếu nó nằm ở một bảng tiền riêng thì
  -- công nợ, phiếu thu và đối soát đều đang đọc thiếu.
  perform set_config('test.uid', bql::text, true);
  perform bql_generate_invoices(p_g, ky1);
  select id, total_amount into r from invoices where unit_id = u1 and period = ky1;
  hd := r.id;
  if hd is null then raise exception 'FAIL 4: khong sinh duoc hoa don ky dau'; end if;
  select count(*) into n from invoice_lines
   where invoice_id = hd and description like 'Thay bom PCCC%';
  if n <> 1 then raise exception 'FAIL 4b: hoa don co % dong dot thu thay vi 1', n; end if;
  -- Dòng phải nói ra ĐỢT MẤY TRÊN MẤY. "Thu theo đợt 111.111đ" trơ trọi thì cư
  -- dân không biết còn phải trả mấy lần nữa.
  select description into r from invoice_lines
   where invoice_id = hd and description like 'Thay bom PCCC%';
  if r.description not like '%1/3%' then
    raise exception 'FAIL 4c: dong hoa don khong noi dot may tren may: %', r.description;
  end if;
  -- Tổng hóa đơn phải CỘNG cả đợt thu: phí quản lý 100.000 + đợt 111.111
  -- + đợt sơn mặt ngoài của kế hoạch thứ hai.
  select total_amount into m from invoices where id = hd;
  select coalesce(sum(amount), 0) into n from invoice_lines where invoice_id = hd;
  if m <> n then
    raise exception 'FAIL 4d: total_amount % khac tong cac dong %', m, n;
  end if;
  if m <= 100000 then
    raise exception 'FAIL 4e: tong hoa don % khong cong dot thu vao', m;
  end if;

  -- CHẠY LẠI generate_invoices KHÔNG được nhân đôi dòng đợt thu. Hàm này chạy
  -- lại được là một lời hứa đã có từ trước; thêm nguồn dòng mới mà làm hỏng nó
  -- thì cư dân bị tính tiền hai lần.
  perform bql_generate_invoices(p_g, ky1);
  select count(*) into n from invoice_lines
   where invoice_id = hd and description like 'Thay bom PCCC%';
  if n <> 1 then raise exception 'FAIL 4f: chay lai sinh % dong dot thu', n; end if;
  select total_amount into m from invoices where id = hd;
  select coalesce(sum(amount), 0) into n from invoice_lines where invoice_id = hd;
  if m <> n then raise exception 'FAIL 4g: chay lai lam lech total_amount'; end if;

  -- Đợt 2 KHÔNG được lên hóa đơn của kỳ 1.
  select count(*) into n from invoice_lines
   where invoice_id = hd and description like '%2/3%';
  if n <> 0 then raise exception 'FAIL 4h: dot 2 lot vao hoa don ky 1'; end if;
  -- ...mà lên đúng kỳ 2.
  perform bql_generate_invoices(p_g, (ky1 + interval '1 month')::date);
  select count(*) into n from invoice_lines l
    join invoices i on i.id = l.invoice_id
   where i.unit_id = u1 and i.period = (ky1 + interval '1 month')::date
     and l.description like 'Thay bom PCCC — đợt 2/3';
  if n <> 1 then raise exception 'FAIL 4i: dot 2 khong len hoa don ky 2'; end if;

  -- ── 5. Kỳ đã phát hành hóa đơn thì chặn ngay lúc lập ──
  -- Không chặn thì đợt thu im lặng không bao giờ lên được, và ba tháng sau có
  -- người hỏi tiền đâu.
  -- Kỳ GIỮA CHỪNG mới là ca dễ bỏ sót: kỳ đầu còn draft nên nhìn thì trót lọt,
  -- mà đợt 2 rơi vào một kỳ đã chốt và sẽ không bao giờ lên được.
  perform bql_issue_invoices(p_g, (ky1 + interval '1 month')::date);
  begin
    perform lap_ke_hoach_thu(p_g, 'Bat dau o ky con draft', 300000, 'theo_can', 3, ky1, 'NQ-08');
    raise exception 'FAIL 5: lap duoc ke hoach di qua mot ky da phat hanh hoa don';
  exception when check_violation then null;
  end;
  perform bql_issue_invoices(p_g, ky1);
  begin
    perform lap_ke_hoach_thu(p_g, 'Lap sau khi da phat hanh', 300000, 'theo_can', 2, ky1, 'NQ-09');
    raise exception 'FAIL 5b: lap duoc ke hoach vao ky da phat hanh hoa don';
  exception when check_violation then null;
  end;

  -- ── 6. Hủy: dừng thu, nhưng KHÔNG gỡ tiền đã báo tới cư dân ──
  perform set_config('test.uid', cu::text, true);
  begin
    perform huy_ke_hoach_thu(kh, 'Toi khong muon dong');
    raise exception 'FAIL 6: cu dan huy duoc ke hoach thu';
  exception when sqlstate '42501' then null;
  end;
  perform set_config('test.uid', bql::text, true);
  begin
    perform huy_ke_hoach_thu(kh, '  ');
    raise exception 'FAIL 6b: huy duoc ma khong ghi ly do';
  exception when sqlstate '22023' then null;
  end;
  -- Sinh TRƯỚC hóa đơn kỳ 3 nhưng KHÔNG phát hành. Đây là ca phân biệt "đã báo
  -- tới cư dân" với "mới nằm trong bản nháp": hóa đơn draft thì generate_invoices
  -- dựng lại từ đầu mỗi lần chạy, nên nó chưa hứa gì với ai. Đếm nó là "đã lên
  -- hóa đơn" là báo với BQT rằng một khoản đã đòi trong khi chưa hề.
  perform bql_generate_invoices(p_g, (ky1 + interval '2 month')::date);
  kq := huy_ke_hoach_thu(kh, 'Nha thau bo dot 2 va 3');
  -- Đợt 1 + đợt 2 (333.333 + 333.333) đã phát hành; đợt 3 (333.334) mới ở bản
  -- nháp nên vẫn là tiền DỪNG THU được.
  if (kq ->> 'da_len_hoa_don')::bigint <> 666666 then
    raise exception 'FAIL 6c: da_len_hoa_don = % thay vi 666666', kq ->> 'da_len_hoa_don';
  end if;
  if (kq ->> 'dung_thu')::bigint <> 333334 then
    raise exception 'FAIL 6d: dung_thu = % thay vi 333334 (dem ca hoa don nhap?)', kq ->> 'dung_thu';
  end if;
  begin
    perform huy_ke_hoach_thu(kh, 'Huy lan hai');
    raise exception 'FAIL 6e: huy duoc mot ke hoach hai lan';
  exception when sqlstate '23505' then null;
  end;
  -- Hóa đơn ĐÃ PHÁT HÀNH giữ nguyên dòng đợt 1: gỡ nó là làm tờ hóa đơn cư dân
  -- đang cầm nói khác sổ.
  select count(*) into n from invoice_lines
   where invoice_id = hd and description like 'Thay bom PCCC%';
  if n <> 1 then raise exception 'FAIL 6f: huy ke hoach xoa mat dong tren hoa don da phat hanh'; end if;
  -- Kỳ 3 còn draft thì đợt 3 phải BIẾN MẤT.
  perform bql_generate_invoices(p_g, (ky1 + interval '2 month')::date);
  select count(*) into n from invoice_lines l
    join invoices i on i.id = l.invoice_id
   where i.unit_id = u1 and i.period = (ky1 + interval '2 month')::date
     and l.description like 'Thay bom PCCC%';
  if n <> 0 then raise exception 'FAIL 6g: ke hoach da huy van len hoa don ky sau'; end if;

  -- ── 7. Đọc: BQL thấy tiến độ, cư dân thấy phần của mình ──
  perform set_config('test.uid', bql::text, true);
  select da_len_hoa_don, chua_toi_ky, so_can into r from ke_hoach_thu_ds(p_g) where id = kh2;
  if r.so_can <> 3 then raise exception 'FAIL 7: bao % can thay vi 3', r.so_can; end if;
  if r.da_len_hoa_don + r.chua_toi_ky <> 999999997 then
    raise exception 'FAIL 7b: da_len_hoa_don + chua_toi_ky = % thay vi tong chi phi',
      r.da_len_hoa_don + r.chua_toi_ky;
  end if;
  select count(*) into n from ke_hoach_thu_chi_tiet(kh2);
  if n <> 12 then raise exception 'FAIL 7c: chi tiet co % dong thay vi 3 can x 4 dot', n; end if;

  -- Cư dân thấy ĐÚNG căn mình, không thấy căn hàng xóm.
  perform set_config('test.uid', cu::text, true);
  select count(distinct unit_id) into n from tra_gop_cua_toi();
  if n <> 1 then raise exception 'FAIL 7d: cu dan thay % can thay vi 1', n; end if;
  select count(*) into n from tra_gop_cua_toi() where unit_id = u2;
  if n <> 0 then raise exception 'FAIL 7e: cu dan thay duoc dot thu cua hang xom'; end if;
  select tong_phai_tra into r from tra_gop_cua_toi() where ke_hoach_id = kh2 limit 1;
  if r.tong_phai_tra is null or abs(r.tong_phai_tra - 466666665) > 2 then
    raise exception 'FAIL 7f: tong phai tra cua can 1 la %', r.tong_phai_tra;
  end if;
  -- Ai xem được thì theo ĐÚNG luật xem tiền của căn, không phải một luật thứ
  -- hai viết riêng cho đợt thu. Người thuê thấy — vì đợt thu nằm ngay trên tờ
  -- hóa đơn tháng mà họ đã thấy toàn bộ, và giấu dòng giải thích trong khi vẫn
  -- hiện con số là để họ nhìn một khoản tiền không tra ngược được về đâu.
  perform set_config('test.uid', cu::text, true);
  select count(*) into n from tra_gop_cua_toi();
  perform set_config('test.uid', thue::text, true);
  select count(*) into m from tra_gop_cua_toi();
  if m <> n then
    raise exception 'FAIL 7g: nguoi thue thay % dong con chu can thay % — hai luat khac nhau cho cung mot to hoa don', m, n;
  end if;
  -- Người nhà KHÔNG có quyền xem tài chính thì không thấy: con cái trong nhà
  -- không cần biết bố mẹ còn nợ mấy đợt.
  perform set_config('test.uid', con::text, true);
  select count(*) into n from tra_gop_cua_toi();
  if n <> 0 then raise exception 'FAIL 7h: nguoi nha khong co quyen xem tien van thay % dong', n; end if;

  -- ── 8. Neo vào nhật ký kiểm toán ──
  select count(*) into n from audit_log where project_id = p_g and bang = 'ke_hoach_thu';
  if n = 0 then raise exception 'FAIL 8: lap/huy ke hoach thu khong vao nhat ky'; end if;

  -- ── 9. RLS: kế hoạch công khai, số tiền từng căn thì không ──
  begin execute 'create role vb_tg_test nologin'; exception when duplicate_object then null; end;
  execute 'grant usage on schema public to vb_tg_test';
  execute 'grant select on ke_hoach_thu, ke_hoach_thu_dot, dot_thu_can to vb_tg_test';
  execute 'grant select on units, buildings, unit_memberships to vb_tg_test';
  execute 'grant execute on function is_staff(uuid), o_trong_du_an(uuid), xem_duoc_tien_cua_can(uuid) to vb_tg_test';
  execute 'set local role vb_tg_test';

  perform set_config('test.uid', cu::text, true);
  select count(*) into n from ke_hoach_thu where project_id = p_g;
  if n < 2 then raise exception 'FAIL 9: cu dan doc duoc % ke hoach thay vi 2', n; end if;
  select count(distinct unit_id) into n from dot_thu_can;
  if n <> 1 then raise exception 'FAIL 9b: cu dan doc duoc so tien cua % can', n; end if;
  execute 'reset role';

  raise notice 'TEST TRA GOP PASSED — chia tien khong roi mot dong, dot thu la mot dong tren hoa don thang, va huy khong go tien da bao toi cu dan';
end $test$;
