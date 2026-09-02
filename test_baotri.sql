-- Smoke test bảo trì định kỳ. Chạy sau schema.sql + seed.sql.
--
-- Hạng mục bắt buộc theo luật (thang máy, PCCC) quá hạn là bị phạt, và tệ hơn
-- là mất an toàn. Hai chỗ dễ hỏng im lặng: cron chạy lại đẻ ra hai lần bảo trì
-- cho cùng một hạn, và hạn kế tiếp tính sai gốc nên giấy kiểm định hết hạn
-- trước khi hệ thống kịp nhắc.

do $test$
declare
  p_bt uuid := 'aaaaaaaa-0000-0000-0000-00000000f000';
  b_bt uuid := 'bbbbbbbb-0000-0000-0000-00000000f000';
  ky_su uuid := '77770000-0000-0000-0000-00000000f001';
  ngoai uuid := '77770000-0000-0000-0000-00000000f002';
  p_khac uuid := 'aaaaaaaa-0000-0000-0000-00000000f009';
  kh_gan uuid; kh_xa uuid; kh_tat uuid; r_gan uuid;
  n int; v_han date; v_moi date;
begin
  insert into projects (id, name) values (p_bt,'Khu bao tri'), (p_khac,'Khu hang xom BT');
  insert into buildings (id, project_id, code, name) values (b_bt, p_bt,'F1','BT 1');
  insert into profiles (id, full_name, phone) values
    (ky_su,'Ky su bao tri','0900000040'), (ngoai,'Nguoi khu khac','0900000041');
  insert into staff_assignments (user_id, project_id, role) values
    (ky_su, p_bt,'technician'), (ngoai, p_khac,'bql_manager');

  perform set_config('test.uid', ky_su::text, true);

  -- Ba kế hoạch: một đã tới cửa sổ nhắc, một còn xa, một đã tắt.
  insert into maintenance_plans
    (project_id, building_id, ten, hang_muc, chu_ky_ngay, han_ke_tiep, nhac_truoc_ngay,
     bat_buoc_phap_ly)
  values (p_bt, b_bt,'Kiem dinh thang may','thang_may', 365, current_date + 5, 7, true)
  returning id into kh_gan;

  insert into maintenance_plans
    (project_id, building_id, ten, hang_muc, chu_ky_ngay, han_ke_tiep, nhac_truoc_ngay)
  values (p_bt, b_bt,'Ve sinh be nuoc','bom_nuoc', 180, current_date + 60, 7)
  returning id into kh_xa;

  insert into maintenance_plans
    (project_id, building_id, ten, hang_muc, chu_ky_ngay, han_ke_tiep, is_active)
  values (p_bt, b_bt,'Ke hoach cu','khac', 90, current_date - 1, false)
  returning id into kh_tat;

  -- ── 1. Chỉ mở đúng kế hoạch đã tới cửa sổ nhắc ──
  n := mo_ky_bao_tri();
  if n <> 1 then raise exception 'Mo sai so lan bao tri: %', n; end if;

  select count(*) into n from maintenance_runs where plan_id = kh_xa;
  if n <> 0 then raise exception 'Mo som cho ke hoach con xa (n=%)', n; end if;
  select count(*) into n from maintenance_runs where plan_id = kh_tat;
  if n <> 0 then raise exception 'Mo cho ke hoach da tat (n=%)', n; end if;

  -- ── 2. Cron chạy lại KHÔNG đẻ ra lần thứ hai cho cùng một hạn ──
  -- Chot nam o unique (plan_id, han). Bo on conflict thi mot lan retry la ca
  -- job no, va lich bao tri dung im ma khong ai biet.
  n := mo_ky_bao_tri();
  if n <> 0 then raise exception 'Chay lai de them % lan bao tri', n; end if;
  select count(*) into n from maintenance_runs where plan_id = kh_gan;
  if n <> 1 then raise exception 'Co % lan bao tri cho cung mot han', n; end if;

  -- ── 3. Hạn kế tiếp tính từ NGÀY LÀM THẬT, không phải hạn cũ ──
  -- Giay kiem dinh co hieu luc tu ngay kiem dinh. Doi theo han cu thi lam muon
  -- bao nhieu ngay la lan sau nhac som bay nhieu — va cung cong thuc do o chieu
  -- nguoc lai la giay het han truoc khi he thong kip nhac.
  select id, han into r_gan, v_han from maintenance_runs where plan_id = kh_gan;
  v_moi := xong_bao_tri(r_gan, 'Dat, khong co khuyen nghi');

  if v_moi <> current_date + 365 then
    raise exception 'Han ke tiep phai la ngay lam + chu ky, dang la %', v_moi;
  end if;
  if v_moi = v_han + 365 then
    raise exception 'Han ke tiep dang tinh tu han cu chu khong phai ngay lam that';
  end if;

  select han_ke_tiep into v_moi from maintenance_plans where id = kh_gan;
  if v_moi <> current_date + 365 then
    raise exception 'Khong doi han tren ke hoach: %', v_moi;
  end if;

  -- ── 4. Đóng rồi thì không đóng lại được ──
  -- Dong hai lan la day han them mot chu ky nua, tuc la bo qua han giua chung.
  begin
    perform xong_bao_tri(r_gan, 'lan hai');
    raise exception 'Dong lai duoc lan bao tri da dong';
  exception when sqlstate '22023' then null;
  end;

  -- ── 5. Ghi đúng người làm ──
  select count(*) into n from maintenance_runs
   where id = r_gan and nguoi_lam = ky_su and lam_luc is not null;
  if n <> 1 then raise exception 'Khong ghi nguoi lam'; end if;

  -- ── 6. Người khu khác không đóng được ──
  perform set_config('test.uid', ngoai::text, true);
  begin
    -- Mo lai mot lan moi de co cai ma dong
    update maintenance_plans set han_ke_tiep = current_date where id = kh_gan;
    perform mo_ky_bao_tri();
    select id into r_gan from maintenance_runs
      where plan_id = kh_gan and lam_luc is null limit 1;
    perform xong_bao_tri(r_gan, 'nguoi ngoai');
    raise exception 'Nguoi khu khac dong duoc lan bao tri cua khu nay';
  exception when sqlstate '42501' then null;
  end;

  -- ── 7. Kế hoạch quá hạn vẫn được mở, không bị bỏ qua ──
  -- Qua han roi ma khong mo thi hang muc bi quen han lai la hang muc duy nhat
  -- khong hien ra tren man — dung cai can hien nhat.
  perform set_config('test.uid', ky_su::text, true);
  insert into maintenance_plans
    (project_id, building_id, ten, hang_muc, chu_ky_ngay, han_ke_tiep, bat_buoc_phap_ly)
  values (p_bt, b_bt,'PCCC da qua han','pccc', 90, current_date - 30, true);
  n := mo_ky_bao_tri();
  if n < 1 then raise exception 'Ke hoach da qua han khong duoc mo'; end if;

  raise notice 'test_baotri.sql OK';
end $test$;
