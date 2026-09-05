-- Smoke test đăng ký chuyển nhà và thi công nội thất. Chạy sau schema.sql + seed.sql.
--
-- Hai lời hứa: (1) tiền ký quỹ của cư dân không bốc hơi giữa hai cột — trừ cộng
-- hoàn luôn bằng đúng số đã nhận; (2) bảo vệ đứng ở sảnh hỏi "xe này có được
-- lên không" thì nhận về một câu trả lời KÈM LÝ DO, vì ba lý do khác nhau dẫn
-- tới ba việc khác nhau.

do $test$
declare
  p_t  uuid := 'aaaaaaaa-0000-0000-0000-000000140000';
  t_t  uuid := 'bbbbbbbb-0000-0000-0000-000000140001';
  bql  uuid := '99990000-0000-0000-0000-000000140001';
  cu   uuid := '99990000-0000-0000-0000-00000014000a';
  cu2  uuid := '99990000-0000-0000-0000-00000014000b';
  con  uuid := '99990000-0000-0000-0000-00000014000c';   -- người nhà
  u1 uuid; u2 uuid; dk uuid; dk2 uuid; kq jsonb;
  mai date := current_date + 1;
  r record; n int; m bigint;
begin
  -- `mai` không rơi vào Chủ nhật: bài kiểm giờ bên dưới nói về NGÀY THƯỜNG, và
  -- một fixture đổi nghĩa theo thứ trong tuần là bài test đỏ vào một sáng nào đó
  -- mà chẳng có gì hỏng — đúng lỗi đã mắc ở test_tienich.
  if extract(isodow from mai) = 7 then mai := mai + 1; end if;

  insert into projects (id, name) values (p_t, 'Khu thi cong');
  insert into buildings (id, project_id, code, name) values (t_t, p_t, 'T1', 'Toa T1');
  insert into units (building_id, code, floor_no) values (t_t,'T1-08.11',8), (t_t,'T1-09.01',9);
  select id into u1 from units where code = 'T1-08.11';
  select id into u2 from units where code = 'T1-09.01';

  insert into profiles (id, full_name, phone) values
    (bql,'Truong BQL T','0900000180'), (cu,'Chu can 8.11','0900000181'),
    (cu2,'Chu can 9.01','0900000182'), (con,'Nguoi nha','0900000183');
  insert into staff_assignments (user_id, project_id, role) values (bql, p_t, 'bql_manager');
  insert into unit_memberships (unit_id, user_id, role, status) values
    (u1, cu, 'owner', 'active'), (u2, cu2, 'owner', 'active'), (u1, con, 'family', 'active');

  -- ── 1. Ai đăng ký được ──
  perform set_config('test.uid', cu2::text, true);
  begin
    perform dang_ky_thi_cong(u1, 'thi_cong', 'Op lat', mai, mai + 14);
    raise exception 'FAIL 1: hang xom dang ky duoc cho can khac';
  exception when sqlstate '42501' then null;
  end;
  -- Người nhà KHÔNG đăng ký được: đây là một cam kết có tiền.
  perform set_config('test.uid', con::text, true);
  begin
    perform dang_ky_thi_cong(u1, 'thi_cong', 'Op lat', mai, mai + 14);
    raise exception 'FAIL 1b: nguoi nha dang ky duoc';
  exception when sqlstate '42501' then null;
  end;
  perform set_config('test.uid', cu::text, true);
  begin
    perform dang_ky_thi_cong(u1, 'thi_cong', '   ', mai, mai + 14);
    raise exception 'FAIL 1c: dang ky duoc ma khong ghi hang muc';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform dang_ky_thi_cong(u1, 'thi_cong', 'Op lat', current_date - 3, mai);
    raise exception 'FAIL 1d: dang ky duoc cho ngay da qua';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform dang_ky_thi_cong(u1, 'thi_cong', 'Op lat', mai + 5, mai);
    raise exception 'FAIL 1e: nhan duoc khoang ngay nguoc chieu';
  exception when check_violation then null;
  end;

  dk := dang_ky_thi_cong(u1, 'thi_cong', 'Op lat, thach cao', mai, mai + 14,
                         time '08:00', time '17:00', 'Noi that Nam Long', '0912345678', 4);

  -- ── 2. Một căn một đăng ký còn hiệu lực ──
  -- Hai giấy phép chồng nhau là hai bộ giờ khác nhau cho cùng một căn, và bảo vệ
  -- ở sảnh không biết theo cái nào.
  begin
    perform dang_ky_thi_cong(u1, 'chuyen_vao', 'Chuyen do', mai, mai);
    raise exception 'FAIL 2: mot can co hai dang ky con hieu luc';
  exception when unique_violation then null;
  end;

  -- ── 3. CHƯA DUYỆT thì chưa được gì ──
  select duoc, ly_do into r from duoc_thi_cong(dk, ((mai + time '10:00') at time zone 'Asia/Ho_Chi_Minh'));
  if r.duoc then raise exception 'FAIL 3: chua duyet ma da duoc thi cong'; end if;
  if r.ly_do not like '%Chưa được ban quản lý duyệt%' then
    raise exception 'FAIL 3b: ly do khong noi dung viec phai lam: %', r.ly_do;
  end if;

  -- ── 4. Duyệt: chỉ BQL, và BQL siết được giờ ──
  perform set_config('test.uid', cu::text, true);
  begin
    perform duyet_thi_cong(dk, 0);
    raise exception 'FAIL 4: cu dan tu duyet don cua minh';
  exception when sqlstate '42501' then null;
  end;
  perform set_config('test.uid', bql::text, true);
  -- Siết giờ từ 08–17 xuống 08–16, và ghi thẳng vào giấy phép chứ không nhắn riêng.
  perform duyet_thi_cong(dk, 10000000, time '08:00', time '16:00', false);
  select trang_thai, gio_ket_thuc, ky_quy_phai_nop into r from dang_ky_thi_cong where id = dk;
  if r.trang_thai <> 'da_duyet' then raise exception 'FAIL 4b: trang thai la %', r.trang_thai; end if;
  if r.gio_ket_thuc <> time '16:00' then
    raise exception 'FAIL 4c: BQL siet gio ma khong ghi vao giay phep (%)', r.gio_ket_thuc;
  end if;
  begin
    perform duyet_thi_cong(dk, 5000000);
    raise exception 'FAIL 4d: duyet duoc hai lan';
  exception when check_violation then null;
  end;

  -- ── 5. KÝ QUỸ LÀ CƠ CHẾ, không phải con số ──
  -- Duyệt rồi nhưng chưa nộp thì giấy phép chưa có hiệu lực.
  select duoc, ly_do into r from duoc_thi_cong(dk, ((mai + time '10:00') at time zone 'Asia/Ho_Chi_Minh'));
  if r.duoc then raise exception 'FAIL 5: chua nop ky quy ma da duoc thi cong'; end if;
  if r.ly_do not like '%ký quỹ%' then
    raise exception 'FAIL 5b: ly do khong noi la thieu ky quy: %', r.ly_do;
  end if;
  -- Số tiền phải viết theo lối Việt. Người bảo vệ đọc dòng này khi đang đứng
  -- trước một xe tải, không phải lúc ngồi đếm số 0.
  if r.ly_do not like '%10.000.000đ%' then
    raise exception 'FAIL 5b1: so tien khong dinh dang theo loi Viet: %', r.ly_do;
  end if;
  -- Nộp làm hai lần là chuyện thường; ghi đè thì lần đầu biến mất.
  perform set_config('test.uid', cu::text, true);
  begin
    perform ghi_ky_quy(dk, 1000000);
    raise exception 'FAIL 5c: cu dan tu ghi nhan ky quy';
  exception when sqlstate '42501' then null;
  end;
  perform set_config('test.uid', bql::text, true);
  m := ghi_ky_quy(dk, 6000000);
  m := ghi_ky_quy(dk, 4000000);
  if m <> 10000000 then raise exception 'FAIL 5d: nop hai lan ra % thay vi 10000000', m; end if;

  -- ── 6. ĐƯỢC hay KHÔNG, và VÌ SAO không ──
  select duoc, ly_do into r from duoc_thi_cong(dk, ((mai + time '10:00') at time zone 'Asia/Ho_Chi_Minh'));
  if not r.duoc then raise exception 'FAIL 6: du dieu kien ma van khong duoc (%)', r.ly_do; end if;
  -- Ngoài giờ: 16:30 sau khi BQL siết xuống 16:00.
  select duoc, ly_do into r from duoc_thi_cong(dk, ((mai + time '16:30') at time zone 'Asia/Ho_Chi_Minh'));
  if r.duoc then raise exception 'FAIL 6b: 16:30 van duoc trong khi gio den 16:00'; end if;
  if r.ly_do not like '%Ngoài giờ%' or r.ly_do not like '%16:00%' then
    raise exception 'FAIL 6c: ly do ngoai gio khong noi khung gio duoc phep: %', r.ly_do;
  end if;
  -- Trước giờ cũng là ngoài giờ: đục tường lúc 6 giờ sáng là đúng chuyện hàng
  -- xóm gọi bảo vệ nhiều nhất.
  select duoc into r from duoc_thi_cong(dk, ((mai + time '06:00') at time zone 'Asia/Ho_Chi_Minh'));
  if r.duoc then raise exception 'FAIL 6d: 6 gio sang van duoc thi cong'; end if;
  -- Chưa tới ngày / quá hạn.
  select duoc, ly_do into r from duoc_thi_cong(dk, ((current_date + time '10:00') at time zone 'Asia/Ho_Chi_Minh'));
  if r.duoc then raise exception 'FAIL 6e: hom nay chua toi ngay ma da duoc'; end if;
  if r.ly_do not like '%Chưa tới ngày%' then
    raise exception 'FAIL 6f: ly do sai khi chua toi ngay: %', r.ly_do;
  end if;
  select duoc, ly_do into r from duoc_thi_cong(dk, ((mai + 30 + time '10:00') at time zone 'Asia/Ho_Chi_Minh'));
  if r.duoc then raise exception 'FAIL 6g: qua han ma van duoc'; end if;
  if r.ly_do not like '%quá hạn%' then
    raise exception 'FAIL 6h: ly do sai khi qua han: %', r.ly_do;
  end if;

  -- ── 6b. Giờ cho phép là giờ ĐỒNG HỒ VIỆT NAM, không phải giờ máy chủ ──
  -- Railway chạy máy chủ ở UTC. Đọc giờ theo giờ máy chủ thì 10 giờ sáng ở Việt
  -- Nam thành 3 giờ sáng trong mắt hệ thống, và mọi khung giờ lệch đi 7 tiếng.
  select duoc into r from duoc_thi_cong(dk, (mai + time '10:00')::timestamptz);
  select duoc, ly_do into r from duoc_thi_cong(
    dk, ((mai + time '10:00') at time zone 'Asia/Ho_Chi_Minh'));
  if not r.duoc then
    raise exception 'FAIL 6i: 10 gio sang gio VN bi tinh theo gio may chu (%)', r.ly_do;
  end if;
  -- Cùng một khoảnh khắc, viết bằng UTC: phải cho ra CÙNG một câu trả lời.
  select duoc into r from duoc_thi_cong(
    dk, ((mai + time '03:00') at time zone 'UTC'));
  if not r.duoc then
    raise exception 'FAIL 6j: cung mot khoanh khac ma tra loi khac nhau tuy cach viet';
  end if;

  -- ── 7. Chủ nhật mặc định KHÔNG được ──
  declare cn date := mai;
  begin
    while extract(isodow from cn) <> 7 loop cn := cn + 1; end loop;
    if cn <= mai + 14 then
      select duoc, ly_do into r from duoc_thi_cong(dk, ((cn + time '10:00') at time zone 'Asia/Ho_Chi_Minh'));
      if r.duoc then raise exception 'FAIL 7: chu nhat van duoc thi cong'; end if;
      if r.ly_do not like '%Chủ nhật%' then
        raise exception 'FAIL 7b: ly do chu nhat sai: %', r.ly_do;
      end if;
      -- Bật cho phép thì được, và cái bật đó nằm lại trong hồ sơ.
      update dang_ky_thi_cong set lam_chu_nhat = true where id = dk;
      select duoc into r from duoc_thi_cong(dk, ((cn + time '10:00') at time zone 'Asia/Ho_Chi_Minh'));
      if not r.duoc then raise exception 'FAIL 7c: bat lam chu nhat ma van bi chan'; end if;
      update dang_ky_thi_cong set lam_chu_nhat = false where id = dk;
    end if;
  end;

  -- ── 8. TẤT TOÁN: trừ + hoàn = đã nộp, và trừ phải có lý do ──
  begin
    perform tat_toan_thi_cong(dk, 3000000, null);
    raise exception 'FAIL 8: tru tien ma khong ghi ly do';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform tat_toan_thi_cong(dk, 99000000, 'Tru nhieu hon da nop');
    raise exception 'FAIL 8b: tru nhieu hon so da nhan';
  exception when check_violation then
    -- Soi CÂU LỖI, không chỉ mã lỗi: ràng buộc ở tầng bảng cũng chặn được ca
    -- này, nhưng nó ném ra một câu tên-ràng-buộc mà kế toán không đọc được.
    -- Câu của hàm nói ra đang giữ bao nhiêu, tức là nói ra trừ tối đa được mấy.
    if sqlerrm not like '%chi nhan ky quy 10000000%' then
      raise exception 'FAIL 8b1: chan dung nhung khong noi dang giu bao nhieu: %', sqlerrm;
    end if;
  end;
  kq := tat_toan_thi_cong(dk, 3000000, 'Xuoc san thang may, chi phi danh bong');
  if (kq ->> 'tru')::bigint <> 3000000 or (kq ->> 'hoan')::bigint <> 7000000 then
    raise exception 'FAIL 8c: tat toan tra ve tru % hoan %', kq ->> 'tru', kq ->> 'hoan';
  end if;
  select ky_quy_tru, ky_quy_hoan, ky_quy_da_nop, trang_thai into r
    from dang_ky_thi_cong where id = dk;
  if r.ky_quy_tru + r.ky_quy_hoan <> r.ky_quy_da_nop then
    raise exception 'FAIL 8d: tru + hoan (% + %) khac da nop %',
      r.ky_quy_tru, r.ky_quy_hoan, r.ky_quy_da_nop;
  end if;
  if r.trang_thai <> 'hoan_thanh' then raise exception 'FAIL 8e: trang thai %', r.trang_thai; end if;
  -- Đã tất toán thì giấy phép hết hiệu lực.
  select duoc into r from duoc_thi_cong(dk, ((mai + time '10:00') at time zone 'Asia/Ho_Chi_Minh'));
  if r.duoc then raise exception 'FAIL 8f: da hoan thanh ma van duoc thi cong'; end if;
  begin
    perform tat_toan_thi_cong(dk, 0, null);
    raise exception 'FAIL 8g: tat toan duoc hai lan';
  exception when check_violation then null;
  end;

  -- ── 9. Không hủy khi còn giữ tiền của người ta ──
  perform set_config('test.uid', cu2::text, true);
  dk2 := dang_ky_thi_cong(u2, 'chuyen_vao', 'Chuyen do vao', mai, mai);
  perform set_config('test.uid', bql::text, true);
  perform duyet_thi_cong(dk2, 5000000);
  perform ghi_ky_quy(dk2, 5000000);
  begin
    perform huy_thi_cong(dk2, 'Doi y');
    raise exception 'FAIL 9: huy duoc khi con giu 5 trieu ky quy';
  exception when check_violation then null;
  end;
  perform tat_toan_thi_cong(dk2, 0, null);
  -- Tất toán rồi thì đã khép, không hủy nữa.
  begin
    perform huy_thi_cong(dk2, 'Doi y');
    raise exception 'FAIL 9b: huy duoc dang ky da hoan thanh';
  exception when sqlstate '23505' then null;
  end;

  -- ── 10. Từ chối phải ghi lý do ──
  perform set_config('test.uid', cu::text, true);
  dk := dang_ky_thi_cong(u1, 'thi_cong', 'Dot tuong', mai, mai + 3);
  perform set_config('test.uid', bql::text, true);
  begin
    perform tu_choi_thi_cong(dk, '  ');
    raise exception 'FAIL 10: tu choi ma khong ghi ly do';
  exception when sqlstate '22023' then null;
  end;
  perform tu_choi_thi_cong(dk, 'Dot tuong chiu luc phai co ho so ket cau');
  select trang_thai, ly_do_tu_choi into r from dang_ky_thi_cong where id = dk;
  if r.trang_thai <> 'tu_choi' or r.ly_do_tu_choi is null then
    raise exception 'FAIL 10b: tu choi khong luu lai ly do';
  end if;
  -- Bị từ chối rồi thì căn đó đăng ký lại được — đơn cũ không chặn đơn mới.
  perform set_config('test.uid', cu::text, true);
  dk := dang_ky_thi_cong(u1, 'thi_cong', 'Op lat lai', mai, mai + 5);
  if dk is null then raise exception 'FAIL 10c: bi tu choi roi khong nop lai duoc'; end if;

  -- ── 11. Màn bảo vệ và màn cư dân ──
  perform set_config('test.uid', bql::text, true);
  select count(*) into n from thi_cong_ds(p_t, null);
  if n < 4 then raise exception 'FAIL 11: BQL thay % dang ky, it hon thuc te', n; end if;
  select count(*) into n from thi_cong_ds(p_t, 'cho_duyet');
  if n <> 1 then raise exception 'FAIL 11b: loc cho_duyet ra % thay vi 1', n; end if;
  perform set_config('test.uid', cu::text, true);
  select count(*) into n from thi_cong_cua_toi();
  -- Căn 8.11 có ba đơn: một đã hoàn thành, một bị từ chối, một đang chờ duyệt.
  if n <> 3 then raise exception 'FAIL 11c: cu dan thay % dang ky cua can minh thay vi 3', n; end if;
  select count(*) into n from thi_cong_cua_toi() where unit_id = u2;
  if n <> 0 then raise exception 'FAIL 11d: cu dan thay dang ky cua can hang xom'; end if;

  -- ── 12. Neo vào nhật ký kiểm toán ──
  select count(*) into n from audit_log where bang = 'dang_ky_thi_cong';
  if n = 0 then raise exception 'FAIL 12: dang ky thi cong khong vao nhat ky'; end if;

  -- ── 13. RLS: hàng xóm không đọc được đăng ký của nhau ──
  begin execute 'create role vb_tc_test nologin'; exception when duplicate_object then null; end;
  execute 'grant usage on schema public to vb_tc_test';
  execute 'grant select on dang_ky_thi_cong to vb_tc_test';
  execute 'grant execute on function is_staff(uuid), current_unit_ids() to vb_tc_test';
  execute 'set local role vb_tc_test';

  perform set_config('test.uid', cu::text, true);
  select count(*) into n from dang_ky_thi_cong;
  if n <> 3 then raise exception 'FAIL 13: cu dan doc duoc % dong thay vi 3 cua can minh', n; end if;
  select count(*) into n from dang_ky_thi_cong where unit_id = u2;
  if n <> 0 then raise exception 'FAIL 13b: cu dan doc duoc dang ky cua can hang xom'; end if;
  perform set_config('test.uid', bql::text, true);
  select count(*) into n from dang_ky_thi_cong;
  if n <> 4 then raise exception 'FAIL 13c: BQL doc duoc % dong thay vi 4', n; end if;
  execute 'reset role';

  raise notice 'TEST THI CONG PASSED — ky quy tru + hoan = da nop, gio duoc phep la mot luat, va moi cau tu choi deu kem ly do';
end $test$;
