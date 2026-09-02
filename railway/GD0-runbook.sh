#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# GĐ0 — dựng nền Postgres cho Vbuilding trên Railway.
#
# ĐÃ CHẠY XONG. Giữ lại làm hồ sơ. Bước tiếp theo là railway/GD1-runbook.sh,
# ở đó 00_compat.sql được áp LẠI (nó thêm role authenticator và auth.uid() đọc
# JWT) — chạy lại file này không hại gì nhưng cũng không còn đủ.
#
# Dán TOÀN BỘ file này vào Console của service Postgres (project bubbly-cat).
# Script chỉ ĐỌC repo public ngomanhha158/v và áp vào chính DB của container này.
# Không sửa dữ liệu nào của app đang chạy.
#
# Đã chạy thử trọn vẹn trên PostgreSQL 16.13 dựng sạch: 7/7 file test xanh.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd /tmp

echo "── 1/5  Lấy schema từ repo"
command -v curl >/dev/null || { apt-get -qq update >/dev/null && apt-get -qq install -y curl >/dev/null; }
BASE=https://raw.githubusercontent.com/ngomanhha158/v/main
for f in schema.sql auth_hooks.sql test_rls.sql; do curl -sSLO "$BASE/$f"; done
wc -l schema.sql auth_hooks.sql test_rls.sql

echo "── 2/5  Ba file mới của GĐ0 (đính kèm riêng, dán vào /tmp trước khi chạy tiếp)"
for f in 00_compat.sql 01_test_prep.sql 02_smoke_prod.sql; do
  [ -f "$f" ] || { echo "THIẾU /tmp/$f — dán file này vào trước rồi chạy lại"; exit 1; }
done

echo "── 3/5  Áp lên database production (railway)"
export PGHOST=localhost
psql -v ON_ERROR_STOP=1 -q -f 00_compat.sql
psql -v ON_ERROR_STOP=1 -q -f schema.sql
psql -v ON_ERROR_STOP=1 -q -f auth_hooks.sql
echo "   OK: compat + schema + auth_hooks"

echo "── 4/5  Smoke đường thật (app.user_id + role authenticated)"
psql -v ON_ERROR_STOP=1 -f 02_smoke_prod.sql 2>&1 | grep -E "SMOKE|ERROR"

echo "── 5/5  Bộ 13 invariant RLS, chạy trên database TEST riêng"
psql -q -c "drop database if exists vb_test" -c "create database vb_test"
for f in 00_compat.sql schema.sql auth_hooks.sql 01_test_prep.sql; do
  psql -v ON_ERROR_STOP=1 -q -d vb_test -f "$f"
done
psql -v ON_ERROR_STOP=1 -1 -d vb_test -f test_rls.sql 2>&1 | grep -E "PASSED|ERROR"
psql -q -c "drop database vb_test"

echo
echo "GĐ0 XONG. Việc còn lại cần anh tự làm (em không được nhập mật khẩu hộ):"
echo "  psql -c \"alter role app_login   password '<đặt mật khẩu ở đây>'\""
echo "  psql -c \"alter role app_service password '<đặt mật khẩu khác>'\""
echo "Rồi đặt biến cho service v:"
echo "  DATABASE_URL_APP     = postgresql://app_login:<mk>@postgres.railway.internal:5432/railway"
echo "  DATABASE_URL_SERVICE = postgresql://app_service:<mk>@postgres.railway.internal:5432/railway"
echo "TUYỆT ĐỐI KHÔNG dùng DATABASE_URL mặc định (role postgres) cho app: superuser bỏ qua RLS."
