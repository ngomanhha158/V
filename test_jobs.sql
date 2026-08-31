-- Smoke test job nền chạy bằng pg_cron. Chạy sau schema.sql + seed.sql.
-- (escalate_overdue_tickets đã được test trong test_tickets.sql assert 6.)
--
-- expire_memberships là job DỌN DỮ LIỆU, không phải chốt chặn bảo mật:
-- RLS đã lọc valid_to >= current_date ngay trong current_unit_ids() và
-- invoice_read, nên người thuê hết hạn mất quyền tức thì dù cron chưa chạy
-- (test_rls.sql assert 3). Job này chỉ đưa cột status về 'expired' cho báo cáo.

do $test$
declare
  v_unit1 uuid; v_unit2 uuid; v_unit3 uuid;
  u_het_han  uuid := '66666666-6666-6666-6666-666666666661';
  u_vo_han   uuid := '66666666-6666-6666-6666-666666666662';
  u_con_han  uuid := '66666666-6666-6666-6666-666666666663';
  u_da_thu_hoi uuid := '66666666-6666-6666-6666-666666666664';
  u_het_hom_nay uuid := '66666666-6666-6666-6666-666666666665';
  v_status text;
  n int;
begin
  select id into v_unit1 from units order by code limit 1;
  select id into v_unit2 from units order by code offset 1 limit 1;
  select id into v_unit3 from units order by code offset 2 limit 1;

  insert into profiles (id, full_name) values
    (u_het_han,'Thue het han'), (u_vo_han,'Chu ho vo han'),
    (u_con_han,'Thue con han'), (u_da_thu_hoi,'Da thu hoi'),
    (u_het_hom_nay,'Thue het hom nay');

  insert into unit_memberships (unit_id, user_id, role, status, valid_from, valid_to) values
    (v_unit1, u_het_han,    'tenant', 'active',  current_date - 365, current_date - 1),
    (v_unit1, u_vo_han,     'owner',  'active',  current_date - 30,  null),
    (v_unit2, u_con_han,    'tenant', 'active',  current_date - 30,  current_date + 30),
    -- Hết hạn ĐÚNG HÔM NAY: hôm nay vẫn còn quyền. RLS dùng valid_to >= current_date,
    -- nên job phải dùng valid_to < current_date. Lệch 1 dấu = cắt quyền sớm 1 ngày.
    (v_unit2, u_het_hom_nay, 'family', 'active',  current_date - 30,  current_date),
    -- Đã thu hồi tay từ trước: cron không được lật ngược thành 'expired'
    (v_unit3, u_da_thu_hoi, 'tenant', 'revoked', current_date - 365, current_date - 1);

  perform expire_memberships();

  -- 1. Hết hạn hôm qua -> chuyển 'expired'
  select status::text into v_status from unit_memberships where user_id = u_het_han;
  if v_status <> 'expired' then
    raise exception 'FAIL 1: thue het han van o trang thai %, phai la expired', v_status;
  end if;

  -- 2. valid_to null (chủ hộ) -> KHÔNG đụng vào. Hỏng cái này là chủ hộ mất
  --    quyền căn hộ của chính mình sau 1 đêm.
  select status::text into v_status from unit_memberships where user_id = u_vo_han;
  if v_status <> 'active' then
    raise exception 'FAIL 2: chu ho vo thoi han bi doi thanh %', v_status;
  end if;

  -- 3. Còn hạn -> không đụng
  select status::text into v_status from unit_memberships where user_id = u_con_han;
  if v_status <> 'active' then
    raise exception 'FAIL 3: thue con han bi doi thanh %', v_status;
  end if;

  -- 4. Hết hạn hôm nay -> HÔM NAY VẪN CÒN QUYỀN, mai cron mới thu.
  --    Khớp với RLS (valid_to >= current_date). Đây là chỗ dễ lệch 1 ngày nhất.
  select status::text into v_status from unit_memberships where user_id = u_het_hom_nay;
  if v_status <> 'active' then
    raise exception 'FAIL 4: hop dong het hom nay bi thu quyen som, trang thai %', v_status;
  end if;

  -- 5. Chỉ đụng bản ghi đang 'active'; 'revoked' giữ nguyên, không hóa 'expired'
  select status::text into v_status from unit_memberships where user_id = u_da_thu_hoi;
  if v_status <> 'revoked' then
    raise exception 'FAIL 5: ban ghi revoked bi ghi de thanh %', v_status;
  end if;

  -- 6. Chạy lại không đổi thêm gì (idempotent)
  perform expire_memberships();
  select count(*) into n from unit_memberships where status = 'expired';
  if n <> 1 then raise exception 'FAIL 6: chay lai lam doi them ban ghi, co % expired', n; end if;

  raise notice 'ALL JOB TESTS PASSED';
end $test$;

-- ─────────────── remind_unpaid_invoices (N21) ────────────────
-- Job này gửi thẳng vào điện thoại cư dân. Hai kiểu sai đều đắt:
-- nhắc nhầm người (con cái nhận tin đòi tiền, hoặc nhắc căn đã trả đủ) và
-- nhắc trùng (bắn hai lần trong ngày -> cư dân tắt thông báo vĩnh viễn).
do $test$
declare
  v_project uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  v_period  date := date_trunc('month', current_date)::date;
  v_units   uuid[];
  un_t3 uuid; un_t0 uuid; un_p3 uuid; un_t1 uuid; un_paid uuid; un_draft uuid; un_fam uuid;
  iv_t3 uuid; iv_t0 uuid; iv_p3 uuid;
  o_t3    uuid := '55550000-0000-0000-0000-000000000001';
  o_t0    uuid := '55550000-0000-0000-0000-000000000002';
  o_p3    uuid := '55550000-0000-0000-0000-000000000003';
  o_t1    uuid := '55550000-0000-0000-0000-000000000004';
  o_paid  uuid := '55550000-0000-0000-0000-000000000005';
  o_draft uuid := '55550000-0000-0000-0000-000000000006';
  f_owner uuid := '55550000-0000-0000-0000-000000000007';
  f_con   uuid := '55550000-0000-0000-0000-000000000008';
  f_vo    uuid := '55550000-0000-0000-0000-000000000009';
  x_thu_hoi uuid := '55550000-0000-0000-0000-00000000000a';
  x_het_han uuid := '55550000-0000-0000-0000-00000000000b';
  v_ret int;
  v_title text; v_body text;
  n int;
begin
  -- Dùng các căn KHÁC hẳn phần trên của file: khối trên đã tạo membership cho
  -- 3 căn đầu, dính vào là đếm nhầm.
  select array_agg(id order by code) into v_units
    from (select id, code from units order by code offset 5 limit 7) s;
  un_t3 := v_units[1]; un_t0 := v_units[2]; un_p3 := v_units[3]; un_t1 := v_units[4];
  un_paid := v_units[5]; un_draft := v_units[6]; un_fam := v_units[7];

  insert into profiles (id, full_name) values
    (o_t3,'Chu ho T-3'), (o_t0,'Chu ho T0'), (o_p3,'Chu ho T+3'), (o_t1,'Chu ho T-1'),
    (o_paid,'Chu ho da tra du'), (o_draft,'Chu ho hoa don nhap'),
    (f_owner,'Chu ho nha dong nguoi'), (f_con,'Con'), (f_vo,'Vo'),
    (x_thu_hoi,'Thue da bi thu hoi'), (x_het_han,'Thue vua het hop dong');

  insert into unit_memberships (unit_id, user_id, role, status, can_view_finance) values
    (un_t3, o_t3,'owner','active', false), (un_t0, o_t0,'owner','active', false),
    (un_p3, o_p3,'owner','active', false), (un_t1, o_t1,'owner','active', false),
    (un_paid, o_paid,'owner','active', false), (un_draft, o_draft,'owner','active', false),
    (un_fam, f_owner,'owner','active', false),
    -- Con: vai 'family', KHÔNG được xem công nợ -> không nhận tin đòi tiền.
    (un_fam, f_con,'family','active', false),
    -- Vợ: cũng 'family' nhưng BQL đã bật can_view_finance -> phải nhận.
    (un_fam, f_vo, 'family','active', true);

  -- Hai người đã rời căn un_t0. Cả hai đều là 'tenant' — vai được xem công nợ —
  -- nên chỉ cột trạng thái/hạn hợp đồng chặn họ lại. Đòi tiền người đã trả nhà
  -- là lỗi lộ dữ liệu, không phải lỗi làm phiền.
  insert into unit_memberships (unit_id, user_id, role, status, valid_from, valid_to) values
    -- Thu hồi GIỮA CHỪNG: hợp đồng còn hạn, nên chỉ cột status chặn được.
    (un_t0, x_thu_hoi,'tenant','revoked', current_date - 365, current_date + 300),
    -- Hết hạn hôm qua nhưng cron dọn chưa chạy: status VẪN 'active'.
    -- Đây mới là trạng thái thật lúc 08:00 sáng, không phải trạng thái đã dọn.
    (un_t0, x_het_han,'tenant','active',  current_date - 365, current_date - 1);

  insert into invoices (unit_id, project_id, period, total_amount, paid_amount, status, due_date) values
    (un_t3,   v_project, v_period, 2000000,       0, 'issued', current_date + 3),
    (un_t0,   v_project, v_period, 2000000,       0, 'issued', current_date),
    -- Trả một phần: tin nhắn phải ghi SỐ CÒN LẠI, không phải tổng hóa đơn.
    (un_p3,   v_project, v_period, 2000000,  500000, 'partial', current_date - 3),
    -- Đến hạn ngày mai: chưa tới mốc nào -> im lặng.
    (un_t1,   v_project, v_period, 2000000,       0, 'issued', current_date + 1),
    -- Đã trả đủ mà vẫn đòi tiền là mất mặt với cư dân.
    (un_paid, v_project, v_period, 2000000, 2000000, 'issued', current_date),
    -- Còn nháp: BQL chưa phát hành, chưa được phép đòi.
    (un_draft,v_project, v_period, 2000000,       0, 'draft',  current_date),
    (un_fam,  v_project, v_period, 3000000,       0, 'issued', current_date);

  select id into iv_t3 from invoices where unit_id = un_t3 and period = v_period;
  select id into iv_t0 from invoices where unit_id = un_t0 and period = v_period;
  select id into iv_p3 from invoices where unit_id = un_p3 and period = v_period;

  v_ret := remind_unpaid_invoices();

  -- 7. Đúng 5 thông báo: T-3, T0, T+3, và nhà đông người 2 người (chủ hộ + vợ).
  --    Đếm tổng bắt được cả bắn thiếu lẫn bắn thừa.
  select count(*) into n from notifications where kind = 'invoice';
  if n <> 5 then raise exception 'FAIL 7: sinh % thong bao, phai la 5', n; end if;
  if v_ret <> 5 then raise exception 'FAIL 7b: ham tra ve %, phai la 5', v_ret; end if;

  -- 8. Đúng ba mốc T-3 / T0 / T+3
  select count(*) into n from notifications
   where kind='invoice' and (user_id,ref_id) in ((o_t3,iv_t3),(o_t0,iv_t0),(o_p3,iv_p3));
  if n <> 3 then raise exception 'FAIL 8: chi trung % / 3 moc nhac', n; end if;

  -- 9. Chưa tới mốc / đã trả đủ / còn nháp -> tuyệt đối im lặng
  select count(*) into n from notifications where user_id in (o_t1, o_paid, o_draft);
  if n <> 0 then raise exception 'FAIL 9: nhac nham % nguoi khong duoc nhac', n; end if;

  -- 9b. Người đã rời căn (thu hồi / hết hợp đồng) không nhận thông báo nợ
  select count(*) into n from notifications where user_id in (x_thu_hoi, x_het_han);
  if n <> 0 then raise exception 'FAIL 9b: nhac no nguoi da roi can, % tin', n; end if;

  -- 10. Con không nhận, vợ (can_view_finance) có nhận
  select count(*) into n from notifications where user_id = f_con;
  if n <> 0 then raise exception 'FAIL 10a: con cai nhan tin doi tien'; end if;
  select count(*) into n from notifications where user_id = f_vo;
  if n <> 1 then raise exception 'FAIL 10b: nguoi duoc xem cong no khong nhan duoc, % tin', n; end if;

  -- 11. Ba mốc phải đọc ra ba nội dung khác nhau. Cùng một câu ở cả ba lần thì
  --     cư dân không biết đang sắp đến hạn hay đã quá hạn.
  select title into v_title from notifications where user_id = o_t3;
  if v_title not like '%sap den han%' then raise exception 'FAIL 11a: tieu de T-3 sai: %', v_title; end if;
  select title into v_title from notifications where user_id = o_t0;
  if v_title not like '%den han hom nay%' then raise exception 'FAIL 11b: tieu de T0 sai: %', v_title; end if;
  select title into v_title from notifications where user_id = o_p3;
  if v_title not like '%qua han%' then raise exception 'FAIL 11c: tieu de T+3 sai: %', v_title; end if;

  -- 12. Số tiền trong tin = CÒN LẠI (2.000.000 - 500.000), không phải tổng.
  --     Ghi nhầm tổng thì cư dân chuyển thừa 500k rồi đòi lại BQL.
  select body into v_body from notifications where user_id = o_p3;
  if v_body not like '%1.500.000d%' then
    raise exception 'FAIL 12: so tien con lai sai trong tin nhan: %', v_body;
  end if;

  -- 13. Chạy lại (cron retry / BQL bấm tay) KHÔNG bắn lần hai
  v_ret := remind_unpaid_invoices();
  if v_ret <> 0 then raise exception 'FAIL 13a: chay lai bắn them % tin', v_ret; end if;
  select count(*) into n from notifications where kind = 'invoice';
  if n <> 5 then raise exception 'FAIL 13b: chay lai thanh % thong bao', n; end if;

  raise notice 'ALL REMINDER TESTS PASSED';
end $test$;


rollback;
