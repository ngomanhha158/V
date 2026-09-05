-- Smoke test báo cáo BQT hàng quý. Chạy sau schema.sql + seed.sql.
--
-- Lời hứa duy nhất: biên bản họp và báo cáo nói CÙNG MỘT CON SỐ mãi mãi. Mở lại
-- báo cáo quý III sau ba tháng mà thấy số khác thì biên bản quý III thành sai,
-- và không ai sửa được biên bản đã ký.

do $test$
declare
  p_b  uuid := 'aaaaaaaa-0000-0000-0000-000000150000';
  t_b  uuid := 'bbbbbbbb-0000-0000-0000-000000150001';
  bql  uuid := '99990000-0000-0000-0000-000000150001';
  bqt  uuid := '99990000-0000-0000-0000-000000150002';
  cu   uuid := '99990000-0000-0000-0000-00000015000a';
  p_x  uuid := 'aaaaaaaa-0000-0000-0000-000000150009';
  t_x  uuid := 'bbbbbbbb-0000-0000-0000-000000150009';
  u1 uuid; u2 uuid; ft uuid; bc uuid;
  -- Quý ĐÃ KẾT THÚC gần nhất, tính từ hôm nay — bài test không được phụ thuộc
  -- vào việc hôm chạy CI rơi vào quý mấy.
  q_nam int; q_quy int; q_tu date; q_den date;
  hd1 uuid; hd2 uuid; yc1 uuid; yc2 uuid; yc3 uuid;
  r record; n int; m bigint;
begin
  select nam, quy into q_nam, q_quy from quy_cua((date_trunc('quarter', current_date) - interval '1 day')::date);
  select tu, den into q_tu, q_den from moc_quy(q_nam, q_quy);

  insert into projects (id, name) values (p_b, 'Khu bao cao');
  insert into buildings (id, project_id, code, name) values (t_b, p_b, 'B1', 'Toa B1');
  insert into units (building_id, code, floor_no) values (t_b,'B1-01.01',1), (t_b,'B1-01.02',1);
  select id into u1 from units where building_id = t_b and code = 'B1-01.01';
  select id into u2 from units where building_id = t_b and code = 'B1-01.02';

  insert into profiles (id, full_name, phone) values
    (bql,'Truong BQL B','0900000190'), (bqt,'Thanh vien BQT B','0900000191'),
    (cu,'Cu dan','0900000192');
  insert into staff_assignments (user_id, project_id, role) values
    (bql, p_b, 'bql_manager'), (bqt, p_b, 'bqt');
  insert into unit_memberships (unit_id, user_id, role, status) values (u1, cu, 'owner', 'active');
  insert into fee_types (project_id, code, name, calc_method, unit_price)
    values (p_b, 'QLY-B', 'Phi quan ly', 'per_unit', 100000) returning id into ft;

  -- ── Fixture: hóa đơn trong quý, một trả đủ một trả một nửa ──
  insert into invoices (unit_id, project_id, period, total_amount, paid_amount, status, due_date)
    values (u1, p_b, q_tu, 1000000, 1000000, 'paid', q_tu + 15) returning id into hd1;
  insert into invoices (unit_id, project_id, period, total_amount, paid_amount, status, due_date)
    values (u2, p_b, q_tu, 1000000, 400000, 'partial', q_tu + 15) returning id into hd2;
  -- Căn u2 nợ THÊM một hóa đơn của kỳ TRƯỚC quý. Không có dòng này thì
  -- count(*) và count(distinct unit_id) cho ra cùng một số, và bài test không
  -- phân biệt được "3 căn đang nợ" với "3 hóa đơn đang nợ" — hai câu rất khác
  -- nhau khi BQT đọc báo cáo.
  insert into invoices (unit_id, project_id, period, total_amount, paid_amount, status, due_date)
    values (u2, p_b, (q_tu - interval '1 month')::date, 300000, 0, 'issued', q_tu - 15);
  -- Hóa đơn NGOÀI quý: không được lọt vào tổng của quý này.
  insert into invoices (unit_id, project_id, period, total_amount, paid_amount, status, due_date)
    values (u1, p_b, (q_den + interval '1 day')::date, 5000000, 0, 'issued', q_den + 16);
  -- Hóa đơn còn NHÁP: chưa phát hành thì chưa đòi ai, không tính vào phải thu.
  insert into invoices (unit_id, project_id, period, total_amount, paid_amount, status, due_date)
    values (u2, p_b, (q_tu + interval '1 month')::date, 7000000, 0, 'draft', q_tu + 45);

  -- Quỹ bảo trì: số dư đầu trước quý, một khoản chi trong quý.
  -- Khoản chi quỹ bảo trì bắt buộc có nghị quyết (§16) — đúng như bảng đòi hỏi.
  -- Khoản chi quỹ bảo trì bắt buộc có nghị quyết KÈM NGÀY (§16).
  insert into quy_bao_tri_giao_dich (project_id, loai, ngay, dien_giai, so_tien, nghi_quyet, ngay_nq)
    values (p_b, 'so_du_dau', q_tu - 10, 'So du ban giao', 500000000, null, null),
           (p_b, 'chi', q_tu + 20, 'Sua thang may', -96000000, 'NQ-03', q_tu + 10),
           (p_b, 'chi', q_den + 5, 'Chi sau quy', -10000000, 'NQ-04', q_den + 1);

  -- Yêu cầu: 3 trong quý (2 xong, 1 đúng hạn), 1 ngoài quý.
  insert into tickets (unit_id, building_id, project_id, reporter_id, category, title,
                       status, created_at, resolved_at, sla_resolve_due, rating)
    values (u1, t_b, p_b, cu, 'dien_nuoc', 'Xong dung han',
            'resolved', (q_tu + 2)::timestamptz, (q_tu + 3)::timestamptz,
            (q_tu + 5)::timestamptz, 5) returning id into yc1;
  insert into tickets (unit_id, building_id, project_id, reporter_id, category, title,
                       status, created_at, resolved_at, sla_resolve_due, rating)
    values (u1, t_b, p_b, cu, 'dien_nuoc', 'Xong tre han',
            'resolved', (q_tu + 4)::timestamptz, (q_tu + 20)::timestamptz,
            (q_tu + 6)::timestamptz, 3) returning id into yc2;
  -- Yêu cầu KHÔNG ĐẶT HẠN mà đã xong: không được đếm là đúng hạn, nếu không thì
  -- tỷ lệ SLA tự đẹp lên mỗi lần ai đó quên đặt hạn.
  insert into tickets (unit_id, building_id, project_id, reporter_id, category, title,
                       status, created_at, resolved_at)
    values (u1, t_b, p_b, cu, 'khac', 'Xong nhung khong dat han',
            'resolved', (q_tu + 6)::timestamptz, (q_tu + 7)::timestamptz)
    returning id into yc3;
  insert into tickets (unit_id, building_id, project_id, reporter_id, category, title,
                       status, created_at)
    values (u1, t_b, p_b, cu, 'khac', 'Ngoai quy', 'new', (q_den + 3)::timestamptz);

  -- ── 1. Ai lập được, và quý chưa xong thì không lập ──
  perform set_config('test.uid', cu::text, true);
  begin
    perform lap_bao_cao_quy(p_b, q_nam, q_quy);
    raise exception 'FAIL 1: cu dan lap duoc bao cao quy';
  exception when sqlstate '42501' then null;
  end;
  perform set_config('test.uid', bqt::text, true);
  begin
    -- Quý ĐANG chạy: nửa quý đặt cạnh một quý đủ là phép so sánh sai mà nhìn
    -- rất hợp lý.
    perform lap_bao_cao_quy(p_b,
      (select nam from quy_cua(current_date)), (select quy from quy_cua(current_date)));
    raise exception 'FAIL 1b: lap duoc bao cao cho quy chua ket thuc';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform lap_bao_cao_quy(p_b, q_nam, 9);
    raise exception 'FAIL 1c: nhan duoc quy 9';
  exception when sqlstate '22023' then null;
  end;

  bc := lap_bao_cao_quy(p_b, q_nam, q_quy);

  -- ── 2. MỘT QUÝ MỘT BÁO CÁO ──
  begin
    perform lap_bao_cao_quy(p_b, q_nam, q_quy);
    raise exception 'FAIL 2: lap duoc hai bao cao cho cung mot quy';
  exception when unique_violation then null;
  end;

  -- ── 3. Tiền: chỉ hóa đơn ĐÃ PHÁT HÀNH và ĐÚNG KỲ ──
  select hoa_don_phai_thu, hoa_don_da_thu, cong_no_cuoi_quy, so_can, so_can_no
    into r from bao_cao_quy where id = bc;
  if r.hoa_don_phai_thu <> 2000000 then
    raise exception 'FAIL 3: phai thu % thay vi 2000000 (lot hoa don ngoai ky hoac hoa don nhap?)',
      r.hoa_don_phai_thu;
  end if;
  if r.hoa_don_da_thu <> 1400000 then
    raise exception 'FAIL 3b: da thu % thay vi 1400000', r.hoa_don_da_thu;
  end if;
  -- Công nợ CUỐI QUÝ tính tới hết quý, nên hóa đơn kỳ sau không được cộng vào.
  -- 600.000 của kỳ trong quý + 300.000 của kỳ trước quý, và KHÔNG có 5.000.000
  -- của kỳ sau quý.
  if r.cong_no_cuoi_quy <> 900000 then
    raise exception 'FAIL 3c: cong no cuoi quy % thay vi 900000', r.cong_no_cuoi_quy;
  end if;
  -- MỘT căn đang nợ, dù nó nợ hai hóa đơn. "2 căn đang nợ" trong một khu 2 căn
  -- là một câu rất khác với "1 căn đang nợ".
  if r.so_can <> 2 or r.so_can_no <> 1 then
    raise exception 'FAIL 3d: % can, % can no (dem theo hoa don thay vi theo can?)',
      r.so_can, r.so_can_no;
  end if;

  -- ── 4. Quỹ bảo trì: đầu kỳ, cuối kỳ, chi trong kỳ ──
  select quy_bao_tri_dau, quy_bao_tri_cuoi, quy_chi_trong_quy into r
    from bao_cao_quy where id = bc;
  if r.quy_bao_tri_dau <> 500000000 then
    raise exception 'FAIL 4: so du dau ky % thay vi 500000000', r.quy_bao_tri_dau;
  end if;
  -- Khoản chi SAU quý không được trừ vào số dư cuối quý.
  if r.quy_bao_tri_cuoi <> 404000000 then
    raise exception 'FAIL 4b: so du cuoi ky % thay vi 404000000 (tinh ca khoan chi sau quy?)',
      r.quy_bao_tri_cuoi;
  end if;
  if r.quy_chi_trong_quy <> 96000000 then
    raise exception 'FAIL 4c: chi trong quy % thay vi 96000000', r.quy_chi_trong_quy;
  end if;

  -- ── 5. SLA: không đặt hạn thì không đếm là đúng hạn ──
  select so_yeu_cau, so_yeu_cau_xong, so_yeu_cau_dung_han, so_danh_gia, tong_diem
    into r from bao_cao_quy where id = bc;
  if r.so_yeu_cau <> 3 then
    raise exception 'FAIL 5: % yeu cau trong quy thay vi 3 (lot yeu cau ngoai quy?)', r.so_yeu_cau;
  end if;
  if r.so_yeu_cau_xong <> 3 then
    raise exception 'FAIL 5b: % yeu cau xong thay vi 3', r.so_yeu_cau_xong;
  end if;
  -- Chỉ MỘT cái vừa xong vừa có hạn vừa kịp hạn. Đếm cả cái không đặt hạn thì
  -- tỷ lệ SLA tự đẹp lên mỗi lần có người quên đặt hạn.
  if r.so_yeu_cau_dung_han <> 1 then
    raise exception 'FAIL 5c: % yeu cau dung han thay vi 1', r.so_yeu_cau_dung_han;
  end if;
  if r.so_danh_gia <> 2 or r.tong_diem <> 8 then
    raise exception 'FAIL 5d: % danh gia, tong % diem', r.so_danh_gia, r.tong_diem;
  end if;

  -- ── 6. BẢN CHỤP ĐÓNG BĂNG ──
  -- Đây là cả lời hứa của tính năng: đổi dữ liệu gốc thì báo cáo KHÔNG đổi.
  update invoices set paid_amount = 1000000, status = 'paid' where id = hd2;
  insert into quy_bao_tri_giao_dich (project_id, loai, ngay, dien_giai, so_tien)
    values (p_b, 'thu', q_tu + 25, 'Thu them sau khi da lap bao cao', 200000000);
  select hoa_don_da_thu, quy_bao_tri_cuoi into r from bao_cao_quy where id = bc;
  if r.hoa_don_da_thu <> 1400000 then
    raise exception 'FAIL 6: bao cao doi theo du lieu goc (da thu thanh %)', r.hoa_don_da_thu;
  end if;
  if r.quy_bao_tri_cuoi <> 404000000 then
    raise exception 'FAIL 6b: so du quy trong bao cao doi thanh %', r.quy_bao_tri_cuoi;
  end if;

  -- ── 7. Neo vào nhật ký kiểm toán ──
  select audit_den into r from bao_cao_quy where id = bc;
  if r.audit_den is null then
    raise exception 'FAIL 7: bao cao khong neo vao nhat ky kiem toan';
  end if;
  select count(*) into n from audit_log where project_id = p_b and bang = 'bao_cao_quy';
  if n = 0 then raise exception 'FAIL 7b: lap bao cao khong vao nhat ky'; end if;

  -- ── 8. Hủy rồi mới lập lại được ──
  perform set_config('test.uid', cu::text, true);
  begin
    perform huy_bao_cao_quy(bc, 'Toi khong thich');
    raise exception 'FAIL 8: cu dan huy duoc bao cao';
  exception when sqlstate '42501' then null;
  end;
  perform set_config('test.uid', bql::text, true);
  begin
    perform huy_bao_cao_quy(bc, '  ');
    raise exception 'FAIL 8b: huy duoc ma khong ghi ly do';
  exception when sqlstate '22023' then null;
  end;
  perform huy_bao_cao_quy(bc, 'Thieu khoan thu thang cuoi, lap lai');
  begin
    perform huy_bao_cao_quy(bc, 'Huy lan hai');
    raise exception 'FAIL 8c: huy duoc mot bao cao hai lan';
  exception when sqlstate '23505' then null;
  end;
  -- Hủy rồi thì lập lại được, và bản mới lấy số liệu MỚI.
  bc := lap_bao_cao_quy(p_b, q_nam, q_quy);
  select hoa_don_da_thu into r from bao_cao_quy where id = bc;
  if r.hoa_don_da_thu <> 2000000 then
    raise exception 'FAIL 8d: ban lap lai van lay so cu (%)', r.hoa_don_da_thu;
  end if;
  -- Bản đã hủy VẪN NẰM LẠI: biên bản họp quý trước trỏ vào nó.
  select count(*) into n from bao_cao_quy where project_id = p_b;
  if n <> 2 then raise exception 'FAIL 8e: co % ban thay vi 2 (ban da huy bi xoa?)', n; end if;

  -- ── 9. Job nền chạy lại được ──
  select sinh_bao_cao_quy() into n;
  select count(*) into n from bao_cao_quy where project_id = p_b and huy_luc is null;
  if n <> 1 then raise exception 'FAIL 9: job nen sinh them ban thu % cho cung mot quy', n; end if;

  -- ── 10. Mốc quý tính đúng, kể cả quý IV ──
  select tu, den into r from moc_quy(2026, 1);
  if r.tu <> date '2026-01-01' or r.den <> date '2026-03-31' then
    raise exception 'FAIL 10: quy I/2026 la % - %', r.tu, r.den;
  end if;
  select tu, den into r from moc_quy(2026, 4);
  if r.tu <> date '2026-10-01' or r.den <> date '2026-12-31' then
    raise exception 'FAIL 10b: quy IV/2026 la % - %', r.tu, r.den;
  end if;
  select nam, quy into r from quy_cua(date '2026-12-31');
  if r.nam <> 2026 or r.quy <> 4 then
    raise exception 'FAIL 10c: 31/12/2026 thuoc quy %/%', r.quy, r.nam;
  end if;
  select nam, quy into r from quy_cua(date '2026-01-01');
  if r.quy <> 1 then raise exception 'FAIL 10d: 01/01 thuoc quy %', r.quy; end if;

  -- ── 10b. Hàm đọc chỉ trả về báo cáo của ĐÚNG dự án ──
  insert into projects (id, name) values (p_x, 'Khu khac');
  insert into buildings (id, project_id, code, name) values (t_x, p_x, 'X1', 'Toa X1');
  insert into units (building_id, code, floor_no) values (t_x, 'X1-01.01', 1);
  perform tinh_bao_cao_quy(p_x, q_nam, q_quy);
  perform set_config('test.uid', bql::text, true);
  select count(*) into n from bao_cao_quy_ds(p_b);
  if n <> 2 then
    raise exception 'FAIL 10e: doc duoc % bao cao thay vi 2 cua dung du an nay', n;
  end if;
  -- Và BQL của khu này KHÔNG đọc được báo cáo của khu khác, kể cả khi gọi
  -- thẳng hàm với id khu đó: cửa quyền nằm trong hàm chứ không ở màn hình.
  select count(*) into n from bao_cao_quy_ds(p_x);
  if n <> 0 then raise exception 'FAIL 10f: BQL khu nay doc duoc % bao cao cua khu khac', n; end if;

  -- ── 11. RLS: CẢ KHU đọc được ──
  begin execute 'create role vb_bc_test nologin'; exception when duplicate_object then null; end;
  execute 'grant usage on schema public to vb_bc_test';
  execute 'grant select on bao_cao_quy to vb_bc_test';
  execute 'grant execute on function is_staff(uuid), o_trong_du_an(uuid) to vb_bc_test';
  execute 'set local role vb_bc_test';

  perform set_config('test.uid', cu::text, true);
  select count(*) into n from bao_cao_quy;
  if n <> 2 then
    raise exception 'FAIL 11: cu dan doc duoc % bao cao thay vi 2 — bao cao quy la thu BQT mang ra hop voi cu dan', n;
  end if;
  execute 'reset role';

  raise notice 'TEST BAO CAO QUY PASSED — ban chup dong bang, mot quy mot ban, va SLA khong tu dep len khi quen dat han';
end $test$;
