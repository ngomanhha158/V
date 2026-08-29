-- ═══════════════════════════════════════════════════════════════════════════
-- XÓA DỮ LIỆU MẪU TRƯỚC KHI GO-LIVE
-- ───────────────────────────────────────────────────────────────────────────
-- seed.sql sinh ra 1 dự án "Sunrise Riverside", 2 tòa, 24 căn, biểu phí và
-- SLA mẫu. Đó là dữ liệu để dev, chính file seed đã ghi "KHÔNG chạy trên
-- production" — nhưng nếu đã lỡ chạy rồi thì phải dọn trước khi nhập dữ liệu
-- tòa thật, không thì cư dân thật đăng nhập vào và thấy 24 căn ma.
--
-- Script này CHỈ xóa đúng những dòng do seed.sql tạo, nhận diện bằng UUID cứng
-- trong seed. Dữ liệu nhập sau đó (tòa thật, căn thật) có UUID ngẫu nhiên nên
-- không bị đụng tới.
--
-- CÁCH CHẠY: đọc hết phần chốt an toàn bên dưới, rồi chạy cả file. Nó tự bọc
-- trong transaction — có gì sai là raise exception và không xóa gì.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

do $reset$
declare
  p_demo uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  n_user int; n_pay int; n_inv int; n_mem int; n_unit int;
begin
  -- ── CHỐT AN TOÀN ──
  -- Xóa nhầm trên hệ thống đang chạy thật là mất dữ liệu không lấy lại được.
  -- Ba chốt dưới đây hỏi cùng một câu: "đã có người dùng thật chưa?"

  select count(*) into n_user from auth.users;
  if n_user > 0 then
    raise exception
      'DUNG LAI: da co % tai khoan dang nhap. Script nay chi dung khi he thong CHUA ai dung. Neu that su muon xoa, xu ly tay tung bang.', n_user;
  end if;

  select count(*) into n_pay from payments;
  if n_pay > 0 then
    raise exception 'DUNG LAI: da co % ban ghi thanh toan. Do la tien that, khong xoa tu dong.', n_pay;
  end if;

  select count(*) into n_inv from invoices where status <> 'draft';
  if n_inv > 0 then
    raise exception 'DUNG LAI: da phat hanh % hoa don. Hoa don da phat hanh la chung tu, khong xoa tu dong.', n_inv;
  end if;

  -- ── Xóa theo thứ tự khóa ngoại ──
  -- invoices/tickets tham chiếu units KHÔNG cascade, nên phải xóa trước khi
  -- xóa project (project cascade xuống buildings rồi units).
  delete from notifications n using invoices i
    where n.kind = 'invoice' and n.ref_id = i.id and i.project_id = p_demo;
  delete from notifications n using tickets t
    where n.kind = 'ticket' and n.ref_id = t.id and t.project_id = p_demo;

  delete from invoice_lines l using invoices i
    where l.invoice_id = i.id and i.project_id = p_demo;
  delete from invoices where project_id = p_demo;

  delete from ticket_events e using tickets t
    where e.ticket_id = t.id and t.project_id = p_demo;
  delete from tickets where project_id = p_demo;

  delete from meter_readings m using units u join buildings b on b.id = u.building_id
    where m.unit_id = u.id and b.project_id = p_demo;

  select count(*) into n_mem from unit_memberships m
    join units u on u.id = m.unit_id join buildings b on b.id = u.building_id
   where b.project_id = p_demo;

  select count(*) into n_unit from units u
    join buildings b on b.id = u.building_id where b.project_id = p_demo;

  -- announcements/documents/sla_policies/fee_types/buildings/units đều cascade
  -- từ projects, nên xóa project là hết.
  delete from projects where id = p_demo;

  raise notice 'DA XOA du lieu mau: % can ho, % thanh vien, cung toan bo toa/bieu phi/SLA/noi quy cua du an mau.', n_unit, n_mem;
end $reset$;

-- Kiểm lại: phải ra 0 hết. Ra khác 0 thì ROLLBACK thay vì COMMIT.
select
  (select count(*) from projects) as du_an_con_lai,
  (select count(*) from buildings) as toa,
  (select count(*) from units) as can_ho,
  (select count(*) from fee_types) as bieu_phi,
  (select count(*) from sla_policies) as sla;

-- ═══════════════════════════════════════════════════════════════════════════
-- Đọc kết quả ở trên. Đúng như mong đợi thì:
--     commit;
-- Sai một chỗ nào đó thì:
--     rollback;
-- Script cố ý KHÔNG tự commit — bước cuối là quyết định của người chạy.
-- ═══════════════════════════════════════════════════════════════════════════
