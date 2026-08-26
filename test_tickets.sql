-- Smoke test trigger ticket: suy ra vị trí, gán SLA, audit trail, leo thang.
-- Chạy sau schema.sql + seed.sql.
-- ponytail: 6 assert, chỉ những cái mà hỏng thì KPI của BQT sai câm.

do $test$
declare
  v_project uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  u_rep uuid := '55555555-5555-5555-5555-555555555555';
  v_unit uuid; v_building uuid;
  t_elev uuid; t_weird uuid;
  v_resp timestamptz; v_first timestamptz;
  n int;
begin
  select u.id, u.building_id into v_unit, v_building from units u where u.code = 'P1-10.01';
  insert into profiles (id, full_name) values (u_rep, 'Nguoi bao');

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

  raise notice 'ALL TICKET TESTS PASSED';
end $test$;

rollback;
