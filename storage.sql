-- CHỈ chạy trên Supabase — cần schema storage (không có ở Postgres thuần, nên
-- file này không nằm trong npm test). Chạy sau schema.sql và auth_hooks.sql.

-- Bucket RIÊNG TƯ: ảnh hỏng hóc bên trong căn hộ là dữ liệu riêng. Public bucket
-- nghĩa là ai đoán được đường dẫn cũng xem được. Đọc bằng signed URL có hạn.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ticket-photos', 'ticket-photos', false, 5242880,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
   set public = false,
       file_size_limit = excluded.file_size_limit,
       allowed_mime_types = excluded.allowed_mime_types;

-- Quy ước đường dẫn: {unit_id}/{tên ngẫu nhiên}.{ext}
-- Đoạn thư mục đầu chính là căn hộ -> RLS lọc theo nó.
--
-- BẪY: KHÔNG ép đoạn đó sang uuid. Đó là chuỗi do client đặt tên; ép kiểu gặp
-- chuỗi rác là policy VĂNG LỖI chứ không phải lọc ra. So sánh uuid::text = text
-- theo chiều ngược lại thì chuỗi rác chỉ đơn giản là không khớp.
drop policy if exists ticket_photo_insert on storage.objects;
create policy ticket_photo_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'ticket-photos'
    and (storage.foldername(name))[1] in (select current_unit_ids()::text)
  );

drop policy if exists ticket_photo_read on storage.objects;
create policy ticket_photo_read on storage.objects for select to authenticated
  using (
    bucket_id = 'ticket-photos'
    and (
      (storage.foldername(name))[1] in (select current_unit_ids()::text)
      or exists (
        select 1 from units u
         where u.id::text = (storage.foldername(name))[1]
           and is_staff(unit_project(u.id))
      )
    )
  );

-- Cố ý KHÔNG có policy delete/update: ảnh đã gắn vào yêu cầu là một phần hồ sơ
-- xử lý; xóa được thì BQL mất bằng chứng, và cư dân xóa xong lại kêu chậm.
-- Cần dọn thật thì làm bằng service_role.
