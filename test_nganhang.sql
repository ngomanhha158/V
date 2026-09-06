-- Smoke test "tài khoản nhận tiền là của từng khu". Chạy sau schema.sql + seed.sql.
--
-- Lời hứa: tiền về đúng sổ của khu nhận nó. Sai chỗ này không hiện ra thành
-- một màn hình lỗi — nó hiện ra ba tuần sau, lúc đối soát, dưới dạng khu A
-- thừa tiền và khu B thiếu tiền đúng bằng chừng ấy.

do $test$
declare
  p_a  uuid := 'aaaaaaaa-0000-0000-0000-000000170001';
  p_b  uuid := 'aaaaaaaa-0000-0000-0000-000000170002';
  t_a  uuid := 'bbbbbbbb-0000-0000-0000-000000170001';
  t_b  uuid := 'bbbbbbbb-0000-0000-0000-000000170002';
  bql_a uuid := '99990000-0000-0000-0000-000000170001';
  nv_a  uuid := '99990000-0000-0000-0000-000000170002';
  bql_b uuid := '99990000-0000-0000-0000-000000170003';
  cu_a  uuid := '99990000-0000-0000-0000-000000170004';
  u_a uuid; u_b uuid; r record; n int; v_id uuid;
begin
  -- Ca "cả hệ thống chỉ có MỘT khu" không thử được ở đây: file này chạy chung
  -- database với mọi file test khác, lúc này trong bảng đã có cả chục dự án.
  -- Ca đó nằm ở test_motkhu.sql, chạy trên schema còn trắng.
  insert into projects (id, name) values (p_a, 'Khu A');
  insert into buildings (id, project_id, code, name) values (t_a, p_a, 'A1', 'Toa A1');
  insert into units (building_id, code, floor_no) values (t_a, 'A1-01.01', 1);
  select id into u_a from units where building_id = t_a;

  -- ── 2. Khu thứ hai xuất hiện: KHÔNG được đoán nữa ──
  insert into projects (id, name) values (p_b, 'Khu B');
  insert into buildings (id, project_id, code, name) values (t_b, p_b, 'B1', 'Toa B1');
  insert into units (building_id, code, floor_no) values (t_b, 'B1-01.01', 1);
  select id into u_b from units where building_id = t_b;

  if du_an_nhan_tien(null) is not null then
    raise exception 'FAIL 2: hai khu ma van doan mot khu — day la tien ghi nham so';
  end if;
  if du_an_nhan_tien('0123456789') is not null then
    raise exception 'FAIL 2b: so tai khoan khong khai cho khu nao ma van ra mot khu';
  end if;

  -- ── 3. Khai tài khoản rồi thì tra ra đúng khu ──
  insert into profiles (id, full_name, phone) values
    (bql_a,'Truong BQL A','0900000210'), (nv_a,'Nhan vien A','0900000211'),
    (bql_b,'Truong BQL B','0900000212'), (cu_a,'Cu dan A','0900000213');
  insert into staff_assignments (user_id, project_id, role) values
    (bql_a, p_a, 'bql_manager'), (nv_a, p_a, 'bql_staff'), (bql_b, p_b, 'bql_manager');
  insert into unit_memberships (unit_id, user_id, role, status) values (u_a, cu_a, 'owner', 'active');

  perform set_config('test.uid', bql_a::text, true);
  perform dat_tk_nhan_tien(p_a, '970436', '1234567890', 'BAN QUAN LY KHU A');
  perform set_config('test.uid', bql_b::text, true);
  perform dat_tk_nhan_tien(p_b, '970422', '9876543210', 'BAN QUAN LY KHU B');

  if du_an_nhan_tien('1234567890') is distinct from p_a then
    raise exception 'FAIL 3: tra nham khu A';
  end if;
  if du_an_nhan_tien('9876543210') is distinct from p_b then
    raise exception 'FAIL 3b: tra nham khu B';
  end if;

  -- ── 4. Chuẩn hóa: người nhập chép cả dấu cách, webhook gửi số trần ──
  perform set_config('test.uid', bql_a::text, true);
  perform dat_tk_nhan_tien(p_a, '970 436', '1234 5678 90', 'BAN QUAN LY KHU A');
  select bank_bin, bank_account into r from projects where id = p_a;
  if r.bank_account <> '1234567890' or r.bank_bin <> '970436' then
    raise exception 'FAIL 4: khong chuan hoa (bin=%, tk=%)', r.bank_bin, r.bank_account;
  end if;
  -- Và tra bằng chuỗi có dấu cách cũng phải ra đúng khu.
  if du_an_nhan_tien('1234 5678 90') is distinct from p_a then
    raise exception 'FAIL 4b: tra bang so co dau cach thi khong khop';
  end if;

  -- ── 5. Hai khu không được khai trùng một số tài khoản ──
  -- Trùng thì không ai biết tiền về là của khu nào, và lúc phát hiện thì sai
  -- đã nằm trong sổ.
  begin
    perform set_config('test.uid', bql_b::text, true);
    perform dat_tk_nhan_tien(p_b, '970436', '1234567890', 'Khu B nhan nham');
    raise exception 'FAIL 5: hai khu khai trung mot so tai khoan';
  exception when unique_violation then null;
  end;

  -- ── 6. Chỉ TRƯỞNG BQL đổi được. Đây là chỗ tiền chảy về đâu ──
  begin
    perform set_config('test.uid', nv_a::text, true);
    perform dat_tk_nhan_tien(p_a, '970436', '5555555555', 'Nhan vien tu doi');
    raise exception 'FAIL 6: nhan vien BQL doi duoc tai khoan nhan tien';
  exception when insufficient_privilege then null;
  end;
  begin
    perform set_config('test.uid', cu_a::text, true);
    perform dat_tk_nhan_tien(p_a, '970436', '5555555555', 'Cu dan tu doi');
    raise exception 'FAIL 6b: cu dan doi duoc tai khoan nhan tien';
  exception when insufficient_privilege then null;
  end;
  -- Trưởng BQL khu A KHÔNG đổi được tài khoản khu B.
  begin
    perform set_config('test.uid', bql_a::text, true);
    perform dat_tk_nhan_tien(p_b, '970436', '5555555555', 'Khu A doi cua khu B');
    raise exception 'FAIL 6c: truong BQL khu A doi duoc tai khoan khu B';
  exception when insufficient_privilege then null;
  end;

  -- ── 7. Nửa cấu hình bị chặn: có BIN mà không có số, hoặc ngược lại ──
  perform set_config('test.uid', bql_a::text, true);
  begin
    perform dat_tk_nhan_tien(p_a, '970436', '', 'Thieu so tai khoan');
    raise exception 'FAIL 7: khai BIN ma khong khai so tai khoan van qua';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform dat_tk_nhan_tien(p_a, '', '1234567890', 'Thieu BIN');
    raise exception 'FAIL 7b: khai so tai khoan ma khong khai BIN van qua';
  exception when invalid_parameter_value then null;
  end;

  -- ── 7b. Ràng buộc ở TẦNG BẢNG cũng chặn nửa cấu hình ──
  -- Không thừa: runbook go-live có bước gõ SQL tay vào Console của Postgres,
  -- và ở đó hàm dat_tk_nhan_tien không nằm trên đường đi. Chốt trong hàm bảo
  -- vệ màn hình; chốt ở bảng bảo vệ database.
  begin
    update projects set bank_bin = '970436', bank_account = null where id = p_b;
    raise exception 'FAIL 7c: ghi thang vao bang duoc nua cau hinh';
  exception when check_violation then null;
  end;

  -- ── 8. Xóa được, và xóa rồi thì số cũ không còn tra ra khu nào ──
  perform dat_tk_nhan_tien(p_a, '', '', null);
  select bank_bin, bank_account into r from projects where id = p_a;
  if r.bank_bin is not null or r.bank_account is not null then
    raise exception 'FAIL 8: xoa khong sach';
  end if;
  if du_an_nhan_tien('1234567890') is not null then
    raise exception 'FAIL 8b: so tai khoan da xoa van tra ra mot khu';
  end if;

  -- ── 9. Màn hóa đơn đọc được tài khoản của khu MÌNH, không của khu khác ──
  perform set_config('test.uid', bql_a::text, true);
  perform dat_tk_nhan_tien(p_a, '970436', '1234567890', 'BAN QUAN LY KHU A');

  perform set_config('test.uid', cu_a::text, true);
  select bin, so_tk into r from tk_nhan_tien(p_a);
  if r.so_tk <> '1234567890' or r.bin <> '970436' then
    raise exception 'FAIL 9: cu dan khong doc duoc tai khoan khu minh o';
  end if;
  select count(*) into n from tk_nhan_tien(p_b);
  if n <> 0 then
    raise exception 'FAIL 9b: cu dan khu A doc duoc tai khoan nhan tien cua khu B';
  end if;

  -- ── 10. Tiền về đúng sổ: hai giao dịch, hai tài khoản, hai khu ──
  -- Đây là ca mà cả phần này sinh ra để chặn.
  perform ghi_nhan_tien_ve(du_an_nhan_tien('1234567890'), 'sepay', 'TX-A-1',
                           500000, 'A1-01.01 thanh toan', now());
  perform ghi_nhan_tien_ve(du_an_nhan_tien('9876543210'), 'sepay', 'TX-B-1',
                           700000, 'B1-01.01 thanh toan', now());
  select count(*) into n from bank_transactions where project_id = p_a;
  if n <> 1 then raise exception 'FAIL 10: khu A co % giao dich thay vi 1', n; end if;
  select count(*) into n from bank_transactions where project_id = p_b;
  if n <> 1 then raise exception 'FAIL 10b: khu B co % giao dich thay vi 1', n; end if;
  select amount into r from bank_transactions where project_id = p_b;
  if r.amount <> 700000 then
    raise exception 'FAIL 10c: khu B nhan % thay vi 700000 — tien ghi nham so', r.amount;
  end if;

  raise notice 'TEST NGAN HANG PASSED — tien ve dung so cua khu nhan no, va nhieu khu thi tha tu choi con hon doan';
end $test$;
