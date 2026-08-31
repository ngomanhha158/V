-- Smoke test đối soát tiền về (N19–N20). Chạy sau schema.sql + seed.sql.
-- ponytail: đây là đường TIỀN. Sai ở đây không văng lỗi — nó gạch nợ cho nhầm
-- căn, hoặc gạch hai lần, và chỉ lộ ra lúc cư dân cầm sao kê đến cãi. Nên test
-- bám vào đúng những chỗ đó: bắn trùng, chia tiền cho nhiều hóa đơn, tiền dư,
-- và ranh giới giữa "khớp chắc chắn" với "để người thật quyết".

do $test$
declare
  p_ds   uuid := 'aaaaaaaa-0000-0000-0000-0000000000e0';
  b_ds   uuid := 'bbbbbbbb-0000-0000-0000-0000000000e0';
  p_khac uuid := 'aaaaaaaa-0000-0000-0000-0000000000e9';
  b_khac uuid := 'bbbbbbbb-0000-0000-0000-0000000000e9';
  u_a uuid; u_b uuid; u_dai uuid; u_ngan uuid; u_khac uuid;
  s_bql uuid := '77770000-0000-0000-0000-0000000000e1';
  c_dan uuid := '77770000-0000-0000-0000-0000000000e2';
  hd1 uuid; hd2 uuid; hd_b uuid; hd_mot_phan uuid;
  v_thang date := (date_trunc('month', current_date) - interval '2 months')::date;
  kq  jsonb;
  r   record;
  n   int;
  v_paid bigint; v_stat text;
begin
  insert into projects (id, name) values
    (p_ds, 'Khu test doi soat'), (p_khac, 'Khu hang xom');
  insert into buildings (id, project_id, code, name) values
    (b_ds, p_ds, 'E1', 'Doi soat 1'), (b_khac, p_khac, 'X9', 'Hang xom');
  insert into units (building_id, code, floor_no, area_m2) values
    (b_ds, 'E1-10.01', 10, 60), (b_ds, 'E1-10.02', 10, 70),
    (b_ds, 'E1-10.12', 10, 80), (b_ds, 'E1-10.1',  10, 50);
  -- Căn của khu hàng xóm cố ý TRÙNG mã với căn khu này: nếu hàm quên lọc dự
  -- án thì tiền của khu này chạy sang đó, và ngược lại.
  insert into units (building_id, code, floor_no, area_m2)
    values (b_khac, 'E1-10.01', 10, 60);
  select id into u_a    from units where building_id = b_ds   and code = 'E1-10.01';
  select id into u_b    from units where building_id = b_ds   and code = 'E1-10.02';
  select id into u_dai  from units where building_id = b_ds   and code = 'E1-10.12';
  select id into u_ngan from units where building_id = b_ds   and code = 'E1-10.1';
  select id into u_khac from units where building_id = b_khac and code = 'E1-10.01';

  insert into profiles (id, full_name) values (s_bql, 'BQL doi soat'), (c_dan, 'Cu dan');
  insert into staff_assignments (user_id, project_id, role)
    values (s_bql, p_ds, 'bql_manager');

  -- Căn A nợ 2 kỳ: 1.000.000 (cũ) và 2.000.000 (mới)
  insert into invoices (unit_id, project_id, period, total_amount, paid_amount, status, due_date)
    values (u_a, p_ds, v_thang, 1000000, 0, 'issued', v_thang + 15)
    returning id into hd1;
  insert into invoices (unit_id, project_id, period, total_amount, paid_amount, status, due_date)
    values (u_a, p_ds, (v_thang + interval '1 month')::date, 2000000, 0, 'issued',
            (v_thang + interval '1 month')::date + 15)
    returning id into hd2;
  -- Căn B: một hóa đơn đã trả một phần
  insert into invoices (unit_id, project_id, period, total_amount, paid_amount, status, due_date)
    values (u_b, p_ds, v_thang, 3000000, 1000000, 'partial', v_thang + 15)
    returning id into hd_mot_phan;

  perform set_config('test.uid', s_bql::text, true);

  -- ══════════ KHỚP TỰ ĐỘNG ═══════════════════════════════════════════════
  -- 1. Đúng dạng "VB <mã căn> <YYYYMM>" -> gạch được, và gạch vào hóa đơn CŨ
  --    NHẤT trước dù nội dung ghi kỳ nào đi nữa.
  kq := ghi_nhan_tien_ve(p_ds, 'sepay', 'SP-1', 1000000,
        'CT DEN:VB E1-10.01 ' || to_char(v_thang + interval '1 month', 'YYYYMM') || ' GD 123',
        now() - interval '1 day', 'FT001', '1234567890', '{"a":1}'::jsonb);
  if kq->>'trang_thai' <> 'da_khop' then
    raise exception 'FAIL 1a: khong tu khop duoc, ra %', kq;
  end if;
  select paid_amount, status::text into v_paid, v_stat from invoices where id = hd1;
  if v_paid <> 1000000 or v_stat <> 'paid' then
    raise exception 'FAIL 1b: hoa don CU ra paid=% status=%, phai la 1000000/paid', v_paid, v_stat;
  end if;
  select paid_amount into v_paid from invoices where id = hd2;
  if v_paid <> 0 then
    raise exception 'FAIL 1c: hoa don MOI bi gach % dong, phai la 0 (cu nhat truoc)', v_paid;
  end if;

  -- 2. HẠT NHÂN: bắn trùng. Nhà cung cấp nào cũng retry khi chưa thấy 200.
  kq := ghi_nhan_tien_ve(p_ds, 'sepay', 'SP-1', 1000000, 'VB E1-10.01 202608',
        now(), 'FT001', '1234567890', '{}'::jsonb);
  if (kq->>'trung')::boolean is not true then
    raise exception 'FAIL 2a: lan bắn thu hai khong bi nhan ra la trung, ra %', kq;
  end if;
  select count(*) into n from bank_transactions where provider = 'sepay' and provider_ref = 'SP-1';
  if n <> 1 then raise exception 'FAIL 2b: co % dong so tien ve, phai la 1', n; end if;
  select paid_amount into v_paid from invoices where id = hd1;
  if v_paid <> 1000000 then
    raise exception 'FAIL 2c: gach hai lan, hoa don thanh % dong', v_paid;
  end if;

  -- 3. HẠT NHÂN: một lần chuyển khoản trả cho NHIỀU hóa đơn.
  --    Căn B: hóa đơn thiếu 2.000.000. Trả 2.000.000 -> đủ.
  --    Căn A: hóa đơn mới còn 2.000.000, trả 3.000.000 -> dư 1.000.000.
  kq := ghi_nhan_tien_ve(p_ds, 'sepay', 'SP-2', 3000000, 'VB E1-10.01 202609',
        now(), 'FT002', '1234567890', '{}'::jsonb);
  if (kq->>'so_hoa_don')::int <> 1 then
    raise exception 'FAIL 3a: gach vao % hoa don, phai la 1', kq->>'so_hoa_don';
  end if;
  select paid_amount, status::text into v_paid, v_stat from invoices where id = hd2;
  if v_paid <> 2000000 or v_stat <> 'paid' then
    raise exception 'FAIL 3b: hoa don moi ra %/% ', v_paid, v_stat;
  end if;
  -- 4. Tiền dư KHÔNG bị nhét vào hóa đơn cho tròn số, cũng không biến mất.
  if (kq->>'con_du')::bigint <> 1000000 then
    raise exception 'FAIL 4a: con_du = %, phai la 1000000', kq->>'con_du';
  end if;
  select count(*) into n from invoices where unit_id = u_a and paid_amount > total_amount;
  if n <> 0 then raise exception 'FAIL 4b: co % hoa don bi thu qua so tien cua no', n; end if;

  -- 5. Hóa đơn đã trả một phần: chỉ gạch đúng phần còn thiếu rồi mới sang cái sau
  kq := ghi_nhan_tien_ve(p_ds, 'sepay', 'SP-3', 2000000, 'VB E1-10.02 202608',
        now(), 'FT003', '1234567890', '{}'::jsonb);
  select paid_amount, status::text into v_paid, v_stat from invoices where id = hd_mot_phan;
  if v_paid <> 3000000 or v_stat <> 'paid' then
    raise exception 'FAIL 5: hoa don tra mot phan ra %/%, phai la 3000000/paid', v_paid, v_stat;
  end if;

  -- 6. Ngân hàng bóp nội dung: mất dấu chấm/gạch, dính liền, thêm tiền tố
  kq := ghi_nhan_tien_ve(p_ds, 'sepay', 'SP-4', 500000,
        'TKThu:1234567890 VBE11002' || to_char(v_thang, 'YYYYMM') || 'Ma GD 9988',
        now(), 'FT004', '1234567890', '{}'::jsonb);
  if kq->>'trang_thai' <> 'da_khop' then
    raise exception 'FAIL 6: noi dung bi ngan hang bop thi mat khop, ra %', kq;
  end if;

  -- ══════════ KHÔNG KHỚP THÌ ĐỂ NGƯỜI THẬT QUYẾT ═════════════════════════
  -- 7. HẠT NHÂN: thiếu tiền tố VB -> KHÔNG tự gạch. Dò mã căn trần trong nội
  --    dung là mở đường cho một mã tham chiếu ngân hàng ngẫu nhiên cướp tiền.
  kq := ghi_nhan_tien_ve(p_ds, 'sepay', 'SP-5', 700000, 'Chuyen tien E1-10.01 thang 8',
        now(), 'FT005', '1234567890', '{}'::jsonb);
  if kq->>'trang_thai' <> 'chua_khop' then
    raise exception 'FAIL 7: thieu tien to VB ma van tu gach, ra %', kq;
  end if;

  -- 8. Có VB nhưng thiếu 6 chữ số kỳ -> cũng không tự gạch
  kq := ghi_nhan_tien_ve(p_ds, 'sepay', 'SP-6', 700000, 'VB E1-10.01 thang tam',
        now(), 'FT006', '1234567890', '{}'::jsonb);
  if kq->>'trang_thai' <> 'chua_khop' then
    raise exception 'FAIL 8: thieu ky ma van tu gach, ra %', kq;
  end if;

  -- 9. HẠT NHÂN: mã dài phải thắng mã ngắn. 'E1-10.1' là tiền tố của
  --    'E1-10.12' sau khi bỏ ký tự, khớp nhầm là tiền sang căn khác.
  kq := ghi_nhan_tien_ve(p_ds, 'sepay', 'SP-7', 100000,
        'VB E1-10.12 ' || to_char(v_thang, 'YYYYMM'), now(), 'FT007', '1234567890', '{}'::jsonb);
  select unit_id into u_khac from bank_transactions where provider_ref = 'SP-7';
  if u_khac <> u_dai then
    raise exception 'FAIL 9: khop nham can, phai la E1-10.12';
  end if;
  select id into u_khac from units where building_id = b_khac and code = 'E1-10.01';

  -- 10. HẠT NHÂN: cách ly dự án. Khu hàng xóm có căn TRÙNG MÃ.
  kq := ghi_nhan_tien_ve(p_khac, 'sepay', 'SP-8', 100000,
        'VB E1-10.01 ' || to_char(v_thang, 'YYYYMM'), now(), 'FT008', '999', '{}'::jsonb);
  select unit_id into u_khac from bank_transactions where provider_ref = 'SP-8';
  if u_khac = u_a then
    raise exception 'FAIL 10: tien khu hang xom gach vao can khu nay';
  end if;

  -- ══════════ QUYỀN ══════════════════════════════════════════════════════
  perform set_config('test.uid', c_dan::text, true);
  -- 11. Cư dân không được gạch tay, không được xem danh sách đối soát
  begin
    perform bql_gan_giao_dich((select id from bank_transactions where provider_ref = 'SP-5'), u_a);
    raise exception 'FAIL 11a: cu dan gach tay duoc';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from bql_doi_soat(p_ds);
    raise exception 'FAIL 11b: cu dan xem duoc danh sach doi soat';
  exception when insufficient_privilege then null;
  end;
  begin
    perform bql_bo_qua_giao_dich((select id from bank_transactions where provider_ref = 'SP-5'), 'khong phai tien cu dan');
    raise exception 'FAIL 11c: cu dan bo qua duoc giao dich';
  exception when insufficient_privilege then null;
  end;

  -- ══════════ BQL GẠCH TAY ═══════════════════════════════════════════════
  perform set_config('test.uid', s_bql::text, true);

  -- 12. Không gán được vào căn của DỰ ÁN KHÁC
  begin
    perform bql_gan_giao_dich(
      (select id from bank_transactions where provider_ref = 'SP-5'), u_khac);
    raise exception 'FAIL 12: gan duoc tien vao can cua du an khac';
  exception when insufficient_privilege then null;
  end;

  -- 13. Gán tay đúng căn -> gạch được, đánh dấu là thủ công
  insert into invoices (unit_id, project_id, period, total_amount, paid_amount, status, due_date)
    values (u_a, p_ds, (v_thang + interval '2 months')::date, 700000, 0, 'issued', current_date + 5)
    returning id into hd_b;
  kq := bql_gan_giao_dich((select id from bank_transactions where provider_ref = 'SP-5'), u_a);
  if (kq->>'da_gach')::bigint <> 700000 then
    raise exception 'FAIL 13a: gach tay ra %, phai la 700000', kq->>'da_gach';
  end if;
  select count(*) into n from payments p
    join bank_transactions t on t.id = p.bank_txn_id
   where t.provider_ref = 'SP-5' and p.matched_by = 'manual';
  if n <> 1 then raise exception 'FAIL 13b: % dong payments thu cong, phai la 1', n; end if;

  -- 14. Gạch lần hai vào cùng giao dịch -> chặn. Không có chốt này thì BQL bấm
  --     hai lần là cư dân được ghi nhận trả gấp đôi.
  begin
    perform bql_gan_giao_dich((select id from bank_transactions where provider_ref = 'SP-5'), u_b);
    raise exception 'FAIL 14: gach duoc lan thu hai vao cung giao dich';
  exception when unique_violation then null;
  end;

  -- ══════════ BỎ QUA ═════════════════════════════════════════════════════
  -- 15. Phải có lý do; không bỏ qua được cái đã gạch
  begin
    perform bql_bo_qua_giao_dich((select id from bank_transactions where provider_ref = 'SP-6'), '   ');
    raise exception 'FAIL 15a: bo qua duoc ma khong ghi ly do';
  exception when others then
    if sqlstate <> '22023' then raise; end if;
  end;
  begin
    perform bql_bo_qua_giao_dich((select id from bank_transactions where provider_ref = 'SP-5'), 'nham');
    raise exception 'FAIL 15b: bo qua duoc giao dich da gach vao hoa don';
  exception when unique_violation then null;
  end;
  perform bql_bo_qua_giao_dich((select id from bank_transactions where provider_ref = 'SP-6'),
                               'Hoan tien nha thau, khong phai tien cu dan');
  select trang_thai into v_stat from bank_transactions where provider_ref = 'SP-6';
  if v_stat <> 'bo_qua' then raise exception 'FAIL 15c: trang thai ra %', v_stat; end if;

  -- ══════════ DANH SÁCH ĐỐI SOÁT ═════════════════════════════════════════
  -- 16. "Còn dư" gom hai tình huống, cả hai đều cần người nhìn:
  --     SP-2 trả thừa 1.000.000 so với hóa đơn đang nợ;
  --     SP-4 và SP-7 trả vào căn KHÔNG còn hóa đơn nào để gạch (tiền trả trước).
  --     Hệ thống không tự quyết tiền đó về đâu.
  select count(*) into n from bql_doi_soat(p_ds, 'con_du');
  if n <> 3 then raise exception 'FAIL 16a: % giao dich con du, phai la 3', n; end if;
  select * into r from bql_doi_soat(p_ds, 'con_du') where bank_ref = 'FT002';
  if r.con_du <> 1000000 then
    raise exception 'FAIL 16b: SP-2 con du %, phai la 1000000', r.con_du;
  end if;
  select * into r from bql_doi_soat(p_ds, 'con_du') where bank_ref = 'FT007';
  if r.con_du <> 100000 or r.unit_code <> 'E1-10.12' then
    raise exception 'FAIL 16c: SP-7 ra con_du=% can=%', r.con_du, r.unit_code;
  end if;

  -- 17. Gạch tay (SP-5) và bỏ qua (SP-6) đều phải RỜI hàng đợi. Việc đã xử lý
  --     mà vẫn nằm trong danh sách thì hôm sau có người xử lý lại lần nữa.
  select count(*) into n from bql_doi_soat(p_ds, 'chua_khop');
  if n <> 0 then
    raise exception 'FAIL 17a: con % giao dich trong hang doi, phai het', n;
  end if;

  -- Giao dịch mới, ghi mã căn nhưng thiếu VB -> chưa khớp, nhưng gợi ý ra căn.
  -- Gợi ý là để NGƯỜI đọc, không phải để máy tự gạch.
  perform ghi_nhan_tien_ve(p_ds, 'casso', 'CS-1', 250000, 'Nop tien can E1-10.02 thang 9',
          now(), 'FT100', '1234567890', '{}'::jsonb);
  select * into r from bql_doi_soat(p_ds, 'chua_khop') where content like '%E1-10.02%';
  if r.goi_y is null or not ('E1-10.02' = any(r.goi_y)) then
    raise exception 'FAIL 17b: khong goi y duoc can E1-10.02, goi_y = %', r.goi_y;
  end if;
  if r.trang_thai <> 'chua_khop' then
    raise exception 'FAIL 17c: goi y ma tu gach luon, trang thai = %', r.trang_thai;
  end if;

  -- 18. Sổ tiền về giữ ĐỦ mọi giao dịch, kể cả cái không khớp được căn nào.
  --     Chỉ lưu cái khớp được thì tiền của người ghi sai biến mất khỏi hệ thống.
  select count(*) into n from bank_transactions where project_id = p_ds;
  if n <> 8 then raise exception 'FAIL 18: so tien ve co % dong, phai la 8', n; end if;

  raise notice 'test_doisoat: 18 assert PASS';
end $test$;
