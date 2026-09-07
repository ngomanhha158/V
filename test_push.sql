-- Smoke test "thông báo đẩy" (§30). Chạy sau schema.sql + seed.sql.
--
-- Lời hứa: người đang nợ NHẬN ĐƯỢC lời nhắc. Ba job nhắc đã dựng xong từ lâu và
-- chỉ ghi một dòng vào notifications; phần này là thứ đưa dòng đó ra tới điện
-- thoại. Hỏng ở đây không kêu lên thành lỗi — nó chỉ làm mọi lời nhắc im lặng.

do $test$
declare
  a  uuid := '99990000-0000-0000-0000-000000300001';
  b  uuid := '99990000-0000-0000-0000-000000300002';
  ep text := 'https://fcm.example/ep-a';
  n_a bigint; n_cu bigint; n_doc bigint; n int; r record;
begin
  insert into profiles (id, full_name, phone) values
    (a, 'Nguoi A push', '0900000310'), (b, 'Nguoi B push', '0900000311');

  -- ── 1. Đăng ký gắn với NGƯỜI ĐANG ĐĂNG NHẬP, không phải tham số ──
  -- Hàm không nhận user_id. Nhận thì trình duyệt gắn được endpoint của mình vào
  -- tài khoản người khác, và từ đó đọc trộm mọi thông báo của họ.
  perform set_config('test.uid', a::text, true);
  perform push_dang_ky_may(ep, 'khoa-p256dh', 'khoa-auth', 'Chrome trên Android');
  select count(*) into n from push_dang_ky where user_id = a and endpoint = ep;
  if n <> 1 then raise exception 'FAIL 1: dang ky khong gan vao nguoi dang dang nhap'; end if;

  -- ── 2. Chưa đăng nhập thì KHÔNG đăng ký được ──
  perform set_config('test.uid', '', true);
  begin
    perform push_dang_ky_may('https://fcm.example/ep-vo-danh', 'x', 'y', null);
    raise exception 'FAIL 2: chua dang nhap ma van dang ky duoc push';
  exception when insufficient_privilege then null;
  end;

  -- ── 2b. Đăng ký THIẾU KHOÁ bị chặn ngay ──
  -- Nhận vào một đăng ký rỗng thì nó nằm trong bảng như một máy hợp lệ, hàng
  -- đợi kéo nó ra mỗi 15 phút, và mọi lần đẩy đều hỏng ở tầng mã hoá. Nhìn từ
  -- log thì giống hệt "nhà cung cấp push đang trục trặc".
  perform set_config('test.uid', a::text, true);
  begin
    perform push_dang_ky_may('https://fcm.example/ep-rong', '', 'khoa-auth', null);
    raise exception 'FAIL 2b: dang ky thieu p256dh van ghi duoc';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform push_dang_ky_may('https://fcm.example/ep-rong', 'khoa-p256dh', '   ', null);
    raise exception 'FAIL 2c: dang ky thieu auth van ghi duoc';
  exception when invalid_parameter_value then null;
  end;
  select count(*) into n from push_dang_ky where endpoint = 'https://fcm.example/ep-rong';
  if n <> 0 then raise exception 'FAIL 2d: dang ky rong van nam lai trong bang'; end if;

  -- ── 3. Cùng một máy, người khác đăng nhập → CHUYỂN CHỦ ──
  -- Máy dùng chung: người trước đăng xuất, người sau đăng ký. Bỏ qua (do nothing)
  -- là thông báo của người trước tiếp tục hiện trên máy người sau đang cầm.
  perform set_config('test.uid', b::text, true);
  perform push_dang_ky_may(ep, 'khoa-moi', 'auth-moi', 'Chrome trên Android');
  select count(*) into n from push_dang_ky where endpoint = ep;
  if n <> 1 then raise exception 'FAIL 3: mot endpoint sinh ra % dong', n; end if;
  select user_id into r from push_dang_ky where endpoint = ep;
  if r.user_id is distinct from b then
    raise exception 'FAIL 3b: endpoint khong chuyen sang nguoi vua dang ky';
  end if;
  -- Trả lại cho A để các bước sau chạy trên A.
  perform set_config('test.uid', a::text, true);
  perform push_dang_ky_may(ep, 'khoa-p256dh', 'khoa-auth', 'Chrome trên Android');

  -- ── 4. Hàng đợi: chỉ thông báo CHƯA đẩy, CHƯA đọc, và còn mới ──
  insert into notifications (user_id, kind, title, body) values (a, 'invoice', 'Sap den han', 'T-3')
    returning id into n_a;
  insert into notifications (user_id, kind, title, body, sent_push_at)
    values (a, 'invoice', 'Da day roi', null, now());
  insert into notifications (user_id, kind, title, body, read_at)
    values (a, 'invoice', 'Da doc trong app', null, now()) returning id into n_doc;
  insert into notifications (user_id, kind, title, body, created_at)
    values (a, 'invoice', 'Cu qua 24h', null, now() - interval '2 days') returning id into n_cu;

  select count(*) into n from thong_bao_can_day(200) where id = n_a;
  if n <> 1 then raise exception 'FAIL 4: thong bao moi khong vao hang doi'; end if;

  select count(*) into n from thong_bao_can_day(200) where title = 'Da day roi';
  if n <> 0 then raise exception 'FAIL 4b: day lai thong bao da day'; end if;

  -- Đã đọc trong app rồi thì đẩy ra màn hình khoá là phiền, không phải phục vụ.
  select count(*) into n from thong_bao_can_day(200) where id = n_doc;
  if n <> 0 then raise exception 'FAIL 4c: day thong bao nguoi ta da doc'; end if;

  -- Nhắc nợ của tuần trước hiện ra màn hình khoá hôm nay còn tệ hơn không hiện.
  select count(*) into n from thong_bao_can_day(200) where id = n_cu;
  if n <> 0 then raise exception 'FAIL 4d: day thong bao cu hon 24 gio'; end if;

  -- ── 5. Hàng đợi mang theo KHOÁ của máy ──
  -- Thiếu khoá thì không mã hoá được, và job nền chỉ biết là "đẩy hỏng".
  select * into r from thong_bao_can_day(200) where id = n_a;
  if r.endpoint is distinct from ep or coalesce(r.p256dh, '') = '' or coalesce(r.auth, '') = '' then
    raise exception 'FAIL 5: hang doi thieu khoa cua may';
  end if;

  -- ── 6. Người không đăng ký máy nào thì không nằm trong hàng đợi ──
  insert into notifications (user_id, kind, title) values (b, 'invoice', 'B chua bat push');
  select count(*) into n from thong_bao_can_day(200) where title = 'B chua bat push';
  if n <> 0 then raise exception 'FAIL 6: nguoi chua bat push van vao hang doi'; end if;

  -- ── 7. Đánh dấu đã đẩy: chạy lại KHÔNG đếm lại ──
  -- Job nền chạy 15 phút/lần; đếm lại là con số trong log phồng lên và không
  -- còn dùng để biết hệ thống có thật sự gửi được gì không.
  select thong_bao_da_day(array[n_a]) into n;
  if n <> 1 then raise exception 'FAIL 7: danh dau da day tra ve %', n; end if;
  select thong_bao_da_day(array[n_a]) into n;
  if n <> 0 then raise exception 'FAIL 7b: danh dau lan hai van dem %', n; end if;
  select count(*) into n from thong_bao_can_day(200) where id = n_a;
  if n <> 0 then raise exception 'FAIL 7c: danh dau roi ma van con trong hang doi'; end if;

  -- ── 8. Máy chết thì GỠ HẲN ──
  -- Giữ lại thì mỗi ngày lại đẩy vào một endpoint đã chết, và tỷ lệ lỗi che mất
  -- lỗi thật.
  select push_go_endpoint_chet(array[ep]) into n;
  if n <> 1 then raise exception 'FAIL 8: khong go duoc endpoint chet'; end if;
  select count(*) into n from push_dang_ky where endpoint = ep;
  if n <> 0 then raise exception 'FAIL 8b: endpoint chet van con trong bang'; end if;

  raise notice 'TEST PUSH PASSED — dang ky gan dung nguoi, hang doi loc dung, danh dau khong dem lai';
end $test$;
