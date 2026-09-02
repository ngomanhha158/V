-- Smoke test bình luận và thăm dò trên bảng tin. Chạy sau schema.sql + seed.sql.
--
-- Hai chỗ dễ hỏng mà hỏng thì không ai thấy ngay: một hộ đông người bỏ được
-- nhiều phiếu hơn hộ ít người, và BQL xóa sạch lời chê mà không để lại dấu.

do $test$
declare
  p_bg uuid := 'aaaaaaaa-0000-0000-0000-000000010000';
  b_bg uuid := 'bbbbbbbb-0000-0000-0000-000000010000';
  bql  uuid := '77770000-0000-0000-0000-000000010001';
  ch1  uuid := '77770000-0000-0000-0000-000000010002';  -- chủ hộ căn A
  ch1b uuid := '77770000-0000-0000-0000-000000010003';  -- người nhà CÙNG căn A
  ch2  uuid := '77770000-0000-0000-0000-000000010004';  -- chủ hộ căn B
  u_a uuid; u_b uuid; tb uuid; bl bigint;
  n int; v_chon int; v_ket record;
begin
  insert into projects (id, name) values (p_bg, 'Khu bang tin');
  insert into buildings (id, project_id, code, name) values (b_bg, p_bg, 'G1', 'BG 1');
  insert into units (building_id, code, floor_no) values (b_bg,'G1-02.01',2), (b_bg,'G1-02.02',2);
  select id into u_a from units where building_id = b_bg and code = 'G1-02.01';
  select id into u_b from units where building_id = b_bg and code = 'G1-02.02';

  insert into profiles (id, full_name, phone) values
    (bql,'BQL bang tin','0900000050'), (ch1,'Chu ho A','0900000051'),
    (ch1b,'Nguoi nha A','0900000052'), (ch2,'Chu ho B','0900000053');
  insert into staff_assignments (user_id, project_id, role) values (bql, p_bg,'bql_manager');
  insert into unit_memberships (unit_id, user_id, role, status) values
    (u_a, ch1,'owner','active'), (u_a, ch1b,'family','active'), (u_b, ch2,'owner','active');

  insert into announcements (project_id, title, body, author_id, published_at)
    values (p_bg,'Lap them camera ham B2','Xin y kien cu dan.', bql, now())
    returning id into tb;
  insert into announcement_polls (announcement_id, cau_hoi, lua_chon)
    values (tb, 'Co nen lap them camera ham B2?', array['Dong y','Khong']);

  -- ── 1. MỘT CĂN MỘT PHIẾU ──
  -- Chu ho A bo phieu, roi NGUOI NHA cung can bo phieu khac. Ket qua phai la
  -- MOT phieu cho can A, khong phai hai. Ho bon nguoi lon khong duoc lan phieu
  -- ho mot nguoi.
  perform set_config('test.uid', ch1::text, true);
  perform bo_phieu(tb, u_a, 0);
  perform set_config('test.uid', ch1b::text, true);
  perform bo_phieu(tb, u_a, 1);

  select count(*) into n from announcement_votes where poll_id = tb and unit_id = u_a;
  if n <> 1 then raise exception 'Mot can bo duoc % phieu', n; end if;

  -- Phieu sau de len phieu truoc: doi y duoc, chu khong phai cong them.
  select chon into v_chon from announcement_votes where poll_id = tb and unit_id = u_a;
  if v_chon <> 1 then raise exception 'Phieu sau khong de len phieu truoc: %', v_chon; end if;

  -- ── 2. Đổi phiếu được cho tới khi đóng ──
  -- Nguoi ta doc binh luan roi moi nghi lai — do chinh la ly do dat tham do
  -- canh phan thao luan. Khoa phieu dau tien thi thao luan chi de trang tri.
  perform set_config('test.uid', ch1::text, true);
  perform bo_phieu(tb, u_a, 0);
  select chon into v_chon from announcement_votes where poll_id = tb and unit_id = u_a;
  if v_chon <> 0 then raise exception 'Khong doi lai phieu duoc'; end if;

  -- ── 3. Không bỏ phiếu hộ căn khác ──
  begin
    perform bo_phieu(tb, u_b, 0);
    raise exception 'Bo phieu ho duoc can minh khong thuoc ve';
  exception when sqlstate '42501' then null;
  end;

  -- ── 4. Lựa chọn ngoài danh sách bị từ chối ──
  -- Khong chan thi bang phieu co cot khong ung voi lua chon nao, va tong khong
  -- bao gio khop.
  begin
    perform bo_phieu(tb, u_a, 5);
    raise exception 'Nhan duoc lua chon ngoai danh sach';
  exception when sqlstate '22023' then null;
  end;

  -- ── 5. Kết quả đếm đúng ──
  perform set_config('test.uid', ch2::text, true);
  perform bo_phieu(tb, u_b, 1);

  select so_phieu into n from ket_qua_tham_do(tb) where chon = 0;
  if n <> 1 then raise exception 'Dem sai lua chon 0: %', n; end if;
  select so_phieu into n from ket_qua_tham_do(tb) where chon = 1;
  if n <> 1 then raise exception 'Dem sai lua chon 1: %', n; end if;

  -- ── 6. Cuộc KÍN giấu kết quả với cư dân, nhưng không giấu với BQL ──
  update announcement_polls set kin = true where announcement_id = tb;
  perform set_config('test.uid', ch2::text, true);
  select count(*) into n from ket_qua_tham_do(tb);
  if n <> 0 then raise exception 'Cuoc kin van lo ket qua cho cu dan (% dong)', n; end if;

  perform set_config('test.uid', bql::text, true);
  select count(*) into n from ket_qua_tham_do(tb);
  if n = 0 then raise exception 'BQL cung khong xem duoc ket qua cuoc kin'; end if;

  -- Dong roi thi ai cung xem duoc.
  update announcement_polls set dong_luc = now() - interval '1 minute' where announcement_id = tb;
  perform set_config('test.uid', ch2::text, true);
  select count(*) into n from ket_qua_tham_do(tb);
  if n = 0 then raise exception 'Dong roi ma van giau ket qua'; end if;

  -- ── 7. Đóng rồi thì không bỏ phiếu nữa ──
  begin
    perform bo_phieu(tb, u_b, 0);
    raise exception 'Van bo phieu duoc sau khi dong';
  exception when sqlstate '22023' then null;
  end;

  -- ── 8. BQL ẨN bình luận chứ không XÓA ──
  -- Xoa duoc la BQL xoa sach loi che ma khong de lai dau. An thi dong van con,
  -- nhat ky kiem toan van ghi, va man van hien "da an".
  perform set_config('test.uid', ch1::text, true);
  insert into announcement_comments (announcement_id, author_id, unit_id, body)
    values (tb, ch1, u_a, 'Nen lap ca loi thoat hiem chu khong chi cho de xe.')
    returning id into bl;

  perform set_config('test.uid', bql::text, true);
  update announcement_comments set an_luc = now(), an_boi = bql, an_ly_do = 'Trung lap'
   where id = bl;

  select count(*) into n from announcement_comments where id = bl;
  if n <> 1 then raise exception 'An binh luan lam mat luon dong'; end if;
  select count(*) into n from announcement_comments where id = bl and an_luc is not null;
  if n <> 1 then raise exception 'Khong danh dau duoc la da an'; end if;

  raise notice 'test_banggop.sql OK';
end $test$;
