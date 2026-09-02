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

-- ────────────────────────────── DANH TÍNH REQUEST ────────────────────────────
-- Hai nguồn, ưu tiên nguồn trên:
--
--  1. `request.jwt.claims` — PostgREST đặt sẵn cho mọi request, đọc từ JWT đã
--     xác thực. Đây là ĐƯỜNG THẬT của app: giống hệt Supabase, nên schema.sql
--     và auth_hooks.sql không phải sửa một chữ nào.
--  2. `app.user_id` — cho việc chạy tay bằng psql và cho job nền nối thẳng vào
--     Postgres, nơi không có JWT. App đặt bằng SET LOCAL trong đúng transaction
--     đang phục vụ; SET LOCAL tự hết hiệu lực khi transaction đóng, nên danh
--     tính không rớt lại trong connection pool để người kế tiếp thừa hưởng.
--
-- coalesce chứ không phải hai hàm: chỉ có MỘT định nghĩa auth.uid() trong hệ
-- thống. Hai định nghĩa là hai chỗ để lệch nhau, và lệch ở đây nghĩa là RLS
-- chặn đúng trên đường này còn mở toang trên đường kia.
create or replace function auth.uid() returns uuid
  language sql stable
as $fn$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
    nullif(current_setting('app.user_id', true), '')
  )::uuid
$fn$;

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

-- Hai role ĐĂNG NHẬP cho psql và job nền. KHÔNG bao giờ dùng role postgres:
-- superuser bỏ qua RLS kể cả khi đã FORCE, và hỏng theo kiểu không báo lỗi.
do $logins$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_login')
    then create role app_login login in role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'app_service')
    then create role app_service login in role service_role; end if;
end
$logins$;

-- Role mà PostgREST nối vào. NOINHERIT là bắt buộc, không phải tùy chọn: có
-- INHERIT thì `authenticator` mang sẵn quyền của cả ba role con ngay khi vừa
-- nối, nên một request KHÔNG có JWT vẫn chạy với quyền service_role — tức là
-- bỏ qua toàn bộ RLS. NOINHERIT bắt nó phải SET ROLE mới có quyền, và
-- PGRST_DB_ANON_ROLE=anon quyết định vai mặc định của request không JWT.
do $pgrst$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticator')
    then create role authenticator login noinherit; end if;
end
$pgrst$;
grant anon, authenticated, service_role to authenticator;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant select, insert on auth.users to service_role;

-- Chặn đường vòng: không ai được tạo bảng trong public rồi tự cấp quyền cho mình.
revoke create on schema public from public;
