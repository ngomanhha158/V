-- ─────────────────────────────────────────────────────────────────────────────
-- Smoke test ĐƯỜNG THẬT của production: danh tính lấy từ GUC `app.user_id`,
-- truy vấn chạy dưới role `authenticated`.
--
-- Bộ test_*.sql chứng minh policy đúng, nhưng chúng lấy danh tính từ `test.uid`.
-- File này chứng minh nốt mắt xích còn lại: cái app thật sẽ làm — SET LOCAL
-- app.user_id + SET LOCAL ROLE authenticated — có thật sự bị RLS chặn không.
-- Đây chính là chỗ hỏng âm thầm nếu app lỡ nối bằng role postgres.
--
-- Chạy:  psql -f railway/02_smoke_prod.sql
-- File tự mở transaction và tự ROLLBACK ở cuối — xanh hay đỏ đều không để lại
-- một dòng dữ liệu nào. (Không dùng cờ -1: -1 sẽ COMMIT khi test xanh.)
-- ─────────────────────────────────────────────────────────────────────────────
begin;

do $smoke$
declare
  v_project uuid; v_building uuid; v_unit uuid;
  u_owner uuid := '9a000000-0000-0000-0000-000000000001';
  u_la    uuid := '9a000000-0000-0000-0000-000000000002';
  n int;
begin
  -- ── dựng dữ liệu, chạy quyền cao ──
  insert into projects  (name) values ('SMOKE') returning id into v_project;
  insert into buildings (project_id, code, name) values (v_project,'S1','Smoke 1') returning id into v_building;
  insert into units     (building_id, code, floor_no) values (v_building,'S1-01.01',1) returning id into v_unit;
  insert into profiles  (id, full_name) values (u_owner,'Chu ho smoke'), (u_la,'Nguoi la smoke');
  insert into unit_memberships (unit_id, user_id, role, status, valid_from, valid_to, can_view_finance)
    values (v_unit, u_owner, 'owner', 'active', current_date, null, true);
  insert into invoices (unit_id, project_id, period, total_amount, due_date)
    values (v_unit, v_project, date_trunc('month', current_date)::date, 1000000, current_date + 7);

  -- ── từ đây trở đi là quyền của client thật ──
  execute 'set local role authenticated';

  -- 1. Không có danh tính -> không thấy gì. Đây là trạng thái mặc định của một
  --    connection vừa lấy ra khỏi pool; nếu nó thấy dữ liệu là RLS đã hỏng.
  perform set_config('app.user_id', '', true);
  select count(*) into n from invoices where unit_id = v_unit;
  if n <> 0 then raise exception 'FAIL 1: khong co danh tinh ma van thay % hoa don', n; end if;

  -- 2. Chủ hộ thấy hóa đơn căn mình.
  perform set_config('app.user_id', u_owner::text, true);
  select count(*) into n from invoices where unit_id = v_unit;
  if n <> 1 then raise exception 'FAIL 2: chu ho phai thay 1 hoa don, thay %', n; end if;

  -- 3. Người lạ không thấy. Cùng câu truy vấn, chỉ khác danh tính.
  perform set_config('app.user_id', u_la::text, true);
  select count(*) into n from invoices where unit_id = v_unit;
  if n <> 0 then raise exception 'FAIL 3: nguoi la doc duoc % hoa don cua can khac', n; end if;

  -- 4. Người lạ không đọc được tư cách thành viên của căn không phải của mình.
  select count(*) into n from unit_memberships where unit_id = v_unit;
  if n <> 0 then raise exception 'FAIL 4: nguoi la doc duoc % dong thanh vien', n; end if;

  -- 5. Danh tính bịa cũng không mở được gì — auth.uid() chỉ là chuỗi trong GUC,
  --    nên phải chắc nó vô dụng khi không khớp dữ liệu thật.
  perform set_config('app.user_id', '00000000-0000-0000-0000-0000000000ff', true);
  select count(*) into n from invoices where unit_id = v_unit;
  if n <> 0 then raise exception 'FAIL 5: uuid bia van doc duoc % hoa don', n; end if;

  execute 'reset role';
  raise notice 'SMOKE PRODUCTION PATH PASSED — app.user_id + role authenticated chan dung';
end
$smoke$;

rollback;
