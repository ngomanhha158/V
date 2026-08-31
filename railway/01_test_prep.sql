-- CHỈ áp lên database TEST, không bao giờ lên production.
--
-- (1) Bộ test lấy danh tính từ GUC `test.uid` (đúng như scripts/verify-schema.mjs
--     vẫn stub). Production lấy từ `app.user_id` — xem 00_compat.sql. Đây là
--     chỗ duy nhất hai đường rẽ nhau, và nó nằm trong file mang tên "test" để
--     không có cách nào áp nhầm mà không nhìn thấy.
create or replace function auth.uid() returns uuid
  language sql stable
as $fn$ select nullif(current_setting('test.uid', true), '')::uuid $fn$;

-- (2) test_rls.sql tự tạo role vb_rls_test và tự cấp quyền BẢNG, nhưng không cấp
--     execute trên helper của policy (current_unit_ids, is_staff...). Trên harness
--     PGlite không sao vì ở đó auth_hooks.sql không chạy, function còn EXECUTE cho
--     PUBLIC. Trên DB đã siết quyền thì thiếu execute là test đỏ vì permission
--     denied chứ không phải vì policy sai.
--     Cho vb_rls_test kế thừa `authenticated` để nó chạy đúng bộ quyền của client
--     thật — test chứng minh cả policy LẪN danh sách grant.
do $prep$
declare r text;
begin
  foreach r in array array['vb_rls_test','vb_bill_test','vb_ticket_test','vb_gl_test'] loop
    begin
      execute format('create role %I nologin', r);
    exception when duplicate_object then null;
    end;
    execute format('grant authenticated to %I', r);
  end loop;
end
$prep$;
