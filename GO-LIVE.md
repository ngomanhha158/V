# Go-live

Trạng thái đo trên project Supabase `abobwfohmyukuyxmtwgp` ngày 29/08/2026.
Không phải kế hoạch — là những gì đã kiểm và những gì còn thiếu.

## Đã sẵn sàng

| Hạng mục | Trạng thái |
|---|---|
| Schema + RLS | 19 migration đã áp. Advisor bảo mật: **0 lỗi ERROR** |
| Job nền | 3 job pg_cron đang chạy, lần chạy gần nhất `succeeded` |
| Lưu trữ ảnh | bucket `ticket-photos` riêng tư, 2 policy |
| Quyền `anon` | **Không có bảng nào** — khóa công khai không đọc được gì |
| Bộ test | 6 file SQL + 27 test JS, xanh trên CI mỗi lần push |
| Giao diện | 24 route, build sạch, sáng/tối |

Ba job nền và giờ chạy (giờ VN):

- `expire-memberships` — 00:05 mỗi ngày, thu quyền hợp đồng hết hạn
- `escalate-overdue-tickets` — 5 phút/lần, leo thang yêu cầu quá hạn SLA
- `remind-unpaid-invoices` — 08:00 mỗi ngày, nhắc nợ T-3 / T-0 / T+3

## Chưa go-live được — và vì sao

### 1. Chưa có nơi chạy

Repo không có cấu hình deploy nào. App mới chỉ chạy trên máy dev.

Cần: chọn nơi host (Vercel là hợp nhất với Next.js), rồi đặt 5 biến môi trường:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
VBUILDING_BANK_BIN            # BIN NAPAS 6 số, VD Vietcombank 970436
VBUILDING_BANK_ACCOUNT        # số tài khoản nhận phí
VBUILDING_BANK_NAME           # tên chủ tài khoản, in trên màn hóa đơn
```

Ba biến ngân hàng thiếu thì hóa đơn vẫn xem được, chỉ là không có mã QR và
cư dân phải hỏi BQL số tài khoản.

### 2. Chưa ai đăng nhập được

Màn đăng nhập dùng OTP qua **SMS**. Supabase cần được cắm nhà cung cấp SMS
thì mới gửi được mã. Chưa cắm thì không ai — kể cả BQL — vào được hệ thống.

Cần chọn một trong hai:

- **Nhà cung cấp SMS**: Twilio / Vonage, hoặc eSMS / SpeedSMS của VN (rẻ hơn
  đáng kể cho đầu số nội địa). Phải tự mở tài khoản, rồi đưa khóa để cắm vào
  Supabase Auth.
- **Tạm dùng OTP qua email**: Supabase gửi sẵn, không cần nhà cung cấp nào.
  Đổi màn đăng nhập mất vài dòng. Đi trước được ngay, sau có SMS thì đổi lại.

### 3. Chưa có tài khoản BQL

`staff_assignments` đang rỗng. Không có ai là BQL thì toàn bộ màn `/bql`
đóng, và không ai sinh được hóa đơn.

Thứ tự bắt buộc — không đảo được:

1. Sửa mục 2 ở trên để đăng nhập được
2. Người sẽ làm BQL **tự đăng nhập một lần** (để `auth.users` và `profiles`
   có bản ghi của họ)
3. Sửa `v_phone` trong `bootstrap_bql.sql` thành số của họ rồi chạy file đó

`bootstrap_bql.sql` cố ý chạy bằng quyền `postgres`: `staff_assignments`
không cấp quyền ghi cho ai, vì tự ghi được bảng đó là tự phong mình làm BQL
và vượt luôn RLS của toàn bộ ticket/hóa đơn.

### 4. Dữ liệu trên DB đang là dữ liệu MẪU

Hiện có: dự án "Sunrise Riverside", 2 tòa P1/P2, 24 căn — đều do `seed.sql`
sinh ra. Chính file đó ghi "KHÔNG chạy trên production" nhưng đã lỡ chạy.

Cư dân thật đăng nhập vào mà thấy 24 căn ma thì hỏng ngay ấn tượng đầu.

Cần: chạy `reset_demo_data.sql` (có ba chốt an toàn, từ chối chạy nếu đã có
tài khoản / thanh toán / hóa đơn đã phát hành), rồi:

1. Tạo tòa thật ở màn `/bql`
2. Import căn hộ thật từ Excel ở `/bql/import` — cột bắt buộc: Tòa, Mã căn, Tầng
3. Sửa biểu phí ở `/bql/billing` cho khớp mức thu thật của tòa
4. Ngồi với BQL chốt lại 10 dòng SLA — số hiện tại là mặc định khởi tạo, không
   phải cam kết ai đã đồng ý

### 5. Đối soát ngân hàng còn làm tay

Webhook gạch nợ tự động (N19–N20) chưa làm, vì chưa chốt **SePay hay Casso**.
Hai bên khác nhau cả định dạng payload lẫn cách xác thực chữ ký.

Không chặn go-live: cư dân vẫn quét QR chuyển tiền được, chỉ là BQL phải đối
chiếu sao kê và nhập tay. Với 24 căn thì chịu được; vài trăm căn thì không.

## Thứ tự chạy

```
[anh] chọn nhà cung cấp SMS (hoặc chốt tạm dùng email OTP)
        ↓
[anh] mở tài khoản, đưa khóa  →  [em] cắm vào Supabase Auth
        ↓
[anh] người làm BQL đăng nhập một lần
        ↓
[anh] đưa SĐT đó  →  [em] chạy bootstrap_bql.sql
        ↓
[em] chạy reset_demo_data.sql xóa dữ liệu mẫu
        ↓
[anh] đưa danh sách căn hộ thật (Excel) + mức phí thật + số tài khoản nhận tiền
        ↓
[em] deploy, cắm biến môi trường, import dữ liệu
        ↓
mở cho một tầng dùng thử trước, rồi mở cả tòa
```

Bốn việc đầu đều cần anh làm hoặc quyết. Em không tự mở tài khoản SMS, không
tự bịa số điện thoại BQL, và không tự đoán mức phí của tòa.

## Nên mở dần, đừng mở hết một lượt

Mở một tầng trước — khoảng chục căn. Kỳ hóa đơn đầu tiên là lúc mọi sai sót về
tiền lộ ra, và sai tiền thì mất niềm tin không lấy lại được. Một tầng sai thì
xin lỗi mười nhà; cả tòa sai thì xin lỗi vài trăm nhà cùng lúc.
