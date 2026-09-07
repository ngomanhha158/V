-- Bề mặt schema mà bootstrap_bql.sql dựa vào.
--
-- bootstrap_bql.sql chạy ĐÚNG MỘT LẦN trong đời một tòa nhà, lúc go-live, bằng
-- tay, trong Console của Railway. Nó không nằm trong đường chạy nào của app nên
-- không có gì phát hiện ra khi nó mục — và chỗ nó mục lộ ra là đúng buổi dựng
-- hệ thống, lúc không còn ai để hỏi. Bài này giữ đúng những thứ nó cần.

do $test$
declare
  p_1 uuid := 'aaaaaaaa-0000-0000-0000-000000200001';
  u_1 uuid := '99990000-0000-0000-0000-000000200001';
  v_id uuid; v_ten text; n int;
begin
  -- ── 1. Kiểu staff_role còn nhận 'bql_manager' ──
  -- Script khai `v_role staff_role := 'bql_manager'`. Đổi tên nhãn này là
  -- script chết ngay dòng khai báo, trước cả khi làm gì.
  if 'bql_manager' <> all (enum_range(null::staff_role)::text[]) then
    raise exception 'FAIL 1: staff_role khong con nhan bql_manager';
  end if;

  -- ── 2. projects còn cột name + address ──
  -- Nhánh "DB trống thì tự tạo dự án" ghi đúng hai cột này.
  insert into projects (id, name, address) values (p_1, 'Khu Bootstrap', '1 Đường Thử');
  select id, name into v_id, v_ten from projects where id = p_1;
  if v_ten <> 'Khu Bootstrap' then raise exception 'FAIL 2: khong doc lai duoc ten du an'; end if;

  -- ── 3. profiles còn email/phone/full_name để tra người ──
  insert into profiles (id, full_name, email, phone)
    values (u_1, 'Người Bootstrap', 'Boot@Example.COM', '0900000300');

  -- Script hạ chữ thường CẢ HAI VẾ. Bỏ một vế là email gõ hoa không tra ra, và
  -- người chạy script tưởng tài khoản chưa tồn tại nên đi tạo thêm cái thứ hai.
  select id into v_id from profiles where lower(email) = lower('boot@EXAMPLE.com');
  if v_id is distinct from u_1 then
    raise exception 'FAIL 3: tra email khong phan biet hoa thuong that bai';
  end if;

  -- ── 4. staff_assignments nhận đúng bộ cột, và upsert được ──
  -- Script dùng `on conflict (user_id, project_id, role) do update`. Không còn
  -- ràng buộc duy nhất trên đúng ba cột đó thì chạy lại script lần hai là lỗi,
  -- mà chạy lại là chuyện bình thường lúc dựng hệ thống.
  insert into staff_assignments (user_id, project_id, role, is_active)
  values (u_1, p_1, 'bql_manager', true)
  on conflict (user_id, project_id, role) do update set is_active = true;

  insert into staff_assignments (user_id, project_id, role, is_active)
  values (u_1, p_1, 'bql_manager', true)
  on conflict (user_id, project_id, role) do update set is_active = true;

  select count(*) into n from staff_assignments where user_id = u_1;
  if n <> 1 then raise exception 'FAIL 4: chay lai script sinh ra % dong thay vi 1', n; end if;

  -- ── 5. Gán xong thì is_staff phải BẬT ──
  -- Đây là lời hứa duy nhất của cả script: sau khi chạy, người đó mở được /bql.
  perform set_config('test.uid', u_1::text, true);
  if not is_staff(p_1) then
    raise exception 'FAIL 5: gan bql_manager roi ma is_staff van false — man /bql van dong';
  end if;

  -- ── 6. Thu hồi bằng is_active = false thì is_staff phải TẮT ──
  -- Dòng "Thu hồi" ở cuối script hứa điều này. Nếu is_staff bỏ qua is_active
  -- thì thu hồi quyền là một câu lệnh chạy xong mà không thu hồi gì.
  update staff_assignments set is_active = false where user_id = u_1;
  if is_staff(p_1) then
    raise exception 'FAIL 6: is_active=false ma is_staff van true — khong thu hoi duoc quyen';
  end if;

  raise notice 'TEST BOOTSTRAP PASSED — bootstrap_bql.sql con dat duoc len schema nay';
end $test$;
