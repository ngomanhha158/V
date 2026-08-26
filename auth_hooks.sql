-- CHỈ chạy trên Supabase — cần schema auth.users (không có ở Postgres thuần,
-- nên file này không nằm trong npm run verify).
-- Tạo profiles tự động khi có user mới, nếu không FK unit_memberships.user_id sẽ gãy.

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  insert into profiles (id, full_name, phone, email)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name', 'Cư dân'),
          new.phone,
          new.email)
  on conflict (id) do nothing;
  return new;
end $fn$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Role `authenticated` của Supabase cần quyền bảng; RLS mới là lớp lọc dòng.
grant usage on schema public to authenticated;
grant select on units, buildings, projects, documents, sla_policies, fee_types to authenticated;
grant select, insert, update on unit_memberships to authenticated;
grant select, insert on tickets to authenticated;
grant select on invoices, invoice_lines, announcements, notifications to authenticated;

-- Bắt buộc: bảng chưa bật RLS mà đã grant = ai đăng nhập cũng đọc được toàn bộ.
alter table tickets  force row level security;
alter table invoices force row level security;
alter table unit_memberships force row level security;
