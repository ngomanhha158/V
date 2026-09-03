-- Smoke test quỹ bảo trì 2%. Chạy sau schema.sql + seed.sql.
--
-- Đây là tiền của cư dân và là mục có rủi ro pháp lý nếu làm sai, nên bài này
-- kiểm hai lời hứa: sổ không sửa được (chỉ đảo), và cả tòa đọc được sổ. Lời hứa
-- thứ hai mới là cơ chế giám sát thật — siết quyền ghi mà không ai đọc được thì
-- vẫn là một cuốn sổ chỉ người giữ tiền nhìn thấy.

do $test$
declare
  p_v  uuid := 'aaaaaaaa-0000-0000-0000-000000050000';
  p_khac uuid := 'aaaaaaaa-0000-0000-0000-000000050099';
  t_v  uuid := 'bbbbbbbb-0000-0000-0000-000000050001';
  t_k  uuid := 'bbbbbbbb-0000-0000-0000-000000050099';
  bql  uuid := '99990000-0000-0000-0000-000000050001';
  bqt  uuid := '99990000-0000-0000-0000-000000050002';
  bao_ve uuid := '99990000-0000-0000-0000-000000050003';
  cu_dan uuid := '99990000-0000-0000-0000-00000005000a';
  nguoi_nha uuid := '99990000-0000-0000-0000-00000005000b';
  la     uuid := '99990000-0000-0000-0000-00000005000c';
  u_a uuid; u_k uuid;
  gd_chi uuid; gd_dao uuid; gd_thu uuid;
  n int; m bigint; r record;
begin
  insert into projects (id, name) values (p_v, 'Khu quy'), (p_khac, 'Khu khac');
  insert into buildings (id, project_id, code, name) values
    (t_v, p_v, 'V1', 'Toa V1'), (t_k, p_khac, 'K1', 'Toa K1');
  insert into units (building_id, code, floor_no) values (t_v,'V1-01.01',1), (t_k,'K1-01.01',1);
  select id into u_a from units where building_id = t_v and code = 'V1-01.01';
  select id into u_k from units where building_id = t_k and code = 'K1-01.01';

  insert into profiles (id, full_name, phone) values
    (bql,'Truong BQL quy','0900000090'), (bqt,'Thanh vien BQT','0900000091'),
    (bao_ve,'Bao ve','0900000092'), (cu_dan,'Cu dan V1','0900000093'),
    (nguoi_nha,'Nguoi nha V1','0900000094'), (la,'Cu dan khu khac','0900000095');
  insert into staff_assignments (user_id, project_id, role) values
    (bql, p_v, 'bql_manager'), (bqt, p_v, 'bqt'), (bao_ve, p_v, 'security');
  insert into unit_memberships (unit_id, user_id, role, status) values
    (u_a, cu_dan, 'owner', 'active'),
    (u_a, nguoi_nha, 'family', 'active'),
    (u_k, la, 'owner', 'active');

  -- ── 1. Số dư đầu kỳ: quỹ có trước khi có phần mềm ──
  perform set_config('test.uid', bql::text, true);
  perform quy_ghi(p_v, 'so_du_dau', date '2026-01-01', 'So du ban giao tu chu dau tu', 2184500000);
  if quy_so_du(p_v) <> 2184500000 then raise exception 'FAIL 1: so du dau ky sai (%)', quy_so_du(p_v); end if;

  -- Hai dòng số dư đầu kỳ là nhân đôi cả quỹ.
  begin
    perform quy_ghi(p_v, 'so_du_dau', date '2026-01-02', 'So du dau lan hai', 100);
    raise exception 'FAIL 1b: ghi duoc hai dong so du dau ky';
  exception when unique_violation then null;
  end;

  -- ── 2. Lãi ngân hàng thuộc về QUỸ ──
  -- Bỏ sót khoản này là lãi của tiền cư dân chảy vào chỗ khác mà sổ không ghi.
  perform quy_ghi(p_v, 'lai', date '2026-03-31', 'Lai ngan hang quy I', 18420000);
  if quy_so_du(p_v) <> 2202920000 then raise exception 'FAIL 2: lai khong cong vao quy'; end if;

  -- ── 3. CHI PHẢI CÓ NGHỊ QUYẾT BQT ──
  -- Điều kiện của luật, nên nó là ràng buộc database chứ không phải một phép
  -- kiểm trong app mà nhánh nào đó quên gọi.
  begin
    perform quy_ghi(p_v, 'chi', date '2026-04-10', 'Sua thang may', 96000000);
    raise exception 'FAIL 3: chi duoc ma khong co nghi quyet';
  exception when check_violation then null;
  end;
  begin
    perform quy_ghi(p_v, 'chi', date '2026-04-10', 'Sua thang may', 96000000, '  ', date '2026-04-05');
    raise exception 'FAIL 3b: so nghi quyet toan khoang trang van qua';
  exception when check_violation then null;
  end;
  -- Có số nghị quyết mà thiếu NGÀY cũng không được: một số nghị quyết không có
  -- ngày thì tra lại biên bản bằng cách nào.
  begin
    perform quy_ghi(p_v, 'chi', date '2026-04-10', 'Sua thang may', 96000000, 'NQ-03/2026');
    raise exception 'FAIL 3c: thieu ngay nghi quyet van qua';
  exception when check_violation then null;
  end;

  -- ── 4. Chi hợp lệ: người gọi đưa SỐ DƯƠNG, loại quyết định dấu ──
  -- Bắt màn hình tự đổi dấu là sớm muộn có chỗ quên, và quên dấu ở sổ quỹ nghĩa
  -- là khoản chi 96 triệu được ghi thành khoản thu 96 triệu.
  gd_chi := quy_ghi(p_v, 'chi', date '2026-04-10', 'Sua thang may thap A',
                    96000000, 'NQ-03/2026', date '2026-04-05');
  select so_tien into m from quy_bao_tri_giao_dich where id = gd_chi;
  if m <> -96000000 then raise exception 'FAIL 4: chi khong mang dau am (%)', m; end if;
  if quy_so_du(p_v) <> 2106920000 then
    raise exception 'FAIL 4b: so du sau chi sai (%)', quy_so_du(p_v);
  end if;

  -- ── 5. Quỹ không được âm ──
  -- Quỹ bảo trì âm không phải một trạng thái tài chính; nó là lỗi nhập liệu
  -- hoặc một khoản chi vượt quỹ, và cả hai đều phải dừng ở đây.
  begin
    perform quy_ghi(p_v, 'chi', date '2026-05-01', 'Chi vuot quy', 9999999999,
                    'NQ-04/2026', date '2026-04-28');
    raise exception 'FAIL 5: chi vuot quy van ghi duoc';
  exception when check_violation then null;
  end;
  if quy_so_du(p_v) <> 2106920000 then raise exception 'FAIL 5b: lan chi hong lam doi so du'; end if;

  -- ── 6. Sửa sai bằng ĐẢO, không bằng UPDATE ──
  gd_dao := quy_dao(gd_chi, 'Ghi nham thap, khoan nay la thap B');
  if quy_so_du(p_v) <> 2202920000 then
    raise exception 'FAIL 6: dao xong so du khong ve cho cu (%)', quy_so_du(p_v);
  end if;
  -- Dòng gốc PHẢI còn lại. Đảo mà xóa dòng gốc thì người đọc không biết là đã
  -- từng có một lần sai — đúng thứ mà một lệnh UPDATE lặng lẽ giấu đi.
  if not exists (select 1 from quy_bao_tri_giao_dich where id = gd_chi) then
    raise exception 'FAIL 6b: dao xong dong goc bien mat';
  end if;
  select count(*) into n from quy_bao_tri_giao_dich where project_id = p_v;
  if n <> 4 then raise exception 'FAIL 6c: so phai co 4 dong, dem duoc %', n; end if;

  -- Đảo hai lần là cộng ngược thành thừa tiền.
  begin
    perform quy_dao(gd_chi, 'dao lan hai');
    raise exception 'FAIL 6d: dao duoc hai lan cung mot dong';
  exception when unique_violation then null;
  end;
  -- Và không đảo được chính dòng đảo.
  begin
    perform quy_dao(gd_dao, 'dao cai dao');
    raise exception 'FAIL 6e: dao duoc mot dong dao';
  exception when check_violation then null;
  end;

  -- ── 7. Bảo vệ là is_staff nhưng KHÔNG ghi được sổ quỹ ──
  perform set_config('test.uid', bao_ve::text, true);
  begin
    perform quy_ghi(p_v, 'thu', date '2026-05-02', 'Bao ve tu ghi', 1000);
    raise exception 'FAIL 7: bao ve ghi duoc so quy';
  exception when insufficient_privilege then null;
  end;
  perform set_config('test.uid', cu_dan::text, true);
  begin
    perform quy_ghi(p_v, 'thu', date '2026-05-02', 'Cu dan tu ghi', 1000);
    raise exception 'FAIL 7b: cu dan ghi duoc so quy';
  exception when insufficient_privilege then null;
  end;

  -- ── 8. BQT ghi được — họ là người quyết chi ──
  perform set_config('test.uid', bqt::text, true);
  gd_thu := quy_ghi(p_v, 'thu', date '2026-05-03', 'Thu 2% can ban giao dot 2', 45000000);
  if quy_so_du(p_v) <> 2247920000 then raise exception 'FAIL 8: BQT ghi ma so du khong doi'; end if;

  -- ── 9. Đối chiếu ngân hàng ──
  -- Sổ tự nói sổ đúng thì không chứng minh gì. Con số duy nhất chứng minh quỹ
  -- còn nguyên là con số ngân hàng báo.
  perform quy_dat_doi_chieu(p_v, 'Vietcombank', '0011000123456', 2247920000, date '2026-05-03');
  select so_du_ngan_hang into m from quy_bao_tri where project_id = p_v;
  if m <> 2247920000 then raise exception 'FAIL 9: khong luu duoc so du ngan hang'; end if;
  perform set_config('test.uid', cu_dan::text, true);
  begin
    perform quy_dat_doi_chieu(p_v, 'X', '1', 1, current_date);
    raise exception 'FAIL 9b: cu dan dat duoc doi chieu';
  exception when insufficient_privilege then null;
  end;

  -- ── 10. RLS: CẢ TÒA đọc được sổ, khu khác thì không ──
  begin execute 'create role vb_quy_test nologin'; exception when duplicate_object then null; end;
  execute 'grant usage on schema public to vb_quy_test';
  execute 'grant select on quy_bao_tri, quy_bao_tri_giao_dich to vb_quy_test';
  execute 'grant execute on function quy_so_ke_toan(uuid) to vb_quy_test';
  execute 'grant execute on function is_staff(uuid), current_unit_ids(), o_trong_du_an(uuid) to vb_quy_test';
  execute 'set local role vb_quy_test';

  perform set_config('test.uid', cu_dan::text, true);
  select count(*) into n from quy_so_ke_toan(p_v);
  if n <> 5 then raise exception 'FAIL 10: cu dan doc duoc % dong thay vi ca so (5)', n; end if;

  -- Người nhà KHÔNG được bật can_view_finance vẫn đọc được quỹ. Cờ đó nói về
  -- công nợ CỦA CĂN — chuyện riêng trong một hộ. Quỹ bảo trì là tiền chung của
  -- cả tòa, và công khai chính là cơ chế giám sát.
  perform set_config('test.uid', nguoi_nha::text, true);
  select count(*) into n from quy_so_ke_toan(p_v);
  if n <> 5 then raise exception 'FAIL 10b: nguoi nha khong doc duoc quy chung (% dong)', n; end if;

  -- Cư dân khu KHÁC không đọc được gì.
  perform set_config('test.uid', la::text, true);
  select count(*) into n from quy_so_ke_toan(p_v);
  if n <> 0 then raise exception 'FAIL 10c: cu dan khu khac doc duoc % dong', n; end if;
  select count(*) into n from quy_bao_tri_giao_dich;
  if n <> 0 then raise exception 'FAIL 10d: doc thang bang la vong qua duoc RLS'; end if;

  -- ── 11. Lũy kế cộng dồn đúng thứ tự ngày ──
  perform set_config('test.uid', cu_dan::text, true);
  select luy_ke into m from quy_so_ke_toan(p_v) order by ngay desc, id desc limit 1;
  select * into r from quy_so_ke_toan(p_v) order by ngay, id limit 1;
  if r.luy_ke <> 2184500000 then
    raise exception 'FAIL 11: dong dau tien phai bang chinh no (%)', r.luy_ke;
  end if;
  -- Dòng cuối phải bằng số dư. Lệch nghĩa là cột lũy kế trên màn hình nói một
  -- đằng còn tổng nói một nẻo, mà người đọc tin cột lũy kế.
  if m <> 2247920000 then raise exception 'FAIL 11b: luy ke cuoi (%) khac so du', m; end if;

  execute 'reset role';
  raise notice 'TEST QUY BAO TRI PASSED — chi phai co nghi quyet, quy khong am, sua bang dao chu khong xoa, va ca toa doc duoc so';
end $test$;
