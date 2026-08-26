-- Gán vai trò BQL cho người đầu tiên. CHẠY MỘT LẦN trong Supabase SQL Editor.
--
-- Vì sao cần: staff_assignments là bảng duy nhất quyết định is_staff(), mà nó
-- không được cấp quyền cho anon/authenticated (cố ý — ai tự ghi được bảng này
-- là tự phong BQL, vượt RLS của tickets/invoices). Nên bản ghi đầu tiên buộc
-- phải do người có quyền postgres tạo, không thể làm từ trong app.
--
-- ĐIỀU KIỆN: người đó phải đăng nhập app ÍT NHẤT 1 LẦN trước, để trigger
-- on_auth_user_created sinh ra dòng trong profiles. Chưa đăng nhập thì script
-- báo lỗi rõ, không tạo bừa.
--
-- Cách dùng: sửa v_phone (và v_role nếu cần) rồi chạy cả file.

do $bootstrap$
declare
  v_phone   text := '+84901234567';        -- << SỬA: SĐT người làm BQL, dạng E.164
  v_role    staff_role := 'bql_manager';   -- bql_manager | bql_staff | technician | security | bqt
  v_project uuid;
  v_user    uuid;
  v_name    text;
begin
  select id into v_project from projects order by created_at limit 1;
  if v_project is null then
    raise exception 'Chua co du an nao trong bang projects. Chay seed.sql hoac tao du an truoc.';
  end if;

  select id, full_name into v_user, v_name from profiles where phone = v_phone;
  if v_user is null then
    raise exception 'Khong tim thay profile voi SDT %. Nguoi do phai dang nhap app 1 lan truoc.', v_phone;
  end if;

  insert into staff_assignments (user_id, project_id, role, is_active)
  values (v_user, v_project, v_role, true)
  on conflict (user_id, project_id, role) do update set is_active = true;

  raise notice 'Da gan % cho % (%) tren du an %', v_role, v_name, v_phone, v_project;
end $bootstrap$;

-- Kiểm tra lại:
--   select p.full_name, p.phone, s.role, s.is_active
--     from staff_assignments s join profiles p on p.id = s.user_id;
-- Thu hồi:
--   update staff_assignments set is_active = false where user_id = '<uuid>';
