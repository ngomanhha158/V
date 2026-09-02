-- ─────────────────────────────────────────────────────────────────────────────
-- Smoke test ĐƯỜNG THẬT của production, chạy dưới role `authenticated`.
--
-- Bộ test_*.sql chứng minh policy đúng, nhưng chúng lấy danh tính từ `test.uid`.
-- File này chứng minh nốt mắt xích còn lại: hai đường mà hệ thống thật dùng —
--   • `request.jwt.claims`  (PostgREST đặt từ JWT — đường của app)
--   • `app.user_id`         (SET LOCAL — đường của psql và job nền)
-- — có thật sự bị RLS chặn không. Đây chính là chỗ hỏng âm thầm nếu app lỡ nối
-- bằng role postgres, hoặc nếu `authenticator` lỡ để INHERIT.
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
  u_bv    uuid := '9a000000-0000-0000-0000-000000000003';
  n int; r record;
begin
  -- ── dựng dữ liệu, chạy quyền cao ──
  insert into projects  (name) values ('SMOKE') returning id into v_project;
  insert into buildings (project_id, code, name) values (v_project,'S1','Smoke 1') returning id into v_building;
  insert into units     (building_id, code, floor_no) values (v_building,'S1-01.01',1) returning id into v_unit;
  insert into profiles  (id, full_name) values
    (u_owner,'Chu ho smoke'), (u_la,'Nguoi la smoke'), (u_bv,'Bao ve smoke');
  insert into staff_assignments (user_id, project_id, role) values (u_bv, v_project, 'security');
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

  -- ── Đường PostgREST: danh tính đến từ JWT, không từ app.user_id ──
  -- Đây mới là đường mà app thật đi sau khi bỏ Supabase. Dọn sạch app.user_id
  -- trước, nếu không thì case dưới có thể xanh nhờ GUC còn sót lại từ case 3 —
  -- xanh vì lý do sai còn tệ hơn đỏ.
  perform set_config('app.user_id', '', true);

  -- 6. Chủ hộ, danh tính nằm trong claims của JWT.
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_owner::text, 'role', 'authenticated')::text, true);
  select count(*) into n from invoices where unit_id = v_unit;
  if n <> 1 then raise exception 'FAIL 6: chu ho qua JWT phai thay 1 hoa don, thay %', n; end if;

  -- 7. Người lạ, cùng đường JWT.
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_la::text, 'role', 'authenticated')::text, true);
  select count(*) into n from invoices where unit_id = v_unit;
  if n <> 0 then raise exception 'FAIL 7: nguoi la qua JWT doc duoc % hoa don', n; end if;

  -- 8. JWT không có claim `sub` (token hỏng, hoặc ký thiếu). Phải rơi về KHÔNG
  --    thấy gì, chứ không phải rơi về "bỏ qua bộ lọc".
  perform set_config('request.jwt.claims', '{"role":"authenticated"}', true);
  select count(*) into n from invoices where unit_id = v_unit;
  if n <> 0 then raise exception 'FAIL 8: JWT thieu sub van doc duoc % hoa don', n; end if;
  perform set_config('request.jwt.claims', '', true);

  -- ── Thẻ cư dân dưới ĐÚNG danh tính thật ──
  -- test_the.sql chứng minh logic, nhưng nó chạy trên harness có auth.uid()
  -- giả đọc `test.uid`. Ba câu dưới đây là chỗ duy nhất chứng minh kiem_the()
  -- còn đúng khi danh tính đến từ JWT và truy vấn chạy dưới role authenticated
  -- — tức là đúng cái mà bảo vệ bấm vào ở cửa.
  perform set_config('app.user_id', '', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_bv::text, 'role', 'authenticated')::text, true);
  select * into r from kiem_the(u_owner, v_unit);
  if not r.con_hieu_luc then raise exception 'FAIL 9: bao ve quet the chu ho ma bao khong hieu luc (%)', r.ly_do; end if;
  if r.can <> 'S1-01.01' then raise exception 'FAIL 9b: sai can tra ve: %', r.can; end if;

  -- Người lạ không phải nhân sự: phải bị chặn, chứ không phải nhận về dữ liệu
  -- rỗng. Rỗng thì màn quét hiện "không hợp lệ" và không ai biết là do thiếu
  -- quyền — bảo vệ thật sẽ tưởng thẻ của cư dân hỏng.
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_la::text, 'role', 'authenticated')::text, true);
  begin
    perform kiem_the(u_owner, v_unit);
    raise exception 'FAIL 10: nguoi khong phai nhan su van tra duoc the';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claims', '', true);

  -- ── Đường service_role: webhook ngân hàng và job nền ──
  -- Ba câu dưới đây bịt một lỗ mà bộ test cũ không nhìn thấy, và nó đã hỏng
  -- thật: trên Supabase, service_role được cấp sẵn mọi thứ bằng default
  -- privileges của họ. Trên Postgres thuần thì KHÔNG — `bypassrls` chỉ bỏ qua
  -- RLS, nó không cho quyền bảng, và `revoke execute ... from public` trong
  -- auth_hooks.sql còn gỡ nốt quyền gọi hàm mà nó đang sống nhờ.
  -- Hệ quả: webhook trả 5xx nên tiền của cư dân biến mất khỏi hệ thống, và cả
  -- năm job nền im lặng không chạy. Không màn nào báo.
  execute 'reset role';
  execute 'set local role service_role';

  -- 9. Đọc bảng: đây là câu `.from('projects')` mở đầu mọi lần webhook chạy.
  select count(*) into n from projects;
  if n = 0 then raise exception 'FAIL 9: service_role khong doc duoc projects'; end if;

  -- 10. Gọi hàm thường trong public. Phải chọn hàm KHÔNG được cấp riêng cho
  --     service_role ở đâu cả — hàm có cấp riêng vẫn chạy kể cả khi nền đã mất,
  --     nên nó không phát hiện ra gì.
  perform unit_project(v_unit);

  -- 11. Và service_role thấy HẾT, không bị RLS lọc — đó là cả lý do nó tồn tại.
  select count(*) into n from invoices;
  if n < 1 then raise exception 'FAIL 11: service_role chi thay % hoa don, phai thay tat ca', n; end if;

  execute 'reset role';
  raise notice 'SMOKE PRODUCTION PATH PASSED — RLS chan dung ca hai duong danh tinh, the cu dan doc dung duoi JWT, va service_role co du nen de chay webhook + job nen';
end
$smoke$;

rollback;
