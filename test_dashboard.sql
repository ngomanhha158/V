-- Smoke test dashboard BQT (N25–N26). Chạy sau schema.sql + seed.sql.
-- ponytail: dashboard sai không văng lỗi, nó chỉ hiện một con số đẹp và BQT
-- dùng con số đó đi họp với cư dân. Nên test ở đây tập trung vào những chỗ
-- một dashboard hay nói dối: ticket treo không bị tính trễ, kỳ tiền bị lẫn,
-- và múi giờ ăn mất ngày đầu tháng.
--
-- Dự án riêng cho test (aaaa…d0), KHÔNG dùng dự án seed: test_billing và
-- test_tickets chạy trước đã để lại ticket/hóa đơn ở đó. Đếm chính xác được
-- thì khi hàm rò dữ liệu dự án khác, số sẽ lệch ngay.

do $test$
declare
  p_dash  uuid := 'aaaaaaaa-0000-0000-0000-0000000000d0';
  b_dash  uuid := 'bbbbbbbb-0000-0000-0000-0000000000d0';
  u_a     uuid;
  u_b     uuid;
  s_bql   uuid := '77770000-0000-0000-0000-0000000000d1';  -- BQL dự án test
  s_khac  uuid := '77770000-0000-0000-0000-0000000000d2';  -- BQL dự án SEED
  c_dan   uuid := '77770000-0000-0000-0000-0000000000d3';  -- cư dân, không phải BQL
  p_seed  uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  -- Cohort ticket đặt ở tháng CÁCH ĐÂY 2 THÁNG: mọi mốc thời gian nằm chắc
  -- trong quá khứ, test không đổi kết quả tùy hôm nay là ngày mấy của tháng.
  v_thang date := (date_trunc('month', (now() at time zone 'Asia/Ho_Chi_Minh'))
                   - interval '2 months')::date;
  v_cuoi  date;
  v_goc   timestamptz;              -- 10:00 giờ VN, ngày 5 của tháng đó
  p_khac uuid := 'aaaaaaaa-0000-0000-0000-0000000000d9';
  b_khac uuid := 'bbbbbbbb-0000-0000-0000-0000000000d9';
  u_khac uuid := 'dddddddd-0000-0000-0000-0000000000d9';
  t0 uuid; t10 uuid;
  t1 uuid; t2 uuid; t3 uuid; t4 uuid; t5 uuid; t6 uuid; t7 uuid; t8 uuid; t9 uuid;
  d record;
  m record;
  n int;
begin
  v_cuoi := (v_thang + interval '1 month' - interval '1 day')::date;
  v_goc  := ((v_thang + 4)::text || ' 10:00')::timestamp at time zone 'Asia/Ho_Chi_Minh';

  insert into projects (id, name) values (p_dash, 'Khu test dashboard');
  insert into buildings (id, project_id, code, name, floor_count)
    values (b_dash, p_dash, 'D1', 'Dash 1', 5);
  insert into units (building_id, code, floor_no, area_m2)
    values (b_dash, 'D1-01.01', 1, 60), (b_dash, 'D1-01.02', 1, 70);
  select id into u_a from units where building_id = b_dash and code = 'D1-01.01';
  select id into u_b from units where building_id = b_dash and code = 'D1-01.02';

  insert into profiles (id, full_name) values
    (s_bql, 'BQL dashboard'), (s_khac, 'BQL du an khac'), (c_dan, 'Cu dan');
  insert into staff_assignments (user_id, project_id, role) values
    (s_bql, p_dash, 'bql_manager'), (s_khac, p_seed, 'bql_manager');

  insert into sla_policies (project_id, category, priority, respond_mins, resolve_mins)
    values (p_dash, 'elevator', 'urgent', 10, 30);

  -- ── Cohort 8 ticket, mỗi cái đại diện một nhánh của luật SLA ──────────
  insert into tickets (unit_id, reporter_id, category, priority, title) values
    (u_a, c_dan, 'elevator', 'urgent', 'T1 xong dung han')   returning id into t1;
  insert into tickets (unit_id, reporter_id, category, priority, title) values
    (u_a, c_dan, 'elevator', 'urgent', 'T2 xong tre han')    returning id into t2;
  insert into tickets (unit_id, reporter_id, category, priority, title) values
    (u_a, c_dan, 'elevator', 'urgent', 'T3 dang mo qua han') returning id into t3;
  insert into tickets (unit_id, reporter_id, category, priority, title) values
    (u_a, c_dan, 'elevator', 'urgent', 'T4 dang mo con han') returning id into t4;
  insert into tickets (unit_id, reporter_id, category, priority, title) values
    (u_a, c_dan, 'elevator', 'urgent', 'T5 bi tu choi')      returning id into t5;
  insert into tickets (unit_id, reporter_id, category, priority, title) values
    (u_a, c_dan, 'chua_co_policy', 'normal', 'T6 khong co SLA') returning id into t6;
  insert into tickets (unit_id, reporter_id, category, priority, title) values
    (u_b, c_dan, 'elevator', 'urgent', 'T7 xong, cham 5 sao') returning id into t7;
  insert into tickets (unit_id, reporter_id, category, priority, title) values
    (u_b, c_dan, 'elevator', 'urgent', 'T8 xong, cham 3 sao') returning id into t8;

  -- Dự án thứ hai, ticket rơi ĐÚNG vào cửa sổ thời gian đang đo. Không có nó
  -- thì bỏ hẳn `project_id = p_project` khỏi câu query vẫn ra đúng số, và cái
  -- rò dữ liệu giữa các khu chỉ lộ ra khi có khu thứ hai lên hệ thống.
  insert into projects (id, name) values (p_khac, 'Khu hang xom');
  insert into buildings (id, project_id, code, name) values (b_khac, p_khac, 'X1', 'Xom 1');
  insert into units (id, building_id, code, floor_no) values (u_khac, b_khac, 'X1-01.01', 1);
  insert into tickets (unit_id, reporter_id, category, priority, title)
    values (u_khac, c_dan, 'elevator', 'urgent', 'Ticket khu hang xom') returning id into t0;
  update tickets set created_at = v_goc where id = t0;

  -- Đặt lại mốc thời gian bằng tay: trigger đóng dấu theo now(), mà test cần
  -- những khoảng đo được. Set status + resolved_at trong CÙNG một update để
  -- ticket_stamp_times thấy resolved_at đã có mà không ghi đè.
  update tickets set created_at = v_goc,
                     sla_respond_due = v_goc + interval '10 min',
                     sla_resolve_due = v_goc + interval '30 min'
   where id in (t1, t2, t3, t4, t5, t7, t8);
  update tickets set created_at = v_goc where id = t6;   -- t6 để sla_*_due NULL

  update tickets set status = 'resolved', responded_at = v_goc + interval '5 min',
                     resolved_at = v_goc + interval '20 min' where id = t1;
  update tickets set status = 'resolved', responded_at = v_goc + interval '10 min',
                     resolved_at = v_goc + interval '50 min' where id = t2;
  update tickets set status = 'in_progress', responded_at = v_goc + interval '18 min'
   where id = t3;
  -- t4 còn hạn: hạn xử lý đẩy về tương lai dù ticket tạo từ 2 tháng trước.
  update tickets set sla_resolve_due = now() + interval '1 day' where id = t4;
  update tickets set status = 'rejected' where id = t5;
  -- t7/t8 xử lý lâu hơn nhưng vẫn ĐÚNG HẠN: hạn của chúng rộng hơn. Cần thế
  -- để "thời gian xử lý dài" và "trễ SLA" là hai chuyện tách rời — dashboard
  -- gộp hai cái đó lại là chỗ hay sai nhất.
  update tickets set sla_resolve_due = v_goc + interval '6 hours' where id in (t7, t8);
  update tickets set status = 'resolved', responded_at = v_goc + interval '30 min',
                     resolved_at = v_goc + interval '2 hours' where id = t7;
  update tickets set status = 'resolved', responded_at = v_goc + interval '60 min',
                     resolved_at = v_goc + interval '4 hours' where id = t8;
  update tickets set rating = 5 where id = t7;
  update tickets set rating = 3 where id = t8;

  -- ── Tiền ──────────────────────────────────────────────────────────────
  insert into invoices (unit_id, project_id, period, total_amount, paid_amount, status, due_date)
  values
    (u_a, p_dash, v_thang, 1000000, 400000, 'partial', v_thang + 15),          -- còn nợ, quá hạn
    (u_b, p_dash, v_thang,  500000, 500000, 'paid',    v_thang + 15),          -- xong
    (u_b, p_dash, date_trunc('month', current_date)::date,
                            800000,      0, 'issued',  current_date + 10),     -- nợ, chưa tới hạn
    (u_a, p_dash, date_trunc('month', current_date)::date + 0,
                            900000,      0, 'draft',   current_date + 40);     -- nháp
  -- Hóa đơn nháp trùng (unit, period) với dòng trên nên phải khác căn:
  delete from invoices where project_id = p_dash and status = 'draft';
  insert into invoices (unit_id, project_id, period, total_amount, paid_amount, status, due_date)
    values (u_a, p_dash, v_thang + interval '10 days', 900000, 0, 'draft', current_date + 40);

  -- Nợ từ kỳ CŨ HƠN cửa sổ đang xem. Không có dòng này thì khóa công nợ vào
  -- kỳ vẫn ra đúng số — mà nợ cũ mới đúng là loại nợ BQT cần thấy nhất.
  insert into invoices (unit_id, project_id, period, total_amount, paid_amount, status, due_date)
    values (u_a, p_dash, (v_thang - interval '3 months')::date, 200000, 0, 'issued',
            (v_thang - interval '3 months')::date + 15);

  insert into payments (unit_id, amount, bank_ref, paid_at) values
    (u_a, 400000, 'DASHTEST-1', v_goc),        -- tiền vào TRONG kỳ
    (u_b, 500000, 'DASHTEST-2', now());        -- tiền vào NGOÀI kỳ (tháng này)

  -- Ticket mở tạo THÁNG NÀY, tức ngoài cohort. Ảnh chụp "đang mở" phải thấy
  -- nó; nếu ai đó khóa ảnh chụp vào khoảng ngày thì con số tụt mà không báo.
  insert into tickets (unit_id, reporter_id, category, priority, title)
    values (u_a, c_dan, 'chua_co_policy', 'normal', 'T10 moi mo thang nay')
    returning id into t10;

  -- ══════════════════════ QUYỀN ══════════════════════════════════════════
  -- 1. Cư dân gọi thẳng RPC -> chặn. Hàm là SECURITY DEFINER, không có
  --    self-guard thì đây là API dump KPI toàn hệ thống.
  perform set_config('test.uid', c_dan::text, true);
  begin
    perform * from bql_dashboard(p_dash);
    raise exception 'FAIL 1: cu dan goi duoc bql_dashboard';
  exception when insufficient_privilege then null;
  end;

  begin
    perform * from bql_dashboard_thang(p_dash);
    raise exception 'FAIL 1b: cu dan goi duoc bql_dashboard_thang';
  exception when insufficient_privilege then null;
  end;

  -- 2. BQL dự án KHÁC cũng không xem được: is_staff phải khóa theo p_project,
  --    không phải "có chân trong BQL nào đó là xong".
  perform set_config('test.uid', s_khac::text, true);
  begin
    perform * from bql_dashboard(p_dash);
    raise exception 'FAIL 2: BQL du an khac xem duoc dashboard du an nay';
  exception when insufficient_privilege then null;
  end;

  -- ══════════════════════ SỐ LIỆU ════════════════════════════════════════
  perform set_config('test.uid', s_bql::text, true);
  select * into d from bql_dashboard(p_dash, v_thang, v_cuoi);

  -- 3. Đếm cohort: đủ 8 ticket, không lẫn ticket dự án seed
  if d.tong_ticket <> 8 then
    raise exception 'FAIL 3: dem % ticket, phai la 8', d.tong_ticket;
  end if;

  -- 4. Ticket bị từ chối tách riêng, không nằm trong mẫu số SLA
  if d.ticket_tu_choi <> 1 then
    raise exception 'FAIL 4: ticket_tu_choi = %, phai la 1', d.ticket_tu_choi;
  end if;

  -- 5. Danh mục chưa có policy là VÙNG MÙ, không phải điểm tuyệt đối
  if d.ticket_khong_co_sla <> 1 then
    raise exception 'FAIL 5: ticket_khong_co_sla = %, phai la 1', d.ticket_khong_co_sla;
  end if;

  -- 6. HẠT NHÂN: t3 đang mở nhưng đã quá hạn -> tính TRỄ NGAY, không đợi đóng.
  --    Nếu chỉ lấy ticket đã đóng làm mẫu số thì ket_luan = 4 và tỷ lệ = 75%.
  if d.ticket_co_ket_luan <> 5 then
    raise exception 'FAIL 6a: ticket_co_ket_luan = %, phai la 5 (t1,t2,t3,t7,t8)',
      d.ticket_co_ket_luan;
  end if;
  if d.ticket_dung_sla <> 3 then
    raise exception 'FAIL 6b: ticket_dung_sla = %, phai la 3 (t1,t7,t8)', d.ticket_dung_sla;
  end if;
  if d.ty_le_dung_sla <> 60.0 then
    raise exception 'FAIL 6c: ty_le_dung_sla = %, phai la 60.0', d.ty_le_dung_sla;
  end if;

  -- 7. t4 còn trong hạn -> chưa ngã ngũ, đứng ngoài cả tử lẫn mẫu
  if d.ticket_chua_ket_luan <> 1 then
    raise exception 'FAIL 7: ticket_chua_ket_luan = %, phai la 1 (t4)', d.ticket_chua_ket_luan;
  end if;

  -- 8. Thời gian: trung vị 1.4h, trung bình 1.8h, p90 3.4h.
  --    Trung bình > trung vị chính là thứ cần nhìn thấy được.
  if d.gio_xu_ly_trung_vi <> 1.4 then
    raise exception 'FAIL 8a: gio_xu_ly_trung_vi = %, phai la 1.4', d.gio_xu_ly_trung_vi;
  end if;
  if d.gio_xu_ly_trung_binh <> 1.8 then
    raise exception 'FAIL 8b: gio_xu_ly_trung_binh = %, phai la 1.8', d.gio_xu_ly_trung_binh;
  end if;
  if d.gio_xu_ly_p90 <> 3.4 then
    raise exception 'FAIL 8c: gio_xu_ly_p90 = %, phai la 3.4', d.gio_xu_ly_p90;
  end if;
  -- Phản hồi: 5, 10, 18, 30, 60 phút -> trung vị 18 phút = 0.3h
  if d.gio_phan_hoi_trung_vi <> 0.3 then
    raise exception 'FAIL 8d: gio_phan_hoi_trung_vi = %, phai la 0.3', d.gio_phan_hoi_trung_vi;
  end if;

  -- 9. Hài lòng: 5 và 3 -> 4.00 điểm / 2 lượt. Mẫu số tỷ lệ đánh giá là ticket
  --    ĐÃ XONG (t1,t2,t7,t8 = 4), không phải toàn bộ 8 ticket -> 50%.
  if d.diem_hai_long <> 4.00 then
    raise exception 'FAIL 9a: diem_hai_long = %, phai la 4.00', d.diem_hai_long;
  end if;
  if d.so_luot_danh_gia <> 2 then
    raise exception 'FAIL 9b: so_luot_danh_gia = %, phai la 2', d.so_luot_danh_gia;
  end if;
  if d.ty_le_danh_gia <> 50.0 then
    raise exception 'FAIL 9c: ty_le_danh_gia = %, phai la 50.0 (2/4 ticket da xong)',
      d.ty_le_danh_gia;
  end if;

  -- 10. Ảnh chụp hiện tại KHÔNG bị khoảng ngày cắt: t3 và t4 vẫn đang mở hôm nay
  --     dù cohort là tháng cũ. Ticket mở từ tháng trước vẫn đang làm phiền người ta.
  if d.dang_mo_hien_tai <> 4 then
    raise exception 'FAIL 10a: dang_mo_hien_tai = %, phai la 4 (t3,t4,t6,t10)',
      d.dang_mo_hien_tai;
  end if;
  if d.qua_han_hien_tai <> 1 then
    raise exception 'FAIL 10b: qua_han_hien_tai = %, phai la 1 (t3)', d.qua_han_hien_tai;
  end if;

  -- 11. Công nợ là ẢNH CHỤP, không bị khoảng ngày cắt: 200k nợ cũ (3 tháng
  --     trước cửa sổ) + 600k quá hạn + 800k chưa tới hạn = 1.6tr, 2 căn.
  --     Hóa đơn 'paid' và 'draft' đứng ngoài.
  if d.cong_no <> 1600000 then
    raise exception 'FAIL 11a: cong_no = %, phai la 1600000', d.cong_no;
  end if;
  if d.cong_no_qua_han <> 800000 then
    raise exception 'FAIL 11b: cong_no_qua_han = %, phai la 800000', d.cong_no_qua_han;
  end if;
  if d.so_can_no <> 2 then
    raise exception 'FAIL 11c: so_can_no = %, phai la 2', d.so_can_no;
  end if;

  -- 12. HẠT NHÂN: phai_thu/da_thu theo KỲ HÓA ĐƠN, tien_ve theo NGÀY TIỀN VÀO.
  --     Hai số cố tình khác nhau — gộp chúng lại là cách quen thuộc để dashboard
  --     nói dối mà vẫn cộng đúng.
  if d.phai_thu_ky <> 1500000 then
    raise exception 'FAIL 12a: phai_thu_ky = %, phai la 1500000 (nhap khong tinh)', d.phai_thu_ky;
  end if;
  if d.da_thu_ky <> 900000 then
    raise exception 'FAIL 12b: da_thu_ky = %, phai la 900000', d.da_thu_ky;
  end if;
  if d.tien_ve_ky <> 400000 then
    raise exception 'FAIL 12c: tien_ve_ky = %, phai la 400000 (500k roi vao thang nay)',
      d.tien_ve_ky;
  end if;

  -- 13. Kỳ trống vẫn phải trả về ĐÚNG MỘT DÒNG, kèm công nợ. Nối thẳng bảng
  --     ticket vào câu chính thì kỳ không có ticket ra bảng rỗng và BQT tưởng
  --     hệ thống hỏng.
  select count(*) into n from bql_dashboard(p_dash, v_thang - 300, v_thang - 270);
  if n <> 1 then
    raise exception 'FAIL 13a: ky trong tra ve % dong, phai la 1', n;
  end if;
  select * into d from bql_dashboard(p_dash, v_thang - 300, v_thang - 270);
  if d.tong_ticket <> 0 or d.cong_no <> 1600000 then
    raise exception 'FAIL 13b: ky trong ra tong_ticket=% cong_no=%', d.tong_ticket, d.cong_no;
  end if;

  -- 14. Khoảng ngày ngược -> lỗi, không âm thầm trả 0
  begin
    perform * from bql_dashboard(p_dash, v_cuoi, v_thang);
    raise exception 'FAIL 14: khoang ngay nguoc khong bi chan';
  exception when invalid_datetime_format then null;
  end;

  -- 15. MÚI GIỜ: ticket báo 6h sáng ngày 1 (= 23h UTC ngày cuối tháng trước)
  --     phải thuộc tháng này. Cắt tháng bằng created_at::date trên server UTC
  --     là ăn mất cả buổi sáng ngày đầu tháng mà không ai phát hiện.
  insert into tickets (unit_id, reporter_id, category, priority, title)
    values (u_a, c_dan, 'elevator', 'urgent', 'T9 sang som ngay 1') returning id into t9;
  update tickets set created_at = (v_thang::text || ' 06:00')::timestamp
                                    at time zone 'Asia/Ho_Chi_Minh',
                     sla_resolve_due = null
   where id = t9;
  select * into d from bql_dashboard(p_dash, v_thang, v_cuoi);
  if d.tong_ticket <> 9 then
    raise exception 'FAIL 15: tong_ticket = %, phai la 9 (T9 6h sang ngay 1 bi rot)',
      d.tong_ticket;
  end if;

  -- ══════════════════════ CHUỖI THEO THÁNG ═══════════════════════════════
  -- 16. Đủ số tháng yêu cầu, kể cả tháng trắng. Biểu đồ thiếu cột đọc ra
  --     "không có dữ liệu", trong khi sự thật là "tháng đó không ai báo hỏng".
  select count(*) into n from bql_dashboard_thang(p_dash, 6);
  if n <> 6 then
    raise exception 'FAIL 16a: chuoi 6 thang tra ve % dong', n;
  end if;

  -- Tháng liền trước không có ticket nào -> phải có dòng, giá trị 0, không NULL
  select * into m from bql_dashboard_thang(p_dash, 6)
   where thang = (date_trunc('month', (now() at time zone 'Asia/Ho_Chi_Minh'))
                  - interval '1 month')::date;
  if m.thang is null then
    raise exception 'FAIL 16b: thang trong bi bo khoi chuoi';
  end if;
  if m.ticket_moi <> 0 or m.phai_thu <> 0 or m.tien_ve <> 0 then
    raise exception 'FAIL 16c: thang trong ra ticket=% phai_thu=% tien_ve=%',
      m.ticket_moi, m.phai_thu, m.tien_ve;
  end if;

  -- 17. Tháng có cohort: 9 ticket, tỷ lệ SLA vẫn 60%, tiền về 400k
  select * into m from bql_dashboard_thang(p_dash, 6) where thang = v_thang;
  if m.ticket_moi <> 9 then
    raise exception 'FAIL 17a: thang cohort ra % ticket, phai la 9', m.ticket_moi;
  end if;
  if m.ty_le_dung_sla <> 60.0 then
    raise exception 'FAIL 17b: ty_le_dung_sla thang cohort = %, phai la 60.0', m.ty_le_dung_sla;
  end if;
  if m.phai_thu <> 1500000 or m.da_thu <> 900000 or m.tien_ve <> 400000 then
    raise exception 'FAIL 17c: tien thang cohort ra %/%/%', m.phai_thu, m.da_thu, m.tien_ve;
  end if;

  -- 18. p_so_thang phải bị kẹp: giá trị đến từ URL, không kẹp là mời người ta
  --     quét 100 năm dữ liệu bằng một query string.
  select count(*) into n from bql_dashboard_thang(p_dash, 0);
  if n <> 1 then raise exception 'FAIL 18a: p_so_thang=0 ra % dong, phai la 1', n; end if;
  select count(*) into n from bql_dashboard_thang(p_dash, 1000);
  if n <> 36 then raise exception 'FAIL 18b: p_so_thang=1000 ra % dong, phai la 36', n; end if;

  raise notice 'test_dashboard: 18 assert PASS';
end $test$;
