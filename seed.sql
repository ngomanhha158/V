-- Dữ liệu mẫu 1 khu dân cư: 2 tòa, 24 căn, biểu phí, SLA, nội quy.
-- Dùng để dev/demo trước khi có dữ liệu thật của tòa pilot.
-- Chạy sau schema.sql. KHÔNG chạy trên production.

insert into projects (id, name, address) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Sunrise Riverside', 'Nguyễn Hữu Thọ, Nhà Bè, TP.HCM');

insert into buildings (id, project_id, code, name, floor_count) values
  ('bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','P1','Park 1',20),
  ('bbbbbbbb-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001','P2','Park 2',20);

-- 24 căn: 2 tòa x 3 tầng x 4 căn
insert into units (building_id, code, floor_no, area_m2, kind, state)
select b.id,
       b.code || '-' || f.floor_no || '.0' || n.idx,
       f.floor_no,
       55 + (n.idx * 12)::numeric,
       'apartment',
       (array['owner_occupied','rented','vacant'])[1 + (n.idx % 3)]::unit_state
  from buildings b
  cross join (values (10),(11),(12)) as f(floor_no)
  cross join (values (1),(2),(3),(4)) as n(idx);

-- ── Biểu phí ──
insert into fee_types (id, project_id, code, name, unit_price, calc_method) values
  ('cccccccc-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','MGMT','Phí quản lý',       16500,'per_m2'),
  ('cccccccc-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001','ELEC','Tiền điện',          3200,'metered'),
  ('cccccccc-0000-0000-0000-000000000003','aaaaaaaa-0000-0000-0000-000000000001','WATER','Tiền nước',        11500,'metered'),
  ('cccccccc-0000-0000-0000-000000000004','aaaaaaaa-0000-0000-0000-000000000001','PARK_CAR','Phí ô tô',    1200000,'fixed'),
  ('cccccccc-0000-0000-0000-000000000005','aaaaaaaa-0000-0000-0000-000000000001','TRASH','Phí rác',          60000,'fixed');

-- ── SLA: con số phải ngồi với BQL chốt lại, đây chỉ là mặc định khởi tạo ──
insert into sla_policies (project_id, category, priority, respond_mins, resolve_mins, escalate_to) values
  ('aaaaaaaa-0000-0000-0000-000000000001','water_outage','urgent',  15,  120,'bql_manager'),
  ('aaaaaaaa-0000-0000-0000-000000000001','elevator',    'urgent',  10,   30,'bql_manager'),
  ('aaaaaaaa-0000-0000-0000-000000000001','power',       'urgent',  15,   60,'bql_manager'),
  ('aaaaaaaa-0000-0000-0000-000000000001','plumbing',    'high',    30,  480,'bql_staff'),
  ('aaaaaaaa-0000-0000-0000-000000000001','aircon',      'normal',  60, 1440,'bql_staff'),
  ('aaaaaaaa-0000-0000-0000-000000000001','cleaning',    'normal',  60, 1440,'bql_staff'),
  ('aaaaaaaa-0000-0000-0000-000000000001','security',    'high',    15,  240,'security'),
  ('aaaaaaaa-0000-0000-0000-000000000001','noise',       'normal',  30,  720,'security'),
  ('aaaaaaaa-0000-0000-0000-000000000001','parking',     'low',    120, 2880,'security'),
  ('aaaaaaaa-0000-0000-0000-000000000001','other',       'normal', 120, 2880,'bql_staff');

-- ── Cẩm nang số: 3 mục hay bị cãi nhất ──
insert into documents (project_id, section, title, body) values
  ('aaaaaaaa-0000-0000-0000-000000000001','Thú cưng','Quy định nuôi thú cưng',
   'Chó mèo phải rọ mõm và có dây dắt khi ra khu vực chung. Không đưa thú cưng vào hồ bơi, phòng gym, thang máy hàng. Chủ nuôi tự dọn chất thải. Vi phạm lần 3 bị đình chỉ quyền nuôi trong khu.'),
  ('aaaaaaaa-0000-0000-0000-000000000001','Rác thải','Quy định đổ rác',
   'Rác sinh hoạt bỏ vào phòng rác mỗi tầng trước 21h, buộc kín túi. Rác cồng kềnh (nệm, tủ, đồ điện) phải đăng ký với BQL và tự trả phí vận chuyển. Không để rác ngoài hành lang.'),
  ('aaaaaaaa-0000-0000-0000-000000000001','Sửa chữa','Quy định sửa chữa căn hộ',
   'Thi công gây ồn chỉ được làm 8h30-11h30 và 13h30-17h các ngày trong tuần, không làm chủ nhật và ngày lễ. Phải đăng ký trước 3 ngày, đặt cọc 5.000.000đ hoàn lại sau nghiệm thu. Dùng thang máy hàng, không dùng thang khách chở vật liệu.');
