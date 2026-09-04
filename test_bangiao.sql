-- Smoke test chốt sổ bàn giao. Chạy sau schema.sql + seed.sql.
--
-- Cả tính năng dựng lên để giữ MỘT lời hứa: con số của ngày chốt không đổi nữa.
-- Hỏng lời hứa đó thì tháng sau có người trả tiền là bên đã bàn giao bị quy
-- trách nhiệm cho một khoản họ chưa từng nhìn thấy.

do $test$
declare
  p_g  uuid := 'aaaaaaaa-0000-0000-0000-000000090000';
  t_g  uuid := 'bbbbbbbb-0000-0000-0000-000000090001';
  bql  uuid := '99990000-0000-0000-0000-000000090001';
  bqt  uuid := '99990000-0000-0000-0000-000000090002';
  bqt2 uuid := '99990000-0000-0000-0000-000000090003';
  ca_hai uuid := '99990000-0000-0000-0000-000000090004';   -- vừa BQL vừa BQT
  cu   uuid := '99990000-0000-0000-0000-00000009000a';
  u_a uuid; u_b uuid; ft uuid;
  hd_a uuid; hd_b uuid; hd_c uuid;
  moc date := current_date - 30;
  c1 uuid; c2 uuid;
  r record; n int; m bigint;
begin
  insert into projects (id, name) values (p_g, 'Khu ban giao');
  insert into buildings (id, project_id, code, name) values (t_g, p_g, 'G1', 'Toa G1');
  insert into units (building_id, code, floor_no) values (t_g,'G1-01.01',1), (t_g,'G1-01.02',1);
  select id into u_a from units where building_id = t_g and code = 'G1-01.01';
  select id into u_b from units where building_id = t_g and code = 'G1-01.02';

  insert into profiles (id, full_name, phone) values
    (bql,'Truong BQL','0900000130'), (bqt,'Thanh vien BQT','0900000131'),
    (bqt2,'Thanh vien BQT 2','0900000132'), (ca_hai,'Kiem ca hai vai','0900000133'),
    (cu,'Cu dan','0900000134');
  insert into staff_assignments (user_id, project_id, role) values
    (bql, p_g, 'bql_manager'), (bqt, p_g, 'bqt'), (bqt2, p_g, 'bqt'),
    (ca_hai, p_g, 'bql_manager'), (ca_hai, p_g, 'bqt');
  insert into unit_memberships (unit_id, user_id, role, status) values (u_a, cu, 'owner', 'active');

  insert into fee_types (project_id, code, name, calc_method, unit_price)
    values (p_g, 'QLY-G', 'Phi quan ly', 'per_unit', 100000) returning id into ft;

  -- Fixture dựng để HAI CÁCH TÍNH SAI ĐỀU LỘ RA. Mốc chốt là 30 ngày trước,
  -- còn hôm nay là hôm nay — nên "quá hạn 90 ngày" tính theo mốc khác hẳn tính
  -- theo hôm nay, và "đã trả" tính tới mốc khác hẳn cột paid_amount.
  --
  -- hd_a: quá hạn theo CẢ HAI mốc, chưa trả gì trước mốc.
  insert into invoices (unit_id, project_id, period, total_amount, status, due_date)
    values (u_a, p_g, current_date - 200, 1000000, 'issued', current_date - 195)
    returning id into hd_a;
  -- hd_c: quá hạn nếu tính theo HÔM NAY (95 ngày) nhưng CHƯA quá hạn tính theo
  -- mốc chốt (mốc trừ 90 là 120 ngày trước). Lấy nhầm mốc là con số này nhảy vào.
  insert into invoices (unit_id, project_id, period, total_amount, status, due_date)
    values (u_a, p_g, current_date - 100, 500000, 'issued', current_date - 95)
    returning id into hd_c;
  -- hd_b: trả một phần TRƯỚC mốc.
  insert into invoices (unit_id, project_id, period, total_amount, status, due_date)
    values (u_b, p_g, current_date - 45, 800000, 'partial', current_date - 40)
    returning id into hd_b;
  insert into payments (invoice_id, unit_id, amount, paid_at)
    values (hd_b, u_b, 300000, (current_date - 40)::timestamptz);
  update invoices set paid_amount = 300000 where id = hd_b;
  -- KHOẢN TRẢ SAU MỐC, trước khi chốt sổ. Đây là ca thật nhất: đóng sổ ngày
  -- 30/09 vào hôm 02/10, mà tiền về ngày 01/10. Cột paid_amount đã cộng khoản
  -- này; phép tính tới mốc thì không được cộng.
  insert into payments (invoice_id, unit_id, amount, paid_at)
    values (hd_a, u_a, 400000, (current_date - 10)::timestamptz);
  update invoices set paid_amount = 400000, status = 'partial' where id = hd_a;

  -- ── 1. Công nợ tính TỚI MỐC, không lấy paid_amount ──
  perform set_config('test.uid', bql::text, true);
  -- 1.000.000 (hd_a, khoản trả sau mốc KHÔNG tính) + 500.000 (hd_c)
  -- + 500.000 (hd_b còn thiếu) = 2.000.000
  select coalesce(sum(phai_thu),0) into m from cong_no_toi_moc(p_g, moc);
  if m <> 2000000 then raise exception 'FAIL 1: tong phai thu toi moc la % thay vi 2000000', m; end if;
  -- Chỉ hd_a quá hạn 90 ngày TÍNH TỪ MỐC. hd_c quá hạn nếu tính từ hôm nay,
  -- nhưng bản chốt nói về ngày chốt chứ không nói về hôm nay.
  select coalesce(sum(qua_han_90),0) into m from cong_no_toi_moc(p_g, moc);
  if m <> 1000000 then raise exception 'FAIL 1b: qua han 90 ngay la % thay vi 1000000', m; end if;

  -- ── 2. Lập bản chốt ──
  c1 := lap_chot_ban_giao(p_g, moc, 'Ban giao dot 1');
  select so_can, so_can_no, tong_phai_thu, qua_han_90 into r from chot_ban_giao where id = c1;
  if r.so_can <> 2 then raise exception 'FAIL 2: dem % can thay vi 2', r.so_can; end if;
  if r.so_can_no <> 2 then raise exception 'FAIL 2b: dem % can co no thay vi 2', r.so_can_no; end if;
  if r.tong_phai_thu <> 2000000 then raise exception 'FAIL 2c: tong phai thu %', r.tong_phai_thu; end if;
  select count(*) into n from chot_ban_giao_can where chot_id = c1;
  if n <> 2 then raise exception 'FAIL 2d: chi tiet % dong thay vi 2', n; end if;
  -- Mã căn CHÉP vào bản chốt, không join lúc đọc.
  select ma_can into r from chot_ban_giao_can where chot_id = c1 order by phai_thu desc limit 1;
  if r.ma_can <> 'G1-01.01' then raise exception 'FAIL 2e: khong chep ma can'; end if;

  -- ── 3. SỐ LIỆU ĐÓNG BĂNG — đây là cả lý do tồn tại của bảng này ──
  -- Sau khi chốt, có người trả hết nợ. Bản chốt KHÔNG được đổi theo, nếu không
  -- bên đã bàn giao bị quy trách nhiệm cho một khoản họ chưa từng nhìn thấy.
  insert into payments (invoice_id, unit_id, amount, paid_at)
    values (hd_a, u_a, 600000, now());
  update invoices set paid_amount = 1000000, status = 'paid' where id = hd_a;
  select tong_phai_thu into m from chot_ban_giao where id = c1;
  if m <> 2000000 then raise exception 'FAIL 3: ban chot tu doi theo (%)', m; end if;
  select phai_thu into m from chot_ban_giao_can where chot_id = c1 and ma_can = 'G1-01.01';
  if m <> 1500000 then raise exception 'FAIL 3b: chi tiet can tu doi theo (%)', m; end if;
  -- Và truy vấn sống thì ĐÃ đổi — chứng minh bài test trên không rỗng.
  select coalesce(sum(phai_thu),0) into m from cong_no_toi_moc(p_g, current_date);
  if m <> 1000000 then raise exception 'FAIL 3c: truy van song khong doi (%), test dong bang vo nghia', m; end if;

  -- ── 4. Một mốc một bản chốt ──
  begin
    perform lap_chot_ban_giao(p_g, moc);
    raise exception 'FAIL 4: lap duoc hai ban chot cho cung mot moc';
  exception when unique_violation then null;
  end;
  -- Không chốt cho ngày chưa tới.
  begin
    perform lap_chot_ban_giao(p_g, current_date + 5);
    raise exception 'FAIL 4b: chot duoc so cho mot ngay chua toi';
  exception when sqlstate '22023' then null;
  end;

  -- ── 5. Cư dân không lập, không ký ──
  perform set_config('test.uid', cu::text, true);
  begin
    perform lap_chot_ban_giao(p_g, current_date - 2);
    raise exception 'FAIL 5: cu dan lap duoc chot so';
  exception when insufficient_privilege then null;
  end;
  begin
    perform ky_chot_ban_giao(c1);
    raise exception 'FAIL 5b: cu dan ky duoc chot so';
  exception when insufficient_privilege then null;
  end;

  -- ── 6. Bên nào ký suy ra từ VAI TRÒ, không cho tự chọn ──
  perform set_config('test.uid', bql::text, true);
  if ky_chot_ban_giao(c1) <> 'bql' then raise exception 'FAIL 6: truong BQL ky nham o'; end if;
  begin
    perform ky_chot_ban_giao(c1);
    raise exception 'FAIL 6b: ky duoc hai lan cung mot ben';
  exception when unique_violation then null;
  end;
  select ky_bqt_luc into r from chot_ban_giao where id = c1;
  if r.ky_bqt_luc is not null then raise exception 'FAIL 6c: BQL ky lam day luon o cua BQT'; end if;

  perform set_config('test.uid', bqt::text, true);
  if ky_chot_ban_giao(c1) <> 'bqt' then raise exception 'FAIL 6d: BQT ky nham o'; end if;

  -- ── 7. MỘT NGƯỜI KHÔNG KÝ ĐƯỢC CẢ HAI BÊN ──
  -- Ký cả hai thì "hai bên ký" chỉ còn là một người tự xác nhận với chính mình.
  perform set_config('test.uid', ca_hai::text, true);
  c2 := lap_chot_ban_giao(p_g, current_date - 3);
  if ky_chot_ban_giao(c2) <> 'bqt' then raise exception 'FAIL 7: nguoi kiem hai vai ky khong ra ben nao'; end if;
  begin
    -- Người này cũng là bql_manager; ràng buộc hai_ben_hai_nguoi phải chặn.
    update chot_ban_giao set ky_bql_luc = clock_timestamp(), ky_bql_boi = ca_hai where id = c2;
    raise exception 'FAIL 7b: mot nguoi ky duoc ca hai ben';
  exception when check_violation then null;
  end;

  -- ── 8. Đủ hai chữ ký thì không hủy được ──
  perform set_config('test.uid', bql::text, true);
  begin
    perform huy_chot_ban_giao(c1, 'Doi y');
    raise exception 'FAIL 8: huy duoc ban chot hai ben da ky';
  exception when check_violation then null;
  end;
  -- Chưa đủ chữ ký thì hủy được, nhưng phải ghi lý do.
  begin
    perform huy_chot_ban_giao(c2, '  ');
    raise exception 'FAIL 8b: huy duoc ma khong ghi ly do';
  exception when sqlstate '22023' then null;
  end;
  perform huy_chot_ban_giao(c2, 'Chot nham ngay');
  -- Bản đã hủy thì không ký thêm được nữa.
  perform set_config('test.uid', bql::text, true);
  begin
    perform ky_chot_ban_giao(c2);
    raise exception 'FAIL 8c: ky duoc ban chot da huy';
  exception when check_violation then null;
  end;

  -- ── 9. Neo vào nhật ký kiểm toán ──
  -- Không có neo thì bản chốt chỉ là một tờ giấy nói về quá khứ mà không gắn
  -- được vào thứ gì kiểm chứng lại được.
  select audit_den into m from chot_ban_giao where id = c1;
  if m is null then raise exception 'FAIL 9: khong neo vao nhat ky kiem toan'; end if;
  select count(*) into n from audit_log where project_id = p_g and id <= m;
  if n = 0 then raise exception 'FAIL 9b: neo tro vao mot cho khong co but toan nao'; end if;

  -- ── 10. RLS: cư dân đọc bản chốt, KHÔNG đọc công nợ hàng xóm ──
  begin execute 'create role vb_bg_test nologin'; exception when duplicate_object then null; end;
  execute 'grant usage on schema public to vb_bg_test';
  execute 'grant select on chot_ban_giao, chot_ban_giao_can to vb_bg_test';
  execute 'grant execute on function is_staff(uuid), current_unit_ids(), o_trong_du_an(uuid) to vb_bg_test';
  execute 'set local role vb_bg_test';

  perform set_config('test.uid', cu::text, true);
  select count(*) into n from chot_ban_giao where project_id = p_g;
  if n < 2 then raise exception 'FAIL 10: cu dan khong doc duoc ban chot (% dong)', n; end if;
  -- Chi tiết: chỉ dòng của CĂN MÌNH.
  select count(*) into n from chot_ban_giao_can where chot_id = c1;
  if n <> 1 then raise exception 'FAIL 10b: cu dan doc duoc % dong chi tiet thay vi 1', n; end if;
  select ma_can into r from chot_ban_giao_can where chot_id = c1;
  if r.ma_can <> 'G1-01.01' then raise exception 'FAIL 10c: doc duoc cong no hang xom'; end if;

  execute 'reset role';
  raise notice 'TEST BAN GIAO PASSED — so lieu dong bang, mot moc mot ban, hai ben hai nguoi ky, va du chu ky thi khong huy duoc';
end $test$;
