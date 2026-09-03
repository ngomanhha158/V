-- Lịch job nền (pg_cron). File này không nằm trong npm run verify vì Postgres
-- thuần không có pg_cron. Bản thân các hàm được test ở test_jobs.sql và
-- test_tickets.sql.
--
-- TRÊN RAILWAY KHÔNG DÙNG FILE NÀY. Ảnh Postgres mặc định không có pg_cron;
-- chạy file này ở đó sẽ đỏ ngay câu `create extension`. Đường đang dùng là
-- Railway Cron Service gọi POST /api/cron/<việc> kèm header x-cron-key.
--
-- Giữ file lại vì nó là bản mô tả duy nhất của "job nào, mấy giờ, vì sao giờ
-- đó" — và vì trên một Postgres CÓ pg_cron thì nó vẫn là cách gọn nhất. Hai
-- bên phải khớp nhau; bảng đối chiếu:
--
--   expire-memberships        -> /api/cron/thu-hoi-thanh-vien   5 17 * * *
--   escalate-overdue-tickets  -> /api/cron/leo-thang-ticket     */5 * * * *
--   remind-unpaid-invoices    -> /api/cron/nhac-no              0 1 * * *
--   mo-ky-bao-tri             -> /api/cron/mo-ky-bao-tri        0 0 * * *
--   don-ma-dang-nhap          -> /api/cron/don-ma-dang-nhap     0 20 * * *
--   don-so-ra-vao             -> /api/cron/don-so-ra-vao        30 19 * * *
--
-- Thêm job ở đây mà quên thêm lịch bên Railway thì nó KHÔNG chạy, và không có
-- gì báo — đó là lý do bảng đối chiếu nằm ngay đầu file chứ không nằm trong
-- một trang tài liệu nào khác.
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

-- N12 — leo thang ticket quá hạn SLA, 5 phút/lần. Ghi ticket_events để Edge
-- Function đọc và đẩy thông báo. Bỏ qua ticket có hạn NULL (danh mục chưa cấu
-- hình SLA) nên chỉ mất cảnh báo, không mất báo cáo — test_tickets.sql assert 6.
select cron.schedule(
  'escalate-overdue-tickets',
  '*/5 * * * *',
  $job$ select public.escalate_overdue_tickets() $job$
);

-- N21 — nhắc nợ, 1 lần/ngày lúc 08:00 giờ VN = 01:00 UTC.
-- Hàm tự chống nhắc trùng trong 20 giờ nên chạy lại (retry) không hại gì.
select cron.schedule(
  'remind-unpaid-invoices',
  '0 1 * * *',
  $job$ select public.remind_unpaid_invoices() $job$
);

-- Bảo trì định kỳ — mở lần bảo trì cho kế hoạch đã tới cửa sổ nhắc.
-- 1 lần/ngày lúc 07:00 giờ VN = 00:00 UTC. Trước giờ làm việc để lúc kỹ thuật
-- vào ca là danh sách đã sẵn trên màn.
-- Hàm chống trùng bằng unique (plan_id, han) nên chạy lại không hại gì.
select cron.schedule(
  'mo-ky-bao-tri',
  '0 0 * * *',
  $job$ select public.mo_ky_bao_tri() $job$
);

-- Dọn mã đăng nhập cũ — 1 lần/ngày lúc 03:00 giờ VN = 20:00 UTC hôm trước.
-- Không có job này thì auth.ma_dang_nhap chỉ lớn dần chứ không sai gì; để đây
-- vì một bảng chỉ-lớn-dần trên một hệ thống chạy nhiều năm cuối cùng vẫn thành
-- việc của ai đó.
select cron.schedule(
  'don-ma-dang-nhap',
  '0 20 * * *',
  $job$ select public.auth_don_ma() $job$
);

-- Gỡ lịch:            select cron.unschedule('expire-memberships');
-- Xem lịch hiện có:   select jobname, schedule, active from cron.job;
-- Xem lần chạy gần đây: select * from cron.job_run_details order by start_time desc limit 20;
