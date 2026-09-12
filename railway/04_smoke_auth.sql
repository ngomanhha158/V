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
  d_mail text := 'smoke.d@vbuilding.test';
  -- Danh tính riêng cho nhóm K: mọi địa chỉ phía trên đã có chủ, và tạo trùng
  -- thì bài test đỏ vì unique chứ không vì điều nó định chứng minh.
  e_mail text := 'smoke.e@vbuilding.test';
  e_sdt  text := '+84900000188';
  a_uid uuid; b_uid uuid; c_uid uuid; d_uid uuid; v_uid uuid;
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

  -- ── J. Thư không gửi được thì TRẢ LẠI suất mã ────────────────────────────
  -- auth_gui_ma lưu mã trước, Node gửi thư sau. Thư hỏng mà không trả lại suất
  -- thì lần bấm kế tiếp nhận câu "vừa gửi rồi, chờ 8 phút" — một câu trả lời
  -- SAI về nguyên nhân, dắt người đi sửa sang nhầm hướng đúng lúc đang có sự cố.
  d_uid := public.auth_tao_nguoi_dung(d_mail, '', 'Anh D smoke', 'mk-cua-d-1');

  -- Một mã CŨ, xin từ 5 phút trước, vẫn còn hạn. Có nó thì mới kiểm được điều
  -- quan trọng nhất: hủy phải chỉ giết mã vừa tạo, không đụng mã người ta đang
  -- cầm trong tay từ lá thư đến chậm.
  insert into auth.ma_dang_nhap (user_id, ma_hash, het_han_luc, tao_luc)
  values (d_uid, crypt('111111', gen_salt('bf', 10)),
          now() + interval '5 minutes', now() - interval '5 minutes');

  select g.trang_thai into tt from public.auth_gui_ma(d_mail, '222222') g;
  if tt <> 'ok' then raise exception 'FAIL J1: khong gui duoc ma moi, tra %', tt; end if;

  if not public.auth_huy_ma(d_mail) then
    raise exception 'FAIL J2: khong huy duoc ma vua tao';
  end if;

  select count(*) into n from auth.ma_dang_nhap
   where user_id = d_uid and dung_luc is null and het_han_luc > now();
  if n <> 1 then raise exception 'FAIL J3: sau khi huy con % ma song, phai con dung 1 (ma cu)', n; end if;

  -- XÓA hẳn, không phải đánh dấu đã dùng. Đánh dấu thì hạn 60 giây vẫn tính
  -- theo tao_luc của nó, và câu trả lời sai ("vừa gửi rồi, chờ 60 giây") vẫn
  -- còn nguyên — tức là chưa sửa được gì.
  select count(*) into n from auth.ma_dang_nhap where user_id = d_uid;
  if n <> 1 then raise exception 'FAIL J3b: con % dong, ma huy phai bi XOA chu khong phai danh dau', n; end if;

  -- Và vì thế gửi lại được NGAY, không vướng hạn 60 giây của lần vừa hỏng.
  select g.trang_thai into tt from public.auth_gui_ma(d_mail, '333333') g;
  if tt <> 'ok' then
    raise exception 'FAIL J3c: sau khi huy van bi chan boi han 60 giay, tra % — nguoi dung se nhan cau tra loi sai ve nguyen nhan', tt;
  end if;
  if not public.auth_huy_ma(d_mail) then raise exception 'FAIL J3d: khong don duoc ma vua tao them'; end if;

  select k.trang_thai into tt from public.auth_kiem_ma(d_mail, '222222') k;
  if tt = 'ok' then raise exception 'FAIL J4: ma da huy van dang nhap duoc'; end if;

  select k.trang_thai into tt from public.auth_kiem_ma(d_mail, '111111') k;
  if tt <> 'ok' then raise exception 'FAIL J5: huy nham ca ma CU, tra %', tt; end if;

  -- Không còn mã nào để hủy, và địa chỉ không tồn tại: trả false chứ không văng.
  if public.auth_huy_ma(d_mail) then raise exception 'FAIL J6: huy duoc trong khi khong con ma nao'; end if;
  if public.auth_huy_ma('khong-ai@vbuilding.test') then
    raise exception 'FAIL J7: huy duoc ma cua mot dia chi khong ton tai';
  end if;

  -- ── K. Tự phục vụ: đổi mật khẩu và thông tin liên lạc ─────────────────────
  -- Cả nhóm này chạy dưới một danh tính GIẢ LẬP: auth.uid() đọc app.user_id khi
  -- không có JWT. Không đặt nó thì mọi hàm dưới đây trả 'chua_dang_nhap' và
  -- bài test xanh mà không chứng minh gì — nên K1 chốt đúng điều đó trước.
  perform set_config('app.user_id', '', true);
  if public.auth_doi_mat_khau_cua_toi('x', 'matkhaumoi123') <> 'chua_dang_nhap' then
    raise exception 'FAIL K1: doi duoc mat khau khi chua dang nhap';
  end if;
  if public.auth_doi_lien_lac_cua_toi('Ten', 'x@vbuilding.test', null) <> 'chua_dang_nhap' then
    raise exception 'FAIL K1b: doi duoc lien lac khi chua dang nhap';
  end if;

  perform set_config('app.user_id', a_uid::text, true);

  -- Mật khẩu mới quá ngắn thì từ chối, và mật khẩu CŨ phải còn nguyên hiệu lực.
  -- Thiếu vế thứ hai thì một hàm ghi đè trước rồi mới kiểm cũng qua được bài này.
  if public.auth_doi_mat_khau_cua_toi('matkhau-cu-123', 'ngan') <> 'qua_ngan' then
    raise exception 'FAIL K2: nhan mat khau ngan hon muc toi thieu';
  end if;
  if public.auth_kiem_mat_khau(a_mail, 'matkhau-cu-123') is distinct from a_uid then
    raise exception 'FAIL K2b: mat khau cu hong sau mot lan tu choi';
  end if;

  -- Sai mật khẩu cũ: từ chối, và cũng không được đổi gì.
  if public.auth_doi_mat_khau_cua_toi('sai-be-bet', 'matkhaumoi-123') <> 'sai_mat_khau_cu' then
    raise exception 'FAIL K3: doi duoc mat khau ma khong biet mat khau cu';
  end if;
  if public.auth_kiem_mat_khau(a_mail, 'matkhaumoi-123') is not null then
    raise exception 'FAIL K3b: mat khau moi da co hieu luc du bi tu choi';
  end if;

  -- Đổi thật. Mã một lần đang treo phải chết theo: đổi mật khẩu vì nghi bị lộ
  -- mà để lại một mã sống là để lại đúng cái cửa vừa định đóng.
  select public.auth_gui_ma(a_mail, '111111') into tt;
  if public.auth_doi_mat_khau_cua_toi('matkhau-cu-123', 'matkhaumoi-123') <> 'ok' then
    raise exception 'FAIL K4: khong doi duoc mat khau du dua dung mat khau cu';
  end if;
  if public.auth_kiem_mat_khau(a_mail, 'matkhaumoi-123') is distinct from a_uid then
    raise exception 'FAIL K4b: mat khau moi khong dung nhap duoc';
  end if;
  if public.auth_kiem_mat_khau(a_mail, 'matkhau-cu-123') is not null then
    raise exception 'FAIL K4c: mat khau CU van dang nhap duoc sau khi doi';
  end if;
  select count(*) into n from auth.ma_dang_nhap
   where user_id = a_uid and dung_luc is null and het_han_luc > now();
  if n <> 0 then raise exception 'FAIL K4d: doi mat khau ma con % ma mot lan song', n; end if;

  -- Người CHƯA TỪNG có mật khẩu đặt được lần đầu mà không cần mật khẩu cũ.
  -- Đòi một thứ họ không có là khoá vĩnh viễn tính năng này với đúng nhóm cần
  -- nó nhất — cư dân chỉ vào bằng mã một lần.
  -- Dùng lại tài khoản C và gỡ mật khẩu của nó, thay vì tạo tài khoản mới:
  -- mọi địa chỉ trong file này đã có chủ từ các phần trên.
  update auth.users set mat_khau_hash = null where id = c_uid;
  perform set_config('app.user_id', c_uid::text, true);
  if public.auth_doi_mat_khau_cua_toi(null, 'matkhaudau-123') <> 'ok' then
    raise exception 'FAIL K5: nguoi chua co mat khau khong tu dat duoc lan dau';
  end if;
  if public.auth_kiem_mat_khau(c_mail, 'matkhaudau-123') is distinct from c_uid then
    raise exception 'FAIL K5b: mat khau dat lan dau khong dung nhap duoc';
  end if;

  -- ── Thông tin liên lạc ────────────────────────────────────────────────────
  perform set_config('app.user_id', a_uid::text, true);

  -- Xoá sạch cả email lẫn số điện thoại là tự khoá mình ra ngoài vĩnh viễn:
  -- auth_tim() tìm người theo đúng hai cột đó. Phải chặn, và chặn mà KHÔNG đổi gì.
  if public.auth_doi_lien_lac_cua_toi('Chi A smoke', '', '') <> 'thieu_lien_lac' then
    raise exception 'FAIL K6: cho phep xoa het ca hai duong dang nhap';
  end if;
  if public.auth_tim(a_mail) is distinct from a_uid then
    raise exception 'FAIL K6b: lan tu choi van kip xoa mat email';
  end if;

  -- Trùng địa chỉ của người khác thì từ chối, và nói rõ trùng cái nào.
  if public.auth_doi_lien_lac_cua_toi('Chi A smoke', c_mail, null) <> 'trung_email' then
    raise exception 'FAIL K7: cho phep lay email cua nguoi khac';
  end if;

  -- Đổi thật. Đây là assert đắt nhất của cả nhóm: phải ghi CẢ HAI bảng. Đăng
  -- nhập đọc auth.users, màn hình đọc profiles — sửa một bên thì màn hình hiện
  -- email mới trong khi đăng nhập vẫn ăn email cũ.
  select public.auth_gui_ma(a_mail, '222222') into tt;
  if public.auth_doi_lien_lac_cua_toi('Chi A doi ten', e_mail, e_sdt) <> 'ok' then
    raise exception 'FAIL K8: khong doi duoc lien lac';
  end if;
  if public.auth_tim(e_mail) is distinct from a_uid then
    raise exception 'FAIL K8b: auth.users chua nhan email moi — dang nhap van an email cu';
  end if;
  if public.auth_tim(a_mail) is not null then
    raise exception 'FAIL K8c: email CU van dang nhap duoc';
  end if;
  select count(*) into n from public.profiles
   where id = a_uid and email = e_mail and phone = e_sdt and full_name = 'Chi A doi ten';
  if n <> 1 then raise exception 'FAIL K8d: profiles chua dong bo voi auth.users'; end if;
  -- Mã gửi tới địa chỉ CŨ phải chết: từ giây này địa chỉ đó không còn là đường
  -- vào tài khoản nữa.
  select count(*) into n from auth.ma_dang_nhap
   where user_id = a_uid and dung_luc is null and het_han_luc > now();
  if n <> 0 then raise exception 'FAIL K8e: doi email ma con % ma mot lan song', n; end if;

  -- Sổ kiểm toán phải có dấu vết: đổi email đăng nhập là việc phải truy được.
  select count(*) into n from public.audit_log
   where bang = 'auth.users' and ban_ghi = a_uid::text and thao_tac = 'UPDATE';
  if n < 2 then raise exception 'FAIL K9: so kiem toan chi co % dong cho doi mat khau va doi email', n; end if;

  -- ── Ban quản lý sửa hộ: phải chặn người không phải trưởng ban ──────────────
  perform set_config('app.user_id', c_uid::text, true);
  begin
    perform public.auth_sua_lien_lac(
      (select id from public.projects order by created_at limit 1),
      a_uid, 'Ten khac', 'cuop@vbuilding.test', null);
    raise exception 'FAIL K10: nguoi khong phai truong BQL sua duoc lien lac cua nguoi khac';
  exception when insufficient_privilege then null;
  end;
  if public.auth_tim(e_mail) is distinct from a_uid then
    raise exception 'FAIL K10b: lan bi chan van kip doi email';
  end if;

  perform set_config('app.user_id', '', true);

  raise notice 'SMOKE AUTH PASSED — mat khau, ma mot lan, chan do ma, quyen, don profiles va tra lai suat khi thu hong deu dung';
end
$smoke$;

rollback;
