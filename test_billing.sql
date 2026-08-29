-- Smoke test cho đường tiền. Sai số tiền = mất niềm tin, không patch lại được.
-- Chạy: psql -f schema.sql && psql -f seed.sql && psql -1 -f test_billing.sql
-- ponytail: assert thẳng, không framework. 5 invariant của generate_invoices,
-- cộng 6-8 cho lớp QUYỀN trên đường tiền (ai được sinh/phát hành/nhập chỉ số).

do $test$
declare
  v_project uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  f_elec    uuid := 'cccccccc-0000-0000-0000-000000000002';
  v_period  date := date_trunc('month', current_date)::date;
  v_unit    uuid;
  u_res uuid := '77770000-0000-0000-0000-000000000001';
  u_bql uuid := '77770000-0000-0000-0000-000000000002';
  v_area    numeric;
  v_unit2   uuid;
  v_ten     text;
  v_ngay    int;
  p_khac uuid := 'aaaaaaaa-0000-0000-0000-00000000000f';
  b_khac uuid := 'bbbbbbbb-0000-0000-0000-00000000000f';
  u_khac uuid := 'dddddddd-0000-0000-0000-00000000000f';
  v_total   bigint;
  v_first   bigint;
  n int;
begin
  select id, area_m2 into v_unit, v_area from units where code = 'P1-10.01';

  -- Chỉ số điện: 100 -> 250 = 150 kWh
  insert into meter_readings (unit_id, fee_type_id, period, prev_index, curr_index)
    values (v_unit, f_elec, v_period, 100, 250);

  perform generate_invoices(v_project, v_period);

  -- 1. Tổng đúng: phí quản lý theo m2 + ô tô + rác + điện theo chỉ số
  select total_amount into v_first from invoices where unit_id = v_unit and period = v_period;
  if v_first <> round(v_area * 16500)::bigint + 1200000 + 60000 + 150 * 3200 then
    raise exception 'FAIL 1: tong hoa don sai, ra % dong', v_first;
  end if;

  -- 2. Chạy lại KHÔNG nhân đôi tiền
  perform generate_invoices(v_project, v_period);
  select total_amount into v_total from invoices where unit_id = v_unit and period = v_period;
  if v_total <> v_first then
    raise exception 'FAIL 2: chay lai bi nhan doi, % -> %', v_first, v_total;
  end if;

  -- 3. Không sinh hóa đơn trùng kỳ cho cùng 1 căn
  select count(*) into n from invoices where unit_id = v_unit and period = v_period;
  if n <> 1 then raise exception 'FAIL 3: co % hoa don cung ky cho 1 can', n; end if;

  -- 4. Căn chưa có chỉ số công tơ -> không có dòng điện 0đ rác trong hóa đơn
  select count(*) into n
    from invoice_lines l
    join invoices i on i.id = l.invoice_id
   where i.period = v_period and l.fee_type_id = f_elec
     and i.unit_id <> v_unit;
  if n <> 0 then raise exception 'FAIL 4: sinh % dong dien cho can chua co chi so', n; end if;

  -- 5. Hóa đơn đã phát hành KHÔNG bị ghi đè khi chạy lại
  update invoices set status = 'issued' where unit_id = v_unit and period = v_period;
  update fee_types set unit_price = 99000 where id = f_elec;   -- đổi giá sau khi phát hành
  perform generate_invoices(v_project, v_period);
  select total_amount into v_total from invoices where unit_id = v_unit and period = v_period;
  if v_total <> v_first then
    raise exception 'FAIL 5: hoa don da phat hanh bi tinh lai, % -> %', v_first, v_total;
  end if;

  -- ── Lớp quyền: đường tiền sai thì mất tiền thật ──
  insert into profiles (id, full_name) values (u_res,'Cu dan'), (u_bql,'BQL');
  insert into staff_assignments (user_id, project_id, role) values (u_bql, v_project, 'bql_manager');
  insert into unit_memberships (unit_id, user_id, role, status)
    values (v_unit, u_res, 'owner', 'active');

  execute 'alter table invoices force row level security';
  execute 'alter table fee_types force row level security';
  execute 'alter table meter_readings force row level security';
  begin execute 'create role vb_bill_test nologin'; exception when duplicate_object then null; end;
  execute 'grant usage on schema public, auth to vb_bill_test';
  execute 'grant select on invoices, units, buildings, projects to vb_bill_test';
  execute 'grant select, insert on meter_readings to vb_bill_test';
  execute 'grant insert, update on fee_types to vb_bill_test';
  execute 'grant execute on function bql_generate_invoices(uuid, date) to vb_bill_test';
  execute 'grant execute on function bql_issue_invoices(uuid, date) to vb_bill_test';
  execute 'grant execute on function bql_debt_report(uuid) to vb_bill_test';
  execute 'set local role vb_bill_test';

  -- 6. Cư dân KHÔNG sinh được hóa đơn cho cả dự án
  perform set_config('test.uid', u_res::text, true);
  begin
    perform bql_generate_invoices(v_project, v_period);
    raise exception 'FAIL 6a: cu dan sinh duoc hoa don toan du an';
  exception when insufficient_privilege then null;
  end;
  begin
    perform bql_issue_invoices(v_project, v_period);
    raise exception 'FAIL 6b: cu dan phat hanh duoc hoa don';
  exception when insufficient_privilege then null;
  end;

  -- 7. Cư dân KHÔNG ghi được chỉ số công tơ (tự khai số điện của chính mình)
  begin
    insert into meter_readings (unit_id, fee_type_id, period, prev_index, curr_index)
      values (v_unit, f_elec, v_period + 40, 0, 1);
    raise exception 'FAIL 7a: cu dan tu ghi duoc chi so cong to';
  exception when insufficient_privilege then null;
  end;
  -- nhưng ĐỌC được chỉ số căn mình để còn đối chiếu khi hóa đơn sai
  select count(*) into n from meter_readings where unit_id = v_unit;
  if n = 0 then raise exception 'FAIL 7b: cu dan khong doc duoc chi so can minh'; end if;

  -- 8. BQL làm được cả hai, và kỳ sai định dạng bị chặn
  perform set_config('test.uid', u_bql::text, true);
  begin
    perform bql_generate_invoices(v_project, v_period + 5);
    raise exception 'FAIL 8a: nhan ky khong phai ngay dau thang';
  exception when invalid_parameter_value then null;
  end;

  insert into meter_readings (unit_id, fee_type_id, period, prev_index, curr_index)
    values (v_unit, f_elec, v_period + 40, 250, 300);

  execute 'reset role';
  select count(*) into n from meter_readings where unit_id = v_unit;
  if n <> 2 then raise exception 'FAIL 8b: BQL khong ghi duoc chi so, co % dong', n; end if;

  -- ── Báo cáo công nợ (N21): definer, nên phải tự gác cửa ──
  -- Bối cảnh sẵn có: chỉ hóa đơn của v_unit ở trạng thái 'issued' (assert 5),
  -- các căn còn lại vẫn 'draft'.

  -- Dự án thứ hai để bắt lỗi kinh điển của hàm definer: quên lọc p_project thì
  -- một BQL bất kỳ dump được công nợ của cả hệ thống.
  insert into projects (id, name) values (p_khac, 'Khu do thi khac');
  insert into buildings (id, project_id, code, name) values (b_khac, p_khac, 'X1', 'Toa X1');
  insert into units (id, building_id, code, floor_no, area_m2)
    values (u_khac, b_khac, 'X1-01.01', 1, 50);
  insert into invoices (unit_id, project_id, period, total_amount, status, due_date)
    values (u_khac, p_khac, v_period, 9000000, 'issued', current_date - 90);

  execute 'set local role vb_bill_test';

  -- 9. Cư dân KHÔNG xem được công nợ toàn dự án (kèm tên + SĐT hàng xóm)
  perform set_config('test.uid', u_res::text, true);
  begin
    perform * from bql_debt_report(v_project);
    raise exception 'FAIL 9: cu dan doc duoc bao cao cong no ca du an';
  exception when insufficient_privilege then null;
  end;

  -- 10. BQL: đúng 1 căn nợ (hóa đơn 'draft' của các căn khác không phải công nợ)
  perform set_config('test.uid', u_bql::text, true);
  select count(*) into n from bql_debt_report(v_project);
  if n <> 1 then raise exception 'FAIL 10: bao cao ra % can, phai la 1', n; end if;

  select con_no, ten_lien_he into v_total, v_ten
    from bql_debt_report(v_project) where unit_id = v_unit;
  if v_total <> v_first then
    raise exception 'FAIL 10b: con no ra % dong, phai la %', v_total, v_first;
  end if;
  if v_ten <> 'Cu dan' then
    raise exception 'FAIL 10c: khong lay duoc nguoi lien he, ra %', coalesce(v_ten,'(null)');
  end if;

  -- 11. Công nợ của dự án KHÁC không được lọt vào báo cáo này
  select count(*) into n from bql_debt_report(v_project) where unit_id = u_khac;
  if n <> 0 then raise exception 'FAIL 11: lo cong no cua du an khac'; end if;

  -- 12. Trả một phần -> chỉ còn phần thiếu; trả đủ -> biến khỏi danh sách đòi nợ
  execute 'reset role';
  update invoices set paid_amount = 500000, status = 'partial'
   where unit_id = v_unit and period = v_period;
  execute 'set local role vb_bill_test';
  perform set_config('test.uid', u_bql::text, true);
  select con_no into v_total from bql_debt_report(v_project) where unit_id = v_unit;
  if v_total <> v_first - 500000 then
    raise exception 'FAIL 12a: tra mot phan van doi % dong, phai la %', v_total, v_first - 500000;
  end if;

  execute 'reset role';
  update invoices set paid_amount = total_amount, status = 'paid'
   where unit_id = v_unit and period = v_period;
  execute 'set local role vb_bill_test';
  perform set_config('test.uid', u_bql::text, true);
  select count(*) into n from bql_debt_report(v_project);
  if n <> 0 then raise exception 'FAIL 12b: da tra du van nam trong danh sach doi no'; end if;

  -- 12c. Đã thu đủ tiền nhưng trạng thái còn kẹt ở 'partial' (đối soát ngân hàng
  --      cập nhật paid_amount trước, trạng thái theo sau) -> KHÔNG được đòi nữa.
  --      Lọc theo mỗi trạng thái là chưa đủ; phải so tiền.
  execute 'reset role';
  select id into v_unit2 from units where code = 'P1-10.04';
  insert into invoices (unit_id, project_id, period, total_amount, paid_amount, status, due_date)
    values (v_unit2, v_project, v_period, 800000, 800000, 'partial', current_date - 5)
    on conflict (unit_id, period) do update
      set total_amount = 800000, paid_amount = 800000, status = 'partial';
  execute 'set local role vb_bill_test';
  perform set_config('test.uid', u_bql::text, true);
  select count(*) into n from bql_debt_report(v_project);
  if n <> 0 then
    raise exception 'FAIL 12c: doi tien can da tra du (trang thai con ket o partial)';
  end if;

  -- 13. Tuổi nợ tính theo hóa đơn CŨ NHẤT còn thiếu. Lấy nhầm hóa đơn mới nhất
  --     thì khoản nợ 3 tháng trông như mới quá hạn hôm qua.
  execute 'reset role';
  insert into invoices (unit_id, project_id, period, total_amount, status, due_date) values
    (v_unit, v_project, v_period - interval '2 month', 1000000, 'issued', current_date - 60),
    (v_unit, v_project, v_period - interval '1 month',  500000, 'issued', current_date - 30);
  execute 'set local role vb_bill_test';
  perform set_config('test.uid', u_bql::text, true);
  select so_hoa_don, con_no, so_ngay_qua_han into n, v_total, v_ngay
    from bql_debt_report(v_project) where unit_id = v_unit;
  if n <> 2 then raise exception 'FAIL 13a: dem % hoa don no, phai la 2', n; end if;
  if v_total <> 1500000 then raise exception 'FAIL 13b: cong no ra % dong, phai la 1500000', v_total; end if;
  if v_ngay <> 60 then raise exception 'FAIL 13c: tuoi no ra % ngay, phai la 60', v_ngay; end if;

  -- 14. Căn KHÔNG có chủ hộ đang hoạt động vẫn phải hiện ra. Nợ không tự mất
  --     đi vì thiếu người đứng tên — đây đúng là loại căn hay bị bỏ sót nhất.
  execute 'reset role';
  select id into v_unit2 from units where code = 'P1-10.02';
  insert into invoices (unit_id, project_id, period, total_amount, status, due_date)
    values (v_unit2, v_project, v_period + interval '1 month', 700000, 'issued', current_date - 10)
    on conflict (unit_id, period) do update set status = 'issued', total_amount = 700000;
  execute 'set local role vb_bill_test';
  perform set_config('test.uid', u_bql::text, true);
  select count(*) into n from bql_debt_report(v_project) where unit_id = v_unit2;
  if n <> 1 then raise exception 'FAIL 14a: can chua co chu ho bi bo khoi bao cao'; end if;
  select ten_lien_he into v_ten from bql_debt_report(v_project) where unit_id = v_unit2;
  if v_ten is not null then raise exception 'FAIL 14b: gan nham nguoi lien he %', v_ten; end if;

  execute 'reset role';

  raise notice 'ALL BILLING TESTS PASSED';
end $test$;

rollback;
