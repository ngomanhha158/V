-- Smoke test thẻ cư dân điện tử. Chạy sau schema.sql + seed.sql.
--
-- Cả tính năng đứng trên đúng một lời hứa: "thu hồi tức thì khi chấm dứt hợp
-- đồng thuê". Thẻ nhựa không giữ được lời hứa đó vì thu hồi là việc phải NHỚ
-- LÀM. Nếu hàm dưới đây đọc nhầm một dòng hợp đồng cũ, thẻ điện tử cũng hỏng
-- đúng kiểu ấy — chỉ khác là không ai cầm được thẻ lên mà nhìn.

do $test$
declare
  p_the uuid := 'aaaaaaaa-0000-0000-0000-000000020000';
  p_la  uuid := 'aaaaaaaa-0000-0000-0000-000000020001';   -- dự án khác
  b_the uuid := 'bbbbbbbb-0000-0000-0000-000000020000';
  b_la  uuid := 'bbbbbbbb-0000-0000-0000-000000020001';
  bv    uuid := '88880000-0000-0000-0000-000000020001';   -- bảo vệ đúng khu
  bv_la uuid := '88880000-0000-0000-0000-000000020002';   -- bảo vệ khu khác
  chu   uuid := '88880000-0000-0000-0000-000000020003';   -- chủ hộ
  thue  uuid := '88880000-0000-0000-0000-000000020004';   -- người thuê đã trả nhà
  cho   uuid := '88880000-0000-0000-0000-000000020005';   -- đang chờ duyệt
  quay  uuid := '88880000-0000-0000-0000-000000020006';   -- thuê, nghỉ, rồi thuê lại
  truoc uuid := '88880000-0000-0000-0000-000000020007';   -- ký trước, chưa tới ngày nhận nhà
  u_a uuid; u_b uuid; u_la uuid; r record; n int;
begin
  insert into projects (id, name) values (p_the,'Khu the'), (p_la,'Khu khac');
  insert into buildings (id, project_id, code, name) values
    (b_the, p_the,'T1','The 1'), (b_la, p_la,'K1','Khac 1');
  insert into units (building_id, code, floor_no) values
    (b_the,'T1-05.01',5), (b_the,'T1-05.02',5), (b_la,'K1-01.01',1);
  select id into u_a  from units where building_id = b_the and code = 'T1-05.01';
  select id into u_b  from units where building_id = b_the and code = 'T1-05.02';
  select id into u_la from units where building_id = b_la;

  insert into profiles (id, full_name, phone, avatar_url) values
    (bv,   'Bao ve khu the','0900000060', null),
    (bv_la,'Bao ve khu khac','0900000061', null),
    (chu,  'Chu ho co the','0900000062','/anh/chu.jpg'),
    (thue, 'Nguoi thue da tra nha','0900000063', null),
    (cho,  'Nguoi cho duyet','0900000064', null),
    (quay, 'Nguoi thue quay lai','0900000065', null),
    (truoc,'Nguoi ky truoc chua den','0900000066', null);
  insert into staff_assignments (user_id, project_id, role) values
    (bv, p_the,'security'), (bv_la, p_la,'security');

  insert into unit_memberships (unit_id, user_id, role, status, valid_from, valid_to) values
    (u_a, chu,  'owner','active',  current_date - 400, null),
    -- Hợp đồng thuê đã hết HÔM QUA. Đây là ca trung tâm của cả tính năng.
    (u_b, thue, 'tenant','active', current_date - 400, current_date - 1),
    (u_b, cho,  'tenant','pending',current_date,       null),
    -- Thuê một kỳ đã xong, rồi thuê lại kỳ mới đang chạy: HAI dòng cùng căn.
    (u_a, quay, 'tenant','expired',current_date - 400, current_date - 200),
    (u_a, quay, 'tenant','active', current_date - 30,  current_date + 200),
    -- Ký hợp đồng trước, mười ngày nữa mới nhận nhà. BQL nhập sẵn cho đỡ quên.
    (u_b, truoc,'tenant','active', current_date + 10,  current_date + 400);

  -- ── 1. Bảo vệ đúng khu quét thẻ chủ hộ ──
  perform set_config('test.uid', bv::text, true);
  select * into r from kiem_the(chu, u_a);
  if not r.con_hieu_luc then raise exception 'FAIL 1: the chu ho hop le ma bao khong hieu luc (%)', r.ly_do; end if;
  if r.ho_ten <> 'Chu ho co the' then raise exception 'FAIL 1b: sai ho ten: %', r.ho_ten; end if;
  if r.can <> 'T1-05.01' or r.toa <> 'The 1' then raise exception 'FAIL 1c: sai can/toa: % / %', r.can, r.toa; end if;
  if r.vai_tro <> 'owner' then raise exception 'FAIL 1d: sai vai tro: %', r.vai_tro; end if;
  -- Ảnh phải trả ra: bảo vệ đối chiếu MẶT NGƯỜI với thẻ, không phải đối chiếu
  -- cái tên với chính cái tên hiện trên màn hình.
  if r.anh is null then raise exception 'FAIL 1e: khong tra ve anh dai dien'; end if;

  -- ── 2. HỢP ĐỒNG THUÊ HẾT HẠN → THẺ CHẾT NGAY ──
  -- Lời hứa của cả tính năng nằm ở đúng ba dòng này. Không ai phải thu hồi gì.
  select * into r from kiem_the(thue, u_b);
  if r.con_hieu_luc then raise exception 'FAIL 2: hop dong thue het han hom qua ma the VAN vao duoc'; end if;
  if r.ly_do <> 'het_han' then raise exception 'FAIL 2b: ly do phai la het_han, nhan duoc %', r.ly_do; end if;
  -- Vẫn trả về tên và căn: bảo vệ cần biết người này LÀ AI để nói chuyện, chứ
  -- không phải nhận một màn hình đỏ trống không rồi tự đoán.
  if r.ho_ten is null or r.can is null then raise exception 'FAIL 2c: the het han thi giau luon danh tinh, bao ve khong biet dang noi chuyen voi ai'; end if;

  -- ── 3. Chưa được duyệt thì chưa phải cư dân ──
  select * into r from kiem_the(cho, u_b);
  if r.con_hieu_luc then raise exception 'FAIL 3: dang cho duyet ma da vao duoc'; end if;
  if r.ly_do <> 'cho_duyet' then raise exception 'FAIL 3b: ly do phai la cho_duyet, nhan duoc %', r.ly_do; end if;

  -- ── 4. Không có tư cách gì ở căn đó ──
  select * into r from kiem_the(chu, u_b);
  if r.con_hieu_luc then raise exception 'FAIL 4: chu ho can A vao duoc can B'; end if;
  if r.ly_do <> 'khong_thuoc' then raise exception 'FAIL 4b: ly do phai la khong_thuoc, nhan duoc %', r.ly_do; end if;

  -- ── 5. Hai dòng hợp đồng: phải đọc dòng ĐANG chạy, không đọc dòng cũ ──
  -- Lấy bừa dòng đầu tiên là từ chối một người đang ở thật, ngay trước mặt bảo
  -- vệ, và không có cách nào giải thích tại sao.
  select * into r from kiem_the(quay, u_a);
  if not r.con_hieu_luc then
    raise exception 'FAIL 5: nguoi thue lai bi doc trung hop dong cu, ly do %', r.ly_do;
  end if;

  -- ── 5b. Hợp đồng ký trước, chưa tới ngày nhận nhà ──
  -- BQL nhập trước cho đỡ quên là chuyện thường. Nhưng "đã nhập" không phải là
  -- "đã được vào": người này còn mười ngày nữa mới có quyền qua cửa, và nếu hệ
  -- thống cho vào sớm thì căn đó đang có hai người cùng quyền vào — người cũ
  -- chưa dọn ra, người mới đã vào được.
  select * into r from kiem_the(truoc, u_b);
  if r.con_hieu_luc then raise exception 'FAIL 5b: hop dong con 10 ngay nua moi bat dau ma the da vao duoc'; end if;
  if r.ly_do <> 'chua_toi_han' then raise exception 'FAIL 5c: ly do phai la chua_toi_han, nhan duoc %', r.ly_do; end if;

  -- ── 6. Không phải nhân sự thì không tra được thẻ của ai ──
  -- Thiếu chốt này thì bất kỳ ai đăng nhập cũng dựng một trang quét rồi tra ra
  -- họ tên cư dân của mọi khu, chỉ bằng cách đoán id căn hộ.
  perform set_config('test.uid', chu::text, true);
  begin
    perform kiem_the(thue, u_b);
    raise exception 'FAIL 6: cu dan thuong tra duoc the cua nguoi khac';
  exception when insufficient_privilege then null;
  end;

  -- ── 7. Nhân sự khu KHÁC cũng không tra được ──
  perform set_config('test.uid', bv_la::text, true);
  begin
    perform kiem_the(chu, u_a);
    raise exception 'FAIL 7: bao ve khu khac tra duoc the khu nay';
  exception when insufficient_privilege then null;
  end;

  -- ── 8. Căn không có thật ──
  perform set_config('test.uid', bv::text, true);
  begin
    perform kiem_the(chu, '00000000-0000-0000-0000-0000000000ff');
    raise exception 'FAIL 8: tra duoc the cho mot can khong ton tai';
  exception when no_data_found then null;
  end;

  raise notice 'TEST THE PASSED — het han la chet ngay, hai dong hop dong doc dung dong dang chay, va chi nhan su dung du an moi tra duoc';
end $test$;
