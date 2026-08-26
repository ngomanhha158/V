-- Lịch job nền (pg_cron). CHỈ chạy trên Supabase — Postgres thuần không có
-- pg_cron, nên file này không nằm trong npm run verify. Bản thân các hàm được
-- test ở test_jobs.sql và test_tickets.sql.
--
-- BẪY MÚI GIỜ: pg_cron trên Supabase chạy theo cron.timezone, mặc định GMT.
-- Kiểm tra trước khi sửa lịch:  show cron.timezone;
-- Giờ VN (UTC+7) phải trừ 7 tiếng. 00:05 giờ VN = 17:05 UTC HÔM TRƯỚC.
-- Viết '5 0 * * *' rồi tưởng là nửa đêm giờ VN là sai 7 tiếng.

create extension if not exists pg_cron;

-- N7 — thu hồi tư cách thành viên đã hết hạn (hết hợp đồng thuê / hết ủy quyền).
-- Chạy 1 lần/ngày là đủ vì valid_to là kiểu date.
select cron.schedule(
  'expire-memberships',
  '5 17 * * *',                          -- 00:05 giờ VN
  $job$ select public.expire_memberships() $job$
);

-- N12 — leo thang ticket quá hạn SLA, 5 phút/lần. Bật ở Tuần 2 cùng bảng điều
-- phối của BQL; hàm đã sẵn sàng và đã có test (test_tickets.sql assert 6).
-- select cron.schedule(
--   'escalate-overdue-tickets',
--   '*/5 * * * *',
--   $job$ select public.escalate_overdue_tickets() $job$
-- );

-- Gỡ lịch:            select cron.unschedule('expire-memberships');
-- Xem lịch hiện có:   select jobname, schedule, active from cron.job;
-- Xem lần chạy gần đây: select * from cron.job_run_details order by start_time desc limit 20;
