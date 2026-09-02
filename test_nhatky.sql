-- Smoke test nhật ký kiểm toán. Chạy sau schema.sql + seed.sql.
--
-- Sổ kiểm toán hỏng theo kiểu im lặng: nó vẫn có dòng, vẫn trông đầy đủ, chỉ
-- là thiếu đúng thao tác mà người ta cần tra. Một sổ thủng lỗ chỗ còn tệ hơn
-- không có sổ, vì nó tạo cảm giác an toàn giả. Test bám vào bốn chỗ dễ thủng:
-- ghi thiếu thao tác, ghi cả dòng thay vì cột đổi, ghi lộ cột nhạy cảm, và
-- không gắn được dự án nên RLS giấu mất dòng.

do $test$
declare
  p_nk uuid := 'aaaaaaaa-0000-0000-0000-00000000e000';
  b_nk uuid := 'bbbbbbbb-0000-0000-0000-00000000e000';
  nguoi uuid := '77770000-0000-0000-0000-00000000e001';
  u_nk uuid; f_nk uuid; hd uuid; gd uuid;
  n int; v jsonb; v_role text; v_duan uuid;
begin
  insert into projects (id, name) values (p_nk, 'Khu nhat ky');
  insert into buildings (id, project_id, code, name) values (b_nk, p_nk, 'E1', 'NK 1');
  insert into profiles (id, full_name, phone) values (nguoi, 'Nguoi ghi so', '0900000030');
  insert into staff_assignments (user_id, project_id, role) values (nguoi, p_nk, 'bql_manager');

  perform set_config('test.uid', nguoi::text, true);

  -- ── 1. INSERT được ghi, và gắn đúng dự án qua đường building_id ──
  insert into units (building_id, code, floor_no, area_m2)
    values (b_nk, 'E1-03.01', 3, 62);
  select id into u_nk from units where building_id = b_nk and code = 'E1-03.01';

  select count(*) into n
    from audit_log where bang = 'units' and ban_ghi = u_nk::text and thao_tac = 'INSERT';
  select project_id into v_duan
    from audit_log where bang = 'units' and ban_ghi = u_nk::text and thao_tac = 'INSERT';
  if n <> 1 then raise exception 'INSERT units khong duoc ghi so (n=%)', n; end if;
  -- units khong co cot project_id: phai lan qua building_id. Khong lan duoc thi
  -- project_id null, va policy audit_staff_read giau luon dong do khoi so.
  if v_duan is distinct from p_nk then
    raise exception 'Khong lan ra du an cho units, project_id = %', v_duan;
  end if;

  -- ── 2. Ghi đúng NGƯỜI và VAI TRÒ ──
  select actor_id, actor_role into v_duan, v_role
    from audit_log where bang = 'units' and ban_ghi = u_nk::text limit 1;
  if v_duan is distinct from nguoi then
    raise exception 'Ghi sai nguoi thao tac: %', v_duan;
  end if;
  if v_role is null or v_role = '' then
    raise exception 'Thieu vai tro — actor_id null se khong phan biet duoc cron voi nguoi that';
  end if;

  -- ── 3. UPDATE chỉ ghi cột ĐỔI, không chụp cả dòng ──
  update units set area_m2 = 78.5 where id = u_nk;
  select truoc into v from audit_log
    where bang = 'units' and ban_ghi = u_nk::text and thao_tac = 'UPDATE';

  -- Chup ca dong thi so khong doc duoc: nguoi xem phai tu do mat xem cai gi khac.
  select count(*) into n from jsonb_object_keys(v);
  if n <> 1 then
    raise exception 'UPDATE phai chi ghi cot doi, dang ghi % cot: %', n, v;
  end if;
  if v->>'area_m2' is null then
    raise exception 'Cot doi khong phai area_m2: %', v;
  end if;

  select sau into v from audit_log
    where bang = 'units' and ban_ghi = u_nk::text and thao_tac = 'UPDATE';
  if (v->>'area_m2')::numeric <> 78.5 then
    raise exception 'Gia tri sau sai: %', v;
  end if;

  -- ── 4. UPDATE không đổi gì thì KHÔNG đẻ dòng ──
  -- Cron chay 5 phut mot lan ma lan nao cung de mot dong "da sua, khong co gi
  -- khac" la so ngap rac trong mot tuan.
  select count(*) into n from audit_log
    where bang = 'units' and ban_ghi = u_nk::text and thao_tac = 'UPDATE';
  update units set area_m2 = 78.5 where id = u_nk;
  select count(*) - n into n from audit_log
    where bang = 'units' and ban_ghi = u_nk::text and thao_tac = 'UPDATE';
  if n <> 0 then raise exception 'UPDATE khong doi gi van de ra % dong', n; end if;

  -- ── 5. Cột nhạy cảm không bị chép nguyên văn sang sổ ──
  -- raw_payload giu nguyen goi tin ngan hang, co ten nguoi chuyen. So kiem toan
  -- van ghi LA CO DOI, chi khong nhan ban gia tri sang mot bang nua.
  insert into bank_transactions
    (project_id, provider, provider_ref, amount, content, paid_at, raw_payload)
  values (p_nk, 'sepay', 'NK-TEST-1', 500000, 'E1-03.01 nop tien', now(),
          '{"nguoi_chuyen":"NGUYEN VAN A","so_tk":"0011002233"}'::jsonb);
  select id into gd from bank_transactions where provider_ref = 'NK-TEST-1';

  select sau into v from audit_log
    where bang = 'bank_transactions' and ban_ghi = gd::text and thao_tac = 'INSERT';
  if v->>'raw_payload' is distinct from '(đã ẩn)' then
    raise exception 'raw_payload bi chep nguyen van sang so: %', v->'raw_payload';
  end if;
  if v::text like '%NGUYEN VAN A%' then
    raise exception 'Ten nguoi chuyen ro ri sang so kiem toan';
  end if;
  -- Van phai ghi la CO cot do doi, khong phai giau bien mat.
  if not (v ? 'raw_payload') then
    raise exception 'An gia tri thi duoc, nhung phai ghi la cot do co doi';
  end if;

  -- ── 6. Tiền: hóa đơn và dòng phí đều vào sổ, lần được ra dự án ──
  insert into fee_types (project_id, code, name, unit_price)
    values (p_nk, 'QL', 'Phi quan ly', 16500);
  select id into f_nk from fee_types where project_id = p_nk and code = 'QL';

  insert into invoices (unit_id, project_id, period, total_amount, due_date)
    values (u_nk, p_nk, date_trunc('month', current_date)::date, 1023000,
            (date_trunc('month', current_date) + interval '15 days')::date)
    returning id into hd;
  insert into invoice_lines (invoice_id, fee_type_id, description, quantity, unit_price, amount)
    values (hd, f_nk, 'Phi quan ly 62 m2', 62, 16500, 1023000);

  select count(*) into n from audit_log
    where bang = 'invoices' and ban_ghi = hd::text and project_id = p_nk;
  if n <> 1 then raise exception 'Hoa don khong vao so (n=%)', n; end if;

  -- invoice_lines khong co project_id lan unit_id: phai di qua invoice_id.
  select count(*) into n from audit_log
    where bang = 'invoice_lines' and project_id = p_nk;
  if n <> 1 then
    raise exception 'Dong phi khong lan duoc ra du an qua invoice_id (n=%)', n;
  end if;

  -- ── 7. DELETE được ghi, và giữ lại nội dung đã xóa ──
  -- Xoa xong ma so khong con gi thi khong ai dung lai duoc dieu gi da mat.
  delete from invoice_lines where invoice_id = hd;
  select truoc into v from audit_log
    where bang = 'invoice_lines' and thao_tac = 'DELETE' and project_id = p_nk;
  if v is null or v->>'amount' is null then
    raise exception 'DELETE khong giu lai noi dung da xoa: %', v;
  end if;
  if (v->>'amount')::bigint <> 1023000 then
    raise exception 'Noi dung da xoa bi sai: %', v;
  end if;

  -- ── 8. Đổi quyền vào sổ — đây là loại thay đổi hay bị chối nhất ──
  update staff_assignments set is_active = false
    where user_id = nguoi and project_id = p_nk;
  select count(*) into n from audit_log
    where bang = 'staff_assignments' and thao_tac = 'UPDATE' and project_id = p_nk;
  if n <> 1 then raise exception 'Go quyen khong vao so (n=%)', n; end if;

  raise notice 'test_nhatky.sql OK';
end $test$;
