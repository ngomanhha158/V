-- Smoke test mở khóa chủ hộ đầu tiên (N29). Chạy sau schema.sql + seed.sql.
-- ponytail: đây là kịch bản NGÀY ĐẦU. Nó không hỏng lúc chạy test — nó hỏng
-- lúc dán poster lên sảnh và cả tòa đăng ký rồi kẹt ở 'pending'. Nên test bám
-- vào đúng cái cửa hẹp: mở đủ để chủ hộ đầu tiên vào được, không mở tới mức
-- BQL tự thêm mình vào căn bất kỳ.

do $test$
declare
  p_gl   uuid := 'aaaaaaaa-0000-0000-0000-00000000c000';
  b_gl   uuid := 'bbbbbbbb-0000-0000-0000-00000000c000';
  p_khac uuid := 'aaaaaaaa-0000-0000-0000-00000000c009';
  b_khac uuid := 'bbbbbbbb-0000-0000-0000-00000000c009';
  u_a uuid; u_b uuid; u_khac uuid;
  s_bql  uuid := '77770000-0000-0000-0000-00000000c001';
  s_khac uuid := '77770000-0000-0000-0000-00000000c002';
  c_chu  uuid := '77770000-0000-0000-0000-00000000c003';
  c_thue uuid := '77770000-0000-0000-0000-00000000c004';
  c_hai  uuid := '77770000-0000-0000-0000-00000000c005';
  c_ba   uuid := '77770000-0000-0000-0000-00000000c006';
  m_chu uuid; m_thue uuid; m_hai uuid; m_ba uuid; m_khac uuid;
  n int; v_stat text; v_by uuid;
begin
  insert into projects (id, name) values (p_gl,'Go live'), (p_khac,'Khu hang xom');
  insert into buildings (id, project_id, code, name) values
    (b_gl, p_gl,'C1','Go live 1'), (b_khac, p_khac,'C9','Hang xom');
  insert into units (building_id, code, floor_no) values
    (b_gl,'C1-10.01',10), (b_gl,'C1-10.02',10);
  insert into units (building_id, code, floor_no) values (b_khac,'C9-01.01',1);
  select id into u_a    from units where building_id = b_gl   and code = 'C1-10.01';
  select id into u_b    from units where building_id = b_gl   and code = 'C1-10.02';
  select id into u_khac from units where building_id = b_khac and code = 'C9-01.01';

  insert into profiles (id, full_name, phone) values
    (s_bql,'BQL go live','0900000010'), (s_khac,'BQL khu khac','0900000011'),
    (c_chu,'Chu ho A','0900000012'), (c_thue,'Nguoi thue A','0900000013'),
    (c_hai,'Nguoi thu hai A','0900000014'), (c_ba,'Nguoi thue moi A','0900000015');
  insert into staff_assignments (user_id, project_id, role) values
    (s_bql, p_gl,'bql_manager'), (s_khac, p_khac,'bql_manager');

  -- ══ Cư dân quét poster rồi tự xin gia nhập ══
  perform set_config('test.uid', c_chu::text, true);
  insert into unit_memberships (unit_id, user_id, role, status)
    values (u_a, c_chu, 'owner', 'pending') returning id into m_chu;
  perform set_config('test.uid', c_thue::text, true);
  insert into unit_memberships (unit_id, user_id, role, status)
    values (u_a, c_thue, 'tenant', 'pending') returning id into m_thue;

  -- 1. HẠT NHÂN: trước khi có hàm này thì KHÔNG AI duyệt được. Kiểm lại rằng
  --    đường cũ (update thẳng) vẫn đóng với cả BQL lẫn chính người xin.
  --
  -- Phải ĐỔI ROLE mới đo được. Chủ sở hữu bảng bỏ qua RLS kể cả khi đã FORCE,
  -- mà bộ test này chạy dưới quyền đó — không đổi role thì hai assert dưới đây
  -- "pass" trong một thế giới không có RLS, tức là chẳng đo gì cả.
  -- (test_rls.sql ghi sẵn cái bẫy này ở đầu file.)
  execute 'alter table unit_memberships force row level security';
  begin execute 'create role vb_gl_test nologin'; exception when duplicate_object then null; end;
  execute 'grant usage on schema public to vb_gl_test';
  execute 'grant select, insert, update on unit_memberships to vb_gl_test';
  execute 'set local role vb_gl_test';

  perform set_config('test.uid', s_bql::text, true);
  update unit_memberships set status = 'active' where id = m_chu;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL 1a: BQL sua thang duoc unit_memberships'; end if;

  perform set_config('test.uid', c_chu::text, true);
  update unit_memberships set status = 'active' where id = m_chu;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL 1b: nguoi xin tu duyet duoc cho minh'; end if;

  execute 'reset role';

  -- ══ QUYỀN ══
  -- 2. Cư dân không gọi được hàm duyệt, cũng không xem được danh sách chờ
  begin
    perform bql_duyet_chu_ho_dau_tien(m_chu);
    raise exception 'FAIL 2a: cu dan duyet duoc';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from bql_cho_duyet_chu_ho(p_gl);
    raise exception 'FAIL 2b: cu dan xem duoc danh sach cho duyet';
  exception when insufficient_privilege then null;
  end;

  -- 3. BQL DỰ ÁN KHÁC cũng không duyệt được
  perform set_config('test.uid', s_khac::text, true);
  begin
    perform bql_duyet_chu_ho_dau_tien(m_chu);
    raise exception 'FAIL 3: BQL du an khac duyet duoc';
  exception when insufficient_privilege then null;
  end;

  -- ══ CỬA HẸP ══
  perform set_config('test.uid', s_bql::text, true);

  -- 4. HẠT NHÂN: BQL chỉ duyệt được vai CHỦ HỘ. Người thuê là việc của chủ hộ.
  begin
    perform bql_duyet_chu_ho_dau_tien(m_thue);
    raise exception 'FAIL 4: BQL duyet duoc nguoi THUE';
  exception when insufficient_privilege then null;
  end;

  -- 5. Danh sách chờ chỉ hiện yêu cầu BQL thật sự duyệt được: đúng 1 (chủ hộ),
  --    không có người thuê. Hiện ra rồi bấm vào báo lỗi là mất niềm tin.
  select count(*) into n from bql_cho_duyet_chu_ho(p_gl);
  if n <> 1 then raise exception 'FAIL 5a: danh sach cho co % dong, phai la 1', n; end if;
  select count(*) into n from bql_cho_duyet_chu_ho(p_gl) where unit_code = 'C1-10.01';
  if n <> 1 then raise exception 'FAIL 5b: khong dung can'; end if;

  -- 6. Duyệt được, và có ghi lại AI duyệt — không có dấu vết thì sau này không
  --    ai chứng minh được vì sao người này thành chủ hộ.
  perform bql_duyet_chu_ho_dau_tien(m_chu);
  select status::text, approved_by into v_stat, v_by from unit_memberships where id = m_chu;
  if v_stat <> 'active' then raise exception 'FAIL 6a: trang thai ra %', v_stat; end if;
  if v_by is distinct from s_bql then raise exception 'FAIL 6b: khong ghi ai duyet'; end if;

  -- 7. HẠT NHÂN: duyệt xong thì CỬA ĐÓNG LẠI với chính căn đó. Người thứ hai
  --    xin làm chủ hộ căn này là việc của chủ hộ, không phải của BQL nữa.
  perform set_config('test.uid', c_hai::text, true);
  insert into unit_memberships (unit_id, user_id, role, status)
    values (u_a, c_hai, 'owner', 'pending') returning id into m_hai;
  perform set_config('test.uid', s_bql::text, true);
  begin
    perform bql_duyet_chu_ho_dau_tien(m_hai);
    raise exception 'FAIL 7a: BQL van duyet duoc sau khi can da co chu ho';
  exception when insufficient_privilege then null;
  end;
  select count(*) into n from bql_cho_duyet_chu_ho(p_gl);
  if n <> 0 then raise exception 'FAIL 7b: can da co chu ho van nam trong danh sach cho'; end if;

  -- 8. Nhưng CHỦ HỘ thì duyệt được — quyền đã trả về đúng chỗ. Người thứ hai
  --    xin làm NGƯỜI THUÊ chứ không phải chủ hộ: index one_active_owner chỉ cho
  --    mỗi căn một chủ hộ hoạt động, nên "chủ hộ thứ hai" là trạng thái không
  --    tồn tại được, không phải thứ đi test.
  --    Cũng đo dưới role thường, nếu không assert này chỉ chứng minh UPDATE chạy.
  perform set_config('test.uid', c_ba::text, true);
  insert into unit_memberships (unit_id, user_id, role, status)
    values (u_a, c_ba, 'tenant', 'pending') returning id into m_ba;

  execute 'set local role vb_gl_test';
  perform set_config('test.uid', c_chu::text, true);
  update unit_memberships set status = 'active' where id = m_ba;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL 8a: chu ho khong duyet duoc nguoi thue'; end if;

  -- Và chủ hộ căn A không với sang căn khác được
  perform set_config('test.uid', c_chu::text, true);
  update unit_memberships set status = 'active' where id = m_thue and unit_id <> u_a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL 8b: chu ho voi sang can khac'; end if;
  execute 'reset role';

  -- 9. Duyệt hai lần cùng một yêu cầu -> chặn
  perform set_config('test.uid', c_thue::text, true);
  insert into unit_memberships (unit_id, user_id, role, status)
    values (u_b, c_thue, 'owner', 'pending') returning id into m_khac;
  perform set_config('test.uid', s_bql::text, true);
  perform bql_duyet_chu_ho_dau_tien(m_khac);
  begin
    perform bql_duyet_chu_ho_dau_tien(m_khac);
    raise exception 'FAIL 9: duyet duoc lan hai';
  exception when others then
    if sqlstate <> '22023' then raise; end if;
  end;

  -- 10. Cách ly dự án: danh sách của khu này không lẫn yêu cầu của khu kia
  perform set_config('test.uid', c_hai::text, true);
  insert into unit_memberships (unit_id, user_id, role, status)
    values (u_khac, c_hai, 'owner', 'pending');
  perform set_config('test.uid', s_bql::text, true);
  select count(*) into n from bql_cho_duyet_chu_ho(p_gl);
  if n <> 0 then raise exception 'FAIL 10: danh sach lan yeu cau cua khu khac (% dong)', n; end if;

  -- 11. Màn tiền kiểm đếm đúng CĂN, không phải đếm membership. Căn C1-10.01
  --     có 1 chủ hộ + 1 người thuê; đếm nhầm theo membership sẽ ra 2 "căn có chủ".
  perform set_config('test.uid', s_bql::text, true);
  select so_can_co_chu into n from bql_san_sang_go_live(p_gl);
  if n <> 2 then
    raise exception 'FAIL 11a: so_can_co_chu = %, phai la 2 (C1-10.01 va C1-10.02)', n;
  end if;
  select so_can into n from bql_san_sang_go_live(p_gl);
  if n <> 2 then raise exception 'FAIL 11b: so_can = %, phai la 2', n; end if;

  -- 12. Cư dân không xem được màn tiền kiểm
  perform set_config('test.uid', c_chu::text, true);
  begin
    perform * from bql_san_sang_go_live(p_gl);
    raise exception 'FAIL 12: cu dan xem duoc man tien kiem';
  exception when insufficient_privilege then null;
  end;

  raise notice 'test_golive: 13 assert PASS';
end $test$;
