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
