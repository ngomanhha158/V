#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# GĐ1 — bỏ Supabase, chạy trọn trên Railway.
#
# GĐ0 đã dựng Postgres. GĐ1 dựng nốt hai thứ Supabase còn đang làm hộ:
#   • PostgREST  — chính cái server mà supabase.from(...) vẫn gọi tới. Chạy
#                  bản gốc, không phải bản của Supabase, và KHÔNG mở ra internet.
#   • Đăng nhập  — railway/03_auth.sql thay GoTrue: mật khẩu bcrypt, mã một
#                  lần, đếm lượt dò. Ký JWT nằm ở Next.js.
#
# Phần A chạy trong Console của service Postgres. Phần B làm trên giao diện
# Railway. Đọc hết một lượt trước khi bấm gì.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║ PHẦN A — dán vào Console của service Postgres                             ║
# ╚═══════════════════════════════════════════════════════════════════════════╝
cd /tmp
export PGHOST=localhost

echo "── A1/4  Lấy file từ repo"
command -v curl >/dev/null || { apt-get -qq update >/dev/null && apt-get -qq install -y curl >/dev/null; }
BASE=https://raw.githubusercontent.com/ngomanhha158/v/main
for f in railway/00_compat.sql railway/02_smoke_prod.sql railway/03_auth.sql railway/04_smoke_auth.sql; do
  curl -sSL -o "$(basename "$f")" "$BASE/$f"
done

echo "── A2/4  Áp lại lớp tương thích + lớp đăng nhập"
# 00_compat.sql chạy LẠI được: toàn bộ là create-if-not-exists và create-or-replace.
# Lần này nó thêm hai thứ mà GĐ0 chưa có — role `authenticator` cho PostgREST,
# và auth.uid() đọc được danh tính từ JWT.
psql -v ON_ERROR_STOP=1 -q -f 00_compat.sql
psql -v ON_ERROR_STOP=1 -q -f 03_auth.sql
echo "   OK: compat + auth"

echo "── A3/4  Mật khẩu cho role authenticator"
# Em KHÔNG đặt hộ mật khẩu. Anh gõ dòng dưới, thay <mk> bằng chuỗi anh tự sinh:
#     openssl rand -base64 24
#
#     psql -c "alter role authenticator password '<mk>'"
#
# Rồi giữ nguyên chuỗi đó cho PGRST_DB_URI ở phần B.
# authenticator KHÔNG phải superuser và KHÔNG có bypassrls — đó là cả điểm của
# nó. Đừng thay bằng role postgres cho nhanh: superuser bỏ qua RLS kể cả khi đã
# FORCE, và hỏng theo kiểu không báo lỗi, không ai biết cho tới lúc một cư dân
# đọc được hóa đơn của căn khác.

echo "── A3b/4  Nạp lại schema cache của PostgREST"
# PostgREST đọc danh mục bảng và hàm MỘT LẦN lúc khởi động rồi giữ trong bộ nhớ.
# Thêm hàm hay bảng mới mà không bảo nó nạp lại thì nó trả 404 cho đúng thứ vừa
# tạo — và 404 nhìn giống hệt "gõ sai tên hàm", nên rất dễ đi tìm nhầm chỗ.
# Bước này CHỈ cần từ lần thứ hai trở đi; lần đầu thì PostgREST còn chưa dựng.
# Áp bất kỳ file .sql nào sau này cũng phải chạy lại đúng câu dưới đây.
psql -c "notify pgrst, 'reload schema'" 2>/dev/null || true

echo "── A4/4  Hai bài smoke"
psql -v ON_ERROR_STOP=1 -f 02_smoke_prod.sql 2>&1 | grep -E "SMOKE|ERROR"
psql -v ON_ERROR_STOP=1 -f 04_smoke_auth.sql 2>&1 | grep -E "SMOKE|ERROR"
# Cả hai tự ROLLBACK. Không xanh thì DỪNG, đừng làm tiếp phần B.

cat <<'HUONGDAN'

╔═══════════════════════════════════════════════════════════════════════════╗
║ PHẦN B — trên giao diện Railway                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝

B1. Tạo service mới từ Docker image:  postgrest/postgrest:v12.2.3
    Ghim đúng số hiệu, đừng dùng :latest — một bản PostgREST mới đổi cách đọc
    JWT là cả tòa nhà không đăng nhập được vào sáng hôm sau, mà không ai vừa
    deploy gì cả.

B2. Biến môi trường của service PostgREST:

      PGRST_DB_URI       = postgresql://authenticator:<mk A3>@postgres.railway.internal:5432/railway
      PGRST_DB_SCHEMAS   = public
      PGRST_DB_ANON_ROLE = anon
      PGRST_JWT_SECRET   = <chuỗi ≥ 32 ký tự, tự sinh: openssl rand -base64 48>
      PGRST_SERVER_HOST  = ::
      PGRST_SERVER_PORT  = 3000
      PGRST_DB_POOL      = 10
      PGRST_OPENAPI_MODE = disabled

    PGRST_SERVER_HOST = ::  là BẮT BUỘC, không phải tùy chọn. Mặc định PostgREST
    chỉ nghe trên IPv4, mà mạng nội bộ của Railway là IPv6 — để mặc định thì
    app gọi sang chỉ nhận "connection refused", và triệu chứng nhìn giống hệt
    lỗi cấu hình mật khẩu.

    PGRST_DB_ANON_ROLE = anon: request không kèm JWT chạy dưới quyền anon, mà
    auth_hooks.sql không cấp cho anon một bảng nào. Tức là không token thì
    không đọc được gì — không phải "đọc được ít", mà là không có gì.

B3. KHÔNG bấm "Generate Domain" cho service PostgREST.
    Nó chỉ cần nói chuyện với service `v` qua mạng nội bộ. Mở ra internet là
    đưa thẳng tầng dữ liệu ra ngoài, và từ đó chốt duy nhất còn lại là chữ ký
    JWT. Để nó kín thì kẻ tấn công phải qua Next.js trước.

B4. Biến môi trường của service `v` (Next.js):

      POSTGREST_URL      = http://postgrest.railway.internal:3000
      AUTH_JWT_SECRET    = <ĐÚNG chuỗi PGRST_JWT_SECRET ở B2>
      SMTP_URL           = smtps://<user>:<mk>@<host>:465     (thư đăng nhập)
      SMTP_FROM          = "BQL Toà nhà <no-reply@ten-mien-cua-anh>"

    AUTH_JWT_SECRET phải trùng khít PGRST_JWT_SECRET. Lệch một ký tự thì mọi
    request đều 401 và log chỉ nói "JWT invalid" — không nói là do lệch khóa.

B5. Gắn Volume cho ảnh hỏng hóc, vào service `v`, mount tại:

      /data/ticket-photos

    Ảnh KHÔNG còn nằm ở Supabase Storage mà nằm trên đĩa của service này. Không
    gắn volume thì app vẫn nhận ảnh bình thường — rồi mất sạch ở lần deploy kế
    tiếp, lặng lẽ, và chỉ lộ ra lúc có người mở lại một yêu cầu cũ để đối chất.

B6. Job nền. Ảnh Postgres của Railway không có pg_cron, nên cron.sql KHÔNG
    dùng ở đây. Thay bằng 6 Cron Service, mỗi cái chạy đúng một dòng curl.

    Đặt biến CRON_SECRET cho service `v` trước (openssl rand -base64 32), rồi
    tạo 6 service từ image `curlimages/curl:latest`, mỗi service một lịch:

      Tên service            Lịch (UTC)      Đường
      cron-nhac-no           0 1 * * *       /api/cron/nhac-no
      cron-leo-thang         */5 * * * *     /api/cron/leo-thang-ticket
      cron-thu-hoi           5 17 * * *      /api/cron/thu-hoi-thanh-vien
      cron-bao-tri           0 0 * * *       /api/cron/mo-ky-bao-tri
      cron-don-ma            0 20 * * *      /api/cron/don-ma-dang-nhap
      cron-don-so-ra-vao     30 19 * * *     /api/cron/don-so-ra-vao

    Việc cuối là hạn lưu 90 ngày của sổ ra vào khách. Quên đặt thì sổ giữ mãi —
    tức là đúng cái mà màn Khách thăm đang hứa với cư dân là sẽ không làm.

    Start command của mỗi service (thay <đường> và dùng tên miền công khai của
    service `v`):

      curl -fsS -X POST -H "x-cron-key: $CRON_SECRET" https://<domain>/api/cron/<đường>

    Cờ -f là bắt buộc: thiếu nó thì curl trả về 0 kể cả khi máy chủ trả 500, và
    lịch cron cứ xanh trong khi việc thì không chạy — đúng kiểu hỏng mà cả cái
    endpoint này sinh ra để tránh.

    Lịch ghi theo UTC, khớp với đầu file cron.sql. Thêm job trong SQL mà quên
    thêm service ở đây thì nó không chạy, và không có gì báo.

B7. Kiểm ĐƯỜNG THẬT đầu-cuối. Từ máy anh, trỏ vào PostgREST đang chạy:

      POSTGREST_URL=<url PostgREST> AUTH_JWT_SECRET=<khóa B2> npm run verify:http

    Chỉ ĐỌC, không sửa gì, nên chạy thẳng trên database thật được. Nó trả lời
    ba câu mà không bài test nào khác chạm tới: PostgREST có nhận chữ ký của
    mình không, có SET ROLE đúng theo claim không, và auth.uid() có đọc ra
    đúng người không. Sai một trong ba là RLS lọc theo nhầm người mà app vẫn
    chạy, vẫn trả dữ liệu, không có lỗi nào.

    CHẠY HAI LẦN: lần này, và lần nữa SAU KHI duyệt chủ hộ đầu tiên. Ca quan
    trọng nhất — "cư dân thật chỉ thấy căn của mình" — cần có ít nhất một
    unit_memberships đang hoạt động, nên lần đầu nó báo CHƯA chứ không báo OK.

B8. Xóa các biến của Supabase khỏi service `v` sau khi đã chạy xanh:
      NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      SUPABASE_SERVICE_ROLE_KEY, SUPABASE_SECRET_KEY
    Xóa SAU chứ không phải trước: còn biến thì còn đường lùi trong lúc đang dò.

B9. Chuyển dữ liệu từ Supabase sang (nếu khu đã chạy thật):
      pg_dump --data-only --schema=public "<chuỗi nối Supabase>" > data.sql
      psql -f data.sql
    Tài khoản đăng nhập KHÔNG chuyển được: mật khẩu bên Supabase băm bằng khóa
    của họ. Mỗi người phải đặt lại mật khẩu một lần — BQL làm ở màn Người dùng,
    hoặc cư dân tự đăng nhập bằng mã một lần rồi đặt mật khẩu mới.

    ẢNH cũng không chuyển được bằng pg_dump: chúng nằm trong Storage của
    Supabase, không nằm trong database. Tải về rồi chép vào volume theo đúng
    đường dẫn cũ ({unit_id}/{tên}) — tickets.photo_urls vẫn đang trỏ vào đó.
HUONGDAN
