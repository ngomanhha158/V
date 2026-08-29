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

### 1. Nơi chạy — Railway  ✔ đã cấu hình

`railway.json` đã có trong repo. Railway là đường deploy Node.js chính thức
được Next.js 16 liệt kê trong tài liệu, và anh đã dùng Railway cho dự án khác
nên không phải mở thêm nhà cung cấp.

- Build `npm ci && npm run build`, chạy `npm run start` (Next tự nghe `$PORT`)
- Health check `/api/health` — cố ý KHÔNG chạm Supabase, vì health check trả
  lời "tiến trình còn sống không" chứ không phải "Supabase còn sống không".
  Gọi DB trong đó thì một sự cố bên Supabase sẽ làm Railway giết container và
  chặn mọi lần deploy sau.
- **Chọn vùng Southeast Asia (Singapore)** khi tạo service. Railway chỉ có 4
  vùng: US West, US East, EU West, Singapore — Singapore gần VN nhất.

Cần đặt 6 biến môi trường:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_VBUILDING_AUTH=email   # 'email' hoặc 'sms'; đang tạm email
VBUILDING_BANK_BIN                 # BIN NAPAS 6 số, VD Vietcombank 970436
VBUILDING_BANK_ACCOUNT             # số tài khoản nhận phí
VBUILDING_BANK_NAME                # tên chủ tài khoản, in trên màn hóa đơn
```

Ba biến ngân hàng thiếu thì hóa đơn vẫn xem được, chỉ là không có mã QR và
cư dân phải hỏi BQL số tài khoản.

**Lưu ý về biến `NEXT_PUBLIC_`**: Next nhúng chúng vào bundle JavaScript lúc
`next build`, không đọc lúc chạy. Nên đổi `NEXT_PUBLIC_VBUILDING_AUTH` từ
email sang sms là phải **build lại**, không chỉ restart. Railway đổi biến thì
tự deploy lại nên vẫn đúng một thao tác.

### 2. Đăng nhập — đang tạm dùng email OTP  ✔ đã làm

Đã chuyển sang **email OTP**. Supabase gửi email sẵn, không cần nhà cung cấp
nào. SMS để sau; lúc có thì đổi `NEXT_PUBLIC_VBUILDING_AUTH=sms` rồi deploy
lại — code đã hỗ trợ sẵn cả hai đường, không phải sửa gì.

Còn **hai việc phải làm trong dashboard Supabase**, không làm được từ code:

**a. Site URL và Redirect URLs** (Authentication → URL Configuration).
Link trong email trỏ về đây. Đặt Site URL là domain thật sau khi deploy, và
thêm `<domain>/auth/confirm` vào danh sách Redirect URLs. Thiếu bước này thì
bấm link trong email sẽ rơi về localhost.

**b. Mẫu email** (Authentication → Email Templates → Magic Link).
Mẫu mặc định **chỉ có đường link, không có mã 6 số**. Thêm dòng này vào mẫu
để cư dân gõ mã cho nhanh:

```html
<p>Mã đăng nhập của bạn: <b>{{ .Token }}</b></p>
```

Không sửa cũng vẫn đăng nhập được — app có sẵn route `/auth/confirm` xử lý
đường link, nên bấm link là vào. Sửa mẫu chỉ để có thêm đường gõ mã, tiện hơn
khi mở email trên máy khác.

### 3. Chưa có tài khoản BQL

`staff_assignments` đang rỗng. Không có ai là BQL thì toàn bộ màn `/bql`
đóng, và không ai sinh được hóa đơn.

Thứ tự bắt buộc — không đảo được:

1. Deploy xong và đặt Site URL (mục 1 và 2 ở trên)
2. Người sẽ làm BQL **tự đăng nhập một lần** (để `auth.users` và `profiles`
   có bản ghi của họ)
3. Điền `v_email` trong `bootstrap_bql.sql` bằng email của họ rồi chạy file đó

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
[anh] chọn nơi host, tạo project trên đó
        ↓
[em] deploy + cắm biến môi trường
        ↓
[anh] đặt Site URL + Redirect URL trong Supabase (Authentication → URL Configuration)
        ↓
[anh] người làm BQL đăng nhập một lần bằng email
        ↓
[anh] đưa email đó  →  [em] chạy bootstrap_bql.sql
        ↓
[em] chạy reset_demo_data.sql xóa dữ liệu mẫu
        ↓
[anh] đưa danh sách căn hộ thật (Excel) + mức phí thật + số tài khoản nhận tiền
        ↓
mở cho một tầng dùng thử trước, rồi mở cả tòa
```

Em không tự mở tài khoản host, không tự bịa email BQL, và không tự đoán mức
phí của tòa. Còn lại em làm được hết.

## Nên mở dần, đừng mở hết một lượt

Mở một tầng trước — khoảng chục căn. Kỳ hóa đơn đầu tiên là lúc mọi sai sót về
tiền lộ ra, và sai tiền thì mất niềm tin không lấy lại được. Một tầng sai thì
xin lỗi mười nhà; cả tòa sai thì xin lỗi vài trăm nhà cùng lúc.
