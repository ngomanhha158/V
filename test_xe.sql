-- Smoke test chỗ đỗ xe và hàng chờ. Chạy sau schema.sql + seed.sql.
--
-- Cả tính năng dựng lên để giữ MỘT lời hứa: ai đăng ký trước thì được gọi
-- trước, và một hộ không ôm được nhiều hơn phần của mình. Hỏng lời hứa đó thì
-- hàng chờ chỉ còn là một danh sách để BQL nhìn cho vui, và cư dân quay lại
-- cách cũ — gọi điện hỏi.

do $test$
declare
  p_x  uuid := 'aaaaaaaa-0000-0000-0000-000000030000';
  t1 uuid := 'bbbbbbbb-0000-0000-0000-000000030001';
  t2 uuid := 'bbbbbbbb-0000-0000-0000-000000030002';
  bql uuid := '99990000-0000-0000-0000-000000030001';
  a uuid := '99990000-0000-0000-0000-00000003000a';
  b uuid := '99990000-0000-0000-0000-00000003000b';
  c uuid := '99990000-0000-0000-0000-00000003000c';
  d uuid := '99990000-0000-0000-0000-00000003000d';
  m uuid := '99990000-0000-0000-0000-00000003000e';
  n uuid := '99990000-0000-0000-0000-00000003000f';
  u_a uuid; u_b uuid; u_c uuid; u_d uuid; u_m uuid; u_n uuid;
  r record; k record; so int;
begin
  insert into projects (id, name) values (p_x, 'Khu bai xe');
  insert into buildings (id, project_id, code, name) values
    (t1, p_x, 'X1', 'Bai xe 1'), (t2, p_x, 'X2', 'Bai xe 2');
  insert into units (building_id, code, floor_no) values
    (t1,'X1-01.01',1), (t1,'X1-01.02',1), (t1,'X1-01.03',1), (t1,'X1-01.04',1),
    (t2,'X2-01.01',1), (t2,'X2-01.02',1);
  -- Lọc theo TÒA chứ không chỉ theo mã căn: mã căn chỉ duy nhất trong một tòa,
  -- và bộ test chạy chung một database nên một file khác rất dễ đã dựng sẵn một
  -- căn trùng mã ở tòa khác. Thiếu điều kiện này thì test đọc trúng căn của
  -- người khác và đỏ ở một chỗ chẳng liên quan gì tới thứ nó định kiểm.
  select id into u_a from units where building_id = t1 and code = 'X1-01.01';
  select id into u_b from units where building_id = t1 and code = 'X1-01.02';
  select id into u_c from units where building_id = t1 and code = 'X1-01.03';
  select id into u_d from units where building_id = t1 and code = 'X1-01.04';
  select id into u_m from units where building_id = t2 and code = 'X2-01.01';
  select id into u_n from units where building_id = t2 and code = 'X2-01.02';

  insert into profiles (id, full_name, phone) values
    (bql,'BQL bai xe','0900000070'), (a,'Chu ho A','0900000071'), (b,'Chu ho B','0900000072'),
    (c,'Chu ho C','0900000073'), (d,'Chu ho D','0900000074'),
    (m,'Chu ho M','0900000075'), (n,'Chu ho N','0900000076');
  insert into staff_assignments (user_id, project_id, role) values (bql, p_x, 'bql_manager');
  insert into unit_memberships (unit_id, user_id, role, status) values
    (u_a,a,'owner','active'), (u_b,b,'owner','active'), (u_c,c,'owner','active'),
    (u_d,d,'owner','active'), (u_m,m,'owner','active'), (u_n,n,'owner','active');

  -- ── 1. Chưa đặt hạn mức thì GHI NHẬN, không chặn ──
  -- Một hệ thống từ chối hết vì BQL chưa điền một dòng cấu hình thì tệ hơn hẳn
  -- một hệ thống ghi lại rồi để BQL dọn sau.
  perform set_config('test.uid', a::text, true);
  select * into r from dang_ky_xe(u_a, ' 30a-111.11 ', 'o_to');
  if r.trang_thai <> 'da_duyet' then raise exception 'FAIL 1: chua co han muc ma tu choi (%)', r.trang_thai; end if;
  if not exists (select 1 from unit_vehicles where unit_id = u_a and plate = '30A-111.11') then
    raise exception 'FAIL 1b: bien so khong duoc chuan hoa (bo khoang trang, viet hoa)';
  end if;
  delete from unit_vehicles where unit_id = u_a;

  -- ── 2. Hạn mức căn tách bạch với sức chứa hầm ──
  perform set_config('test.uid', bql::text, true);
  perform dat_han_muc_bai_xe(t1, 'o_to', 2, 1);   -- hầm 2 chỗ, mỗi căn 1

  perform set_config('test.uid', a::text, true);
  select * into r from dang_ky_xe(u_a, '30A-111.11', 'o_to');
  if r.trang_thai <> 'da_duyet' then raise exception 'FAIL 2: xe dau tien phai duoc duyet'; end if;

  -- Chiếc thứ hai của CÙNG căn: vượt hạn mức CĂN, dù hầm vẫn còn chỗ. Phải là
  -- qua_han_muc chứ KHÔNG phải hang_cho — hai chuyện khác nhau, và nhét chung
  -- một hàng thì chiếc này đứng đầu hàng vĩnh viễn, chặn luôn mọi người sau.
  select * into r from dang_ky_xe(u_a, '30A-222.22', 'o_to');
  if r.trang_thai <> 'qua_han_muc' then
    raise exception 'FAIL 2b: chiec thu hai cung can phai la qua_han_muc, nhan duoc %', r.trang_thai;
  end if;
  -- Đặt giờ SỚM HƠN mọi người trong hàng chờ: chiếc này đăng ký trước C và D
  -- thật. Nếu phép đếm vị trí lỡ gộp cả xe qua_han_muc vào hàng thì C sẽ thành
  -- số 2, và cả cái hàng chờ hiện sai cho mọi người phía sau.
  update unit_vehicles set dang_ky_luc = timestamptz '2026-01-01 07:00+07'
   where unit_id = u_a and plate = '30A-222.22';

  perform set_config('test.uid', b::text, true);
  select * into r from dang_ky_xe(u_b, '30B-333.33', 'o_to');
  if r.trang_thai <> 'da_duyet' then raise exception 'FAIL 2c: can B phai duoc chiec cuoi cung'; end if;

  -- ── 3. Hầm đầy: người sau xếp hàng, và biết mình thứ mấy ──
  -- Sau mỗi lượt đăng ký, ĐẶT TAY giờ đăng ký. Mặc định là clock_timestamp(),
  -- mà hai lượt cách nhau vài micro giây thì trên máy chậm có lúc trùng nhau,
  -- và thứ tự hàng chờ rơi về id ngẫu nhiên. Một bài test đỏ một trên tám lần
  -- chạy còn tệ hơn không có bài test: người ta chạy lại rồi cho qua.
  perform set_config('test.uid', c::text, true);
  select * into r from dang_ky_xe(u_c, '30C-444.44', 'o_to');
  if r.trang_thai <> 'hang_cho' then raise exception 'FAIL 3: ham day ma van duyet (%)', r.trang_thai; end if;
  if r.vi_tri <> 1 then raise exception 'FAIL 3b: nguoi dau hang phai la so 1, nhan duoc %', r.vi_tri; end if;
  update unit_vehicles set dang_ky_luc = timestamptz '2026-01-01 08:00+07'
   where unit_id = u_c and plate = '30C-444.44';

  perform set_config('test.uid', d::text, true);
  select * into r from dang_ky_xe(u_d, '30D-555.55', 'o_to');
  if r.vi_tri <> 2 then raise exception 'FAIL 3c: nguoi thu hai phai la so 2, nhan duoc %', r.vi_tri; end if;
  update unit_vehicles set dang_ky_luc = timestamptz '2026-01-01 09:00+07'
   where unit_id = u_d and plate = '30D-555.55';

  -- ── 4. Bảng tình trạng nói đúng cho căn A ──
  perform set_config('test.uid', a::text, true);
  select * into k from cho_do_cua_can(u_a) where loai = 'o_to';
  if k.da_dung <> 1 or k.moi_can <> 1 or k.tong_cho <> 2 or k.ca_toa_dang_dung <> 2 then
    raise exception 'FAIL 4: so lieu sai: dung % / han %, ham % / dang dung %',
      k.da_dung, k.moi_can, k.tong_cho, k.ca_toa_dang_dung;
  end if;
  if k.toi_dang_cho <> 0 or k.vi_tri_dau <> 0 then
    raise exception 'FAIL 4b: can A khong xep hang nao ma bao dang cho (% / vi tri %)', k.toi_dang_cho, k.vi_tri_dau;
  end if;
  if k.toi_qua_han_muc <> 1 then raise exception 'FAIL 4c: can A co 1 xe qua han muc, bao %', k.toi_qua_han_muc; end if;
  if k.hang_cho_ca_toa <> 2 then raise exception 'FAIL 4d: ca toa co 2 xe cho, bao %', k.hang_cho_ca_toa; end if;

  perform set_config('test.uid', c::text, true);
  select * into k from cho_do_cua_can(u_c) where loai = 'o_to';
  if k.vi_tri_dau <> 1 then raise exception 'FAIL 4e: can C dung dau hang, bao vi tri %', k.vi_tri_dau; end if;

  -- ── 5. Chưa có chỗ thì không duyệt được ──
  -- Duyệt khi hầm chưa trống là bán một chỗ không tồn tại, và người ta xuống
  -- hầm rồi mới biết.
  perform set_config('test.uid', bql::text, true);
  begin
    perform duyet_xe_tiep(t1, 'o_to');
    raise exception 'FAIL 5: duyet duoc trong khi ham van day';
  exception when check_violation then null;
  end;

  -- ── 6. Có chỗ trống thì gọi ĐÚNG người đầu hàng ──
  -- Dựng lại hai dòng hàng chờ với id và thứ tự chèn ĐẶT TAY, sao cho ba cách
  -- sắp xếp cho ba kết quả khác nhau:
  --     theo GIỜ đăng ký  -> 30C-444.44   (đúng)
  --     theo id           -> 30D-555.55
  --     theo thứ tự chèn  -> 30D-555.55
  -- Không làm vậy thì id là uuid ngẫu nhiên, và một bài test bắt được lỗi xếp
  -- hàng sai đúng một nửa số lần chạy thì không phải là bài test.
  delete from unit_vehicles where unit_id in (u_c, u_d) and trang_thai = 'hang_cho';
  insert into unit_vehicles (id, unit_id, plate, loai, trang_thai, dang_ky_luc) values
    ('cccccccc-0000-0000-0000-000000000001', u_d, '30D-555.55', 'o_to', 'hang_cho',
     timestamptz '2026-01-01 10:00+07'),
    ('cccccccc-0000-0000-0000-000000000009', u_c, '30C-444.44', 'o_to', 'hang_cho',
     timestamptz '2026-01-01 06:00+07');

  delete from unit_vehicles where plate = '30B-333.33' and unit_id = u_b;
  select * into r from duyet_xe_tiep(t1, 'o_to');
  if r.bien_so <> '30C-444.44' then
    raise exception 'FAIL 6: goi nham nguoi — dau hang theo GIO dang ky la 30C-444.44, nhan duoc %', r.bien_so;
  end if;
  if (select count(*) from unit_vehicles v where v.unit_id in (u_c, u_d)
        and v.trang_thai = 'hang_cho') <> 1 then
    raise exception 'FAIL 6b: goi lay ca nguoi phia sau';
  end if;

  -- ── 7. HÀNG CHỜ KHÔNG ĐƯỢC KẸT ──
  -- Người đầu hàng có thể đã kín hạn mức trong lúc chờ (BQL siết moi_can).
  -- Nếu duyet_xe_tiep dừng lại ở đó thì cả hàng đứng im mãi mãi, và không ai
  -- hiểu vì sao — đó là lý do hàm phải ĐẨY người đó sang qua_han_muc rồi đi tiếp.
  perform dat_han_muc_bai_xe(t2, 'xe_may', 1, 2);   -- hầm 1 chỗ, mỗi căn 2
  perform set_config('test.uid', m::text, true);
  perform dang_ky_xe(u_m, '29M-111.11', 'xe_may');           -- chiếm chỗ duy nhất
  select * into r from dang_ky_xe(u_m, '29M-222.22', 'xe_may');
  if r.trang_thai <> 'hang_cho' then
    raise exception 'FAIL 7: chiec thu hai cua M con trong han muc can, phai xep hang (%)', r.trang_thai;
  end if;
  update unit_vehicles set dang_ky_luc = timestamptz '2026-02-01 08:00+07'
   where unit_id = u_m and plate = '29M-222.22';
  perform set_config('test.uid', n::text, true);
  perform dang_ky_xe(u_n, '29N-333.33', 'xe_may');            -- xếp sau M
  update unit_vehicles set dang_ky_luc = timestamptz '2026-02-01 09:00+07'
   where unit_id = u_n and plate = '29N-333.33';

  perform set_config('test.uid', bql::text, true);
  perform dat_han_muc_bai_xe(t2, 'xe_may', 2, 1);   -- nới hầm lên 2, SIẾT mỗi căn còn 1
  select * into r from duyet_xe_tiep(t2, 'xe_may');
  if r.bien_so <> '29N-333.33' then
    raise exception 'FAIL 7b: hang cho bi ket o nguoi da kin han muc — phai goi 29N-333.33, nhan duoc %', r.bien_so;
  end if;
  if (select trang_thai from unit_vehicles where plate = '29M-222.22' and unit_id = u_m) <> 'qua_han_muc' then
    raise exception 'FAIL 7c: chiec bi vuot han muc phai chuyen sang qua_han_muc, khong nam lai trong hang';
  end if;

  -- ── 8. Nới hạn mức thì xét lại, và GIỮ NGUYÊN chỗ đã xếp ──
  -- Nới xong mà không xét lại thì xe nằm ở qua_han_muc mãi: duyet_xe_tiep không
  -- bao giờ nhìn tới đó, còn chủ xe thì thấy trạng thái đứng yên sau khi BQL đã
  -- hứa nới.
  so := dat_han_muc_bai_xe(t2, 'xe_may', 2, 2);
  if so <> 1 then raise exception 'FAIL 8: noi han muc phai xet lai 1 xe, xet lai %', so; end if;
  select trang_thai, dang_ky_luc into r from unit_vehicles
   where plate = '29M-222.22' and unit_id = u_m;
  if r.trang_thai <> 'hang_cho' then
    raise exception 'FAIL 8b: noi han muc roi ma xe van nam o qua_han_muc';
  end if;
  -- GIỮ NGUYÊN giờ đăng ký. Đẩy xuống cuối hàng là phạt người ta vì một hạn
  -- mức mà BQL đặt rồi đổi ý — họ đã đợi từ hôm đó, không phải từ hôm nay.
  if r.dang_ky_luc <> timestamptz '2026-02-01 08:00+07' then
    raise exception 'FAIL 8c: xet lai han muc lam mat cho da xep (gio dang ky doi thanh %)', r.dang_ky_luc;
  end if;

  -- ── 9. Quyền ──
  -- Không phải chủ hộ thì không đăng ký hộ được: xe đăng ký dưới tên căn khác
  -- là chiếm chỗ của người ta bằng chính hạn mức của họ.
  perform set_config('test.uid', d::text, true);
  begin
    perform dang_ky_xe(u_a, '30Z-999.99', 'o_to');
    raise exception 'FAIL 9: nguoi la dang ky duoc xe cho can khac';
  exception when insufficient_privilege then null;
  end;
  begin
    perform duyet_xe_tiep(t1, 'o_to');
    raise exception 'FAIL 9b: cu dan tu duyet duoc hang cho';
  exception when insufficient_privilege then null;
  end;
  begin
    perform dat_han_muc_bai_xe(t1, 'o_to', 99, 99);
    raise exception 'FAIL 9c: cu dan tu dat duoc han muc bai xe';
  exception when insufficient_privilege then null;
  end;
  begin
    perform cho_do_cua_can(u_a);
    raise exception 'FAIL 9d: cu dan xem duoc cho do cua can khac';
  exception when insufficient_privilege then null;
  end;
  begin
    perform bai_xe_tong_quan(p_x);
    raise exception 'FAIL 9e: cu dan xem duoc toan canh bai xe';
  exception when insufficient_privilege then null;
  end;

  -- ── 10. Toàn cảnh cho BQL chỉ ra tòa QUÊN đặt hạn mức ──
  -- dang_ky_xe() cho qua khi chưa có cấu hình, nên một tòa quên đặt sẽ âm thầm
  -- nhận xe không giới hạn cho tới lúc hầm đầy thật. Màn này là chỗ duy nhất
  -- nhìn ra điều đó.
  perform set_config('test.uid', c::text, true);
  perform dang_ky_xe(u_c, '30C-777.77', 'xe_dap');   -- X1 chưa đặt hạn mức xe đạp
  perform set_config('test.uid', bql::text, true);
  select * into k from bai_xe_tong_quan(p_x) where building_id = t1 and loai = 'xe_dap';
  -- Không tìm thấy dòng nào cũng là hỏng, và hỏng theo kiểu lặng lẽ nhất: màn
  -- của BQL sẽ không hiện gì cả, nên tòa quên đặt hạn mức trông y hệt tòa
  -- không có xe nào.
  if not found then raise exception 'FAIL 10: toan canh bo qua loai xe chua dat han muc'; end if;
  if k.co_han_muc then raise exception 'FAIL 10b: toa chua dat han muc ma bao la co'; end if;
  if k.dang_dung <> 1 then raise exception 'FAIL 10c: khong dem duoc xe o loai chua dat han muc'; end if;

  raise notice 'TEST XE PASSED — han muc can va suc chua ham tach bach, hang cho theo gio dang ky va khong bi ket, noi han muc thi xet lai';
end $test$;
