-- ─────────────────────────────────────────────────────────────────────────────
-- Lớp tương thích Supabase cho Postgres thuần (Railway).
-- Chạy TRƯỚC schema.sql. Mục đích: schema.sql, auth_hooks.sql và toàn bộ file
-- test chạy được NGUYÊN VĂN, không sửa một chữ — thứ gì không sửa thì không có
-- chỗ để lọt lỗi.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists pgcrypto;
create schema if not exists auth;

-- Thay auth.users của Supabase. Tên cột giữ đúng để trigger handle_new_user()
-- trong auth_hooks.sql chạy được không sửa.
create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text unique,
  phone              text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

-- Danh tính của request. Supabase đọc từ JWT; ở đây app đặt bằng
--   SET LOCAL app.user_id = '<uuid>'
-- trong đúng transaction đang phục vụ request. SET LOCAL tự hết hiệu lực khi
-- transaction đóng, nên danh tính không rớt lại trong connection pool để người
-- kế tiếp thừa hưởng quyền của người trước.
create or replace function auth.uid() returns uuid
  language sql stable
as $fn$ select nullif(current_setting('app.user_id', true), '')::uuid $fn$;

-- Ba role của Supabase, dựng y hệt tên.
do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon')
    then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated')
    then create role authenticated nologin; end if;
  -- service_role bỏ qua RLS, đúng như trên Supabase: dùng cho webhook và job nền.
  if not exists (select 1 from pg_roles where rolname = 'service_role')
    then create role service_role nologin bypassrls; end if;
end
$roles$;

-- Hai role ĐĂNG NHẬP. Đây là chỗ app cắm vào — KHÔNG bao giờ dùng role postgres:
-- superuser bỏ qua RLS kể cả khi đã FORCE, và hỏng theo kiểu không báo lỗi.
do $logins$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_login')
    then create role app_login login in role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'app_service')
    then create role app_service login in role service_role; end if;
end
$logins$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant select, insert on auth.users to service_role;

-- Chặn đường vòng: không ai được tạo bảng trong public rồi tự cấp quyền cho mình.
revoke create on schema public from public;
