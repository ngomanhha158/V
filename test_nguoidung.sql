-- Smoke test quản lý người dùng. Chạy sau schema.sql + seed.sql.
--
-- Cái đáng sợ ở màn này không phải "không tạo được tài khoản" — đó là lỗi ai
-- cũng thấy ngay. Đáng sợ là tạo được QUÁ NHIỀU: bảo vệ tự phong mình làm
-- trưởng BQL, hoặc BQL tự thêm mình vào căn của cư dân rồi đọc hóa đơn nhà
-- người ta. Test bám vào đúng hai cửa hẹp đó.

do $test$
declare
  p_nd   uuid := 'aaaaaaaa-0000-0000-0000-00000000d000';
  b_nd   uuid := 'bbbbbbbb-0000-0000-0000-00000000d000';
  p_khac uuid := 'aaaaaaaa-0000-0000-0000-00000000d009';
  b_khac uuid := 'bbbbbbbb-0000-0000-0000-00000000d009';
  u_a uuid; u_b uuid; u_khac uuid;
  truong  uuid := '77770000-0000-0000-0000-00000000d001';  -- bql_manager
  baove   uuid := '77770000-0000-0000-0000-00000000d002';  -- security, KHÔNG phải manager
  truong2 uuid := '77770000-0000-0000-0000-00000000d003';  -- manager thứ hai
  cudan   uuid := '77770000-0000-0000-0000-00000000d004';
  cudan2  uuid := '77770000-0000-0000-0000-00000000d005';
  ngoai   uuid := '77770000-0000-0000-0000-00000000d006';  -- người của khu khác
  n int; v_roles text[]; v_cans text[]; v_active boolean;
begin
  insert into projects (id, name) values (p_nd,'Khu nguoi dung'), (p_khac,'Khu hang xom ND');
  insert into buildings (id, project_id, code, name) values
    (b_nd, p_nd,'D1','ND 1'), (b_khac, p_khac,'D9','Hang xom ND');
  insert into units (building_id, code, floor_no) values
    (b_nd,'D1-05.01',5), (b_nd,'D1-05.02',5);
  insert into units (building_id, code, floor_no) values (b_khac,'D9-01.01',1);
  select id into u_a    from units where building_id = b_nd   and code = 'D1-05.01';
  select id into u_b    from units where building_id = b_nd   and code = 'D1-05.02';
  select id into u_khac from units where building_id = b_khac and code = 'D9-01.01';

  insert into profiles (id, full_name, phone) values
    (truong,'Truong BQL','0900000020'), (baove,'Bao ve','0900000021'),
    (truong2,'Truong BQL hai','0900000022'), (cudan,'Cu dan mot','0900000023'),
    (cudan2,'Cu dan hai','0900000024'), (ngoai,'Nguoi khu khac','0900000025');
  insert into staff_assignments (user_id, project_id, role) values
    (truong, p_nd,'bql_manager'), (baove, p_nd,'security');
  insert into staff_assignments (user_id, project_id, role) values (ngoai, p_khac,'bql_manager');

  -- ══ 1. is_bql_manager phân biệt được trưởng BQL với nhân sự thường ══
  perform set_config('test.uid', truong::text, true);
  if not is_bql_manager(p_nd) then raise exception '1a: truong BQL phai la manager'; end if;

  perform set_config('test.uid', baove::text, true);
  if is_bql_manager(p_nd) then raise exception '1b: bao ve KHONG duoc la manager'; end if;
  -- nhưng bảo vệ vẫn là nhân sự, vẫn xem được danh sách
  if not is_staff(p_nd) then raise exception '1c: bao ve van phai la staff'; end if;

  perform set_config('test.uid', ngoai::text, true);
  if is_bql_manager(p_nd) then raise exception '1d: manager khu khac khong duoc quan khu nay'; end if;

  -- ══ 2. Bảo vệ KHÔNG tự phong mình làm trưởng BQL ══
  perform set_config('test.uid', baove::text, true);
  begin
    perform bql_gan_nhan_su(baove, p_nd, 'bql_manager');
    raise exception '2a: bao ve tu phong minh lam truong BQL duoc';
  exception when insufficient_privilege then null;
  end;

  -- Người của khu khác cũng không gán được vào khu này
  perform set_config('test.uid', ngoai::text, true);
  begin
    perform bql_gan_nhan_su(ngoai, p_nd, 'bql_manager');
    raise exception '2b: nguoi khu khac gan duoc nhan su khu nay';
  exception when insufficient_privilege then null;
  end;

  -- ══ 3. Trưởng BQL gán được, và gán lại thì bật lại chứ không lỗi trùng ══
  perform set_config('test.uid', truong::text, true);
  perform bql_gan_nhan_su(truong2, p_nd, 'bql_manager');
  select count(*) into n from staff_assignments
   where user_id = truong2 and project_id = p_nd and role = 'bql_manager' and is_active;
  if n <> 1 then raise exception '3a: gan nhan su that bai, n=%', n; end if;

  perform bql_ngung_nhan_su(truong2, p_nd, 'bql_manager');
  perform bql_gan_nhan_su(truong2, p_nd, 'bql_manager');   -- gán lại
  select is_active into v_active from staff_assignments
   where user_id = truong2 and project_id = p_nd and role = 'bql_manager';
  if not v_active then raise exception '3b: gan lai phai bat lai is_active'; end if;

  -- ══ 4. Không gỡ được trưởng BQL CUỐI CÙNG ══
  -- Gỡ được là khu không còn ai tạo tài khoản, không còn ai gán quyền.
  perform bql_ngung_nhan_su(truong2, p_nd, 'bql_manager');  -- còn mỗi `truong`
  begin
    perform bql_ngung_nhan_su(truong, p_nd, 'bql_manager');
    raise exception '4a: go duoc truong BQL cuoi cung';
  exception when insufficient_privilege then null;
  end;
  -- vẫn còn hiệu lực sau khi bị từ chối
  select is_active into v_active from staff_assignments
   where user_id = truong and project_id = p_nd and role = 'bql_manager';
  if not v_active then raise exception '4b: bi go mat du da tu choi'; end if;

  -- Có hai trưởng thì gỡ được một
  perform bql_gan_nhan_su(truong2, p_nd, 'bql_manager');
  perform bql_ngung_nhan_su(truong, p_nd, 'bql_manager');
  select is_active into v_active from staff_assignments
   where user_id = truong and project_id = p_nd and role = 'bql_manager';
  if v_active then raise exception '4c: con hai truong thi phai go duoc mot'; end if;
  perform set_config('test.uid', truong2::text, true);   -- giờ truong2 là người quản
  perform bql_gan_nhan_su(truong, p_nd, 'bql_manager');  -- trả lại cho phần sau

  -- ══ 5. Gán chủ hộ đầu tiên: mở đúng MỘT lần cho mỗi căn ══
  perform set_config('test.uid', truong::text, true);
  perform bql_gan_chu_ho_dau_tien(cudan, u_a);
  select count(*) into n from unit_memberships
   where unit_id = u_a and user_id = cudan and role = 'owner' and status = 'active';
  if n <> 1 then raise exception '5a: gan chu ho dau tien that bai'; end if;

  -- Căn đã có chủ hộ -> cửa đóng lại, người sau do chính chủ hộ duyệt
  begin
    perform bql_gan_chu_ho_dau_tien(cudan2, u_a);
    raise exception '5b: BQL them duoc nguoi thu hai vao can da co chu ho';
  exception when insufficient_privilege then null;
  end;

  -- BQL tự thêm CHÍNH MÌNH vào căn của cư dân cũng bị chặn bởi cùng cái chốt đó
  begin
    perform bql_gan_chu_ho_dau_tien(truong, u_a);
    raise exception '5c: BQL tu them minh vao can da co chu ho';
  exception when insufficient_privilege then null;
  end;

  -- Căn khác chưa có ai thì vẫn mở được
  perform bql_gan_chu_ho_dau_tien(cudan2, u_b);
  select count(*) into n from unit_memberships where unit_id = u_b and status = 'active';
  if n <> 1 then raise exception '5d: can trong phai gan duoc'; end if;

  -- Bảo vệ không gán chủ hộ được
  perform set_config('test.uid', baove::text, true);
  begin
    perform bql_gan_chu_ho_dau_tien(cudan, u_khac);
    raise exception '5e: bao ve gan duoc chu ho';
  exception when insufficient_privilege then null;
  end;

  -- Căn không tồn tại -> lỗi rõ ràng, không phải null pointer
  perform set_config('test.uid', truong::text, true);
  begin
    perform bql_gan_chu_ho_dau_tien(cudan, 'ffffffff-0000-0000-0000-000000000000');
    raise exception '5f: gan duoc vao can khong ton tai';
  exception when sql_routine_exception or invalid_parameter_value then null;
       when others then if sqlstate <> '22023' then raise; end if;
  end;

  -- ══ 6. Danh sách: đúng người, đúng vai trò, KHÔNG lẫn khu khác ══
  perform set_config('test.uid', truong::text, true);
  select count(*) into n from bql_danh_sach_nguoi_dung(p_nd);
  -- truong, truong2, baove (nhân sự) + cudan, cudan2 (cư dân) = 5. `ngoai` thuộc khu khác.
  if n <> 5 then raise exception '6a: danh sach phai co 5 nguoi, co %', n; end if;

  select count(*) into n from bql_danh_sach_nguoi_dung(p_nd) where user_id = ngoai;
  if n <> 0 then raise exception '6b: nguoi khu khac lot vao danh sach'; end if;

  select vai_tro_bql into v_roles from bql_danh_sach_nguoi_dung(p_nd) where user_id = baove;
  if v_roles <> array['security'] then raise exception '6c: sai vai tro bao ve: %', v_roles; end if;

  select can_ho into v_cans from bql_danh_sach_nguoi_dung(p_nd) where user_id = cudan;
  if v_cans <> array['D1-05.01 (owner)'] then raise exception '6d: sai can ho: %', v_cans; end if;

  -- Nhân sự thuần thì không có căn, cư dân thuần thì không có vai trò BQL.
  -- Nhầm hai cột này là màn hình hiện "bảo vệ đang ở căn D1-05.01".
  select vai_tro_bql into v_roles from bql_danh_sach_nguoi_dung(p_nd) where user_id = cudan;
  if v_roles is not null then raise exception '6e: cu dan khong duoc co vai tro BQL'; end if;
  select can_ho into v_cans from bql_danh_sach_nguoi_dung(p_nd) where user_id = baove;
  if v_cans is not null then raise exception '6f: bao ve khong duoc co can ho'; end if;

  -- ══ 7. Bảo vệ XEM được danh sách (cần để trực), người ngoài thì không ══
  perform set_config('test.uid', baove::text, true);
  select count(*) into n from bql_danh_sach_nguoi_dung(p_nd);
  if n <> 5 then raise exception '7a: bao ve phai xem duoc danh sach'; end if;

  perform set_config('test.uid', cudan::text, true);
  begin
    perform * from bql_danh_sach_nguoi_dung(p_nd);
    raise exception '7b: cu dan xem duoc danh sach nguoi dung';
  exception when insufficient_privilege then null;
  end;

  perform set_config('test.uid', ngoai::text, true);
  begin
    perform * from bql_danh_sach_nguoi_dung(p_nd);
    raise exception '7c: BQL khu khac xem duoc danh sach khu nay';
  exception when insufficient_privilege then null;
  end;

  raise notice 'test_nguoidung.sql: OK';
end $test$;
