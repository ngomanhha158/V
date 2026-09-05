# Go-live

Từ 02/09/2026 hệ thống chạy **trọn trên Railway**, không còn Supabase. Ba
service: Postgres, PostgREST, và app Next.js. Dựng theo `railway/GD1-runbook.sh`.

Không phải kế hoạch — là những gì đã kiểm và những gì còn thiếu.

> **Áp bất kỳ file `.sql` nào, kể cả sau này, thì phải chạy tiếp một câu:**
> `psql -c "notify pgrst, 'reload schema'"`
>
> PostgREST đọc danh mục bảng và hàm **một lần lúc khởi động** rồi giữ trong bộ
> nhớ. Thêm hàm mới mà không bảo nó nạp lại thì nó trả **404 cho đúng thứ vừa
> tạo** — và 404 nhìn giống hệt "gõ sai tên hàm", nên rất dễ đi tìm nhầm chỗ.

## Đã sẵn sàng

| Hạng mục | Trạng thái |
|---|---|
| Database | Postgres trên Railway, vùng **Singapore**, cùng vùng với app |
| Schema + RLS | `schema.sql` + `auth_hooks.sql`, chạy lại được từ đầu bất cứ lúc nào |
| Đăng nhập | Tự dựng (`railway/03_auth.sql`): mật khẩu bcrypt + mã một lần, đếm lượt dò ở tầng DB |
| Backup | GitHub Actions dump hằng ngày, gồm cả schema `auth` |
| Lưu trữ ảnh | Volume của service `v`, phục vụ qua `/api/anh` — hỏi lại quyền từng lần xem |
| Quyền `anon` | **Không có bảng nào** — request không JWT không đọc được gì |
| Bộ test | 23 file SQL độc lập + cả ngăn xếp Railway + 270 test JS, xanh trên CI mỗi lần push |
| Giao diện | 61 route thật (chưa kể bản demo), build sạch, sáng/tối |

Bảy job nền và giờ chạy (giờ VN). Đặt thiếu một cái thì nó KHÔNG chạy và
không có gì báo — bảng đối chiếu đầy đủ ở đầu `cron.sql` và bước 8 của
`railway/GD1-runbook.sh`:

- `thu-hoi-thanh-vien` — 00:05 mỗi ngày, thu quyền hợp đồng hết hạn
- `leo-thang-ticket` — 5 phút/lần, leo thang yêu cầu quá hạn SLA
- `nhac-no` — 08:00 mỗi ngày, nhắc nợ T-3 / T-0 / T+3
- `mo-ky-bao-tri` — 07:00 mỗi ngày, mở kỳ bảo trì tới hạn
- `don-ma-dang-nhap` — 03:00 mỗi ngày, dọn mã đăng nhập đã hết hạn
- `nhac-kien-hang` — 18:00 mỗi ngày, nhắc kiện hàng để quá 3 ngày ở quầy
- `don-so-ra-vao` — 02:30 mỗi ngày, xóa lượt khách quá 90 ngày. **Đây là lời
  hứa về hạn lưu mà màn Khách thăm nói với cư dân** — quên đặt lịch thì sổ ra
  vào giữ mãi, đúng cái mà tính năng đó cam kết là sẽ không làm.

## Chưa go-live được — và vì sao

### 1. Nơi chạy — Railway  ✔ đã cấu hình

`railway.json` đã có trong repo. Railway là đường deploy Node.js chính thức
được Next.js 16 liệt kê trong tài liệu, và anh đã dùng Railway cho dự án khác
nên không phải mở thêm nhà cung cấp.

- Build `npm ci && npm run build`, chạy `npm run start` (Next tự nghe `$PORT`)
- Health check `/api/health` — cố ý KHÔNG chạm database, vì health check trả
  lời "tiến trình còn sống không" chứ không phải "mọi thứ phụ thuộc còn sống
  không". Gọi DB trong đó thì một sự cố ở tầng dữ liệu sẽ làm Railway giết
  container và chặn mọi lần deploy sau.
- **Chọn vùng Southeast Asia (Singapore)** khi tạo service. Railway chỉ có 4
  vùng: US West, US East, EU West, Singapore — Singapore gần VN nhất.

Biến môi trường của service `v` (danh sách đầy đủ và lý do từng cái ở
`.env.example`):

```
POSTGREST_URL=http://postgrest.railway.internal:3000
AUTH_JWT_SECRET                    # PHẢI trùng khít PGRST_JWT_SECRET
SMTP_URL                           # thư đăng nhập; thiếu là không ai vào được
SMTP_FROM
ANH_DIR=/data/ticket-photos        # PHẢI trỏ vào một Volume đã gắn
NEXT_PUBLIC_VBUILDING_AUTH=email   # 'email' hoặc 'sms'; đang tạm email
VBUILDING_BANK_BIN                 # BIN NAPAS 6 số, VD Vietcombank 970436
VBUILDING_BANK_ACCOUNT             # số tài khoản nhận phí
VBUILDING_BANK_NAME                # tên chủ tài khoản, in trên màn hóa đơn
```

Ba biến ngân hàng thiếu thì hóa đơn vẫn xem được, chỉ là không có mã QR và
cư dân phải hỏi BQL số tài khoản. `SMTP_URL` thiếu thì nặng hơn nhiều: nút
"Gửi mã" báo lỗi, và lối vào duy nhất còn lại là mật khẩu BQL đặt tay.

**Volume cho ảnh.** Gắn một Volume vào service `v` tại đúng `/data/ticket-photos`.
Không gắn thì app vẫn nhận ảnh bình thường rồi mất sạch ở lần deploy kế tiếp —
lặng lẽ, và chỉ lộ ra lúc có người mở lại một yêu cầu cũ để đối chất.

**PostgREST không được có tên miền công khai.** Nó chỉ cần địa chỉ nội bộ. Mở
ra internet là phơi thẳng tầng dữ liệu, và chốt duy nhất còn lại là chữ ký JWT.

**Lưu ý về biến `NEXT_PUBLIC_`**: Next nhúng chúng vào bundle JavaScript lúc
`next build`, không đọc lúc chạy. Nên đổi `NEXT_PUBLIC_VBUILDING_AUTH` từ
email sang sms là phải **build lại**, không chỉ restart. Railway đổi biến thì
tự deploy lại nên vẫn đúng một thao tác.

### 2. Đăng nhập — email OTP hoặc mật khẩu  ✔ đã làm

Hai lối vào cùng một tài khoản: **mã một lần qua email** (mặc định cho cư dân,
không phải nhớ gì) và **mật khẩu** do BQL đặt (cho người dùng thường xuyên, và
cho lúc SMTP hỏng).

Không còn dashboard nào phải vào. Link trong thư lấy tên miền từ chính request
đang phục vụ, nên cùng một bản build chạy đúng ở cả máy dev lẫn Railway — không
có một ô "Site URL" nào để quên cập nhật. Mẫu thư nằm ở `lib/mail.ts` và có
sẵn **cả mã 6 số lẫn đường link**, mã đứng trước.

Việc duy nhất phải làm bên ngoài: có một tài khoản SMTP và điền `SMTP_URL`.
Gmail (mật khẩu ứng dụng), SendGrid, Amazon SES — cái nào cũng được, đổi nhà
cung cấp là đổi một chuỗi.

SMS để sau; lúc có thì đổi `NEXT_PUBLIC_VBUILDING_AUTH=sms` rồi deploy lại —
màn đăng nhập đã có sẵn cả hai đường, nhưng `/api/auth/ma` hiện trả lỗi rõ
ràng cho số điện thoại vì chưa cắm nhà cung cấp nào.

### 3. Chưa có tài khoản BQL

`staff_assignments` đang rỗng. Không có ai là BQL thì toàn bộ màn `/bql`
đóng, và không ai sinh được hóa đơn.

Thứ tự bắt buộc — không đảo được:

1. Deploy xong (mục 1 ở trên), đã chạy `railway/03_auth.sql`
2. Tạo tài khoản cho người sẽ làm BQL. Chạy trong Console của service Postgres:

   ```sql
   select auth_tao_nguoi_dung('email-cua-bql@…', '', 'Họ tên', 'mật khẩu tạm');
   ```

   Không còn phải chờ họ "tự đăng nhập một lần" như hồi Supabase: `auth.users`
   giờ là bảng của chính mình, tạo thẳng được, và trigger tự dựng `profiles`.
3. Điền `v_email` (và `v_du_an` nếu DB còn trống) trong `bootstrap_bql.sql`
   rồi chạy file đó
4. Báo họ đăng nhập bằng mật khẩu tạm, rồi tự đổi ở màn Người dùng

`bootstrap_bql.sql` cố ý chạy bằng quyền `postgres`: `staff_assignments`
không cấp quyền ghi cho ai, vì tự ghi được bảng đó là tự phong mình làm BQL
và vượt luôn RLS của toàn bộ ticket/hóa đơn.

### 4b. Backup — đã dựng, cần anh thêm 1 secret

`.github/workflows/backup.yml` dump DB hằng ngày lúc 01:30 giờ VN và lưu thành
artifact của workflow (giữ 90 ngày). Cần **một** secret trong repo:

- Tên: `DATABASE_URL_BACKUP`
- Lấy ở Railway → service Postgres → Variables → **DATABASE_PUBLIC_URL**

**Phải là bản PUBLIC.** Địa chỉ `*.railway.internal` chỉ sống trong mạng nội bộ
của Railway; runner của GitHub không nối tới được.

Dump gồm cả schema `auth`. Thiếu nó thì bản khôi phục có đủ hóa đơn và công nợ
nhưng **không ai đăng nhập được**, kể cả BQL — nên workflow kiểm riêng sự có
mặt của `auth.users` trước khi lưu.

**Ảnh KHÔNG nằm trong bản dump.** Ảnh ở trên Volume của service `v`, không ở
database. Bật thêm snapshot cho Volume nếu ảnh là bằng chứng cần giữ.

Bản dump chứa **dữ liệu cá nhân thật**: họ tên, SĐT, email, CCCD cư dân, toàn
bộ hóa đơn, thanh toán, và băm mật khẩu. Nó không vào git (chỉ là artifact),
nhưng ai đọc được repo là tải được — giữ repo riêng tư.

Job tự kiểm bản dump có nội dung thật (đếm số bảng có dữ liệu) rồi mới lưu.
Không có bước đó thì một bản dump rỗng vẫn upload thành công và ba tháng sau
mới phát hiện suốt thời gian đó không có backup nào.

### 4. Dữ liệu trên DB đang là dữ liệu MẪU

Hiện có: dự án "Sunrise Riverside", 2 tòa P1/P2, 24 căn — đều do `seed.sql`
sinh ra. Chính file đó ghi "KHÔNG chạy trên production" nhưng đã lỡ chạy.

Cư dân thật đăng nhập vào mà thấy 24 căn ma thì hỏng ngay ấn tượng đầu.

DB trên Railway dựng mới thì **hoàn toàn trống** — không chạy `seed.sql`, nên
không có dữ liệu mẫu nào. `reset_demo_data.sql` chỉ cần khi dọn một DB đã lỡ
chạy seed.

Trên DB mới, `bootstrap_bql.sql` **tự tạo dự án** nếu chưa có — điền `v_du_an`
bằng tên tòa thật. Sau đó:

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
[anh] chạy railway/GD1-runbook.sh phần A (Console của service Postgres)
        ↓
[anh] dựng service PostgREST + gắn Volume + đặt biến (phần B)
        ↓
[anh] đặt SMTP_URL (một tài khoản gửi thư bất kỳ)
        ↓
[anh] đưa email + họ tên người làm BQL  →  [em] tạo tài khoản + chạy bootstrap_bql.sql
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
