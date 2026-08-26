-- Smoke test cho đường tiền. Sai số tiền = mất niềm tin, không patch lại được.
-- Chạy: psql -f schema.sql && psql -f seed.sql && psql -1 -f test_billing.sql
-- ponytail: assert thẳng, không framework. 5 invariant dễ vỡ nhất của generate_invoices.

do $test$
declare
  v_project uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  f_elec    uuid := 'cccccccc-0000-0000-0000-000000000002';
  v_period  date := date_trunc('month', current_date)::date;
  v_unit    uuid;
  v_area    numeric;
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

  raise notice 'ALL BILLING TESTS PASSED';
end $test$;

rollback;
