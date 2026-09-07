#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# KHÔI PHỤC từ bản dump của .github/workflows/backup.yml.
#
# Vì sao có file này: có backup ba năm rồi phát hiện ra không khôi phục được là
# kiểu hỏng kinh điển nhất của backup. Workflow kia chỉ chứng minh bản dump
# ĐƯỢC TẠO RA và không rỗng — nó không chứng minh bản dump DÙNG ĐƯỢC. Hai
# chuyện khác nhau, và chuyện thứ hai chỉ được kiểm ở đúng cái ngày tệ nhất.
#
# ĐÃ DIỄN TẬP TRỌN VẸN trên PostgreSQL 16.13, 06/09/2026: dump một DB có tài
# khoản thật (tạo bằng auth_tao_nguoi_dung) → khôi phục vào database trắng →
# đăng nhập đúng mật khẩu THÀNH CÔNG, sai mật khẩu bị từ chối, phân công BQL
# còn nguyên. Các bước dưới đây là đúng chuỗi đã chạy được, không phải phác thảo.
#
# ẢNH KHÔNG nằm trong bản dump. Ảnh hỏng hóc ở trên Volume của service `v`.
# Khôi phục xong thì hóa đơn, công nợ, tài khoản đều về — ảnh thì không.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DUMP=${1:?Dùng: KHOI-PHUC-runbook.sh <file.dump> <postgres://... database ĐÍCH>}
DICH=${2:?Thiếu URL database đích. TẠO MỚI một database trống, đừng trỏ vào cái đang chạy.}
REPO=$(cd "$(dirname "$0")/.." && pwd)

echo "── 0/5  Bản dump có thật sự chứa gì không"
# Lặp lại đúng ba chốt của backup.yml. Chạy lại ở đây vì file dump có thể đã
# hỏng trên đường đi — tải dở, sao chép thiếu — sau khi workflow kiểm nó.
# Đọc danh mục MỘT LẦN rồi soi bằng chuỗi. KHÔNG nối ống sang `grep -q`: nó
# thoát ngay khi thấy dòng khớp, pg_restore còn đang ghi thì ăn SIGPIPE, và dưới
# `set -o pipefail` cả ống trả về 141 — ống ĐỎ đúng lúc grep TÌM THẤY. Bản đầu
# của chính file này mắc lỗi đó và từ chối một bản dump tốt; cùng lỗi cũng nằm
# trong backup.yml, đã sửa cùng lượt.
DANH_MUC=$(pg_restore --list "$DUMP")
[[ "$DANH_MUC" == *'TABLE DATA auth users'* ]] \
  || { echo "DỪNG: bản dump không có auth.users. Khôi phục xong sẽ KHÔNG AI đăng nhập được."; exit 1; }
SO_BANG=$(grep -c 'TABLE DATA' <<< "$DANH_MUC" || true)
echo "     $SO_BANG bảng, có auth.users"
[ "$SO_BANG" -ge 10 ] || { echo "DỪNG: chỉ $SO_BANG bảng, bản dump này không đủ."; exit 1; }

echo "── 1/5  Role và extension (role là cấp CỤM, không nằm trong dump)"
# pg_dump không bao giờ dump role. Cụm mới tinh thì chưa có anon/authenticated/
# service_role/authenticator, mà auth_hooks.sql cấp quyền cho đúng những cái đó
# — thiếu role thì bước 4 đỏ hàng loạt và rất giống lỗi "dump hỏng".
psql "$DICH" -v ON_ERROR_STOP=1 -q -f "$REPO/railway/00_compat.sql"

echo "── 2/5  Dọn chỗ cho bản dump"
# Bước 1 vừa dựng schema `auth` và `public`; bản dump cũng chứa lệnh tạo chúng.
# Không dọn thì pg_restore vấp "schema already exists" và THOÁT MÃ 1 — trên một
# lần khôi phục thật ra vẫn đúng. Người đang xử lý sự cố nhìn mã 1 đó không có
# cách nào phân biệt với một lần khôi phục hỏng thật, và lần sau họ bỏ qua mã
# thoát. Dọn trước để mã thoát chỉ còn một nghĩa.
psql "$DICH" -v ON_ERROR_STOP=1 -q -c "drop schema if exists public cascade; drop schema if exists auth cascade;"

echo "── 3/5  pg_restore"
# --exit-on-error: dừng ở lỗi ĐẦU TIÊN. Mặc định nó chạy tiếp tới hết rồi mới
# báo, để lại một database khôi phục dở mà nhìn thì vẫn có dữ liệu.
# --no-owner --no-privileges: khớp với cờ lúc dump; quyền được cấp lại ở bước 4.
pg_restore --dbname="$DICH" --no-owner --no-privileges --exit-on-error "$DUMP"

echo "── 4/5  Cấp lại quyền (bản dump cố ý KHÔNG mang theo quyền)"
psql "$DICH" -v ON_ERROR_STOP=1 -q -f "$REPO/auth_hooks.sql"
psql "$DICH" -v ON_ERROR_STOP=1 -q -f "$REPO/railway/03_auth.sql"

echo "── 5/5  Bản khôi phục có DÙNG ĐƯỢC không"
# Đếm dòng không trả lời được câu hỏi này. Một bản khôi phục đủ hóa đơn mà không
# ai đăng nhập được thì vẫn là hỏng — và đó đúng là kiểu hỏng mà việc thiếu
# schema `auth` hoặc thiếu quyền gây ra.
psql "$DICH" -v ON_ERROR_STOP=1 -tA <<'SQL'
do $kiem$
declare v_uid uuid; v_email text; n int;
begin
  select email into v_email from auth.users where email is not null order by created_at limit 1;
  if v_email is null then
    raise exception 'KHONG DUNG DUOC: auth.users rong, khong ai dang nhap duoc';
  end if;

  select count(*) into n from projects;
  if n = 0 then raise exception 'KHONG DUNG DUOC: khong co du an nao'; end if;

  -- Hàm đăng nhập phải còn GỌI ĐƯỢC, không chỉ còn tồn tại: bước 4 là thứ cấp
  -- lại quyền cho nó, nên đây là chỗ phát hiện bước 4 bị bỏ sót.
  perform auth_kiem_mat_khau(v_email, 'chac-chan-sai-' || gen_random_uuid());

  select count(*) into n from staff_assignments where is_active;
  if n = 0 then
    raise warning 'Khoi phuc xong nhung KHONG con ai la BQL — man /bql se dong.';
  end if;

  raise notice 'KHOI PHUC OK — % tai khoan, % du an, % phan cong BQL con hieu luc',
    (select count(*) from auth.users), (select count(*) from projects), n;
end $kiem$;
SQL

echo
echo "XONG. Còn phải làm bằng tay:"
echo "  1. Đổi PGRST_DB_URI của service PostgREST sang database này"
echo "  2. notify pgrst, 'reload schema'   (PostgREST giữ danh mục trong bộ nhớ)"
echo "  3. Đặt lại mật khẩu cho authenticator/app_login/app_service — dump không mang role"
echo "  4. ẢNH không có trong bản dump: khôi phục Volume của service v riêng"
