-- Smoke test khách thăm và sổ ra vào. Chạy sau schema.sql + seed.sql.
--
-- Hai lời hứa: bảo vệ SOI THỬ được mà không ghi vào sổ, và sổ chỉ ghi KHÁCH
-- chứ không ghi cư dân. Lời hứa thứ nhất là thứ quyết định sổ có đúng giờ hay
-- không; lời hứa thứ hai là ranh giới của cả tính năng.

do $test$
declare
  p_k  uuid := 'aaaaaaaa-0000-0000-0000-000000060000';
  p_x  uuid := 'aaaaaaaa-0000-0000-0000-000000060099';
  t_k  uuid := 'bbbbbbbb-0000-0000-0000-000000060001';
  t_x  uuid := 'bbbbbbbb-0000-0000-0000-000000060099';
  bv   uuid := '99990000-0000-0000-0000-000000060001';
  bv_x uuid := '99990000-0000-0000-0000-000000060002';
  chu  uuid := '99990000-0000-0000-0000-00000006000a';
  thue uuid := '99990000-0000-0000-0000-00000006000b';
  hang_xom uuid := '99990000-0000-0000-0000-00000006000c';
  u_a uuid; u_b uuid; u_x uuid;
  k1 uuid; ma1 text; k2 uuid; ma2 text; k3 uuid; ma3 text; k4 uuid; ma4 text;
  r record; n int; ty numeric;
begin
  insert into projects (id, name) values (p_k, 'Khu khach'), (p_x, 'Khu ngoai');
  insert into buildings (id, project_id, code, name) values
    (t_k, p_k, 'K1', 'Toa K1'), (t_x, p_x, 'X9', 'Toa X9');
  insert into units (building_id, code, floor_no) values
    (t_k,'K1-12.04',12), (t_k,'K1-12.05',12), (t_k,'K1-12.06',12), (t_x,'X9-01.01',1);
  select id into u_a from units where building_id = t_k and code = 'K1-12.04';
  select id into u_b from units where building_id = t_k and code = 'K1-12.05';
  select id into u_x from units where building_id = t_x and code = 'X9-01.01';

  insert into profiles (id, full_name, phone) values
    (bv,'Bao ve K1','0900000100'), (bv_x,'Bao ve khu ngoai','0900000101'),
    (chu,'Chu ho 12.04','0900000102'), (thue,'Nguoi thue 12.04','0900000103'),
    (hang_xom,'Chu ho 12.05','0900000104');
  insert into staff_assignments (user_id, project_id, role) values
    (bv, p_k, 'security'), (bv_x, p_x, 'security');
  insert into unit_memberships (unit_id, user_id, role, status) values
    (u_a, chu, 'owner', 'active'), (u_a, thue, 'tenant', 'active'),
    (u_b, hang_xom, 'owner', 'active');

  -- ── 1. Người trong căn mời khách; mã có HÌNH DẠNG riêng ──
  -- Ba loại mã của hệ thống (phiên đăng nhập, thẻ cư dân, mã khách) phải phân
  -- biệt được bằng hình dạng chứ không bằng quy ước tên claim.
  perform set_config('test.uid', thue::text, true);
  select id, ma into k1, ma1 from moi_khach(
    u_a, 'Nguyen Thi Lan', now() - interval '1 hour', now() + interval '4 hours',
    '0912004455', 'Tham nha');
  if length(ma1) <> 43 then raise exception 'FAIL 1: ma khach dai % ky tu', length(ma1); end if;
  -- Kiểm bộ ký tự trên HAI MƯƠI mã, không phải một. base64 thường chỉ sinh ra
  -- '+' hoặc '/' ở khoảng 1/64 ký tự, nên một mã lọt qua là chuyện thường —
  -- đúng một mã thì câu assert này xanh kể cả khi phép chuyển bộ ký tự sai.
  for n in 1..20 loop
    select ma into ma2 from moi_khach(
      u_a, 'Khach kiem hinh dang', now(), now() + interval '1 hour');
    if ma2 !~ '^[A-Za-z0-9_-]{43}$' then
      raise exception 'FAIL 1b: ma khach sai bo ky tu (%) — doc() co the nham la JWT', ma2;
    end if;
  end loop;
  delete from khach_tham where ho_ten = 'Khach kiem hinh dang';

  -- Người thuê mời được, không phải chờ chủ hộ duyệt: bắt chờ thì họ quay lại
  -- gọi điện xuống sảnh, và cả tính năng thành thừa.
  if k1 is null then raise exception 'FAIL 1c: nguoi thue khong moi duoc khach'; end if;

  -- ── 2. Người ngoài căn không mời được ──
  perform set_config('test.uid', hang_xom::text, true);
  begin
    perform moi_khach(u_a, 'Khach chui', now(), now() + interval '1 hour');
    raise exception 'FAIL 2: hang xom moi duoc khach vao can nguoi khac';
  exception when insufficient_privilege then null;
  end;

  perform set_config('test.uid', chu::text, true);
  begin
    perform moi_khach(u_a, '   ', now(), now() + interval '1 hour');
    raise exception 'FAIL 2b: moi duoc khach khong ten';
  exception when sqlstate '22023' then null;
  end;
  -- Cửa sổ hiệu lực dài vô hạn thì mã không còn là giấy mời, nó là chìa khóa.
  begin
    perform moi_khach(u_a, 'Khach o lai lau', now(), now() + interval '30 days');
    raise exception 'FAIL 2c: moi duoc khach voi ma song 30 ngay';
  exception when check_violation then null;
  end;

  -- ── 3. Cư dân KHÔNG quét được mã ──
  begin
    perform quet_khach(ma1, false);
    raise exception 'FAIL 3: cu dan quet duoc ma khach';
  exception when insufficient_privilege then null;
  end;
  -- Và mã BỊA cũng phải trả lời y hệt. Trả 'khong_co' cho mã bịa còn 42501 cho
  -- mã thật là biến hàm thành máy dò xem một mã có tồn tại hay không — người
  -- ngoài thử một mã, đọc câu trả lời, và biết mình đoán đúng hay sai.
  begin
    perform quet_khach('ma-hoan-toan-bia-dat-khong-co-that', false);
    raise exception 'FAIL 3b: nguoi ngoai phan biet duoc ma that voi ma bia';
  exception when insufficient_privilege then null;
  end;

  -- ── 4. SOI THỬ không ghi vào sổ ──
  -- Bảo vệ soi mã trước khi mở cửa. Lần soi đó mà đã ghi giờ vào thì sổ ghi sai
  -- giờ, và ghi cả những lượt cuối cùng không vào.
  perform set_config('test.uid', bv::text, true);
  select * into r from quet_khach(ma1, false);
  if not r.cho_vao then raise exception 'FAIL 4: ma dang hieu luc ma bao khong cho vao (%)', r.trang_thai; end if;
  if r.ho_ten <> 'Nguyen Thi Lan' then raise exception 'FAIL 4b: khong tra ve ten khach'; end if;
  if r.can <> 'K1-12.04' then raise exception 'FAIL 4c: khong tra ve ma can'; end if;
  if r.nguoi_moi <> 'Nguoi thue 12.04' then raise exception 'FAIL 4d: khong noi ai moi'; end if;
  select vao_luc into r from khach_tham where id = k1;
  if r.vao_luc is not null then raise exception 'FAIL 4e: soi thu ma da ghi gio vao so'; end if;

  -- ── 5. Quét thật: ghi giờ vào, rồi giờ ra ──
  select * into r from quet_khach(ma1, true);
  if r.vao_luc is null then raise exception 'FAIL 5: quet that ma khong ghi gio vao'; end if;
  if r.trang_thai <> 'trong_toa' then raise exception 'FAIL 5b: vao roi ma trang thai la %', r.trang_thai; end if;

  select * into r from quet_khach(ma1, true);
  if r.ra_luc is null then raise exception 'FAIL 5c: quet lan hai khong ghi gio ra'; end if;
  if r.trang_thai <> 'da_ra' then raise exception 'FAIL 5d: ra roi ma trang thai la %', r.trang_thai; end if;
  -- Giờ vào KHÔNG được ghi đè bởi lần quét thứ hai.
  select vao_luc, ra_luc into r from khach_tham where id = k1;
  if r.vao_luc >= r.ra_luc then raise exception 'FAIL 5e: gio vao bi ghi de bang gio ra'; end if;

  -- ── 6. Mã dùng xong thì thôi ──
  select * into r from quet_khach(ma1, true);
  if r.cho_vao then raise exception 'FAIL 6: ma da ra van cho vao lai'; end if;
  if r.loi is null then raise exception 'FAIL 6b: tu choi ma khong noi ly do'; end if;

  -- ── 7. Chưa tới giờ và quá giờ nói ra HAI lý do khác nhau ──
  -- Gộp thành "mã không hợp lệ" là bảo vệ không biết nên bảo khách chờ hay gọi
  -- lên căn hộ.
  perform set_config('test.uid', chu::text, true);
  select id, ma into k2, ma2 from moi_khach(
    u_a, 'Khach toi som', now() + interval '3 hours', now() + interval '5 hours');
  select id, ma into k3, ma3 from moi_khach(
    u_a, 'Khach hom qua', now() - interval '5 hours', now() - interval '3 hours');
  perform set_config('test.uid', bv::text, true);
  select * into r from quet_khach(ma2, true);
  if r.cho_vao then raise exception 'FAIL 7: cho vao truoc gio hen'; end if;
  if r.trang_thai <> 'chua_toi_gio' then raise exception 'FAIL 7b: trang thai % thay vi chua_toi_gio', r.trang_thai; end if;
  select * into r from quet_khach(ma3, true);
  if r.trang_thai <> 'het_han' then raise exception 'FAIL 7c: trang thai % thay vi het_han', r.trang_thai; end if;
  if r.loi = (select loi from quet_khach(ma2, false)) then
    raise exception 'FAIL 7d: chua toi gio va het han noi cung mot cau';
  end if;

  -- ── 8. Mã bịa: trả lời gọn, KHÔNG ném lỗi ──
  select * into r from quet_khach('khong-phai-ma-that-dau', false);
  if r.trang_thai <> 'khong_co' then raise exception 'FAIL 8: ma bia tra ve %', r.trang_thai; end if;
  if r.cho_vao then raise exception 'FAIL 8b: ma bia van cho vao'; end if;

  -- ── 9. Thu hồi ──
  perform set_config('test.uid', chu::text, true);
  select id, ma into k4, ma4 from moi_khach(u_a, 'Khach bi huy', now(), now() + interval '2 hours');
  perform thu_hoi_khach(k4);
  perform set_config('test.uid', bv::text, true);
  select * into r from quet_khach(ma4, true);
  if r.cho_vao then raise exception 'FAIL 9: ma da thu hoi van cho vao'; end if;
  if r.trang_thai <> 'thu_hoi' then raise exception 'FAIL 9b: trang thai % thay vi thu_hoi', r.trang_thai; end if;

  -- Thu hồi mã của khách ĐANG Ở TRONG TÒA không đuổi được người ra. Nói thẳng
  -- thay vì để cư dân tưởng mình vừa làm được một việc.
  perform set_config('test.uid', chu::text, true);
  select id, ma into k4, ma4 from moi_khach(u_a, 'Khach dang o trong', now(), now() + interval '2 hours');
  perform set_config('test.uid', bv::text, true);
  perform quet_khach(ma4, true);
  perform set_config('test.uid', chu::text, true);
  begin
    perform thu_hoi_khach(k4);
    raise exception 'FAIL 9c: thu hoi duoc khach dang o trong toa ma khong canh bao';
  exception when check_violation then null;
  end;
  -- Hàng xóm không thu hồi được lượt khách của căn khác.
  perform set_config('test.uid', hang_xom::text, true);
  begin
    perform thu_hoi_khach(k2);
    raise exception 'FAIL 9d: hang xom thu hoi duoc khach cua can khac';
  exception when insufficient_privilege then null;
  end;

  -- ── 10. Bảo vệ khu KHÁC không quét được ──
  perform set_config('test.uid', bv_x::text, true);
  begin
    perform quet_khach(ma2, false);
    raise exception 'FAIL 10: bao ve khu khac quet duoc ma cua khu nay';
  exception when insufficient_privilege then null;
  end;

  -- ── 11. Sổ ra vào và tỷ lệ hộ dùng app ──
  perform set_config('test.uid', bv::text, true);
  select count(*) into n from so_ra_vao(p_k, (now() - interval '1 day')::date, (now() + interval '1 day')::date);
  if n < 4 then raise exception 'FAIL 11: so ra vao chi thay % luot', n; end if;

  -- Ngưỡng 50% mà kế hoạch đặt: dưới mức đó bảo vệ giữ sổ giấy song song. Con số
  -- phải tính được, không nằm trong một tài liệu.
  -- Ba căn, hai căn có người. Đo trên một khu mà MỌI căn đều có người thì câu
  -- assert xanh kể cả khi hàm luôn trả về 100 — và 100 là con số duy nhất khiến
  -- người trực ban tin là bỏ được sổ giấy.
  select tong_can, can_co_nguoi, ty_le into r from ty_le_ho_dung_app(p_k);
  if r.tong_can <> 3 then raise exception 'FAIL 11b: dem duoc % can thay vi 3', r.tong_can; end if;
  if r.can_co_nguoi <> 2 then raise exception 'FAIL 11c: dem duoc % can co nguoi thay vi 2', r.can_co_nguoi; end if;
  if r.ty_le <> 66.7 then raise exception 'FAIL 11d: 2/3 can ma ty le la %', r.ty_le; end if;
  -- Dưới ngưỡng 50% mà kế hoạch đặt thì bảo vệ phải giữ sổ giấy; 66.7 là trên.
  if r.ty_le < 50 then raise exception 'FAIL 11e: fixture nay le ra phai tren nguong'; end if;

  -- ── 12. RLS: căn mình thì thấy, căn khác thì không ──
  begin execute 'create role vb_khach_test nologin'; exception when duplicate_object then null; end;
  execute 'grant usage on schema public to vb_khach_test';
  execute 'grant select on khach_tham to vb_khach_test';
  execute 'grant execute on function is_staff(uuid), current_unit_ids() to vb_khach_test';
  execute 'set local role vb_khach_test';

  perform set_config('test.uid', chu::text, true);
  select count(*) into n from khach_tham where unit_id = u_a;
  if n < 4 then raise exception 'FAIL 12: chu ho chi thay % luot khach cua can minh', n; end if;
  -- Và đọc được cột `ma` — đó là thứ họ gửi lại cho khách qua Zalo.
  select count(*) into n from khach_tham where unit_id = u_a and ma is not null;
  if n < 4 then raise exception 'FAIL 12b: chu ho khong doc duoc ma de gui lai'; end if;

  perform set_config('test.uid', hang_xom::text, true);
  select count(*) into n from khach_tham where unit_id = u_a;
  if n <> 0 then raise exception 'FAIL 12c: hang xom doc duoc % luot khach cua can khac', n; end if;

  execute 'reset role';

  -- ── 13. Xóa sổ cũ theo hạn lưu ──
  -- Giữ mãi thì sổ ra vào thành một kho hồ sơ quan hệ của cư dân mà không ai
  -- xin phép để lập.
  insert into khach_tham (project_id, unit_id, ho_ten, ma, hieu_luc_tu, hieu_luc_den)
    values (p_k, u_a, 'Khach nam ngoai', 'ma-rat-cu-khong-trung-ai',
            now() - interval '200 days', now() - interval '200 days' + interval '2 hours');
  select count(*) into n from khach_tham where project_id = p_k;
  if xoa_khach_cu(90) <> 1 then raise exception 'FAIL 13: xoa sai so luong dong cu'; end if;
  select count(*) into n from khach_tham where project_id = p_k;
  if n < 4 then raise exception 'FAIL 13b: xoa lan vao ca luot khach con trong han'; end if;

  raise notice 'TEST KHACH THAM PASSED — soi thu khong ghi so, tu choi noi ro ly do, thu hoi khong duoi duoc nguoi da vao, va so ra vao co han luu';
end $test$;
