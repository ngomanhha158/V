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

rollback;
