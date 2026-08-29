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
-- Cách dùng: điền MỘT trong hai — v_email hoặc v_phone — rồi chạy cả file.
-- Hệ thống đang tạm đăng nhập bằng email OTP (chưa có nhà cung cấp SMS), nên
-- thường sẽ là v_email. Lúc chuyển sang SMS thì dùng v_phone.

do $bootstrap$
declare
  v_email   text := 'ten@example.com';     -- << SỬA: email người làm BQL (đang dùng email OTP)
  v_phone   text := null;                  -- << hoặc SĐT dạng E.164, khi đã chuyển sang SMS
  v_role    staff_role := 'bql_manager';   -- bql_manager | bql_staff | technician | security | bqt
  -- Trên DB mới tinh chưa có dự án nào. Điền tên tòa thật vào đây thì script tự
  -- tạo; đã có dự án rồi thì bỏ qua và dùng cái đang có.
  v_du_an   text := 'Tên khu dân cư';    -- << SỬA nếu DB còn trống
  v_dia_chi text := null;                 -- << địa chỉ, không bắt buộc
  v_project uuid;
  v_user    uuid;
  v_name    text;
  v_dinh_danh text;
begin
  if (v_email is null) = (v_phone is null) then
    raise exception 'Dien DUNG MOT trong hai: v_email hoac v_phone, khong phai ca hai va khong phai khong cai nao.';
  end if;

  select id into v_project from projects order by created_at limit 1;
  if v_project is null then
    if v_du_an is null or trim(v_du_an) = '' or v_du_an = 'Tên khu dân cư' then
      raise exception 'DB chua co du an nao. Sua v_du_an thanh ten toa nha that roi chay lai.';
    end if;
    insert into projects (name, address) values (trim(v_du_an), v_dia_chi)
      returning id into v_project;
    raise notice 'Da tao du an "%"', trim(v_du_an);
  end if;

  if v_email is not null then
    v_dinh_danh := lower(trim(v_email));
    -- So sánh hạ chữ thường cả hai vế: Supabase lưu email theo đúng cách người
    -- ta gõ lúc đăng nhập, nên 'Ha@Gmail.com' và 'ha@gmail.com' là hai chuỗi
    -- khác nhau trong bảng dù cùng một hộp thư.
    select id, full_name into v_user, v_name
      from profiles where lower(email) = v_dinh_danh;
  else
    v_dinh_danh := v_phone;
    select id, full_name into v_user, v_name from profiles where phone = v_phone;
  end if;

  if v_user is null then
    raise exception 'Khong tim thay profile voi %. Nguoi do phai dang nhap app 1 LAN TRUOC roi moi chay script nay.', v_dinh_danh;
  end if;

  insert into staff_assignments (user_id, project_id, role, is_active)
  values (v_user, v_project, v_role, true)
  on conflict (user_id, project_id, role) do update set is_active = true;

  raise notice 'Da gan % cho % (%) tren du an %', v_role, v_name, v_dinh_danh, v_project;
end $bootstrap$;

-- Kiểm tra lại:
--   select p.full_name, p.email, p.phone, s.role, s.is_active
--     from staff_assignments s join profiles p on p.id = s.user_id;
-- Thu hồi:
--   update staff_assignments set is_active = false where user_id = '<uuid>';
