-- ─────────────────────────────────────────────────────────────────────────────
-- Thay GoTrue (Supabase Auth) bằng Postgres thuần.
-- Chạy SAU schema.sql và auth_hooks.sql.
--
-- Chia việc, cố ý:
--   • Postgres giữ mật khẩu (bcrypt qua pgcrypto), mã một lần, và đồng hồ đếm
--     lượt. Đếm lượt PHẢI nằm ở đây chứ không phải trong RAM tiến trình Next:
--     Railway chạy nhiều bản sao thì bộ đếm trong RAM bị chia ra, và ngưỡng
--     "5 lượt" thành 5 lượt MỖI bản sao.
--   • Next.js giữ việc sinh mã ngẫu nhiên, gửi thư, và ký JWT. Mã sinh ở Node
--     bằng crypto.randomInt rồi đưa xuống đây để BĂM — hàm SQL không bao giờ
--     TRẢ RA một bí mật nào, nên log của PostgREST không thể vô tình chứa mã.
--
-- Không hàm nào ở đây được cấp cho anon hay authenticated. Toàn bộ đường đăng
-- nhập đi qua route handler phía máy chủ, dùng JWT service_role. Trình duyệt
-- không nói chuyện trực tiếp với PostgREST bao giờ.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists pgcrypto;

-- Cột thêm cho auth.users. `add column if not exists` chứ không dựng lại bảng:
-- DB đã chạy GĐ0 rồi thì đã có dữ liệu, và bảng này là gốc khóa ngoại của
-- profiles.
alter table auth.users add column if not exists mat_khau_hash text;
alter table auth.users add column if not exists xac_nhan_luc  timestamptz;
alter table auth.users add column if not exists dang_nhap_luc timestamptz;

-- Mã một lần. Lưu BĂM chứ không lưu mã: kẻ đọc trộm được bảng này vẫn không
-- đăng nhập hộ ai được, và người trực ban đọc bảng cũng không thấy mã của cư dân.
create table if not exists auth.ma_dang_nhap (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  ma_hash     text not null,
  tao_luc     timestamptz not null default now(),
  het_han_luc timestamptz not null,
  dung_luc    timestamptz,
  so_lan_sai  int not null default 0
);
create index if not exists ma_dang_nhap_nguoi
  on auth.ma_dang_nhap (user_id, tao_luc desc);

-- ─────────────────────────────── HẰNG SỐ CHÍNH SÁCH ──────────────────────────
--   Mã sống 10 phút · 60 giây giữa hai lần gửi · tối đa 3 mã còn sống
--   · tối đa 10 lần gõ sai trên toàn bộ mã còn sống của một người.
-- Con số nằm ngay trong hàm, không tách ra bảng cấu hình: một bảng cấu hình mà
-- BQL sửa được là một nút để tự tắt chốt chặn của chính mình.

-- ────────────────────────────────── TÌM NGƯỜI ────────────────────────────────
-- Nhận email đã chuẩn hóa (chữ thường) hoặc số E.164. Trả null nếu không có.
create or replace function public.auth_tim(p_danh_tinh text)
returns uuid language sql stable security definer set search_path = auth, public as $fn$
  select u.id from auth.users u
   where u.email = lower(p_danh_tinh) or u.phone = p_danh_tinh
   limit 1;
$fn$;

-- ─────────────────────────────── GỬI MÃ MỘT LẦN ──────────────────────────────
-- Node sinh mã, gọi hàm này để băm và lưu. Trả về:
--   ('ok', 0)              — lưu rồi, cứ gửi thư đi
--   ('khong_co_nguoi', 0)  — không có tài khoản nào; app vẫn trả lời y hệt
--                            như lúc thành công, đừng để màn đăng nhập thành
--                            máy dò xem địa chỉ nào đã đăng ký
--   ('cho', <giây>)        — gửi quá dày hoặc quá nhiều
create or replace function public.auth_gui_ma(p_danh_tinh text, p_ma text)
returns table (trang_thai text, cho_giay int)
language plpgsql volatile security definer set search_path = auth, public as $fn$
declare
  v_uid   uuid;
  v_gan   timestamptz;
  v_song  int;
  v_cu    timestamptz;
begin
  v_uid := public.auth_tim(p_danh_tinh);
  if v_uid is null then
    return query select 'khong_co_nguoi'::text, 0; return;
  end if;

  select max(m.tao_luc) into v_gan from auth.ma_dang_nhap m where m.user_id = v_uid;
  if v_gan is not null and v_gan > now() - interval '60 seconds' then
    return query select 'cho'::text,
      ceil(extract(epoch from (v_gan + interval '60 seconds' - now())))::int;
    return;
  end if;

  select count(*), min(m.tao_luc) into v_song, v_cu
    from auth.ma_dang_nhap m
   where m.user_id = v_uid and m.dung_luc is null and m.het_han_luc > now();
  if v_song >= 3 then
    -- Chờ tới lúc mã cũ nhất hết hạn thì mới có chỗ cho mã mới. Nói ra số giây
    -- thật để màn đăng nhập đếm ngược được, đừng bắt người ta đoán.
    return query select 'cho'::text,
      ceil(extract(epoch from (v_cu + interval '10 minutes' - now())))::int;
    return;
  end if;

  insert into auth.ma_dang_nhap (user_id, ma_hash, het_han_luc)
  values (v_uid, crypt(p_ma, gen_salt('bf', 10)), now() + interval '10 minutes');

  return query select 'ok'::text, 0;
end
$fn$;

-- ────────────────────────────────── KIỂM MÃ ──────────────────────────────────
-- Trả ('ok', <uid>) hoặc ('sai'|'het_han'|'qua_nhieu', null).
--
-- KHÔNG hủy các mã cũ khi gửi mã mới: thư đến chậm là chuyện thường, và người
-- gõ mã trong lá thư đến trước mà bị báo sai thì họ tưởng mình gõ nhầm rồi gõ
-- lại tới lúc bị khóa. Chốt chặn nằm ở "tối đa 3 mã còn sống" chứ không nằm ở
-- việc hủy mã.
create or replace function public.auth_kiem_ma(p_danh_tinh text, p_ma text)
returns table (trang_thai text, uid uuid)
language plpgsql volatile security definer set search_path = auth, public as $fn$
declare
  v_uid  uuid;
  v_sai  int;
  v_id   bigint;
begin
  v_uid := public.auth_tim(p_danh_tinh);
  -- Không có tài khoản: trả 'sai' y như gõ nhầm mã. Trả 'khong_co_nguoi' ở đây
  -- là biến ô nhập mã thành máy dò danh sách cư dân.
  if v_uid is null then return query select 'sai'::text, null::uuid; return; end if;

  select coalesce(sum(m.so_lan_sai), 0) into v_sai
    from auth.ma_dang_nhap m
   where m.user_id = v_uid and m.dung_luc is null and m.het_han_luc > now();
  if v_sai >= 10 then return query select 'qua_nhieu'::text, null::uuid; return; end if;

  select m.id into v_id
    from auth.ma_dang_nhap m
   where m.user_id = v_uid and m.dung_luc is null and m.het_han_luc > now()
     and m.ma_hash = crypt(p_ma, m.ma_hash)
   order by m.tao_luc desc
   limit 1;

  if v_id is null then
    -- Đếm lượt sai lên TẤT CẢ mã còn sống: đếm trên một mã thôi thì kẻ dò chỉ
    -- cần xin mã mới là bộ đếm về không.
    update auth.ma_dang_nhap m set so_lan_sai = m.so_lan_sai + 1
     where m.user_id = v_uid and m.dung_luc is null and m.het_han_luc > now();
    -- Còn mã sống nào không: hết sạch nghĩa là mã đã hết hạn chứ không phải gõ
    -- sai, và hai câu khuyên khác hẳn nhau ("gõ lại" với "xin mã mới").
    if not exists (select 1 from auth.ma_dang_nhap m
                    where m.user_id = v_uid and m.dung_luc is null
                      and m.het_han_luc > now())
    then return query select 'het_han'::text, null::uuid; return; end if;
    return query select 'sai'::text, null::uuid; return;
  end if;

  update auth.ma_dang_nhap set dung_luc = now() where id = v_id;
  update auth.users set dang_nhap_luc = now(), xac_nhan_luc = coalesce(xac_nhan_luc, now())
   where id = v_uid;
  return query select 'ok'::text, v_uid;
end
$fn$;

-- ──────────────────────────────── KIỂM MẬT KHẨU ──────────────────────────────
-- Trả uid nếu đúng, null nếu sai. Không phân biệt "không có tài khoản" với
-- "sai mật khẩu" — cùng một câu trả lời cho cả hai.
create or replace function public.auth_kiem_mat_khau(p_danh_tinh text, p_mat_khau text)
returns uuid
language plpgsql volatile security definer set search_path = auth, public as $fn$
declare v_uid uuid; v_hash text;
begin
  select u.id, u.mat_khau_hash into v_uid, v_hash
    from auth.users u
   where u.email = lower(p_danh_tinh) or u.phone = p_danh_tinh
   limit 1;
  if v_uid is null or v_hash is null then return null; end if;
  if v_hash <> crypt(p_mat_khau, v_hash) then return null; end if;
  update auth.users set dang_nhap_luc = now() where id = v_uid;
  return v_uid;
end
$fn$;

-- ─────────────────────── HỦY MÃ VỪA TẠO KHI THƯ KHÔNG ĐI ────────────────────
-- auth_gui_ma LƯU mã trước, Node GỬI thư sau. Thư không đi được thì cái mã vừa
-- lưu chiếm một trong ba suất còn sống VÀ đặt hạn 60 giây, dù chẳng ai nhận
-- được gì.
--
-- Hậu quả không phải là không đăng nhập được — SMTP hỏng thì đằng nào cũng
-- không — mà là hệ thống NÓI SAI về nguyên nhân: bấm lần nữa sẽ nhận "vừa gửi
-- rồi, chờ 60 giây, nhớ xem cả hộp thư rác". Người trực ban đọc câu đó sẽ đi
-- tìm lỗi ở giới hạn gửi thay vì đi kiểm SMTP, và một sự cố nửa giờ thành nửa
-- buổi.
--
-- XÓA hẳn dòng, không phải đánh dấu đã dùng. Đánh dấu thì suất được trả lại
-- nhưng hạn 60 giây vẫn tính theo tao_luc, nên câu trả lời sai vẫn còn nguyên.
-- Xóa cũng đúng với sự thật: đây là mã chưa từng đến tay ai, nó không có giá
-- trị điều tra nào để giữ lại.
--
-- Đổi lại, trong lúc SMTP hỏng thì hạn 60 giây không áp nữa. Chấp nhận được vì
-- đường này CHỈ chạy khi lần gửi vừa rồi đã thất bại: gửi thành công thì dòng
-- ở lại và hạn vẫn nguyên như cũ. Chi phí mỗi lần bấm bị chặn trên bởi
-- connectionTimeout/socketTimeout đặt trong lib/mail.ts.
create or replace function public.auth_huy_ma(p_danh_tinh text)
returns boolean
language plpgsql volatile security definer set search_path = auth, public as $fn$
declare v_uid uuid; v_id bigint;
begin
  v_uid := public.auth_tim(p_danh_tinh);
  if v_uid is null then return false; end if;
  -- CHỈ mã mới nhất. Người ta có thể đang cầm một mã cũ vẫn còn hạn từ lần gửi
  -- trước đó — thư đến chậm là chuyện thường — và hủy nhầm nó là lấy mất đúng
  -- cái mã đang dùng được.
  select m.id into v_id from auth.ma_dang_nhap m
   where m.user_id = v_uid and m.dung_luc is null
   order by m.tao_luc desc limit 1;
  if v_id is null then return false; end if;
  delete from auth.ma_dang_nhap where id = v_id;
  return true;
end
$fn$;

-- ──────────────────────────── QUẢN LÝ TÀI KHOẢN (BQL) ────────────────────────
-- Thay admin.createUser / updateUserById / deleteUser của Supabase.
--
-- Ba hàm này KHÔNG tự kiểm quyền BQL, y như Admin API của Supabase cũng không.
-- Chốt is_bql_manager nằm ở app/bql/nguoi-dung/actions.ts và chạy TRƯỚC, bằng
-- client của người đang đăng nhập. Ở đây chỉ cấp cho service_role, mà
-- service_role thì không bao giờ ra tới trình duyệt.
create or replace function public.auth_tao_nguoi_dung(
  p_email text, p_phone text, p_ho_ten text, p_mat_khau text)
returns uuid
language plpgsql volatile security definer set search_path = auth, public as $fn$
declare v_uid uuid;
begin
  insert into auth.users (email, phone, raw_user_meta_data, mat_khau_hash, xac_nhan_luc)
  values (lower(nullif(p_email, '')), nullif(p_phone, ''),
          jsonb_build_object('full_name', p_ho_ten),
          crypt(p_mat_khau, gen_salt('bf', 10)),
          -- Tạo bởi BQL thì coi như đã xác nhận: đây là cả lý do màn tạo tài
          -- khoản tồn tại — mời 24 hộ mà mỗi hộ phải chờ một lá thư xác nhận
          -- là mất nửa ngày và hộ nào không nhận được thư là kẹt luôn.
          now())
  returning id into v_uid;
  return v_uid;   -- trigger on_auth_user_created tự dựng dòng profiles
end
$fn$;

create or replace function public.auth_dat_mat_khau(p_uid uuid, p_mat_khau text)
returns boolean
language plpgsql volatile security definer set search_path = auth, public as $fn$
begin
  update auth.users set mat_khau_hash = crypt(p_mat_khau, gen_salt('bf', 10))
   where id = p_uid;
  if not found then return false; end if;
  -- Đổi mật khẩu thì mọi mã một lần đang treo mất hiệu lực: nếu đổi vì nghi bị
  -- lộ, để lại một mã còn sống là để lại đúng cái cửa vừa định đóng.
  update auth.ma_dang_nhap set dung_luc = now()
   where user_id = p_uid and dung_luc is null;
  return true;
end
$fn$;

-- Xóa CẢ dòng profiles, không chỉ auth.users. profiles không có khóa ngoại trỏ
-- về auth.users (schema.sql chạy được độc lập), nên xóa mỗi auth.users là để
-- lại một profiles mồ côi — mà profiles.phone là UNIQUE. Hệ quả đúng ở chỗ đau
-- nhất: BQL tạo tài khoản, gán vai trò lỗi, hệ thống tự hủy, BQL tạo lại bằng
-- đúng số điện thoại đó và lần này hỏng vì trùng — với một dòng không ai nhìn
-- thấy ở bất kỳ màn nào.
--
-- profiles xóa TRƯỚC: nếu người này đã được gán căn hoặc gán nhân sự thì khóa
-- ngoại chặn lại, cả hàm rollback, và không ai bị xóa nửa vời.
create or replace function public.auth_xoa_nguoi_dung(p_uid uuid)
returns boolean
language plpgsql volatile security definer set search_path = auth, public as $fn$
begin
  delete from public.profiles where id = p_uid;
  delete from auth.users where id = p_uid;
  return found;
end
$fn$;

-- ────────────────────────────────── QUYỀN ────────────────────────────────────
-- BẪY: Postgres cấp EXECUTE cho PUBLIC trên mọi function mới. auth_hooks.sql có
-- câu revoke chung, nhưng nó chạy TRƯỚC file này nên không với tới đây. Thiếu
-- đoạn dưới thì bất kỳ ai cầm JWT authenticated đều gọi được auth_dat_mat_khau
-- và đổi mật khẩu của cả tòa.
revoke execute on function
  public.auth_tim(text), public.auth_gui_ma(text, text), public.auth_kiem_ma(text, text),
  public.auth_kiem_mat_khau(text, text), public.auth_tao_nguoi_dung(text, text, text, text),
  public.auth_dat_mat_khau(uuid, text), public.auth_xoa_nguoi_dung(uuid),
  public.auth_huy_ma(text)
  from public, anon, authenticated;

grant execute on function
  public.auth_tim(text), public.auth_gui_ma(text, text), public.auth_kiem_ma(text, text),
  public.auth_kiem_mat_khau(text, text), public.auth_tao_nguoi_dung(text, text, text, text),
  public.auth_dat_mat_khau(uuid, text), public.auth_xoa_nguoi_dung(uuid),
  public.auth_huy_ma(text)
  to service_role;

grant usage, select on sequence auth.ma_dang_nhap_id_seq to service_role;
grant select, insert, update, delete on auth.users, auth.ma_dang_nhap to service_role;

-- Dọn rác: mã đã dùng hoặc hết hạn quá một ngày thì không còn giá trị điều tra.
-- Gọi từ cron.sql; không có cron thì bảng cũng chỉ lớn theo số lượt đăng nhập.
create or replace function public.auth_don_ma()
returns int language plpgsql volatile security definer set search_path = auth, public as $fn$
declare n int;
begin
  delete from auth.ma_dang_nhap
   where het_han_luc < now() - interval '1 day';
  get diagnostics n = row_count;
  return n;
end
$fn$;
revoke execute on function public.auth_don_ma() from public, anon, authenticated;
grant execute on function public.auth_don_ma() to service_role;

-- ═════════ TỰ PHỤC VỤ: ĐỔI MẬT KHẨU VÀ THÔNG TIN LIÊN LẠC ═══════════════════
--
-- Vì sao cần: trước đây KHÔNG có đường nào để cư dân tự đặt mật khẩu hay sửa số
-- điện thoại của mình. auth_dat_mat_khau nhận p_uid tuỳ ý nên bị thu hồi khỏi
-- authenticated — đúng, vì cấp nó ra là ai cũng đổi mật khẩu của cả tòa. Nhưng
-- hệ quả là mọi việc nhỏ nhất cũng phải nhờ ban quản lý, nhân với số căn của
-- cả khu trong đúng tuần dán poster.
--
-- Cách chữa không phải là cấp lại quyền cũ mà là hàm MỚI không nhận uid: danh
-- tính lấy từ auth.uid(), nên người gọi chỉ sửa được chính mình.
--
-- GHI CẢ HAI BẢNG, không chỉ một. Đăng nhập đọc auth.users.email (auth_tim);
-- màn hình đọc profiles.email. Trigger on_auth_user_created chỉ chạy lúc
-- INSERT nên không đồng bộ hộ lần sửa nào. Sửa mỗi profiles là màn hình hiện
-- email mới trong khi đăng nhập vẫn ăn email cũ — một tính năng nửa vời tệ hơn
-- là không có, vì nó làm người dùng tin rằng mình đã đổi xong.

/**
 * Dự án để ghi sổ kiểm toán cho một người.
 *
 * audit_log lọc bằng is_staff(project_id), mà is_staff(null) luôn false — nên
 * một dòng sổ không có dự án là dòng không màn nào đọc được. Lấy dự án từ căn
 * đang ở; không có căn thì lấy từ phân công nhân sự.
 */
create or replace function public.auth_du_an_cua(p_uid uuid)
returns uuid language sql stable security definer set search_path = public as $fn$
  select coalesce(
    (select b.project_id
       from unit_memberships m
       join units u     on u.id = m.unit_id
       join buildings b on b.id = u.building_id
      where m.user_id = p_uid and m.status = 'active'
        and (m.valid_to is null or m.valid_to >= current_date)
      order by b.project_id limit 1),
    (select s.project_id from staff_assignments s
      where s.user_id = p_uid and s.is_active
      order by s.project_id limit 1));
$fn$;

/** Độ dài tối thiểu của mật khẩu tự đặt. Ngắn hơn thì lớp đếm lượt dò ở tầng
 *  database cũng không cứu nổi — 6 ký tự số là dò xong trong vài phút. */
create or replace function public.auth_mat_khau_toi_thieu()
returns int language sql immutable as $fn$ select 8 $fn$;

/**
 * Cư dân tự đổi mật khẩu của CHÍNH MÌNH.
 *
 * Trả về mã trạng thái, không phải boolean: "sai mật khẩu cũ" và "mật khẩu mới
 * quá ngắn" là hai việc người dùng phải làm hai chuyện khác nhau để sửa, gộp
 * thành false là bắt họ đoán.
 *
 * CHƯA CÓ MẬT KHẨU thì cho đặt lần đầu mà không đòi mật khẩu cũ. Phần lớn cư
 * dân vào bằng mã một lần và chưa từng có mật khẩu; đòi một thứ họ không có là
 * khoá vĩnh viễn tính năng này với đúng nhóm cần nó nhất. Phiên đăng nhập hiện
 * tại đã là bằng chứng kiểm soát được hộp thư — bằng chứng ngang với một lần
 * đặt lại mật khẩu qua email ở bất kỳ hệ thống nào khác.
 */
create or replace function public.auth_doi_mat_khau_cua_toi(p_cu text, p_moi text)
returns text
language plpgsql volatile security definer set search_path = auth, public as $fn$
declare v_uid uuid := auth.uid(); v_hash text;
begin
  if v_uid is null then return 'chua_dang_nhap'; end if;
  if length(coalesce(p_moi, '')) < public.auth_mat_khau_toi_thieu() then
    return 'qua_ngan';
  end if;

  select u.mat_khau_hash into v_hash from auth.users u where u.id = v_uid;
  -- Đã có mật khẩu thì phải biết mật khẩu cũ. Không có bước này thì một phiên
  -- bị chiếm biến thành chiếm tài khoản vĩnh viễn, còn chủ tài khoản thì mất
  -- luôn đường vào.
  if v_hash is not null and v_hash <> crypt(coalesce(p_cu, ''), v_hash) then
    return 'sai_mat_khau_cu';
  end if;

  update auth.users set mat_khau_hash = crypt(p_moi, gen_salt('bf', 10))
   where id = v_uid;
  -- Cùng lý do với auth_dat_mat_khau: đổi mật khẩu mà để lại một mã một lần
  -- còn sống là để lại đúng cái cửa vừa định đóng.
  update auth.ma_dang_nhap set dung_luc = now()
   where user_id = v_uid and dung_luc is null;

  -- KHÔNG BAO GIỜ chép mật khẩu sang sổ, kể cả bản băm. Sổ ghi LÀ CÓ ĐỔI.
  insert into public.audit_log (actor_id, actor_role, bang, ban_ghi, thao_tac,
                                project_id, truoc, sau)
  values (v_uid, 'authenticated', 'auth.users', v_uid::text, 'UPDATE',
          public.auth_du_an_cua(v_uid),
          jsonb_build_object('mat_khau', v_hash is not null),
          jsonb_build_object('mat_khau', true));
  return 'ok';
end
$fn$;

/**
 * Cư dân tự sửa tên và thông tin liên lạc của CHÍNH MÌNH.
 *
 * KHÔNG ĐƯỢC XOÁ HẾT CẢ HAI. auth_tim() tìm người theo email hoặc số điện
 * thoại; xoá sạch cả hai là tự khoá mình ra ngoài vĩnh viễn, và không màn nào
 * ngăn được vì lúc đó họ đã không đăng nhập lại được để sửa.
 */
create or replace function public.auth_doi_lien_lac_cua_toi(
  p_ho_ten text, p_email text, p_phone text)
returns text
language plpgsql volatile security definer set search_path = auth, public as $fn$
declare
  v_uid   uuid := auth.uid();
  v_email text := lower(nullif(btrim(coalesce(p_email, '')), ''));
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_ten   text := nullif(btrim(coalesce(p_ho_ten, '')), '');
  v_cu    record;
begin
  if v_uid is null then return 'chua_dang_nhap'; end if;
  if v_email is null and v_phone is null then return 'thieu_lien_lac'; end if;
  if v_ten is null then return 'thieu_ten'; end if;

  select u.email, u.phone into v_cu from auth.users u where u.id = v_uid;

  -- Kiểm trùng TRƯỚC để trả về đúng cái nào trùng. Vẫn bắt unique_violation ở
  -- dưới cho trường hợp hai người đổi cùng lúc — kiểm trước không phải là khoá.
  if v_email is not null and exists (
       select 1 from auth.users u where u.email = v_email and u.id <> v_uid) then
    return 'trung_email';
  end if;
  if v_phone is not null and exists (
       select 1 from auth.users u where u.phone = v_phone and u.id <> v_uid) then
    return 'trung_phone';
  end if;

  begin
    update auth.users
       set email = v_email, phone = v_phone,
           raw_user_meta_data = raw_user_meta_data || jsonb_build_object('full_name', v_ten)
     where id = v_uid;
    update public.profiles
       set email = v_email, phone = v_phone, full_name = v_ten
     where id = v_uid;
  exception
    when unique_violation then return 'trung_lien_lac';
  end;

  -- Đổi danh tính thì mã một lần đang treo mất hiệu lực: mã đó gửi tới địa chỉ
  -- CŨ, và từ giây này địa chỉ cũ không còn là đường vào tài khoản nữa.
  if v_cu.email is distinct from v_email or v_cu.phone is distinct from v_phone then
    update auth.ma_dang_nhap set dung_luc = now()
     where user_id = v_uid and dung_luc is null;
  end if;

  insert into public.audit_log (actor_id, actor_role, bang, ban_ghi, thao_tac,
                                project_id, truoc, sau)
  values (v_uid, 'authenticated', 'auth.users', v_uid::text, 'UPDATE',
          public.auth_du_an_cua(v_uid),
          jsonb_build_object('email', v_cu.email, 'phone', v_cu.phone),
          jsonb_build_object('email', v_email,   'phone', v_phone));
  return 'ok';
end
$fn$;

/**
 * Ban quản lý sửa thông tin liên lạc của một người TRONG KHU CỦA MÌNH.
 *
 * Nửa còn lại của cùng một lỗ hổng: màn Người dùng tạo được tài khoản, đặt
 * được mật khẩu, xoá được tài khoản — nhưng không sửa được một email gõ sai
 * lúc nhập liệu. Cách duy nhất còn lại là xoá đi tạo lại, mà xoá thì vướng
 * khoá ngoại nếu người đó đã được gán căn.
 *
 * Phạm vi khoá hai lớp: người gọi phải là trưởng ban quản lý CỦA KHU ĐÓ, và
 * người bị sửa phải có liên hệ với chính khu đó — đúng mệnh đề mà
 * bql_danh_sach_nguoi_dung dùng để không liệt kê cư dân khu khác.
 */
create or replace function public.auth_sua_lien_lac(
  p_project uuid, p_uid uuid, p_ho_ten text, p_email text, p_phone text)
returns text
language plpgsql volatile security definer set search_path = auth, public as $fn$
declare
  v_email text := lower(nullif(btrim(coalesce(p_email, '')), ''));
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_ten   text := nullif(btrim(coalesce(p_ho_ten, '')), '');
  v_cu    record;
begin
  if not public.is_bql_manager(p_project) then
    raise exception 'Chi truong ban quan ly moi sua duoc thong tin lien lac'
      using errcode = '42501';
  end if;
  if not exists (
       select 1 from public.staff_assignments s
        where s.user_id = p_uid and s.project_id = p_project and s.is_active
       union all
       select 1 from public.unit_memberships m
        join public.units u     on u.id = m.unit_id
        join public.buildings b on b.id = u.building_id
       where m.user_id = p_uid and b.project_id = p_project and m.status = 'active')
  then
    raise exception 'Nguoi nay khong thuoc khu cua ban' using errcode = '42501';
  end if;

  if v_email is null and v_phone is null then return 'thieu_lien_lac'; end if;
  if v_ten is null then return 'thieu_ten'; end if;

  select u.email, u.phone into v_cu from auth.users u where u.id = p_uid;
  if not found then return 'khong_co_nguoi'; end if;

  if v_email is not null and exists (
       select 1 from auth.users u where u.email = v_email and u.id <> p_uid) then
    return 'trung_email';
  end if;
  if v_phone is not null and exists (
       select 1 from auth.users u where u.phone = v_phone and u.id <> p_uid) then
    return 'trung_phone';
  end if;

  begin
    update auth.users
       set email = v_email, phone = v_phone,
           raw_user_meta_data = raw_user_meta_data || jsonb_build_object('full_name', v_ten)
     where id = p_uid;
    update public.profiles
       set email = v_email, phone = v_phone, full_name = v_ten
     where id = p_uid;
  exception
    when unique_violation then return 'trung_lien_lac';
  end;

  if v_cu.email is distinct from v_email or v_cu.phone is distinct from v_phone then
    update auth.ma_dang_nhap set dung_luc = now()
     where user_id = p_uid and dung_luc is null;
  end if;

  -- actor_id là NGƯỜI SỬA, ban_ghi là người BỊ SỬA. Đổi email đăng nhập của
  -- người khác là việc phải truy được ra ai làm — nhật ký kiểm toán của khu có
  -- màn hình đọc, nên dòng này nhìn thấy được chứ không nằm im trong bảng.
  insert into public.audit_log (actor_id, actor_role, bang, ban_ghi, thao_tac,
                                project_id, truoc, sau)
  values (auth.uid(), 'bql_manager', 'auth.users', p_uid::text, 'UPDATE', p_project,
          jsonb_build_object('email', v_cu.email, 'phone', v_cu.phone),
          jsonb_build_object('email', v_email,   'phone', v_phone));
  return 'ok';
end
$fn$;

/**
 * Tài khoản này đã đặt mật khẩu chưa.
 *
 * Màn hồ sơ cần biết để quyết định có hiện ô "mật khẩu hiện tại" hay không —
 * hiện một ô bắt buộc mà người dùng không thể điền là cách chắc chắn nhất để
 * họ bỏ cuộc. Không đọc thẳng auth.users từ app được: authenticated không có
 * quyền select trên bảng đó, và giữ nguyên như vậy là đúng.
 *
 * Trả về boolean, KHÔNG trả về bản băm hay bất cứ mảnh nào của nó.
 */
create or replace function public.auth_co_mat_khau()
returns boolean
language sql stable security definer set search_path = auth, public as $fn$
  select exists (
    select 1 from auth.users u where u.id = auth.uid() and u.mat_khau_hash is not null);
$fn$;

-- Ba hàm trên KHÔNG nhận uid tuỳ ý (hai hàm đầu) hoặc tự chốt quyền bên trong
-- (hàm thứ ba), nên cấp cho authenticated ở đây không mở thêm gì. Đây chính là
-- điểm khác với auth_dat_mat_khau(uuid, text) ở trên — hàm đó nhận uid nên
-- phải nằm sau service_role.
grant execute on function public.auth_doi_mat_khau_cua_toi(text, text)        to authenticated;
grant execute on function public.auth_doi_lien_lac_cua_toi(text, text, text)  to authenticated;
grant execute on function public.auth_sua_lien_lac(uuid, uuid, text, text, text) to authenticated;
grant execute on function public.auth_du_an_cua(uuid)            to authenticated, service_role;
grant execute on function public.auth_mat_khau_toi_thieu()       to authenticated, service_role;
grant execute on function public.auth_co_mat_khau()              to authenticated;
