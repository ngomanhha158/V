-- Lịch job nền (pg_cron). File này không nằm trong npm run verify vì Postgres
-- thuần không có pg_cron. Bản thân các hàm được test ở test_jobs.sql và
-- test_tickets.sql.
--
-- TRÊN RAILWAY: ảnh Postgres mặc định KHÔNG có pg_cron. Chạy file này ở đó sẽ
-- đỏ ngay câu `create extension`, và đỏ như vậy còn may — cái đáng sợ là tưởng
-- nó chạy rồi. Không có pg_cron thì: hóa đơn không được nhắc, ticket quá hạn
-- không leo thang, tư cách thành viên hết hạn không bị thu hồi — tất cả đều
-- hỏng LẶNG LẼ, không màn nào báo.
-- Đường thay thế trên Railway là Cron Service gọi vào một endpoint của app.
-- Chưa dựng: xem GĐ2 trong railway/GD1-runbook.sh. Tới lúc dựng xong thì mỗi
-- job dưới đây phải có đúng một dòng tương ứng bên đó.
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
