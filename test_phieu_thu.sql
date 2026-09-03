-- Smoke test phiếu thu điện tử. Chạy sau schema.sql + seed.sql.
--
-- Một số chứng từ chỉ có giá trị nếu dãy số KÍN. Bài này kiểm đúng lời hứa đó,
-- và kiểm cả cái tinh vi hơn: phiếu phải cân với số tiền ngân hàng báo, chứ
-- không phải với số tiền gạch được — hai con số đó khác nhau khi có tiền thừa,
-- và cư dân là người cầm cả hai tờ để so.

do $test$
declare
  p_q   uuid := 'aaaaaaaa-0000-0000-0000-000000040000';
  t_q   uuid := 'bbbbbbbb-0000-0000-0000-000000040001';
  bql   uuid := '99990000-0000-0000-0000-000000040001';
  o_a   uuid := '99990000-0000-0000-0000-00000004000a';
  o_b   uuid := '99990000-0000-0000-0000-00000004000b';
  o_c   uuid := '99990000-0000-0000-0000-00000004000c';
  o_d   uuid := '99990000-0000-0000-0000-00000004000d';
  nha_a uuid := '99990000-0000-0000-0000-00000004000e';  -- người nhà, không xem tiền
  la    uuid := '99990000-0000-0000-0000-00000004000f';  -- người ngoài
  ft    uuid;
  u_a uuid; u_b uuid; u_c uuid; u_d uuid;
  hd_a uuid; hd_b uuid; hd_c uuid;
  tx uuid; tx2 uuid; tx3 uuid; tx4 uuid; tx_bo uuid;
  ph uuid; ph2 uuid; ph_c uuid;
  v_ky date := date_trunc('month', current_date)::date;
  tien_to text;
  r record; n int; m bigint; s text;
begin
  tien_to := 'PT-' || to_char(v_ky, 'YYMM') || '-';

  insert into projects (id, name) values (p_q, 'Khu phieu thu');
  insert into buildings (id, project_id, code, name) values (t_q, p_q, 'Q1', 'Toa Q1');
  insert into units (building_id, code, floor_no) values
    (t_q,'Q1-12.04',12), (t_q,'Q1-12.05',12), (t_q,'Q1-12.06',12), (t_q,'Q1-12.07',12);
  select id into u_a from units where building_id = t_q and code = 'Q1-12.04';
  select id into u_b from units where building_id = t_q and code = 'Q1-12.05';
  select id into u_c from units where building_id = t_q and code = 'Q1-12.06';
  select id into u_d from units where building_id = t_q and code = 'Q1-12.07';

  insert into profiles (id, full_name, phone) values
    (bql,'BQL phieu thu','0900000080'),
    (o_a,'Tran Thi Bich Ngoc','0900000081'), (o_b,'Chu ho B','0900000082'),
    (o_c,'Chu ho C','0900000083'),           (o_d,'Chu ho D','0900000084'),
    (nha_a,'Nguoi nha cua A','0900000085'),  (la,'Nguoi la','0900000086');
  insert into staff_assignments (user_id, project_id, role) values (bql, p_q, 'bql_manager');
  insert into unit_memberships (unit_id, user_id, role, status) values
    (u_a,o_a,'owner','active'), (u_b,o_b,'owner','active'),
    (u_c,o_c,'owner','active'), (u_d,o_d,'owner','active'),
    (u_a,nha_a,'family','active');

  insert into fee_types (project_id, code, name, calc_method, unit_price)
    values (p_q, 'QLY-Q', 'Phi quan ly', 'per_m2', 12000) returning id into ft;

  -- Hóa đơn A: trả TRỌN trong một lần → phải có chi tiết từng khoản phí
  insert into invoices (unit_id, project_id, period, total_amount, status, due_date)
    values (u_a, p_q, date '2026-09-01', 1406000, 'issued', date '2026-09-15')
    returning id into hd_a;
  insert into invoice_lines (invoice_id, fee_type_id, description, quantity, unit_price, amount)
    values (hd_a, ft, 'Phi quan ly 09/2026', 1, 1287000, 1287000),
           (hd_a, ft, 'Nuoc 14 m3',          1,  119000,  119000);

  -- Hóa đơn B: chỉ trả một phần
  insert into invoices (unit_id, project_id, period, total_amount, status, due_date)
    values (u_b, p_q, date '2026-09-01', 2000000, 'issued', date '2026-09-15')
    returning id into hd_b;
  insert into invoice_lines (invoice_id, fee_type_id, description, quantity, unit_price, amount)
    values (hd_b, ft, 'Phi quan ly 09/2026', 1, 2000000, 2000000);

  -- Hóa đơn C: trả THỪA
  insert into invoices (unit_id, project_id, period, total_amount, status, due_date)
    values (u_c, p_q, date '2026-09-01', 500000, 'issued', date '2026-09-15')
    returning id into hd_c;
  insert into invoice_lines (invoice_id, fee_type_id, description, quantity, unit_price, amount)
    values (hd_c, ft, 'Phi quan ly 09/2026', 1, 500000, 500000);

  -- ── 1. Gạch nợ đẻ ra phiếu thu, ngay trong cùng lời gọi ──
  -- Để app gọi thêm một lượt sau khi gạch thì webhook ngân hàng — đường mà 99%
  -- tiền đi qua — sẽ không bao giờ gọi lượt đó.
  insert into bank_transactions (project_id, provider, provider_ref, bank_ref, amount,
                                 content, paid_at)
    values (p_q,'test','PT-REF-1','FT001', 1406000, 'Q1-12.04 phi thang 9',
            timestamptz '2026-09-03 09:12+07') returning id into tx;
  select (gach_no(tx, u_a, 'ma_can') ->> 'phieu_thu')::uuid into ph;
  if ph is null then raise exception 'FAIL 1: gach no xong khong co phieu thu'; end if;

  select * into r from phieu_thu where id = ph;
  if r.so_phieu <> tien_to || '0001' then
    raise exception 'FAIL 1b: so phieu dau tien phai la %0001, nhan duoc %', tien_to, r.so_phieu;
  end if;
  if r.tong_thu <> 1406000 then raise exception 'FAIL 1c: tong thu sai (%)', r.tong_thu; end if;
  -- Tên người nộp CHÉP vào phiếu, không join lúc đọc.
  if r.nguoi_nop <> 'Tran Thi Bich Ngoc' then
    raise exception 'FAIL 1d: khong chep ten nguoi nop (%)', r.nguoi_nop;
  end if;
  if r.ma_can <> 'Q1-12.04' then raise exception 'FAIL 1e: khong chep ma can'; end if;
  -- Ngày trên phiếu là ngày TIỀN VỀ, không phải ngày lập.
  if r.nhan_luc <> timestamptz '2026-09-03 09:12+07' then
    raise exception 'FAIL 1f: phieu ghi ngay lap thay vi ngay tien ve';
  end if;

  -- ── 2. Trả trọn hóa đơn thì phiếu liệt kê từng khoản phí ──
  select count(*) into n from phieu_thu_dong where phieu_id = ph and loai = 'chi_tiet';
  if n <> 2 then raise exception 'FAIL 2: tra tron ma khong liet ke phi (% dong)', n; end if;
  -- Và chúng phải cộng đúng bằng dòng hóa đơn ở trên. Lệch là tờ phiếu tự mâu
  -- thuẫn với chính nó, thứ kế toán nhìn ra ngay còn hệ thống thì không.
  select sum(so_tien) into m from phieu_thu_dong where phieu_id = ph and loai = 'chi_tiet';
  select so_tien into r from phieu_thu_dong where phieu_id = ph and loai = 'hoa_don';
  if m <> r.so_tien then
    raise exception 'FAIL 2b: chi tiet phi (%) khong cong bang dong hoa don (%)', m, r.so_tien;
  end if;
  -- Tổng phiếu KHÔNG được cộng dòng chi tiết vào (nếu không sẽ ra gấp đôi).
  select sum(so_tien) into m from phieu_thu_dong
   where phieu_id = ph and loai <> 'chi_tiet';
  select tong_thu into r from phieu_thu where id = ph;
  if m <> r.tong_thu then raise exception 'FAIL 2c: phieu khong can (% vs %)', m, r.tong_thu; end if;

  -- ── 3. SỐ ĐÃ CẤP MÀ TRANSACTION HỎNG THÌ PHẢI TRẢ LẠI ──
  -- Đây là lý do không dùng sequence. nextval() cố ý nằm ngoài transaction, nên
  -- một lần rollback là mất luôn số đó và dãy thủng một lỗ vĩnh viễn.
  insert into bank_transactions (project_id, provider, provider_ref, amount, content, paid_at)
    values (p_q,'test','PT-REF-HONG', 111000, 'roi se rollback', now())
    returning id into tx_bo;
  update bank_transactions set unit_id = u_d, con_du = 111000 where id = tx_bo;
  begin
    perform lap_phieu_thu(tx_bo);
    raise exception 'ROLLBACK_CO_Y';
  exception when raise_exception then
    if sqlerrm <> 'ROLLBACK_CO_Y' then raise; end if;
  end;
  select so_cuoi into n from phieu_thu_dem where project_id = p_q and ky = v_ky;
  if n <> 1 then raise exception 'FAIL 3: rollback roi ma bo dem van la % (phai ve 1)', n; end if;

  -- ── 4. Trả một phần: KHÔNG bịa ra phép phân bổ vào từng khoản phí ──
  insert into bank_transactions (project_id, provider, provider_ref, amount, content, paid_at)
    values (p_q,'test','PT-REF-2', 900000, 'Q1-12.05 tra bot', now()) returning id into tx2;
  select (gach_no(tx2, u_b, 'ma_can') ->> 'phieu_thu')::uuid into ph2;
  select so_phieu into s from phieu_thu where id = ph2;
  if s <> tien_to || '0002' then
    raise exception 'FAIL 4: so phieu khong lien tiep sau rollback (%)', s;
  end if;
  select count(*) into n from phieu_thu_dong where phieu_id = ph2 and loai = 'chi_tiet';
  if n <> 0 then raise exception 'FAIL 4b: tra mot phan ma van liet ke phi'; end if;
  select dien_giai into s from phieu_thu_dong where phieu_id = ph2 and loai = 'hoa_don';
  if s not like '%1.100.000đ%' then
    raise exception 'FAIL 4c: khong noi ro con thieu bao nhieu (%)', s;
  end if;

  -- ── 5. Trả thừa: phiếu ghi ĐỦ SỐ NGÂN HÀNG BÁO ──
  -- Ghi mỗi phần gạch được thì cư dân so tờ phiếu với app ngân hàng thấy lệch,
  -- và kết luận hợp lý nhất của họ là hệ thống nuốt mất tiền.
  insert into bank_transactions (project_id, provider, provider_ref, amount, content, paid_at)
    values (p_q,'test','PT-REF-3', 800000, 'Q1-12.06 tra du', now()) returning id into tx3;
  select (gach_no(tx3, u_c, 'ma_can') ->> 'phieu_thu')::uuid into ph_c;
  ph := ph_c;
  select tong_thu into m from phieu_thu where id = ph;
  if m <> 800000 then raise exception 'FAIL 5: phieu ghi % thay vi 800000', m; end if;
  select so_tien into m from phieu_thu_dong where phieu_id = ph and loai = 'nop_truoc';
  if m <> 300000 then raise exception 'FAIL 5b: phan nop truoc sai (%)', m; end if;

  -- ── 6. Không nợ đồng nào vẫn có phiếu ──
  -- Chuyển nhầm, hoặc nộp trước cả năm. Không đẻ phiếu thì tiền đã vào tài
  -- khoản mà người nộp không có gì chứng minh là mình đã nộp.
  insert into bank_transactions (project_id, provider, provider_ref, amount, content, paid_at)
    values (p_q,'test','PT-REF-4', 300000, 'Q1-12.07 nop truoc', now()) returning id into tx4;
  select (gach_no(tx4, u_d, 'ma_can') ->> 'phieu_thu')::uuid into ph;
  if ph is null then raise exception 'FAIL 6: khong no thi khong lap phieu'; end if;
  select count(*) into n from phieu_thu_dong where phieu_id = ph;
  if n <> 1 then raise exception 'FAIL 6b: phieu nop truoc phai co dung 1 dong (%)', n; end if;

  -- ── 7. Một lần tiền về, một phiếu ──
  -- Webhook nào cũng retry. Gọi lại phải trả về đúng phiếu cũ, không cấp số mới.
  select so_cuoi into n from phieu_thu_dem where project_id = p_q and ky = v_ky;
  if lap_phieu_thu(tx4) <> ph then raise exception 'FAIL 7: goi lai de ra phieu khac'; end if;
  select so_cuoi into m from phieu_thu_dem where project_id = p_q and ky = v_ky;
  if m <> n then raise exception 'FAIL 7b: goi lai tieu them mot so chung tu'; end if;

  -- ── 8. Dãy số kín, và bộ dò lỗ trống KHÔNG rỗng một cách vô nghĩa ──
  perform set_config('test.uid', bql::text, true);
  select count(*) into n from kiem_lien_tuc_phieu_thu(p_q, v_ky);
  if n <> 0 then raise exception 'FAIL 8: day so bi thung % lo', n; end if;
  -- Chọc thủng một lỗ để chứng minh bộ dò thật sự dò. Không có bước này thì
  -- câu assert trên xanh kể cả khi hàm luôn trả về rỗng.
  delete from phieu_thu where id = ph2;
  select count(*) into n from kiem_lien_tuc_phieu_thu(p_q, v_ky);
  if n <> 1 then raise exception 'FAIL 8b: xoa mot phieu ma bo do khong thay'; end if;
  select thieu_stt into n from kiem_lien_tuc_phieu_thu(p_q, v_ky);
  if n <> 2 then raise exception 'FAIL 8c: chi sai vao so % thay vi 2', n; end if;

  -- ── 9. Hủy phiếu: cần lý do, không đụng tiền, không dùng lại số ──
  -- Hủy đúng cái phiếu CÓ gạch vào một hóa đơn thật (căn C, hd_c). Hủy phiếu
  -- của căn không nợ gì thì câu kiểm "tiền không đổi" bên dưới xanh kể cả khi
  -- hàm hủy có xóa sạch tiền — nó chẳng có hóa đơn nào để xóa.
  ph := ph_c;
  begin
    perform huy_phieu_thu(ph, '   ');
    raise exception 'FAIL 9: huy duoc phieu ma khong ghi ly do';
  exception when sqlstate '22023' then null;
  end;
  select paid_amount into m from invoices where id = hd_c;
  if m <> 500000 then raise exception 'FAIL 9a: chuan bi sai, hd_c chua duoc gach du'; end if;
  perform huy_phieu_thu(ph, 'Ghi nham can, se gach lai cho Q1-12.06');
  select huy_luc, ly_do_huy into r from phieu_thu where id = ph;
  if r.huy_luc is null then raise exception 'FAIL 9b: huy roi ma khong danh dau'; end if;
  select paid_amount into n from invoices where id = hd_c;
  if n <> m then raise exception 'FAIL 9c: huy phieu ma tien cua hoa don doi theo'; end if;
  -- Hủy lần hai phải từ chối: hai lần hủy là hai dòng nhật ký cho một việc.
  begin
    perform huy_phieu_thu(ph, 'huy lan hai');
    raise exception 'FAIL 9d: huy duoc phieu da huy';
  exception when unique_violation then null;
  end;
  -- Số của phiếu đã hủy KHÔNG quay lại vòng cấp phát.
  select stt into n from phieu_thu where id = ph;
  insert into bank_transactions (project_id, provider, provider_ref, amount, content, paid_at)
    values (p_q,'test','PT-REF-5', 50000, 'sau khi huy', now()) returning id into tx;
  -- Gọi gach_no vào BIẾN trước rồi mới truy vấn: đặt thẳng vào mệnh đề where là
  -- Postgres chạy lại hàm cho từng dòng của bảng.
  select (gach_no(tx, u_d, 'thu_cong') ->> 'phieu_thu')::uuid into ph;
  select stt into m from phieu_thu where id = ph;
  if m = n then raise exception 'FAIL 9e: cap lai so cua phieu da huy (%)', n; end if;

  -- ── 10. Phiếu không cân thì KHÔNG được phép tồn tại ──
  -- Dựng đúng cái trạng thái lệch mà chốt tự kiểm sinh ra để chặn: sổ tiền về
  -- báo 500.000đ nhưng chỉ 400.000đ có chỗ đứng trong phiếu. Không có chốt đó
  -- thì hệ thống lặng lẽ in ra một tờ chứng từ thiếu 100.000đ, và người phát
  -- hiện ra sẽ là kế toán, ba tuần sau, lúc cộng tay không khớp.
  insert into bank_transactions (project_id, provider, provider_ref, amount, content,
                                 paid_at, trang_thai, unit_id, con_du)
    values (p_q,'test','PT-REF-LECH', 500000, 'so sach lech', now(), 'da_khop', u_d, 400000)
    returning id into tx;
  begin
    perform lap_phieu_thu(tx);
    raise exception 'FAIL 10: lap duoc phieu thu khong can';
  exception when sqlstate '23514' then null;
  end;
  if exists (select 1 from phieu_thu where bank_txn_id = tx) then
    raise exception 'FAIL 10b: phieu khong can van nam lai trong so';
  end if;

  -- ── 11. RLS: phiếu thu theo ĐÚNG luật của hóa đơn, không nới ra ──
  begin execute 'create role vb_pt_test nologin'; exception when duplicate_object then null; end;
  execute 'grant usage on schema public to vb_pt_test';
  execute 'grant select on phieu_thu, phieu_thu_dong, invoices to vb_pt_test';
  execute 'grant execute on function xem_duoc_tien_cua_can(uuid) to vb_pt_test';
  execute 'grant execute on function is_staff(uuid) to vb_pt_test';
  execute 'set local role vb_pt_test';

  perform set_config('test.uid', o_a::text, true);
  select count(*) into n from phieu_thu where unit_id = u_a;
  if n < 1 then raise exception 'FAIL 11: chu ho khong doc duoc phieu cua chinh minh'; end if;

  -- Người nhà không được bật can_view_finance: không thấy hóa đơn thì cũng
  -- không được thấy phiếu thu của chính hóa đơn đó. Đây là cửa sau vào cùng
  -- một con số, và nó chỉ đóng nếu hai bảng dùng CHUNG một luật.
  perform set_config('test.uid', nha_a::text, true);
  select count(*) into n from invoices where unit_id = u_a;
  if n <> 0 then raise exception 'FAIL 11b: nguoi nha thay hoa don (test tu mau thuan)'; end if;
  select count(*) into n from phieu_thu where unit_id = u_a;
  if n <> 0 then raise exception 'FAIL 11c: nguoi nha khong xem duoc hoa don nhung doc duoc phieu thu'; end if;
  select count(*) into n from phieu_thu_dong;
  if n <> 0 then raise exception 'FAIL 11d: doc thang phieu_thu_dong la vong qua duoc RLS'; end if;

  perform set_config('test.uid', la::text, true);
  select count(*) into n from phieu_thu;
  if n <> 0 then raise exception 'FAIL 11e: nguoi ngoai doc duoc % phieu thu', n; end if;

  execute 'reset role';
  raise notice 'TEST PHIEU THU PASSED — day so kin ke ca khi rollback, phieu can voi so tien ngan hang bao, huy khong dung tien va khong tra lai so';
end $test$;
