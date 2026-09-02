# VBUILDING — KẾ HOẠCH THỰC THI 30 NGÀY

> **Ghi chú 02/09/2026.** Đây là bản kế hoạch viết ngày 25/08, giữ nguyên làm
> hồ sơ. Ngăn xếp đã đổi: hệ thống chạy trọn trên Railway, không còn Supabase —
> Postgres + PostgREST + lớp đăng nhập tự viết, ảnh lưu trên Volume thay cho
> Storage. Trạng thái hiện hành đọc ở `GO-LIVE.md` và `railway/GD1-runbook.sh`;
> mọi dòng nhắc Supabase bên dưới là chuyện đã qua.


**N1 = Thứ Hai 31/08/2026 · Go-live N29 = 28/09 · Kết thúc N30 = 29/09**
Việc chạy trước ngay 25/08 (không chờ N1, không phụ thuộc quyết định nào): tạo Supabase/Vercel, apply `schema.sql`.
Zalo OA/ZNS: **hoãn theo quyết định 25/08** — xem mục 3bis để biết hệ quả và hạn chót thật.

**Mục tiêu tháng 1:** 1 tòa nhà pilot chạy thật với 3 module: Ticketing+SLA, Auto-Billing, Thông báo+Cẩm nang số.
**Không phải mục tiêu tháng 1:** Marketplace, Digital Twin, AI predictive, Gamification, Building Rating.

Lý do cắt: 3 module trên là thứ BQL trả tiền ngay. Phần còn lại cần *dữ liệu vận hành thật* mới có giá trị — xây trước khi có data = xây mù.

---

## 0. GIẢ ĐỊNH (sửa nếu sai, cả kế hoạch đổi theo)

| # | Giả định | Nếu sai thì |
|---|---|---|
| A1 | 1–3 dev full-time, 1 người chốt nghiệp vụ | 1 dev đơn độc → cắt tuần 4, giãn thành 6 tuần |
| A2 | Đã có 1 chung cư pilot đồng ý (≈200–500 căn) | Chưa có → Tuần 1 làm demo data, nhưng KHÔNG có validation thật |
| A3 | Có được file Excel danh sách căn hộ + cư dân từ BQL | Không có → +5 ngày nhập liệu thủ công |
| A4 | Ngân sách hạ tầng < 100 USD/tháng | — |

---

## 1. STACK (chốt, không bàn lại giữa chừng)

| Lớp | Chọn | Lý do |
|---|---|---|
| DB + Auth + Storage + Realtime | **Supabase (Postgres)** | RLS của Postgres giải quyết trực tiếp ma trận phân quyền 4 vai trò. Không phải viết tầng auth. |
| Web (BQL + BQT dashboard) | **Next.js 15 App Router + Tailwind + shadcn/ui** | 1 codebase, deploy Vercel |
| App cư dân | **PWA cùng codebase Next.js** (giai đoạn 1) | Không chờ duyệt App Store. Native/Expo để tháng 3 khi đã có PMF. |
| Thông báo đẩy | **Zalo ZNS + OA** (chính), web push (phụ) | 100% cư dân VN có Zalo. iOS PWA push yếu. |
| Đối soát ngân hàng | **SePay / Casso webhook** | Không đợi tích hợp API ngân hàng trực tiếp (3–6 tháng) |
| QR thanh toán | **VietQR động** (chuẩn NAPAS) | Miễn phí, mọi app ngân hàng quét được |
| Cron | pg_cron + Supabase Edge Functions | SLA escalation, sinh hóa đơn, hết hạn thuê |

> ⚠️ Zalo ZNS duyệt 5–15 ngày làm việc. Đã hoãn nộp (quyết định 25/08) → kênh đẩy chính không sẵn sàng đúng hạn. Cách bù: xem mục 3bis.

---

## 2. FILE ĐÃ CÓ TRONG THƯ MỤC NÀY

| File | Nội dung |
|---|---|
| `schema.sql` | Schema lõi: spatial hierarchy, `unit_memberships` (junction table + `valid_to`), ticketing/SLA, billing, thông báo, RLS policies, cron functions |
| `test_rls.sql` | 5 assert cho phần dễ vỡ nhất: family member không thấy công nợ, tenant hết hạn mất quyền ngay, 1 căn 1 chủ hộ |

Chạy kiểm tra:
```bash
psql "$DATABASE_URL" -f schema.sql && psql "$DATABASE_URL" -1 -f test_rls.sql
```

### 2 quyết định thiết kế cần biết
1. **Không có bảng `floors`.** Tầng là cột `units.floor_no` + index. Vẫn lọc được "gửi thông báo toàn tầng 12 tòa P3". Tách bảng khi tầng có thuộc tính riêng thật (đồng hồ tổng, thuê nguyên tầng).
2. **Không có bảng `join_requests`.** Luồng 1-chạm dùng chính `unit_memberships.status = 'pending'` → chủ hộ duyệt → `active`. Ít bảng hơn, cùng audit trail.

---

## 3. LỊCH 4 TUẦN

> ⚠️ **02/09 Quốc khánh rơi vào N3 (Tuần 1)**, thường nghỉ 2 ngày. Hai cách xử lý — chọn 1, đừng để trôi:
> (a) chạy trước phần setup từ 25/08 để bù, giữ nguyên go-live 28/09; hoặc
> (b) chấp nhận trượt, go-live 30/09.
> Lịch dưới đây tính theo phương án (a).

### TUẦN 1 (N1–N7 · 31/08 – 06/09) — Nền móng & Master Data
> Không có module nghiệp vụ nào chạy đúng nếu cây tài sản + ma trận nhân khẩu sai.

| Ngày | Việc |
|---|---|
| N1 | Tạo project Supabase + Vercel + repo. (Zalo OA/ZNS đã hoãn — mục 3bis) |
| N1–N2 | Apply `schema.sql`, chạy `test_rls.sql` xanh. Sinh TypeScript types từ DB. |
| N2–N3 | Auth OTP số điện thoại (Supabase phone auth / Zalo login). Onboarding: nhập SĐT → chọn tòa/căn → gửi yêu cầu gia nhập. |
| N3–N4 | Trang BQL: CRUD tòa/căn hộ + **import Excel danh sách căn hộ & cư dân** (đây là việc BQL đánh giá đầu tiên — làm cho tử tế, có preview + báo lỗi dòng). |
| N5 | Luồng phê duyệt 1 chạm: cư dân xin gia nhập → push chủ hộ → duyệt/từ chối. |
| N6 | Hồ sơ căn hộ: thành viên, xe, thú cưng. Chủ hộ thêm/xóa/đặt `valid_to`. |
| N7 | Cron `expire_memberships`. Deploy staging. Nạp dữ liệu thật của tòa pilot. |

**DoD Tuần 1:** BQL import xong toàn bộ căn hộ tòa pilot; 10 cư dân thật đăng nhập được và thấy đúng căn hộ của mình; `test_rls.sql` xanh trong CI.

---

### TUẦN 2 (N8–N14 · 07/09 – 13/09) — Ticketing & SLA (trái tim)

| Ngày | Việc |
|---|---|
| N8 | Cấu hình `sla_policies` cùng BQL: danh mục sự cố + thời hạn (mất nước 2h, thang máy 30 phút…). Không tự bịa — ngồi với BQL chốt. |
| N9–N10 | Tạo ticket 3 chạm: chụp ảnh → chọn danh mục → gửi. Upload Supabase Storage, nén ảnh phía client. Tự set `sla_respond_due`/`sla_resolve_due` từ policy. |
| N10–N11 | Bảng điều phối BQL: danh sách ticket, filter tòa/tầng/trạng thái, phân công kỹ thuật, đổi trạng thái. Mọi thay đổi ghi `ticket_events`. |
| N12 | Cron `escalate_overdue_tickets` 5 phút/lần + push Trưởng BQL khi quá hạn. |
| N13 | Realtime timeline cho cư dân + đánh giá 1–5 sao khi hoàn thành. |
| N14 | Test end-to-end với 2 kỹ thuật viên thật. Sửa lỗi. |

**DoD Tuần 2:** 20 ticket thật chạy trọn vòng đời; escalation bắn đúng khi quá hạn; cư dân đánh giá được.

---

### TUẦN 3 (N15–N21 · 14/09 – 20/09) — Auto-Billing & Đối soát

| Ngày | Việc |
|---|---|
| N15 | `fee_types` + công thức: cố định / theo m² / theo chỉ số. Nhập chỉ số điện–nước hàng tháng (form + import Excel). |
| N16–N17 | Sinh hóa đơn hàng loạt theo kỳ (idempotent — chạy 2 lần không nhân đôi). Trang duyệt & phát hành của BQL. |
| N18 | VietQR động cho từng hóa đơn: nội dung chuyển khoản chứa mã căn + kỳ để máy khớp được. |
| N19–N20 | Webhook SePay/Casso → `payments` (khóa `bank_ref` unique, chống bắn trùng) → auto gạch nợ → đổi `invoice.status`. **Bắt buộc có màn đối soát thủ công cho giao dịch không khớp** — luôn có người ghi sai nội dung. |
| N21 | Cron nhắc nợ: T-3 ngày, ngày đến hạn, T+3. Báo cáo công nợ cho BQL. |

**DoD Tuần 3:** Sinh hóa đơn 1 kỳ thật cho toàn tòa; ≥1 giao dịch chuyển khoản thật được gạch nợ tự động; sổ tổng khớp 100% với sao kê.

> Đây là tuần rủi ro cao nhất. Sai số tiền = mất niềm tin, không sửa được bằng patch. Đối soát tay từng đồng ở kỳ đầu.

---

### TUẦN 4 (N22–N30 · 21/09 – 29/09) — Truyền thông, Dashboard BQT, Go-live

| Ngày | Việc |
|---|---|
| N22 | Cẩm nang số: nhập nội quy, tìm kiếm full-text (`documents.search_tsv` đã sẵn). |
| N23 | Thông báo có target: toàn khu / tòa / tầng / căn + nút **trích dẫn nội quy** gắn `document_id`. |
| N24 | Gửi thông báo qua adapter kênh: in-app + web push chạy được ngay; ZNS bật khi có OA. Log `notifications.sent_*_at`, retry khi lỗi. |
| N25–N26 | Dashboard BQT (chỉ đọc): % ticket đúng SLA, thời gian xử lý trung bình, điểm hài lòng, công nợ tổng, thu/chi. Toàn bộ query từ `ticket_events` + `invoices`. |
| N27 | Rà soát bảo mật: RLS trên mọi bảng, không rò dữ liệu chéo căn hộ, rate limit, không log CCCD/SĐT. |
| N28 | Sửa lỗi + tối ưu tốc độ (index, N+1). |
| N29 | Go-live: dán poster QR ở sảnh + thang máy, BQL nhắn Zalo OA toàn cư dân. |
| N30 | Trực vận hành, thu thập phản hồi, chốt backlog tháng 2. |

**DoD Tuần 4:** ≥30% hộ tòa pilot kích hoạt tài khoản; BQT xem được KPI của BQL; 0 lỗi rò dữ liệu chéo căn hộ.

---

## 3bis. HỆ QUẢ VIỆC HOÃN ZALO OA/ZNS (quyết định 25/08)

Hạn chót thật: **hồ sơ phải nộp chậm nhất 02/09** thì mới kịp duyệt (5–15 ngày làm việc) trước N24 = 23/09. Nộp sau 02/09 thì coi như tháng 1 không có ZNS.

Cách bù, không làm trượt lịch:
- Tầng thông báo viết theo **adapter kênh**, không gọi thẳng API Zalo. `notifications` là nguồn sự thật; mỗi kênh là 1 hàm gửi. Bật/tắt bằng biến môi trường.
- Kênh chạy được ngay, không phụ thuộc ai duyệt: **in-app** (badge + danh sách) và **web push** (Android/desktop tốt, iOS cần cư dân Add to Home Screen).
- Thông báo gấp trong lúc chưa có ZNS: BQL broadcast tay trên Zalo OA hoặc nhóm Zalo hiện có, kèm link sâu vào app.

Đánh đổi phải chấp nhận: tỷ lệ cư dân đọc thông báo tháng 1 sẽ thấp hơn dự kiến → chỉ số "≥30% hộ kích hoạt" ở mục 4 khó đạt hơn, vì kênh kéo người dùng vào app mạnh nhất chính là ZNS.

---

## 4. CHỈ SỐ ĐO NGÀY 30 (đo được, không cảm tính)

| Chỉ số | Ngưỡng đạt |
|---|---|
| Hộ kích hoạt / tổng số hộ | ≥ 30% |
| Ticket qua app / tổng ticket (kể cả Zalo, gọi điện) | ≥ 50% |
| Ticket xử lý đúng SLA | ≥ 70% |
| Hóa đơn gạch nợ tự động (không cần sửa tay) | ≥ 80% |
| Chênh lệch sổ hệ thống vs sao kê ngân hàng | = 0 đồng |

Không đạt 3/5 chỉ số → tháng 2 là tháng sửa, không phải tháng thêm tính năng.

---

## 5. RỦI RO & CÁCH CHẶN

| Rủi ro | Xác suất | Cách chặn |
|---|---|---|
| Tháng 1 không có ZNS (đã hoãn nộp hồ sơ) | Cao | Adapter kênh + in-app/web push chạy trước; nộp chậm nhất 02/09 nếu vẫn muốn kịp. Mục 3bis |
| Nghỉ lễ 02/09 nuốt 2 ngày Tuần 1 | Chắc chắn | Xem ghi chú đầu mục 3 |
| Dữ liệu căn hộ từ BQL bẩn/thiếu | Rất cao | Import có preview + báo lỗi từng dòng; N7 chốt dữ liệu, không nhận thay đổi giữa chừng |
| Đối soát ngân hàng lệch | Cao | `bank_ref` unique + màn khớp tay bắt buộc + chốt sổ hàng ngày kỳ đầu |
| Cư dân không cài app | Rất cao | PWA (không cần store) + QR ở sảnh + BQL đẩy qua Zalo OA + gắn với thứ họ *cần*: xem hóa đơn & QR trả tiền |
| Scope creep sang Marketplace | Cao | Xem mục 6 |

---

## 6. CỐ TÌNH BỎ QUA — VÀ KHI NÀO THÊM

| Bỏ qua | Thêm khi |
|---|---|
| QR khách thăm | Có ≥50% hộ active + bảo vệ có thiết bị quét — Tháng 2 |
| Đăng ký tiện ích (gym, hồ bơi, chuyển nhà) | Tháng 2, sau khi ticketing ổn định |
| Marketplace nhà cung cấp | Có ≥3 tòa nhà chạy — mất giá trị nếu ít cầu |
| Digital Twin + AI dự báo hỏng hóc | Có ≥6 tháng lịch sử bảo trì. Không có data thì AI chỉ là demo |
| Gamification / Save-to-Earn | Sau khi tỷ lệ active ổn định — thưởng cho hành vi chưa tồn tại là vô nghĩa |
| Multi-tenant SaaS đầy đủ (billing theo tòa, white-label) | Có khách trả tiền thứ 2. Schema đã sẵn `project_id` để nâng cấp không cần migrate lớn |
| App native (Expo) | PWA chạm trần: cần push iOS ổn định hoặc quét NFC — Tháng 3 |

---

## 7. VIỆC CẦN BẠN QUYẾT TRƯỚC KHI CODE

**Hạn chót: hết 30/08.** Chưa chốt thì tắc từ N3 (02/09) trở đi.

1. **Tòa pilot đã chốt chưa?** Có hay không đổi cả cách làm Tuần 1.
2. **Ai chốt nghiệp vụ phía BQL?** Cần 1 người trả lời trong 24h, không thì SLA policy và biểu phí sẽ tắc.
3. **PWA hay native ngay?** Mặc định đang chọn PWA. Native đẩy toàn bộ lịch trên lùi ~2 tuần.
