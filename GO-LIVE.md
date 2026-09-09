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
| Bộ test | 31 file SQL độc lập + cả ngăn xếp Railway + 336 test JS, xanh trên CI mỗi lần push |
| Giao diện | 66 route thật (chưa kể bản demo), build sạch, sáng/tối |

Chín job nền và giờ chạy (giờ VN). Đặt thiếu một cái thì nó KHÔNG chạy và
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
- `bao-cao-quy` — 02:00 ngày 5 tháng đầu mỗi quý, sinh báo cáo cho quý vừa kết
  thúc. Chạy lại nhiều lần cũng chỉ ra một bản: mỗi quý một báo cáo còn hiệu
  lực, chốt bằng index ở database chứ không bằng trí nhớ của người đặt lịch.
- `day-thong-bao` — 15 phút/lần, đẩy thông báo ra điện thoại cư dân. **Đây là
  thứ làm ba job nhắc ở trên có tác dụng thật**: `nhac-no`, kiện hàng về quầy
  và kiện quá hạn đều chỉ ghi một dòng vào `notifications`, mà cư dân chỉ thấy
  nếu tự mở app. Không đặt lịch này thì hệ thống "có nhắc nợ" đúng về mặt dữ
  liệu và sai về mặt sự thật. Job duy nhất chạy bằng Node chứ không bằng một
  hàm SQL — mã hoá Web Push không làm được trong Postgres.

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
VAPID_PUBLIC_KEY                   # thông báo đẩy; sinh: npx web-push generate-vapid-keys
VAPID_PRIVATE_KEY                  # KHOÁ BÍ MẬT, đừng commit
VAPID_SUBJECT=mailto:bql@ten-mien-cua-ban
```

Ba biến ngân hàng thiếu thì hóa đơn vẫn xem được, chỉ là không có mã QR và
cư dân phải hỏi BQL số tài khoản. Ba biến `VAPID_*` thiếu thì thông báo vẫn
nằm đủ trong app, chỉ là điện thoại không rung — màn Thông báo nói thẳng
chuyện đó thay vì im lặng không có nút bật. `SMTP_URL` thiếu thì nặng hơn nhiều: nút
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

### 2b. Đăng nhập hỏng thì hỏi thẳng máy chủ

```
curl.exe -s -X POST -H "x-cron-key: <CRON_SECRET>" https://<domain>/api/chan-doan
```

`/api/health` cố ý KHÔNG chạm database, nên nó trả lời được "tiến trình còn
sống" và "biến đã đặt" mà không trả lời được câu hay hỏng nhất: **hai khoá
JWT có khớp nhau không**. Đó là lỗ thật: màn đăng nhập báo "hệ thống đang
không đọc được dữ liệu đăng nhập" — đúng và trung thực với cư dân, nhưng
người đi sửa phải mở log Railway mới biết là khoá lệch, hay chưa chạy
`railway/03_auth.sql`, hay quên `notify pgrst`. Ba nguyên nhân, một triệu
chứng.

Endpoint này soát sáu bước theo thứ tự và **dừng ở nguyên nhân gốc**: biến môi
trường → PostgREST có tới được → khoá JWT có khớp → lớp đăng nhập đã áp chưa →
có ai là BQL chưa → thông báo đẩy đã bật chưa. Khóa bằng `CRON_SECRET` chứ
không bằng phiên đăng nhập: nó phải dùng được đúng lúc không ai đăng nhập nổi.
Không bao giờ trả về giá trị của biến nào, chỉ trả về nó có hoạt động không.

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
3. Điền `v_email` trong `bootstrap_bql.sql` rồi chạy file đó. `v_du_an` là
   tên khu: DB còn trống thì script tự tạo khu đó; DB đã có **từ hai khu**
   thì `v_du_an` phải khớp đúng tên một khu — script không tự chọn hộ nữa,
   vì "khu đầu bảng" khi có hai khu là chọn bừa
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

**Khôi phục: `railway/KHOI-PHUC-runbook.sh <file.dump> <url database đích>`.**
Có backup ba năm rồi phát hiện không khôi phục được là kiểu hỏng kinh điển nhất
của backup — workflow trên chỉ chứng minh bản dump ĐƯỢC TẠO RA và không rỗng,
không chứng minh nó DÙNG ĐƯỢC. Runbook đã diễn tập trọn vẹn trên PostgreSQL
16.13: dump một DB có tài khoản thật → khôi phục vào database trắng → đăng nhập
đúng mật khẩu thành công, sai mật khẩu bị từ chối, phân công BQL còn nguyên.
Bước cuối của nó kiểm đúng chuyện đó chứ không đếm dòng: một bản khôi phục đủ
hóa đơn mà không ai đăng nhập được thì vẫn là hỏng.

Role KHÔNG nằm trong bản dump (`pg_dump` không bao giờ dump role) và quyền cũng
không (`--no-privileges`) — nên runbook chạy `railway/00_compat.sql` trước để dựng role,
rồi `auth_hooks.sql` + `railway/03_auth.sql` sau để cấp lại quyền.

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
3b. Khai **số tài khoản nhận tiền** của khu ở `/bql/khu` — thiếu thì hóa đơn
   không có mã QR, và với nhiều khu thì webhook từ chối tiền về
4. Ngồi với BQL chốt lại 10 dòng SLA — số hiện tại là mặc định khởi tạo, không
   phải cam kết ai đã đồng ý

### 5. Đối soát ngân hàng — đã tự động, cần khai TÀI KHOẢN CỦA TỪNG KHU

Webhook gạch nợ **đã làm**, nhận được cả **SePay lẫn Casso** —
`/api/webhook/bank/sepay` và `/api/webhook/bank/casso`. Điền khóa nào thì
đường đó sống; chưa điền thì endpoint **từ chối**, không phải cho qua.

Cư dân quét QR trên hóa đơn, chuyển đúng nội dung `VB <mã căn> <kỳ>`, và tiền
tự gạch vào hóa đơn của căn đó. Nội dung sai định dạng thì giao dịch nằm ở
`/bql/doi-soat` chờ BQL gán tay — cố ý: dò lỏng rồi tự gạch là tiền chạy nhầm căn.

**Việc phải làm: khai số tài khoản nhận tiền cho TỪNG KHU** ở màn
`/bql/khu` (chỉ trưởng BQL đổi được). Webhook tra khu theo **số tài khoản tiền
vừa về**:

| Tình huống | Xử lý |
|---|---|
| Số tài khoản khớp một khu | Ghi vào sổ khu đó |
| Cả hệ thống chỉ có **một** khu | Ghi vào khu đó, kể cả khi chưa khai — giữ cho bản cài một khu chạy như cũ |
| Nhiều khu, không khớp khu nào | **Từ chối 400**, câu lỗi gọi thẳng số tài khoản |

Từ chối chứ không đoán: đoán một khu là ghi tiền vào sổ của khách hàng khác,
và cái sai đó chỉ lộ ra lúc đối soát cuối tháng — khi khu này thừa tiền và khu
kia thiếu đúng chừng ấy.

Ba biến `VBUILDING_BANK_*` giờ là **đường lùi** cho bản cài một khu. Từ khu thứ
hai trở đi, mỗi khu phải khai tài khoản riêng, nếu không mã QR của mọi khu đều
trỏ về một tài khoản.

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
