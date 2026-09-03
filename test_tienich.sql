-- Smoke test đặt tiện ích. Chạy sau schema.sql + seed.sql.
--
-- Cả tính năng dựng lên để giữ MỘT lời hứa: hai người bấm cùng lúc thì chỉ một
-- người được suất. Kiểm ở tầng app thì cả hai lọt, và cái lọt đó xuất hiện đúng
-- vào những khung giờ đắt nhất — tối thứ Bảy — nơi cãi nhau tốn kém nhất.

do $test$
declare
  p_t  uuid := 'aaaaaaaa-0000-0000-0000-000000070000';
  t_t  uuid := 'bbbbbbbb-0000-0000-0000-000000070001';
  bql  uuid := '99990000-0000-0000-0000-000000070001';
  a    uuid := '99990000-0000-0000-0000-00000007000a';
  b    uuid := '99990000-0000-0000-0000-00000007000b';
  la   uuid := '99990000-0000-0000-0000-00000007000c';
  u_a uuid; u_b uuid;
  ti uuid; s1 uuid; s2 uuid; s3 uuid; s4 uuid;
  d1 uuid; d2 uuid;
  mai date := current_date + 1;
  r record; n int;
begin
  insert into projects (id, name) values (p_t, 'Khu tien ich');
  insert into buildings (id, project_id, code, name) values (t_t, p_t, 'T1', 'Toa T1');
  insert into units (building_id, code, floor_no) values (t_t,'T1-05.01',5), (t_t,'T1-05.02',5);
  select id into u_a from units where building_id = t_t and code = 'T1-05.01';
  select id into u_b from units where building_id = t_t and code = 'T1-05.02';

  insert into profiles (id, full_name, phone) values
    (bql,'BQL tien ich','0900000110'), (a,'Chu ho A','0900000111'),
    (b,'Chu ho B','0900000112'), (la,'Nguoi ngoai','0900000113');
  insert into staff_assignments (user_id, project_id, role) values (bql, p_t, 'bql_manager');
  insert into unit_memberships (unit_id, user_id, role, status) values
    (u_a, a, 'owner', 'active'), (u_b, b, 'owner', 'active');

  insert into tien_ich (project_id, ten, phi, toi_da_tuan, dat_truoc_ngay)
    values (p_t, 'Sanh sinh hoat', 200000, 2, 14) returning id into ti;
  insert into tien_ich_suat (tien_ich_id, thu_tu, bat_dau, ket_thuc)
    values (ti, 1, time '08:00', time '11:00') returning id into s1;
  insert into tien_ich_suat (tien_ich_id, thu_tu, bat_dau, ket_thuc)
    values (ti, 2, time '14:00', time '17:00') returning id into s2;
  insert into tien_ich_suat (tien_ich_id, thu_tu, bat_dau, ket_thuc)
    values (ti, 3, time '18:00', time '21:00') returning id into s3;
  -- Suất thứ tư để trống tới tận ca 4: cần một ô còn rảnh TRONG CÙNG TUẦN với
  -- `mai` để chứng minh lượt đã hủy không ăn mất hạn mức. Dùng `mai + 1` thì
  -- bài test phụ thuộc vào việc hôm chạy CI rơi vào thứ mấy.
  insert into tien_ich_suat (tien_ich_id, thu_tu, bat_dau, ket_thuc)
    values (ti, 4, time '21:00', time '22:00') returning id into s4;

  -- ── 1. Đặt được, và phí CHÉP vào lượt đặt ──
  perform set_config('test.uid', a::text, true);
  d1 := dat_suat(s1, mai);
  select phi, unit_id into r from dat_tien_ich where id = d1;
  if r.phi <> 200000 then raise exception 'FAIL 1: khong chep phi (%)', r.phi; end if;
  if r.unit_id <> u_a then raise exception 'FAIL 1b: gan sai can'; end if;
  -- BQL đổi bảng giá không được làm đổi số tiền của suất đã đặt và đã báo giá.
  update tien_ich set phi = 500000 where id = ti;
  select phi into r from dat_tien_ich where id = d1;
  if r.phi <> 200000 then raise exception 'FAIL 1c: doi bang gia lam doi phi da dat'; end if;
  update tien_ich set phi = 200000 where id = ti;

  -- ── 2. TRÙNG GIỜ BỊ CHẶN Ở DATABASE ──
  -- Đây là cả lý do tồn tại của tính năng. Chặn ở app thì hai người bấm cùng
  -- lúc vẫn lọt cả hai.
  perform set_config('test.uid', b::text, true);
  begin
    perform dat_suat(s1, mai);
    raise exception 'FAIL 2: hai can dat duoc cung mot suat';
  exception when unique_violation then null;
  end;
  -- Suất khác cùng ngày thì vẫn đặt được — chặn trùng chứ không chặn cả ngày.
  d2 := dat_suat(s2, mai);
  if d2 is null then raise exception 'FAIL 2b: chan ca ngay thay vi chan trung suat'; end if;

  -- ── 3. Hạn mức mỗi căn mỗi tuần ──
  -- Không có nó thì một hộ đặt kín cả tháng tối thứ Bảy, và những hộ còn lại
  -- quay về Zalo.
  d2 := dat_suat(s3, mai);        -- căn B: suất thứ hai trong tuần
  begin
    perform dat_suat(s1, mai + 1);
    raise exception 'FAIL 3: dat duoc suat thu ba trong tuan (toi_da_tuan = 2)';
  exception when check_violation then null;
  end;

  -- Hạn mức tính theo TUẦN, nên sang tuần sau lại đặt được.
  if tuan_cua(mai) = tuan_cua(mai + 7) then
    raise exception 'FAIL 3b: tuan_cua tra ve cung mot tuan cho hai moc cach 7 ngay';
  end if;
  -- Ranh giới tuần chốt bằng NGÀY CỐ ĐỊNH. Hai mốc cách 7 ngày thì tuần bắt đầu
  -- từ thứ Hai hay Chủ nhật đều cho ra "khác tuần", nên câu trên không nói được
  -- gì về ranh giới. 31/08/2026 là thứ Hai, 06/09 là Chủ nhật liền sau,
  -- 07/09 là thứ Hai kế tiếp — theo lối Việt thì hai cái đầu CÙNG tuần.
  if tuan_cua(date '2026-08-31') <> tuan_cua(date '2026-09-06') then
    raise exception 'FAIL 3b1: thu Hai va Chu nhat cung tuan bi tach ra hai tuan';
  end if;
  if tuan_cua(date '2026-09-06') = tuan_cua(date '2026-09-07') then
    raise exception 'FAIL 3b2: Chu nhat va thu Hai hom sau bi gom vao mot tuan';
  end if;
  if dat_suat(s1, mai + 7) is null then
    raise exception 'FAIL 3c: han muc khong reset sang tuan moi';
  end if;

  -- Và con số phải hiện ra TRƯỚC khi chọn ô, không phải hiện dưới dạng một lỗi.
  select da_dat, toi_da, con_lai into r from con_suat_tuan(ti, mai);
  if r.da_dat <> 2 or r.con_lai <> 0 then
    raise exception 'FAIL 3d: con_suat_tuan bao da_dat=% con_lai=%', r.da_dat, r.con_lai;
  end if;

  -- ── 4. Hủy trả lại chỗ NGAY ──
  perform set_config('test.uid', a::text, true);
  perform huy_dat_suat(d1);
  perform set_config('test.uid', b::text, true);
  -- Căn B đang kín hạn mức tuần này nên vẫn không đặt được; căn A thì được.
  perform set_config('test.uid', a::text, true);
  if dat_suat(s1, mai) is null then
    raise exception 'FAIL 4: huy roi ma cho van bi giu';
  end if;

  -- Hủy hai lần bị từ chối.
  begin
    perform huy_dat_suat(d1);
    raise exception 'FAIL 4b: huy duoc hai lan cung mot luot';
  exception when unique_violation then null;
  end;

  -- Lượt ĐÃ HỦY không được tính vào hạn mức tuần. Tính vào thì hủy một lượt là
  -- mất luôn một suất của căn mình — người ta sẽ không dám hủy, và chỗ trống
  -- nằm chết ở đó thay vì về tay người khác.
  -- Căn A lúc này: 1 lượt sống (s1/mai, đặt lại ở trên) + 1 lượt đã hủy cùng
  -- tuần. Hạn mức 2, nên còn đúng 1 suất.
  -- Con số này chính là thứ màn hình hiện ra trước khi người ta chọn ô, nên nó
  -- vừa là bằng chứng vừa là cái người dùng thấy.
  select da_dat, con_lai into r from con_suat_tuan(ti, mai);
  if r.da_dat <> 1 then
    raise exception 'FAIL 4c: dem % suat, luot da huy van bi tinh', r.da_dat;
  end if;
  if r.con_lai <> 1 then
    raise exception 'FAIL 4d: con_lai = % sau khi huy mot luot', r.con_lai;
  end if;
  -- Và đặt được thật. Tính lượt đã hủy vào hạn mức thì hủy một lượt là mất luôn
  -- một suất của căn mình — người ta sẽ không dám hủy, và chỗ trống nằm chết ở
  -- đó thay vì về tay người khác.
  if dat_suat(s4, mai) is null then
    raise exception 'FAIL 4e: luot da huy chiem mat suat cuoi cua tuan';
  end if;

  -- ── 5. Không hủy được lượt của căn khác ──
  perform set_config('test.uid', b::text, true);
  select id into d1 from dat_tien_ich where unit_id = u_a and huy_luc is null limit 1;
  begin
    perform huy_dat_suat(d1);
    raise exception 'FAIL 5: huy duoc luot dat cua can khac';
  exception when insufficient_privilege then null;
  end;

  -- ── 6. Không đặt suất đã qua, và không đặt quá xa ──
  perform set_config('test.uid', a::text, true);
  begin
    perform dat_suat(s2, current_date - 1);
    raise exception 'FAIL 6: dat duoc suat hom qua';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform dat_suat(s2, current_date + 60);
    raise exception 'FAIL 6b: dat duoc suat qua han dat_truoc_ngay';
  exception when sqlstate '22023' then null;
  end;

  -- ── 7. Người ngoài dự án không đặt được ──
  perform set_config('test.uid', la::text, true);
  begin
    perform dat_suat(s2, mai + 2);
    raise exception 'FAIL 7: nguoi khong o can nao dat duoc tien ich';
  exception when insufficient_privilege then null;
  end;

  -- ── 8. BQL đóng suất để bảo trì, và phải ghi lý do ──
  -- Cư dân đóng được suất là cư dân khóa được tiện ích của cả tòa.
  perform set_config('test.uid', a::text, true);
  begin
    perform dong_suat(s3, mai + 4, 'Toi muon giu cho');
    raise exception 'FAIL 8-0: cu dan dong duoc suat';
  exception when insufficient_privilege then null;
  end;
  perform set_config('test.uid', bql::text, true);
  begin
    perform dong_suat(s2, mai + 3, '  ');
    raise exception 'FAIL 8: dong duoc suat ma khong ghi ly do';
  exception when sqlstate '22023' then null;
  end;
  perform dong_suat(s2, mai + 3, 'Ve sinh dinh ky');
  -- Đóng rồi thì cư dân không đặt được nữa — cùng một index chống trùng.
  perform set_config('test.uid', a::text, true);
  begin
    perform dat_suat(s2, mai + 3);
    raise exception 'FAIL 8b: dat duoc suat BQL da dong';
  exception when unique_violation then null;
  end;
  -- Và cư dân không tự mở lại được.
  select id into d1 from dat_tien_ich where suat_id = s2 and ngay = mai + 3 and dong_cua;
  begin
    perform huy_dat_suat(d1);
    raise exception 'FAIL 8c: cu dan mo lai duoc suat BQL da dong';
  exception when insufficient_privilege then null;
  end;
  perform set_config('test.uid', bql::text, true);
  begin
    perform dong_suat(s2, mai + 3, 'Ve sinh lan hai');
    raise exception 'FAIL 8d: dong duoc mot suat da dong';
  exception when unique_violation then null;
  end;

  -- ── 9. Lịch vẽ ĐỦ lưới, và không lộ mã căn của hàng xóm ──
  perform set_config('test.uid', a::text, true);
  -- Ba ngày × bốn suất = 12 ô. Màn hình cần vẽ hết lưới; trả về mỗi ô đã đặt thì
  -- lịch chỉ còn là một danh sách, và người ta không biết chỗ nào trống.
  select count(*) into n from lich_tien_ich(ti, mai, mai + 2);
  if n <> 12 then raise exception 'FAIL 9: lich tra ve % o thay vi 12', n; end if;
  -- Ngày mai+2 chưa ai đặt: bốn ô đều phải hiện ra và đều trống.
  select count(*) into n from lich_tien_ich(ti, mai, mai + 2)
   where ngay = mai + 2 and con_trong;
  if n <> 4 then raise exception 'FAIL 9a: ngay chua ai dat chi hien % o trong', n; end if;
  select count(*) into n from lich_tien_ich(ti, mai, mai) where con_trong;
  if n <> 0 then raise exception 'FAIL 9b: 4 suat deu da dat ma bao con % o trong', n; end if;

  -- Căn A thấy mã căn của CHÍNH MÌNH...
  select ma_can into r from lich_tien_ich(ti, mai, mai) where suat_id = s1;
  if r.ma_can <> 'T1-05.01' then raise exception 'FAIL 9c: khong thay o cua chinh minh'; end if;
  -- ...nhưng KHÔNG thấy mã căn của hàng xóm. Lịch chỉ cần nói ô này đã kín;
  -- ai đặt là chuyện của BQL khi có tranh chấp. Hiện hết là một bảng lịch sinh
  -- hoạt của hàng xóm.
  select ma_can, cua_toi into r from lich_tien_ich(ti, mai, mai) where suat_id = s3;
  if r.ma_can is not null then raise exception 'FAIL 9d: lo ma can cua hang xom (%)', r.ma_can; end if;
  if r.cua_toi then raise exception 'FAIL 9e: bao o cua hang xom la cua minh'; end if;

  -- BQL thì thấy hết — đó là người xử tranh chấp.
  perform set_config('test.uid', bql::text, true);
  select ma_can into r from lich_tien_ich(ti, mai, mai) where suat_id = s3;
  if r.ma_can <> 'T1-05.02' then raise exception 'FAIL 9f: BQL khong thay ai dat'; end if;

  -- ── 10. Tiện ích đóng thì không đặt được ──
  update tien_ich set dang_mo = false where id = ti;
  perform set_config('test.uid', a::text, true);
  begin
    perform dat_suat(s2, mai + 5);
    raise exception 'FAIL 10: dat duoc khi tien ich dang dong';
  exception when check_violation then null;
  end;
  update tien_ich set dang_mo = true where id = ti;

  -- ── 11. Suất đã bắt đầu thì không hủy được ──
  -- Hủy lúc đó chẳng trả chỗ cho ai kịp dùng, mà lại xóa dấu vết là căn này đã
  -- giữ chỗ — tức là lách hạn mức.
  insert into dat_tien_ich (project_id, tien_ich_id, suat_id, ngay, unit_id, phi, dat_boi)
    values (p_t, ti, s1, current_date - 1, u_a, 200000, a) returning id into d1;
  begin
    perform huy_dat_suat(d1);
    raise exception 'FAIL 11: huy duoc suat da qua';
  exception when check_violation then null;
  end;

  raise notice 'TEST TIEN ICH PASSED — trung gio chan o database, han muc theo tuan, huy tra cho ngay, va lich khong lo ma can hang xom';
end $test$;
