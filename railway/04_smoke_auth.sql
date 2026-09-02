-- ─────────────────────────────────────────────────────────────────────────────
-- Smoke test cho lớp đăng nhập tự viết (railway/03_auth.sql).
--
-- Chạy:  psql -v ON_ERROR_STOP=1 -f railway/04_smoke_auth.sql
-- Tự mở transaction và tự ROLLBACK — xanh hay đỏ đều không để lại tài khoản
-- nào. (Không dùng cờ -1: -1 sẽ COMMIT khi test xanh.)
--
-- Vì sao là smoke trên DB thật chứ không phải test trong `npm run verify`:
-- toàn bộ file này đứng trên pgcrypto và trên trigger on_auth_user_created của
-- auth_hooks.sql, mà cả hai đều không có trong harness PGlite. Một test chạy
-- được trên harness nhưng không chứng minh điều đang cần chứng minh thì tệ hơn
-- là không có test — nó cho cảm giác an toàn mà không có an toàn.
-- ─────────────────────────────────────────────────────────────────────────────
begin;

do $smoke$
declare
  -- Hai dạng của cùng một địa chỉ: dạng người ta GÕ và dạng đã chuẩn hóa.
  -- Tạo tài khoản bằng dạng gõ tay là cách duy nhất chốt được lower() ở câu
  -- INSERT; tạo bằng dạng chuẩn rồi thì gỡ lower() đi bài test vẫn xanh.
  a_go   text := 'Smoke.A@VBuilding.Test';
  a_mail text := 'smoke.a@vbuilding.test';
  b_sdt  text := '+84900000199';
  c_mail text := 'smoke.c@vbuilding.test';
  a_uid uuid; b_uid uuid; c_uid uuid; v_uid uuid;
  tt text; giay int; n int; i int;
begin
  -- ── A. Tạo tài khoản ──────────────────────────────────────────────────────
  a_uid := public.auth_tao_nguoi_dung(a_go, '', 'Chi A smoke', 'matkhau-cu-123');
  if a_uid is null then raise exception 'FAIL A1: khong tao duoc tai khoan'; end if;

  -- Trigger on_auth_user_created phải dựng sẵn profiles: thiếu dòng này thì
  -- unit_memberships.user_id không gán được, và tài khoản vừa tạo là tài khoản
  -- đăng nhập được nhưng không gắn vào căn nào.
  select count(*) into n from public.profiles where id = a_uid;
  if n <> 1 then raise exception 'FAIL A2: khong co dong profiles cho nguoi vua tao'; end if;
  -- email trong profiles phải là dạng CHUẨN HÓA, không phải dạng gõ tay. Lệch
  -- ở đây là hai hộ cùng một địa chỉ chỉ khác chữ hoa thành hai tài khoản.
  select count(*) into n from public.profiles
   where id = a_uid and full_name = 'Chi A smoke' and email = a_mail;
  if n <> 1 then raise exception 'FAIL A3: profiles khong mang ho ten/email da chuan hoa'; end if;

  -- ── B. Mật khẩu ───────────────────────────────────────────────────────────
  if public.auth_kiem_mat_khau(a_mail, 'matkhau-cu-123') is distinct from a_uid then
    raise exception 'FAIL B1: mat khau dung ma khong vao duoc';
  end if;
  -- Người ta gõ email có chữ hoa suốt ngày. Không chuẩn hóa là họ tưởng mình
  -- sai mật khẩu.
  if public.auth_kiem_mat_khau(a_go, 'matkhau-cu-123') is distinct from a_uid then
    raise exception 'FAIL B2: email viet hoa khong dang nhap duoc';
  end if;
  if public.auth_kiem_mat_khau(a_mail, 'sai-be-bet') is not null then
    raise exception 'FAIL B3: mat khau sai van vao duoc';
  end if;
  if public.auth_kiem_mat_khau('khong-ton-tai@vbuilding.test', 'x') is not null then
    raise exception 'FAIL B4: tai khoan khong ton tai van vao duoc';
  end if;

  -- ── C. Gửi mã một lần ─────────────────────────────────────────────────────
  select g.trang_thai, g.cho_giay into tt, giay from public.auth_gui_ma(a_mail, '123456') g;
  if tt <> 'ok' then raise exception 'FAIL C1: gui ma lan dau tra %', tt; end if;

  -- Bấm gửi lại ngay: phải bị chặn VÀ phải nói ra còn bao nhiêu giây, để màn
  -- đăng nhập đếm ngược được thay vì bắt người ta đoán.
  select g.trang_thai, g.cho_giay into tt, giay from public.auth_gui_ma(a_mail, '999999') g;
  if tt <> 'cho' then raise exception 'FAIL C2: gui lai ngay ma khong bi chan, tra %', tt; end if;
  if giay is null or giay <= 0 then raise exception 'FAIL C3: bi chan nhung khong noi cho bao lau (%)', giay; end if;

  -- Địa chỉ lạ: hàm nói thật cho máy chủ, còn màn đăng nhập trả lời y hệt như
  -- lúc thành công. Đây là chỗ ranh giới đó, nên phải chốt bằng test.
  select g.trang_thai into tt from public.auth_gui_ma('nguoi-la@vbuilding.test', '111111') g;
  if tt <> 'khong_co_nguoi' then raise exception 'FAIL C4: dia chi la tra %', tt; end if;

  -- ── D. Kiểm mã ────────────────────────────────────────────────────────────
  select k.trang_thai, k.uid into tt, v_uid from public.auth_kiem_ma(a_mail, '654321') k;
  if tt <> 'sai' then raise exception 'FAIL D1: go sai ma tra %', tt; end if;

  select k.trang_thai, k.uid into tt, v_uid from public.auth_kiem_ma(a_mail, '123456') k;
  if tt <> 'ok' then raise exception 'FAIL D2: go dung ma tra %', tt; end if;
  if v_uid is distinct from a_uid then raise exception 'FAIL D3: dung ma nhung tra ve nguoi khac'; end if;

  -- ── E. Mã dùng một lần là DÙNG MỘT LẦN ────────────────────────────────────
  -- Đây là cả điểm của "mã một lần". Hỏng chốt này thì mã trong hộp thư cũ dùng
  -- lại được mãi mãi.
  select k.trang_thai into tt from public.auth_kiem_ma(a_mail, '123456') k;
  if tt = 'ok' then raise exception 'FAIL E1: ma da dung van dung lai duoc'; end if;

  -- ── F. Dò mã bị chặn ──────────────────────────────────────────────────────
  -- Tài khoản riêng: A vừa tiêu mã xong và còn vướng hạn 60 giây, mà now() thì
  -- đứng yên trong một transaction nên không chờ được.
  b_uid := public.auth_tao_nguoi_dung('', b_sdt, 'Anh B smoke', 'matkhau-cua-b-1');
  select g.trang_thai into tt from public.auth_gui_ma(b_sdt, '246810') g;
  if tt <> 'ok' then raise exception 'FAIL F1: khong gui duoc ma cho so dien thoai, tra %', tt; end if;

  for i in 1..10 loop
    select k.trang_thai into tt from public.auth_kiem_ma(b_sdt, '000000') k;
    if tt <> 'sai' then raise exception 'FAIL F2: lan do thu % tra % (mong doi sai)', i, tt; end if;
  end loop;
  select k.trang_thai into tt from public.auth_kiem_ma(b_sdt, '000000') k;
  if tt <> 'qua_nhieu' then raise exception 'FAIL F3: do 11 lan van chua bi khoa, tra %', tt; end if;
  -- Khóa rồi thì mã ĐÚNG cũng không vào. Nếu không, kẻ dò chỉ cần đoán trúng
  -- ở lần thứ 12 là xong.
  select k.trang_thai into tt from public.auth_kiem_ma(b_sdt, '246810') k;
  if tt <> 'qua_nhieu' then raise exception 'FAIL F4: bi khoa ma ma dung van vao duoc, tra %', tt; end if;

  -- ── G. Đổi mật khẩu ───────────────────────────────────────────────────────
  -- Tài khoản riêng, và phải có một mã một lần ĐANG TREO lúc đổi mật khẩu —
  -- đó mới là tình huống G4 nói tới. Dùng lại tài khoản A thì mã của A đã tiêu
  -- ở bước D, G4 đếm ra 0 dù hàm có hủy mã hay không, và bài test thành rỗng.
  c_uid := public.auth_tao_nguoi_dung(c_mail, '', 'Co C smoke', 'matkhau-cu-c-1');
  select g.trang_thai into tt from public.auth_gui_ma(c_mail, '135790') g;
  if tt <> 'ok' then raise exception 'FAIL G0: khong gui duoc ma cho C, tra %', tt; end if;

  if not public.auth_dat_mat_khau(c_uid, 'matkhau-moi-c-2') then
    raise exception 'FAIL G1: khong doi duoc mat khau';
  end if;
  if public.auth_kiem_mat_khau(c_mail, 'matkhau-cu-c-1') is not null then
    raise exception 'FAIL G2: mat khau CU van con dung duoc sau khi doi';
  end if;
  if public.auth_kiem_mat_khau(c_mail, 'matkhau-moi-c-2') is distinct from c_uid then
    raise exception 'FAIL G3: mat khau MOI khong dung duoc';
  end if;
  -- Đổi mật khẩu vì nghi bị lộ mà để lại một mã một lần còn sống là để lại
  -- đúng cái cửa vừa định đóng.
  select count(*) into n from auth.ma_dang_nhap
   where user_id = c_uid and dung_luc is null and het_han_luc > now();
  if n <> 0 then raise exception 'FAIL G4: doi mat khau xong con % ma mot lan song', n; end if;
  -- Và mã đó phải chết THẬT, không chỉ là đếm ra 0.
  select k.trang_thai into tt from public.auth_kiem_ma(c_mail, '135790') k;
  if tt = 'ok' then raise exception 'FAIL G5: ma gui truoc khi doi mat khau van dang nhap duoc'; end if;
  if public.auth_dat_mat_khau('00000000-0000-0000-0000-0000000000ff', 'x') then
    raise exception 'FAIL G6: doi mat khau cho nguoi khong ton tai ma bao thanh cong';
  end if;

  -- ── H. Quyền: cư dân không gọi được hàm đăng nhập ─────────────────────────
  -- Chốt quan trọng nhất file này. Postgres cấp EXECUTE cho PUBLIC trên mọi
  -- function mới, và câu revoke chung trong auth_hooks.sql chạy TRƯỚC 03_auth.sql
  -- nên không với tới. Quên đoạn revoke ở cuối 03_auth.sql thì bất kỳ ai cầm JWT
  -- authenticated cũng đổi được mật khẩu của cả tòa — mà không có gì báo.
  begin
    execute 'set local role authenticated';
    perform public.auth_dat_mat_khau(a_uid, 'toi-tu-doi-mat-khau');
    execute 'reset role';
    raise exception 'FAIL H1: role authenticated goi duoc auth_dat_mat_khau';
  exception when insufficient_privilege then
    null;   -- đúng như mong đợi
  end;
  execute 'reset role';

  begin
    execute 'set local role authenticated';
    perform public.auth_kiem_mat_khau(a_mail, 'matkhau-cu-123');
    execute 'reset role';
    raise exception 'FAIL H2: role authenticated goi duoc auth_kiem_mat_khau';
  exception when insufficient_privilege then
    null;
  end;
  execute 'reset role';

  -- Đọc thẳng bảng mã cũng phải bị chặn: có execute hay không thì cũng vô
  -- nghĩa nếu băm của mã nằm phơi ra cho mọi người đăng nhập đọc.
  begin
    execute 'set local role authenticated';
    execute 'select count(*) from auth.ma_dang_nhap';
    execute 'reset role';
    raise exception 'FAIL H3: role authenticated doc duoc bang auth.ma_dang_nhap';
  exception when insufficient_privilege then
    null;
  end;
  execute 'reset role';

  -- ── I. Xóa tài khoản dọn sạch cả profiles ─────────────────────────────────
  -- Đường "tạo tài khoản xong gán vai trò lỗi -> tự hủy". Sót dòng profiles là
  -- số điện thoại đó bị chiếm vĩnh viễn bởi một dòng không màn nào hiện ra.
  if not public.auth_xoa_nguoi_dung(b_uid) then
    raise exception 'FAIL I1: khong xoa duoc tai khoan';
  end if;
  select count(*) into n from public.profiles where id = b_uid;
  if n <> 0 then raise exception 'FAIL I2: xoa tai khoan xong con % dong profiles mo coi', n; end if;
  -- Và tạo lại được bằng đúng số điện thoại đó.
  b_uid := public.auth_tao_nguoi_dung('', b_sdt, 'Anh B smoke lan hai', 'matkhau-cua-b-2');
  if b_uid is null then raise exception 'FAIL I3: khong tao lai duoc bang so dien thoai cu'; end if;

  raise notice 'SMOKE AUTH PASSED — mat khau, ma mot lan, chan do ma, quyen va don profiles deu dung';
end
$smoke$;

rollback;
