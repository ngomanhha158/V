-- Cần schema auth.users và ba role anon/authenticated/service_role. Trên
-- Postgres thuần thì railway/00_compat.sql dựng sẵn chúng, nên file này chạy
-- được nguyên văn ở cả hai nơi và nằm trong `npm run verify:railway`.
-- Chạy sau schema.sql và seed.sql.

-- Tạo profiles tự động khi có user mới, nếu không FK unit_memberships.user_id sẽ gãy.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  insert into profiles (id, full_name, phone, email)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name', 'Cư dân'),
          new.phone,
          new.email)
  on conflict (id) do nothing;
  return new;
end $fn$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ─────────────────────── DENY BY DEFAULT (bắt buộc trước) ────────────────────
-- Supabase cấp sẵn ALL trên MỌI bảng public cho anon + authenticated bằng
-- default privileges (pg_default_acl, cả role postgres lẫn supabase_admin).
-- Không thu hồi nền đó thì danh sách grant bên dưới VÔ NGHĨA — nó chỉ cộng thêm
-- vào một nền đã mở toang: ai cầm publishable key (khóa công khai, nằm trong
-- bundle JS) cũng đọc/ghi được profiles, payments, staff_assignments...
-- Và ghi được staff_assignments nghĩa là tự phong mình làm BQL: is_staff() trả
-- true, RLS của tickets/invoices bị vượt qua luôn.
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- ───────────────────── service_role: cấp lại nền của nó ──────────────────────
-- BẪY, và là bẫy chỉ lộ ra khi rời Supabase: bên đó `service_role` được cấp
-- sẵn mọi thứ bằng default privileges của họ. Trên Postgres thuần thì KHÔNG có
-- gì cấp cho nó cả, mà `bypassrls` chỉ bỏ qua RLS — nó không cho quyền bảng.
--
-- Hai đường chết ngay nếu thiếu đoạn này, và cả hai đều im lặng cho tới lúc
-- có tiền thật hoặc có hạn thật:
--   • Webhook ngân hàng — `.from('projects')` rồi `.rpc('ghi_nhan_tien_ve')`.
--     Trả 5xx, nhà cung cấp retry vài lần rồi bỏ, tiền của cư dân biến mất
--     khỏi hệ thống.
--   • Cả năm job nền qua /api/cron — nhắc nợ, leo thang ticket, thu hồi tư
--     cách hết hạn, mở kỳ bảo trì, dọn mã. Không cái nào chạy, không cái nào
--     kêu.
-- Câu `revoke execute ... from public` bên dưới càng làm nặng thêm: nó gỡ luôn
-- cái quyền PUBLIC mà service_role đang vô tình sống nhờ.
--
-- Cấp RỘNG, đúng bằng những gì Supabase vẫn cấp, chứ không liệt kê từng bảng.
-- Liệt kê nghe có vẻ chặt hơn nhưng không mua được gì: role này đã bypassrls,
-- và ai ký được token của nó thì cũng ký được token vai bất kỳ. Đổi lại, danh
-- sách liệt kê nghĩa là mỗi tính năng mới đi qua đường admin sẽ hỏng bằng một
-- lỗi 403 khó hiểu, phát hiện ở production — đúng kiểu hỏng vừa xảy ra.
--
-- An toàn nằm ở chỗ khác, và nằm ở ba lớp: khóa ký không có tiền tố
-- NEXT_PUBLIC_ nên không vào bundle; createAdminClient ném lỗi nếu thấy mình
-- chạy trong trình duyệt; token nó ký ra chỉ sống 60 giây.
grant usage on schema public to service_role;
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
alter default privileges in schema public grant all on tables    to service_role;
alter default privileges in schema public grant all on sequences to service_role;

-- ─────────────────────────── Cấp lại đúng phần cần ───────────────────────────
-- Role `authenticated` của Supabase cần quyền bảng; RLS mới là lớp lọc dòng.
-- anon giữ usage trên schema nhưng không có bảng nào -> PostgREST không trả dữ liệu.
grant usage on schema public to anon, authenticated;
grant select on units, buildings, projects, documents, sla_policies, fee_types to authenticated;
-- profiles có RLS (policy profile_read): chỉ thấy chính mình và thành viên
-- các căn mình quản lý, không phải cả danh bạ khu.
grant select on profiles to authenticated;
grant select, insert, update on unit_memberships to authenticated;
-- Ghi cây tài sản: chỉ BQL qua policy is_staff(). Cấp quyền bảng ở đây là chưa
-- đủ để ai cũng sửa được — RLS mới là lớp quyết định.
grant insert, update, delete on units, buildings to authenticated;
-- Xe/thú cưng: chủ hộ tự quản, policy dùng is_unit_manager().
grant select, insert, update, delete on unit_vehicles, unit_pets to authenticated;
-- update cho BQL đổi trạng thái/phân công. Policy ticket_staff_write mới quyết
-- định ai được đụng dòng nào — cư dân không có policy update nên vẫn bị chặn.
grant select, insert, update on tickets to authenticated;
grant select on staff_assignments to authenticated;
-- Biểu phí và chỉ số công tơ: RLS quyết định ai ghi (chỉ BQL).
grant insert, update, delete on fee_types to authenticated;
-- SLA: policy sla_staff_write đã cho phép BQL ghi từ đầu, nhưng thiếu grant thì
-- policy không bao giờ chạy tới — Postgres chặn ở tầng quyền bảng trước. Hệ quả
-- không ai ngờ: danh mục sự cố ở màn báo hỏng của cư dân lấy từ chính bảng này,
-- nên khu chưa có SLA là cư dân không gửi được yêu cầu nào.
grant insert, update, delete on sla_policies to authenticated;
grant select, insert, update, delete on meter_readings to authenticated;
-- CỐ Ý không cấp update/insert trên invoices, invoice_lines, payments cho
-- authenticated: đường tiền đi qua RPC definer (bql_generate_invoices,
-- bql_issue_invoices) để cư dân không bao giờ có quyền ghi bảng tiền.
-- Chỉ ĐỌC ticket_events: audit trail mà người bị audit ghi được thì vô nghĩa.
grant select on ticket_events to authenticated;
-- Sổ tiền về: RLS (bank_txn_staff_read) lọc xuống còn dự án của người đó.
-- Không cấp insert/update/delete cho ai — ghi vào sổ tiền chỉ qua hàm definer.
grant select on bank_transactions to authenticated;
grant select on invoices, invoice_lines, announcements, notifications to authenticated;
-- Sổ quỹ: policy payment_staff_read đã lọc xuống BQL của đúng dự án từ đầu,
-- nhưng thiếu grant thì policy không bao giờ chạy tới — Postgres chặn ở tầng
-- quyền bảng TRƯỚC. Đây là bảng thứ hai dính đúng cái bẫy đó sau sla_policies.
--
-- raw_payload giữ nguyên gói tin ngân hàng, có tên người chuyển; nhưng đó đúng
-- là thứ BQL cần khi đối chiếu, và policy đã chặn cư dân. Cấp select ở đây là
-- cùng một quyết định đã cấp cho bank_transactions ngay trên, không phải nới
-- lỏng gì thêm. Vẫn KHÔNG cấp insert/update/delete: ghi vào bảng tiền chỉ đi
-- qua hàm definer.
grant select on payments to authenticated;
-- Sổ chứng từ (§15). Cư dân đọc phiếu của căn mình, BQL đọc cả dự án — hai
-- chuyện đó do policy phieu_thu_read quyết, grant này chỉ mở cửa cho policy
-- được chạy tới. KHÔNG cấp insert/update/delete cho ai: một sổ chứng từ mà
-- người cầm phiếu sửa được thì không còn là chứng từ.
grant select on phieu_thu, phieu_thu_dong to authenticated;
-- Quỹ bảo trì (§16). Cả sổ MỞ cho mọi cư dân trong dự án — công khai chính là
-- cơ chế giám sát của tính năng này. quy_so_ke_toan chạy security invoker nên
-- không có grant này thì hàm đó lỗi permission denied ngay cả với BQL.
-- Không cấp insert/update/delete: vào sổ quỹ chỉ qua hàm definer.
grant select on quy_bao_tri, quy_bao_tri_giao_dich to authenticated;
-- Khách thăm (§17). RLS (khach_read) lọc xuống căn của người đó, hoặc cả dự án
-- nếu là nhân sự. Cột `ma` nằm trong bảng này: đó là mã cư dân gửi cho khách
-- qua Zalo, và họ phải mở lại xem được để gửi lần nữa. Không cấp ghi cho ai —
-- mời / thu hồi / quét đều đi qua hàm definer.
grant select on khach_tham to authenticated;
-- Đặt tiện ích (§18). BQL sửa danh mục tiện ích và suất qua RLS (tien_ich_staff_write
-- / suat_staff_write) nên cần quyền ghi ở tầng bảng; đặt/hủy suất thì đi qua hàm
-- definer, nên dat_tien_ich chỉ cấp select.
grant select, insert, update, delete on tien_ich, tien_ich_suat to authenticated;
-- Nhận hàng hộ (§19). Chỉ select: nhận / trao / hủy đều đi qua hàm definer.
grant select on kien_hang to authenticated;
-- Chốt sổ bàn giao (§20). Cư dân đọc được BẢN CHỐT (số liệu chung của cả tòa,
-- công khai là cơ chế giám sát) nhưng RLS chot_can_read chỉ cho họ thấy dòng
-- của CĂN MÌNH trong phần chi tiết — công nợ hàng xóm không phải việc của họ.
grant select on chot_ban_giao, chot_ban_giao_can to authenticated;
-- Biểu quyết hội nghị (§21). Chỉ select trên cả ba bảng: mở cuộc, bỏ phiếu,
-- hủy phiếu, đóng cuộc đều đi qua hàm definer. Cấp insert thẳng trên
-- phieu_bieu_quyet là cho một căn tự ghi diện tích phiếu của mình — trọng số
-- phiếu do người bỏ phiếu tự khai thì cả cuộc biểu quyết mất nghĩa.
-- bieu_quyet_can (danh sách căn đóng băng) cả khu đọc được: mẫu số của mọi tỷ
-- lệ nằm ở đó, giấu nó đi là để lại đúng chỗ mà hội nghị hay bị nghi ngờ nhất.
grant select on bieu_quyet, bieu_quyet_can, phieu_bieu_quyet to authenticated;
-- Thu theo đợt (§22). Kế hoạch và lịch đợt: cả khu đọc được — con số trên hóa
-- đơn của họ phải tra ngược lại được tới nghị quyết đã duyệt. Số tiền của TỪNG
-- CĂN thì RLS (dtc_read) lọc theo đúng luật xem tiền của căn đó, cùng vị từ với
-- hóa đơn và phiếu thu. Không cấp quyền ghi: lập và hủy đều đi qua hàm definer,
-- vì phép chia tiền chỉ đúng khi làm ở một chỗ duy nhất.
grant select on ke_hoach_thu, ke_hoach_thu_dot, dot_thu_can to authenticated;
-- Ca trực và bàn giao ca (§23). Khối này CHỈ NHÂN SỰ đọc — RLS đã chốt bằng
-- is_staff, và cấp select ở đây không mở gì cho cư dân. Riêng ca_truc cấp cả
-- quyền ghi vì đó là danh mục BQL tự quản lý (policy ca_truc_staff chốt lại);
-- vào ca / bàn giao / ký nhận thì đi qua hàm definer, vì thứ tự và chữ ký chỉ
-- đúng khi làm ở một chỗ duy nhất.
grant select, insert, update, delete on ca_truc to authenticated;
grant select on phien_truc, ban_giao_ca, ban_giao_ca_viec to authenticated;
grant select on dat_tien_ich to authenticated;
-- Bảng tin và cẩm nang: RLS (announcement_staff_write / document_staff_write)
-- quyết định chỉ BQL ghi được. Cấp quyền bảng ở đây là chưa đủ để ai cũng sửa.
grant insert, update, delete on announcements, documents to authenticated;
-- KHÔNG cấp update trên notifications: đánh dấu đã đọc đi qua RPC
-- mark_notifications_read để không ai sửa được nội dung thông báo của mình.

-- Không cấp GHI trên profiles, staff_assignments, ticket_events, meter_readings,
-- payments, unit_vehicles, unit_pets: đây là dữ liệu cá nhân / tài chính / audit,
-- sửa được là mất luôn ý nghĩa của việc lưu. Ghi vào chúng đi qua hàm definer
-- hoặc service_role ở phía server, client không đụng thẳng.

-- ──────────────────────────── EXECUTE trên function ──────────────────────────
-- BẪY: Postgres mặc định cấp EXECUTE cho PUBLIC trên MỌI function mới (ACL hiện
-- ra dưới dạng `=X/postgres`, grantee rỗng = PUBLIC). Revoke từ anon/authenticated
-- KHÔNG đủ — nó chỉ xóa dòng thừa, PUBLIC vẫn cho tất cả gọi được. Phải revoke
-- từ PUBLIC rồi cấp lại đúng chỗ cần.
revoke execute on all functions in schema public from public, anon, authenticated;

-- Cấp lại cho service_role NGAY SAU câu revoke ở trên, không phải trước: câu
-- đó gỡ quyền của PUBLIC, mà service_role vốn chỉ gọi được hàm nhờ đúng cái
-- quyền PUBLIC ấy. Đây là chỗ ghi_nhan_tien_ve và cả năm hàm job nền mất
-- quyền, và không có gì báo cho tới khi ngân hàng bắn giao dịch đầu tiên.
grant execute on all functions in schema public to service_role;
alter default privileges in schema public grant execute on functions to service_role;

-- Helper của RLS: policy gọi chúng dưới quyền chính người đang truy vấn, mất
-- execute là policy tự lỗi permission denied và cư dân không đọc được gì.
grant execute on function current_unit_ids()     to authenticated;
grant execute on function is_staff(uuid)         to authenticated;
grant execute on function is_unit_manager(uuid)  to authenticated;
grant execute on function xem_duoc_tien_cua_can(uuid) to authenticated;
grant execute on function can_see_profile(uuid)  to authenticated;
grant execute on function building_project(uuid) to authenticated;
grant execute on function unit_project(uuid)     to authenticated;
grant execute on function announcement_targets_me(uuid, uuid, int, uuid) to authenticated;

-- RPC app gọi thẳng. Security invoker nên RLS vẫn là chốt chặn.
grant execute on function create_ticket(uuid, text, ticket_priority, text, text, text[]) to authenticated;
grant execute on function rate_ticket(uuid, int, text) to authenticated;
grant execute on function bql_generate_invoices(uuid, date) to authenticated;
grant execute on function bql_issue_invoices(uuid, date)   to authenticated;
grant execute on function bql_debt_report(uuid)            to authenticated;
grant execute on function mark_notifications_read(bigint[]) to authenticated;
grant execute on function bql_dashboard(uuid, date, date)  to authenticated;
grant execute on function bql_dashboard_thang(uuid, int)   to authenticated;
grant execute on function bql_doi_soat(uuid, text)         to authenticated;
grant execute on function bql_gan_giao_dich(uuid, uuid)    to authenticated;
grant execute on function bql_bo_qua_giao_dich(uuid, text) to authenticated;
grant execute on function bql_cho_duyet_chu_ho(uuid)         to authenticated;
grant execute on function bql_duyet_chu_ho_dau_tien(uuid)    to authenticated;
grant execute on function bql_san_sang_go_live(uuid)          to authenticated;
-- Quản lý người dùng. is_bql_manager là helper của các hàm dưới nhưng trang
-- /bql/nguoi-dung cũng gọi thẳng để quyết định có hiện form tạo tài khoản không.
grant execute on function is_bql_manager(uuid)                to authenticated;
grant execute on function bql_danh_sach_nguoi_dung(uuid)      to authenticated;
grant execute on function bql_gan_nhan_su(uuid, uuid, staff_role)   to authenticated;
grant execute on function bql_ngung_nhan_su(uuid, uuid, staff_role) to authenticated;
grant execute on function bql_gan_chu_ho_dau_tien(uuid, uuid)       to authenticated;
-- Phiếu thu (§15). lap_phieu_thu KHÔNG cấp cho authenticated: nó cấp số chứng
-- từ, gọi được là tự in phiếu cho một khoản tiền chưa từng về. Nó chỉ được gọi
-- từ trong gach_no, mà gach_no cũng không cấp cho authenticated.
grant execute on function huy_phieu_thu(uuid, text)                 to authenticated;
grant execute on function kiem_lien_tuc_phieu_thu(uuid, date)       to authenticated;
grant execute on function bql_so_phieu_thu(uuid, date)              to authenticated;
-- Quỹ bảo trì (§16). quy_so_du KHÔNG cấp: nó là hàm definer bỏ qua RLS, dùng
-- nội bộ trong quy_ghi để chặn chi vượt quỹ. Cấp ra ngoài là cửa đọc số dư quỹ
-- của mọi dự án mà không qua policy nào.
-- Khách thăm (§17). xoa_khach_cu KHÔNG cấp: nó là job nền, gọi bằng
-- service_role qua /api/cron. Cấp cho authenticated là cho bất kỳ ai xóa sạch
-- sổ ra vào bằng một lời gọi.
grant execute on function moi_khach(uuid, text, timestamptz, timestamptz, text, text) to authenticated;
grant execute on function thu_hoi_khach(uuid)                                 to authenticated;
grant execute on function quet_khach(text, boolean)                           to authenticated;
grant execute on function so_ra_vao(uuid, date, date)                         to authenticated;
grant execute on function ty_le_ho_dung_app(uuid)                             to authenticated;
grant execute on function khach_trang_thai(khach_tham, timestamptz)           to authenticated;
grant execute on function khach_an_han()                                      to authenticated;
-- Đặt tiện ích (§18).
-- Nhận hàng hộ (§19). nhac_kien_hang KHÔNG cấp: nó là job nền, gọi bằng
-- service_role qua /api/cron — cấp cho authenticated là cho bất kỳ ai bắn
-- thông báo tới toàn bộ cư dân đang có hàng ở quầy.
-- Chốt sổ bàn giao (§20).
grant execute on function cong_no_toi_moc(uuid, date)                         to authenticated;
grant execute on function lap_chot_ban_giao(uuid, date, text)                 to authenticated;
grant execute on function ky_chot_ban_giao(uuid)                              to authenticated;
grant execute on function huy_chot_ban_giao(uuid, text)                       to authenticated;
grant execute on function chot_ban_giao_ds(uuid)                              to authenticated;
grant execute on function kien_trang_thai(kien_hang)                          to authenticated;
grant execute on function kien_han_ngay()                                     to authenticated;
grant execute on function nhan_loai_kien(text)                                to authenticated;
grant execute on function nhan_kien_hang(uuid, text, text, text, text, text)  to authenticated;
grant execute on function giao_kien_hang(uuid, uuid)                          to authenticated;
grant execute on function huy_kien_hang(uuid, text)                           to authenticated;
grant execute on function kien_dang_giu(uuid)                                 to authenticated;
grant execute on function kien_cua_toi()                                      to authenticated;
grant execute on function tuan_cua(date)                                      to authenticated;
grant execute on function dat_suat(uuid, date)                                to authenticated;
grant execute on function huy_dat_suat(uuid)                                  to authenticated;
grant execute on function dong_suat(uuid, date, text)                         to authenticated;
grant execute on function lich_tien_ich(uuid, date, date)                     to authenticated;
grant execute on function con_suat_tuan(uuid, date)                           to authenticated;
grant execute on function khach_cua_toi()                                     to authenticated;
grant execute on function o_trong_du_an(uuid)                                 to authenticated;
grant execute on function is_bqt(uuid)                                        to authenticated;
grant execute on function quy_ghi_duoc(uuid)                                  to authenticated;
grant execute on function quy_so_ke_toan(uuid)                                to authenticated;
grant execute on function quy_ghi(uuid, text, date, text, bigint, text, date, text) to authenticated;
grant execute on function quy_dao(uuid, text)                                 to authenticated;
grant execute on function quy_dat_doi_chieu(uuid, text, text, bigint, date)   to authenticated;
grant execute on function tien_chu(bigint)                          to authenticated;
-- Biểu quyết hội nghị (§21). Mọi hàm tự chốt quyền BÊN TRONG: mở/đóng/hủy đòi
-- is_bql_manager hoặc is_bqt, bỏ phiếu đòi owner/authorized của đúng căn. Cấp
-- cho authenticated ở đây vì thế không mở thêm gì — nó chỉ quyết định ai GỌI
-- ĐƯỢC, còn ai LÀM ĐƯỢC thì nằm trong thân hàm.
grant execute on function mo_bieu_quyet(uuid, text, text, numeric, numeric) to authenticated;
grant execute on function bo_phieu_bieu_quyet(uuid, uuid, text)               to authenticated;
grant execute on function huy_phieu_bieu_quyet(uuid, text)                    to authenticated;
grant execute on function kiem_phieu_bieu_quyet(uuid)                         to authenticated;
grant execute on function dong_bieu_quyet(uuid)                               to authenticated;
grant execute on function huy_bieu_quyet(uuid, text)                          to authenticated;
grant execute on function bieu_quyet_cua_toi(uuid)                            to authenticated;
-- Thu theo đợt (§22).
grant execute on function lap_ke_hoach_thu(uuid, text, bigint, text, int, date, text, date, text) to authenticated;
grant execute on function huy_ke_hoach_thu(uuid, text)                        to authenticated;
grant execute on function ke_hoach_thu_ds(uuid)                               to authenticated;
grant execute on function ke_hoach_thu_chi_tiet(uuid)                         to authenticated;
grant execute on function tra_gop_cua_toi()                                   to authenticated;
-- Ca trực và bàn giao ca (§23). Mọi hàm tự chốt is_staff hoặc "chính người đang
-- trực" BÊN TRONG, nên cấp cho authenticated chỉ quyết định ai GỌI ĐƯỢC.
grant execute on function vao_ca(uuid, date)                                  to authenticated;
grant execute on function ban_giao_ca(uuid, uuid, text, uuid[])               to authenticated;
grant execute on function ky_nhan_ca(uuid)                                    to authenticated;
grant execute on function ket_ca_khong_ban_giao(uuid, text)                   to authenticated;
grant execute on function dang_truc(uuid)                                     to authenticated;
grant execute on function ban_giao_chua_ky(uuid)                              to authenticated;
grant execute on function so_ban_giao_ca(uuid, date, date)                    to authenticated;
grant execute on function viec_ban_giao(uuid)                                 to authenticated;

-- ghi_nhan_tien_ve / gach_no / tach_ma_can / goi_y_can KHÔNG cấp cho
-- authenticated. ghi_nhan_tien_ve là cửa vào của webhook: ai gọi được nó là
-- tự ghi tiền vào hệ thống mà chẳng cần chuyển khoản đồng nào. Route handler
-- gọi bằng service_role, không qua phiên người dùng.


-- Còn lại là trigger function và job nền: không phải RPC endpoint, để nguyên là
-- chúng nằm chình ình ở /rest/v1/rpc/...

-- ────────────────────────────────── FORCE RLS ────────────────────────────────
-- Bắt buộc: bảng chưa bật RLS mà đã grant = ai đăng nhập cũng đọc được toàn bộ.
alter table tickets          force row level security;
alter table invoices         force row level security;
alter table unit_memberships force row level security;
alter table notifications    force row level security;
alter table invoice_lines    force row level security;
alter table profiles         force row level security;
alter table unit_vehicles    force row level security;
alter table unit_pets        force row level security;
alter table ticket_events    force row level security;
alter table staff_assignments force row level security;
alter table meter_readings   force row level security;
-- Bốn bảng dữ liệu dùng chung + bảng tiền. FORCE hiện chưa đổi gì vì chủ bảng
-- là postgres và role đó có BYPASSRLS, nhưng để sót thì ngày đổi chủ bảng sang
-- role thường là RLS im lặng ngừng áp cho chính chủ.
alter table buildings        force row level security;
alter table units            force row level security;
alter table fee_types        force row level security;
alter table payments         force row level security;
-- bank_transactions KHÔNG force: hàm definer (gach_no, ghi_nhan_tien_ve) chạy
-- dưới quyền owner và phải ghi được vào bảng này, mà bảng cố ý không có policy
-- ghi nào. Chốt chặn ở đây là GRANT — authenticated chỉ có select — cộng với
-- policy đọc theo dự án.

-- Sổ kiểm toán: chỉ ĐỌC, và RLS (audit_staff_read) lọc xuống dự án của người
-- đó. Cố ý không cấp insert/update/delete cho bất kỳ ai, kể cả BQL — sổ mà
-- người bị ghi sổ sửa được thì vô nghĩa. Trigger ghi_nhat_ky() chạy security
-- definer nên vẫn ghi được.
grant select on audit_log to authenticated;

-- Bảo trì định kỳ: RLS (mp_staff / mr_staff) đã chốt xuống BQL của đúng dự án.
-- Cấp đủ quyền ghi vì đây là bảng BQL tự quản lý — khác payments hay audit_log.
grant select, insert, update, delete on maintenance_plans, maintenance_runs to authenticated;
grant execute on function xong_bao_tri(uuid, text) to authenticated;

-- Bình luận và thăm dò trên bảng tin.
-- Cư dân VIẾT được bình luận nhưng KHÔNG sửa/xóa: sửa lời mình đã nói sau khi
-- người khác trả lời là bẻ cong cả mạch hội thoại. Ẩn là quyền của BQL, và
-- policy ac_bql đã chốt điều đó — grant update ở đây chưa đủ để cư dân sửa.
grant select, insert, update on announcement_comments to authenticated;
grant usage, select on sequence announcement_comments_id_seq to authenticated;
grant select, insert, update, delete on announcement_polls to authenticated;
grant select on announcement_votes to authenticated;
-- KHÔNG cấp insert/update thẳng trên announcement_votes: bỏ phiếu đi qua
-- bo_phieu() để một căn một phiếu và chốt "đã đóng" nằm ở một chỗ duy nhất.
grant execute on function bo_phieu(uuid, uuid, int) to authenticated;
grant execute on function ket_qua_tham_do(uuid) to authenticated;

-- Thẻ cư dân. Hàm tự chốt is_staff BÊN TRONG, nên cấp cho authenticated ở đây
-- không mở gì thêm: cư dân gọi được nhưng nhận về lỗi quyền. Cấp riêng cho
-- role `security` thì không làm được — Postgres cấp quyền theo role đăng nhập,
-- mà cả BQL lẫn bảo vệ đều đăng nhập dưới cùng một role `authenticated`; vai
-- trò trong tòa nhà nằm ở staff_assignments, không nằm ở tầng Postgres.
grant execute on function kiem_the(uuid, uuid) to authenticated;

-- Chỗ đỗ xe. Cư dân ĐỌC được hạn mức của tòa mình — không thấy con số thì
-- "còn 3 chỗ" chỉ là lời nói miệng và hàng chờ mất hết sức thuyết phục.
-- KHÔNG cấp quyền ghi thẳng: mọi thay đổi đi qua hàm, vì thứ tự hàng chờ và
-- phép đếm sức chứa là những thứ chỉ đúng khi làm trong một chỗ duy nhất.
-- Policy bai_xe_staff vì thế không bao giờ chạy tới — giữ lại làm lớp chặn
-- thứ hai cho ngày ai đó cấp thêm quyền ghi mà quên mất lý do ở đây.
grant select on bai_xe to authenticated;
grant execute on function dang_ky_xe(uuid, text, loai_xe, text) to authenticated;
grant execute on function duyet_xe_tiep(uuid, loai_xe)          to authenticated;
grant execute on function dat_han_muc_bai_xe(uuid, loai_xe, int, int, text) to authenticated;
grant execute on function cho_do_cua_can(uuid)                  to authenticated;
grant execute on function bai_xe_tong_quan(uuid)                to authenticated;
