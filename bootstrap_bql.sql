-- Gán vai trò BQL cho người đầu tiên. CHẠY MỘT LẦN bằng psql.
--
-- Vì sao cần: staff_assignments là bảng duy nhất quyết định is_staff(), mà nó
-- không được cấp quyền cho anon/authenticated (cố ý — ai tự ghi được bảng này
-- là tự phong BQL, vượt RLS của tickets/invoices). Nên bản ghi đầu tiên buộc
-- phải do người có quyền postgres tạo, không thể làm từ trong app.
--
-- ĐIỀU KIỆN: người đó phải CÓ TÀI KHOẢN rồi. Tạo bằng một dòng, ngay trước
-- file này, cũng trong Console của service Postgres:
--
--     select auth_tao_nguoi_dung('email@…', '', 'Họ tên', '<mật khẩu tạm>');
--
-- Không còn phải chờ họ "tự đăng nhập một lần" như hồi Supabase: auth.users
-- giờ là bảng của chính mình, tạo thẳng được, và trigger on_auth_user_created
-- dựng dòng profiles ngay trong lệnh đó. Hai lệnh chạy liền nhau được.
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
  -- tạo. DB đã có dự án rồi thì đây là tên khu để CHỌN, xem khối bên dưới.
  v_du_an   text := 'Tên khu dân cư';    -- << SỬA nếu DB còn trống
  v_dia_chi text := null;                 -- << địa chỉ, không bắt buộc
  v_project uuid;
  v_ten_du_an text;
  v_so_du_an  int;
  v_user    uuid;
  v_name    text;
  v_dinh_danh text;
begin
  if (v_email is null) = (v_phone is null) then
    raise exception 'Dien DUNG MOT trong hai: v_email hoac v_phone, khong phai ca hai va khong phai khong cai nao.';
  end if;

  -- ── Chọn khu ──────────────────────────────────────────────────────────────
  -- Trước đây chỗ này là `order by created_at limit 1` — "khu đầu bảng". Với
  -- một khu thì đúng; từ khu thứ hai trở đi nó im lặng chọn hộ, và người chạy
  -- script không hề biết mình vừa được phong quản lý của khu nào. Tệ nhất là
  -- ca hay gặp nhất: DB còn dữ liệu mẫu của seed.sql, khu đầu bảng là khu GIẢ,
  -- v_du_an vừa điền bị bỏ qua sạch, và mọi thứ về sau treo vào một tòa nhà
  -- không tồn tại.
  select count(*) into v_so_du_an from projects;

  if v_so_du_an = 0 then
    if v_du_an is null or trim(v_du_an) = '' or v_du_an = 'Tên khu dân cư' then
      raise exception 'DB chua co du an nao. Sua v_du_an thanh ten toa nha that roi chay lai.';
    end if;
    insert into projects (name, address) values (trim(v_du_an), v_dia_chi)
      returning id, name into v_project, v_ten_du_an;
    raise notice 'Da TAO du an moi: "%"', v_ten_du_an;

  elsif v_so_du_an = 1 then
    select id, name into v_project, v_ten_du_an from projects;
    raise notice 'DUNG du an DA CO trong DB: "%"  (v_du_an ban dien khong duoc dung den)', v_ten_du_an;

  else
    -- Từ hai khu trở lên thì không có "khu đầu bảng" nào là câu trả lời đúng.
    -- Bắt chỉ đích danh, và liệt kê sẵn các tên để khỏi phải đi tra.
    select id, name into v_project, v_ten_du_an
      from projects where name = trim(coalesce(v_du_an, ''));
    if v_project is null then
      raise exception 'DB dang co % du an nen "khu dau bang" khong con nghia gi. Dien v_du_an dung TEN mot trong: %',
        v_so_du_an, (select string_agg(quote_literal(name), ', ' order by name) from projects);
    end if;
    raise notice 'DUNG du an: "%"', v_ten_du_an;
  end if;

  -- Nói thẳng ra khi trông giống dữ liệu mẫu. Người đang dựng hệ thống lần đầu
  -- không có cách nào tự biết "Sunrise Riverside" là khu bịa trong seed.sql.
  if exists (select 1 from projects where name = 'Sunrise Riverside') then
    raise notice 'CANH BAO: DB dang co du an "Sunrise Riverside" — do la du lieu MAU cua seed.sql.';
    raise notice '          Don du lieu mau truoc khi chay that, khong thi hoa don va so quy deu treo vao khu bia.';
  end if;

  -- ── Tìm người ─────────────────────────────────────────────────────────────
  if v_email is not null then
    v_dinh_danh := lower(trim(v_email));
    -- So sánh hạ chữ thường cả hai vế: email lưu theo đúng cách người
    -- ta gõ lúc đăng nhập, nên 'Ha@Gmail.com' và 'ha@gmail.com' là hai chuỗi
    -- khác nhau trong bảng dù cùng một hộp thư.
    select id, full_name into v_user, v_name
      from profiles where lower(email) = v_dinh_danh;
  else
    v_dinh_danh := v_phone;
    select id, full_name into v_user, v_name from profiles where phone = v_phone;
  end if;

  if v_user is null then
    raise exception 'Khong tim thay profile voi %. Tao tai khoan truoc: select auth_tao_nguoi_dung(''%'', '''', ''Ho ten'', ''<mat khau tam>'');',
      v_dinh_danh, v_dinh_danh;
  end if;

  insert into staff_assignments (user_id, project_id, role, is_active)
  values (v_user, v_project, v_role, true)
  on conflict (user_id, project_id, role) do update set is_active = true;

  raise notice 'Da gan % cho % (%) tren du an "%" (%)', v_role, v_name, v_dinh_danh, v_ten_du_an, v_project;
end $bootstrap$;

-- Kiểm tra lại:
--   select p.full_name, p.email, p.phone, s.role, s.is_active, d.name as khu
--     from staff_assignments s
--     join profiles p on p.id = s.user_id
--     join projects d on d.id = s.project_id;
-- Thu hồi:
--   update staff_assignments set is_active = false where user_id = '<uuid>';
