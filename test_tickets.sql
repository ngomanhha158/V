-- Smoke test trigger ticket: suy ra vị trí, gán SLA, audit trail, leo thang.
-- Chạy sau schema.sql + seed.sql.
-- ponytail: 6 assert, chỉ những cái mà hỏng thì KPI của BQT sai câm.

do $test$
declare
  v_project uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  u_rep uuid := '55555555-5555-5555-5555-555555555555';
  u_bql uuid := '55555555-5555-5555-5555-555555555556';
  v_unit uuid; v_building uuid;
  t_elev uuid; t_weird uuid;
  v_resp timestamptz; v_first timestamptz;
  n int;
begin
  select u.id, u.building_id into v_unit, v_building from units u where u.code = 'P1-10.01';
  insert into profiles (id, full_name) values (u_rep, 'Nguoi bao'), (u_bql, 'BQL');
  insert into staff_assignments (user_id, project_id, role) values (u_bql, v_project, 'bql_manager');

  -- App chỉ gửi unit_id + category + priority, KHÔNG gửi building_id/project_id
  insert into tickets (unit_id, reporter_id, category, priority, title)
    values (v_unit, u_rep, 'elevator', 'urgent', 'Thang máy kẹt tầng 10')
    returning id into t_elev;

  -- 1. Trigger suy ra đúng tòa + dự án
  select count(*) into n from tickets
   where id = t_elev and building_id = v_building and project_id = v_project;
  if n <> 1 then raise exception 'FAIL 1: khong suy ra dung building/project'; end if;

  -- 2. SLA gán theo policy elevator/urgent = 10 phút tiếp nhận, 30 phút xử lý
  select count(*) into n from tickets
   where id = t_elev
     and sla_respond_due between now() + interval '9 min'  and now() + interval '11 min'
     and sla_resolve_due between now() + interval '29 min' and now() + interval '31 min';
  if n <> 1 then raise exception 'FAIL 2: han SLA gan sai'; end if;

  -- 3. Danh mục không có policy -> vẫn tạo được ticket, hạn để NULL
  insert into tickets (unit_id, reporter_id, category, priority, title)
    values (v_unit, u_rep, 'khong_co_trong_policy', 'normal', 'Linh tinh')
    returning id into t_weird;
  select count(*) into n from tickets
   where id = t_weird and sla_resolve_due is null;
  if n <> 1 then raise exception 'FAIL 3: ticket khong co policy bi chan hoac gan bua han'; end if;

  -- 4. Audit trail tự ghi lúc tạo
  select count(*) into n from ticket_events
   where ticket_id = t_elev and event_type = 'created';
  if n <> 1 then raise exception 'FAIL 4: khong ghi su kien created'; end if;

  -- 5. Đổi trạng thái -> ghi sự kiện + đóng dấu responded_at, và KHÔNG ghi đè lần sau
  update tickets set status = 'assigned' where id = t_elev;
  select responded_at into v_first from tickets where id = t_elev;
  if v_first is null then raise exception 'FAIL 5a: khong dong dau responded_at'; end if;

  update tickets set status = 'in_progress' where id = t_elev;
  select responded_at into v_resp from tickets where id = t_elev;
  if v_resp <> v_first then raise exception 'FAIL 5b: responded_at bi ghi de lan sau'; end if;

  select count(*) into n from ticket_events
   where ticket_id = t_elev and event_type = 'status_changed';
  if n <> 2 then raise exception 'FAIL 5c: ghi % su kien doi trang thai, phai la 2', n; end if;

  -- 6. Leo thang: bắt ticket quá hạn, BỎ QUA ticket không có hạn
  update tickets set sla_resolve_due = now() - interval '1 min' where id = t_elev;
  perform escalate_overdue_tickets();

  select count(*) into n from tickets where id = t_elev and escalated_at is not null;
  if n <> 1 then raise exception 'FAIL 6a: khong leo thang ticket qua han'; end if;

  select count(*) into n from tickets where id = t_weird and escalated_at is not null;
  if n <> 0 then raise exception 'FAIL 6b: leo thang nham ticket khong co han SLA'; end if;

  -- 7. Cư dân đọc được diễn biến ticket của mình, KHÔNG đọc của căn khác.
  --    (RLS thật chỉ có hiệu lực khi SET ROLE sang role thường — xem test_rls.sql.)
  execute 'alter table tickets force row level security';
  execute 'alter table ticket_events force row level security';
  begin execute 'create role vb_ticket_test nologin'; exception when duplicate_object then null; end;
  execute 'grant usage on schema public to vb_ticket_test';
  -- Trên Supabase, role authenticated có sẵn usage trên schema auth. Stub
  -- local thì không, phải cấp để create_ticket() gọi được auth.uid().
  execute 'grant usage on schema auth to vb_ticket_test';
  execute 'grant select on tickets, ticket_events to vb_ticket_test';
  execute 'grant update on tickets to vb_ticket_test';
  execute 'grant select on staff_assignments to vb_ticket_test';
  execute 'alter table staff_assignments force row level security';
  -- Gắn người báo vào căn TRƯỚC khi hạ quyền: role thường không ghi được bảng này.
  insert into unit_memberships (unit_id, user_id, role, status)
    values (v_unit, u_rep, 'owner', 'active');

  execute 'set local role vb_ticket_test';
  perform set_config('test.uid', u_rep::text, true);
  select count(*) into n from ticket_events where ticket_id = t_elev;
  if n = 0 then raise exception 'FAIL 7a: cu dan khong doc duoc dien bien ticket cua minh'; end if;

  perform set_config('test.uid', '00000000-0000-0000-0000-0000000000ff', true);
  select count(*) into n from ticket_events where ticket_id = t_elev;
  if n <> 0 then raise exception 'FAIL 7b: nguoi la doc duoc dien bien ticket can khac'; end if;
  execute 'reset role';

  -- 7c. BQL đọc được nhân sự dự án mình để còn phân công; cư dân thì không.
  --     Bảng này quyết định is_staff() nên rò ra là lộ luôn ai có quyền gì.
  execute 'set local role vb_ticket_test';
  perform set_config('test.uid', u_bql::text, true);
  select count(*) into n from staff_assignments;
  if n <> 1 then raise exception 'FAIL 7c: BQL khong doc duoc nhan su du an minh'; end if;

  perform set_config('test.uid', u_rep::text, true);
  select count(*) into n from staff_assignments;
  if n <> 0 then raise exception 'FAIL 7d: cu dan thuong doc duoc bang nhan su'; end if;
  execute 'reset role';

  -- 8. create_ticket() phải ĐI QUA RLS, không được thành cửa sau. Hàm là
  --    security invoker nên insert bên trong vẫn bị ticket_resident_insert lọc.
  execute 'grant insert on tickets to vb_ticket_test';
  execute 'grant execute on function create_ticket(uuid, text, ticket_priority, text, text, text[]) to vb_ticket_test';
  execute 'set local role vb_ticket_test';

  perform set_config('test.uid', u_rep::text, true);
  perform create_ticket(v_unit, 'plumbing', 'high'::ticket_priority, 'Ro nuoc');
  select count(*) into n from tickets where unit_id = v_unit and category = 'plumbing';
  if n <> 1 then raise exception 'FAIL 8a: cu dan cua can khong tao duoc ticket qua create_ticket'; end if;

  perform set_config('test.uid', '00000000-0000-0000-0000-0000000000ff', true);
  begin
    perform create_ticket(v_unit, 'plumbing', 'high'::ticket_priority, 'Nguoi la');
    raise exception 'FAIL 8b: nguoi la tao duoc ticket cho can ho khong phai cua minh';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';

  -- 9. Đổi trạng thái: chỉ BQL. Cư dân đổi được status ticket của mình thì
  --    toàn bộ KPI đúng-hạn-SLA của BQT thành số tự khai.
  execute 'set local role vb_ticket_test';

  perform set_config('test.uid', u_rep::text, true);
  update tickets set status = 'resolved' where id = t_elev;
  select count(*) into n from tickets where id = t_elev and status = 'resolved';
  if n <> 0 then raise exception 'FAIL 9a: cu dan tu doi duoc trang thai ticket'; end if;

  perform set_config('test.uid', u_bql::text, true);
  update tickets set status = 'resolved' where id = t_elev;
  select count(*) into n from tickets where id = t_elev and status = 'resolved';
  if n <> 1 then raise exception 'FAIL 9b: BQL khong doi duoc trang thai ticket'; end if;
  execute 'reset role';

  -- 10. Đánh giá: chỉ người trong căn, chỉ khi đã xong, chỉ điểm 1-5.
  --     Hàm là DEFINER nên bỏ qua RLS — nếu nó kiểm tra hụt thì ai cũng chấm
  --     điểm hộ được, và KPI hài lòng của BQT thành số bịa.
  execute 'grant execute on function rate_ticket(uuid, int, text) to vb_ticket_test';
  execute 'set local role vb_ticket_test';

  -- (t_elev đang ở 'resolved' sau assert 9b)
  perform set_config('test.uid', '00000000-0000-0000-0000-0000000000ff', true);
  begin
    perform rate_ticket(t_elev, 5);
    raise exception 'FAIL 10a: nguoi ngoai can ho cham diem duoc';
  exception when insufficient_privilege then null;
  end;

  perform set_config('test.uid', u_rep::text, true);
  begin
    perform rate_ticket(t_elev, 9);
    raise exception 'FAIL 10b: nhan diem ngoai thang 1-5';
  exception when invalid_parameter_value then null;   -- 22023, đúng loại từ chối
  end;

  perform rate_ticket(t_elev, 4, 'Xu ly nhanh');
  execute 'reset role';
  select count(*) into n from tickets where id = t_elev and rating = 4 and rating_note = 'Xu ly nhanh';
  if n <> 1 then raise exception 'FAIL 10c: cu dan trong can khong cham diem duoc'; end if;

  -- Ticket chưa xong thì không chấm được
  execute 'set local role vb_ticket_test';
  perform set_config('test.uid', u_rep::text, true);
  begin
    perform rate_ticket(t_weird, 5);
    raise exception 'FAIL 10d: cham diem duoc ticket chua xong';
  exception when object_not_in_prerequisite_state then null;   -- 55000
  end;
  execute 'reset role';

  raise notice 'ALL TICKET TESTS PASSED';
end $test$;

rollback;
