-- Smoke test nhận hàng hộ. Chạy sau schema.sql + seed.sql.
--
-- Điểm mấu chốt của tính năng KHÔNG phải lúc nhận mà lúc TRAO: "đã nhận một
-- kiện cho căn P1-12.04" thì sổ giấy cũng ghi được. Thứ sổ giấy không làm được
-- là chứng minh đã trao cho AI. Bài này kiểm đúng chỗ đó.

do $test$
declare
  p_h  uuid := 'aaaaaaaa-0000-0000-0000-000000080000';
  t_h  uuid := 'bbbbbbbb-0000-0000-0000-000000080001';
  bv   uuid := '99990000-0000-0000-0000-000000080001';
  chu  uuid := '99990000-0000-0000-0000-00000008000a';
  nha  uuid := '99990000-0000-0000-0000-00000008000b';
  cu   uuid := '99990000-0000-0000-0000-00000008000c';   -- hợp đồng đã hết
  hx   uuid := '99990000-0000-0000-0000-00000008000d';   -- hàng xóm
  u_a uuid; u_b uuid;
  k1 uuid; k2 uuid; k3 uuid;
  r record; n int;
begin
  insert into projects (id, name) values (p_h, 'Khu nhan hang');
  insert into buildings (id, project_id, code, name) values (t_h, p_h, 'H1', 'Toa H1');
  insert into units (building_id, code, floor_no) values (t_h,'H1-12.04',12), (t_h,'H1-07.09',7);
  select id into u_a from units where building_id = t_h and code = 'H1-12.04';
  select id into u_b from units where building_id = t_h and code = 'H1-07.09';

  insert into profiles (id, full_name, phone) values
    (bv,'Bao ve H1','0900000120'), (chu,'Chu ho 12.04','0900000121'),
    (nha,'Nguoi nha 12.04','0900000122'), (cu,'Nguoi thue cu','0900000123'),
    (hx,'Chu ho 07.09','0900000124');
  insert into staff_assignments (user_id, project_id, role) values (bv, p_h, 'security');
  insert into unit_memberships (unit_id, user_id, role, status) values
    (u_a, chu, 'owner', 'active'), (u_a, nha, 'family', 'active'),
    (u_b, hx, 'owner', 'active');
  -- Hợp đồng thuê đã kết thúc hôm qua. valid_from phải lùi trước valid_to,
  -- ràng buộc valid_range không cho một hợp đồng kết thúc trước khi bắt đầu.
  insert into unit_memberships (unit_id, user_id, role, status, valid_from, valid_to) values
    (u_a, cu, 'tenant', 'active', current_date - 60, current_date - 1);

  -- ── 1. Bảo vệ nhận kiện, cư dân được BÁO NGAY ──
  -- Không báo thì kiện nằm ở quầy tới lúc cư dân tình cờ đi qua, và cả tính
  -- năng chỉ còn là một cuốn sổ đẹp hơn.
  perform set_config('test.uid', bv::text, true);
  k1 := nhan_kien_hang(u_a, 'thung_lon', 'GHTK', 'GH123456', 'Quay le tan');
  select count(*) into n from notifications
   where kind = 'kien_hang' and ref_id = k1;
  -- Chủ hộ + người nhà đều đang ở đó; người thuê cũ đã hết hạn thì KHÔNG.
  if n <> 2 then raise exception 'FAIL 1: bao cho % nguoi thay vi 2', n; end if;
  if exists (select 1 from notifications where ref_id = k1 and user_id = cu) then
    raise exception 'FAIL 1b: bao cho nguoi da het hop dong thue';
  end if;
  -- Thông báo phải gọi đúng tên loại kiện bằng tiếng người.
  select body into r from notifications where ref_id = k1 limit 1;
  if r.body not like '%thùng lớn%' then
    raise exception 'FAIL 1c: thong bao khong goi ten loai kien (%)', r.body;
  end if;
  if r.body not like '%Quay le tan%' then
    raise exception 'FAIL 1d: thong bao khong noi kien dang o dau';
  end if;

  -- ── 2. Cư dân KHÔNG tự ghi nhận kiện ──
  -- Tự ghi được là tự tạo ra bằng chứng "quầy đang giữ hàng của tôi".
  perform set_config('test.uid', chu::text, true);
  begin
    perform nhan_kien_hang(u_a, 'kien_nho');
    raise exception 'FAIL 2: cu dan tu ghi nhan duoc kien hang';
  exception when insufficient_privilege then null;
  end;

  -- ── 3. TRAO KIỆN PHẢI CÓ THẺ CỦA ĐÚNG CĂN ──
  -- Đây là ca mà sổ giấy không chặn nổi: một chữ ký nguệch ngoạc không nói được
  -- người ký ở căn nào.
  perform set_config('test.uid', bv::text, true);
  begin
    perform giao_kien_hang(k1, hx);
    raise exception 'FAIL 3: the cua can khac lay duoc hang can nay';
  exception when insufficient_privilege then null;
  end;
  -- Hợp đồng thuê đã hết thì thẻ cũng không lấy được nữa.
  begin
    perform giao_kien_hang(k1, cu);
    raise exception 'FAIL 3b: nguoi het hop dong thue van lay duoc hang';
  exception when insufficient_privilege then null;
  end;

  -- Người nhà thì được: nhận hàng hộ không phải chuyện tiền nong.
  select (giao_kien_hang(k1, nha) ->> 'ten') into r;
  select ten_nguoi_lay, nguoi_lay, tra_luc into r from kien_hang where id = k1;
  if r.nguoi_lay <> nha then raise exception 'FAIL 3c: ghi sai nguoi lay'; end if;
  if r.ten_nguoi_lay <> 'Nguoi nha 12.04' then
    raise exception 'FAIL 3d: khong chep ten nguoi lay (%)', r.ten_nguoi_lay;
  end if;
  if r.tra_luc is null then raise exception 'FAIL 3e: khong ghi gio trao'; end if;

  -- ── 4. Trao hai lần bị chặn ──
  begin
    perform giao_kien_hang(k1, chu);
    raise exception 'FAIL 4: trao duoc mot kien hai lan';
  exception when unique_violation then null;
  end;

  -- ── 5. Kiện ĐÃ TRAO thì không hủy được ──
  -- Hủy sau khi trao là xóa mất chính dòng chứng minh đã trao cho ai.
  -- Ràng buộc khong_vua_tra_vua_huy trên bảng cũng chặn ca này, nên chỉ bắt
  -- check_violation là chưa đủ: gỡ lời canh trong hàm đi thì hệ thống vẫn an
  -- toàn nhưng bảo vệ nhận được một chuỗi tên ràng buộc thay vì một câu tiếng
  -- Việt. Chốt cả CÂU BÁO LỖI, vì đó là thứ người ở quầy đọc.
  begin
    perform huy_kien_hang(k1, 'Bo di cho gon');
    raise exception 'FAIL 5: huy duoc kien da trao';
  exception when check_violation then
    if sqlerrm not like '%da trao roi%' then
      raise exception 'FAIL 5b: bao loi khong doc duoc (%)', sqlerrm;
    end if;
  end;

  -- ── 6. Hủy phải ghi lý do, và cư dân đọc được lý do đó ──
  k2 := nhan_kien_hang(u_a, 'phong_bi');
  begin
    perform huy_kien_hang(k2, '   ');
    raise exception 'FAIL 6: huy duoc ma khong ghi ly do';
  exception when sqlstate '22023' then null;
  end;
  perform huy_kien_hang(k2, 'Ben van chuyen lay lai vi sai dia chi');
  select ly_do_huy into r from kien_hang where id = k2;
  if r.ly_do_huy is null then raise exception 'FAIL 6b: huy ma khong luu ly do'; end if;
  begin
    perform giao_kien_hang(k2, chu);
    raise exception 'FAIL 6c: trao duoc kien da huy';
  exception when check_violation then
    if sqlerrm not like '%da huy%' then
      raise exception 'FAIL 6d: bao loi khong doc duoc (%)', sqlerrm;
    end if;
  end;

  -- ── 7. Quầy lễ tân chỉ thấy kiện ĐANG GIỮ ──
  k3 := nhan_kien_hang(u_b, 'kien_nho', 'Shopee');
  select count(*) into n from kien_dang_giu(p_h);
  if n <> 1 then raise exception 'FAIL 7: quay dang giu % kien thay vi 1', n; end if;
  select can into r from kien_dang_giu(p_h);
  if r.can <> 'H1-07.09' then raise exception 'FAIL 7b: sai can (%)', r.can; end if;

  -- ── 8. Nhắc kiện quá hạn — MỘT LẦN mỗi ngày cho mỗi kiện ──
  -- Ba thông báo giống nhau trong một buổi sáng thì lần sau cư dân tắt thông
  -- báo, và mất luôn cả những cái quan trọng.
  update kien_hang set nhan_luc = now() - interval '5 days' where id = k3;
  if nhac_kien_hang() <> 1 then raise exception 'FAIL 8: khong nhac kien qua han'; end if;
  if nhac_kien_hang() <> 0 then raise exception 'FAIL 8b: nhac lai kien vua nhac'; end if;
  -- Kiện còn trong hạn thì không nhắc.
  perform nhan_kien_hang(u_a, 'kien_nho');
  if nhac_kien_hang() <> 0 then raise exception 'FAIL 8c: nhac ca kien con trong han'; end if;

  -- ── 9. RLS: căn mình thì thấy, căn khác thì không ──
  begin execute 'create role vb_kien_test nologin'; exception when duplicate_object then null; end;
  execute 'grant usage on schema public to vb_kien_test';
  -- Cấp giống hệt production: auth_hooks.sql cho `authenticated` đọc units.
  -- kien_cua_toi() chạy security invoker để chính policy kien_read lọc, nên nó
  -- cần đúng những quyền mà người dùng thật đang có — bớt đi là bài test kiểm
  -- một cấu hình không tồn tại ngoài đời.
  execute 'grant select on kien_hang, units to vb_kien_test';
  execute 'grant execute on function is_staff(uuid), current_unit_ids() to vb_kien_test';
  execute 'grant execute on function kien_cua_toi(), kien_trang_thai(kien_hang) to vb_kien_test';
  execute 'set local role vb_kien_test';

  perform set_config('test.uid', chu::text, true);
  select count(*) into n from kien_cua_toi();
  if n <> 3 then raise exception 'FAIL 9: chu ho thay % kien cua can minh thay vi 3', n; end if;
  select count(*) into n from kien_cua_toi() where trang_thai = 'da_lay';
  if n <> 1 then raise exception 'FAIL 9b: dem sai so kien da lay (%)', n; end if;
  -- Và thấy TÊN người đã lấy — đó là cả điểm của tính năng.
  select ten_nguoi_lay into r from kien_cua_toi() where trang_thai = 'da_lay';
  if r.ten_nguoi_lay <> 'Nguoi nha 12.04' then
    raise exception 'FAIL 9c: khong hien ten nguoi da lay';
  end if;

  -- Bảo vệ là is_staff nên policy kien_read cho họ đọc CẢ DỰ ÁN. Nhưng
  -- kien_cua_toi() là màn CƯ DÂN — nó phải lọc theo căn của người gọi, không
  -- phải dựa vào RLS. Bảo vệ không ở căn nào thì thấy đúng 0 kiện; bỏ điều kiện
  -- đó đi là màn "hàng của tôi" hiện hàng của cả tòa.
  perform set_config('test.uid', bv::text, true);
  select count(*) into n from kien_cua_toi();
  if n <> 0 then raise exception 'FAIL 9c1: nhan su thay % kien o man cua cu dan', n; end if;

  perform set_config('test.uid', hx::text, true);
  select count(*) into n from kien_cua_toi() where can = 'H1-12.04';
  if n <> 0 then raise exception 'FAIL 9d: hang xom doc duoc kien cua can khac'; end if;
  select count(*) into n from kien_hang where unit_id = u_a;
  if n <> 0 then raise exception 'FAIL 9e: doc thang bang la vong qua duoc RLS'; end if;

  execute 'reset role';
  raise notice 'TEST KIEN HANG PASSED — trao phai co the dung can, da trao khong huy duoc, va nhac qua han mot lan moi ngay';
end $test$;
