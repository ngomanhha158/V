# VBUILDING — KẾ HOẠCH 30 NGÀY, THÁNG 2

**14/09/2026 → 13/10/2026.** Tiếp nối `PLAN-30-NGAY.md` (tháng 1).

Đây không phải danh sách tính năng. Lý do nằm ở mục 1, và nó là kết luận rút ra
từ số đo chứ không phải từ cảm giác.

---

## 0. SỰ THẬT ĐO ĐƯỢC NGÀY 0

**Phần mềm:** 67 màn thật, 377 test JS + 32 file SQL + cả ngăn xếp Railway xanh
trên CI mỗi lần push, 9 job nền, build sạch, sáng/tối. Mọi mục của
`PLAN-30-NGAY.md` đã làm xong, kể cả N25–N26 (khu vực Ban quản trị) vốn là mục
cuối còn thiếu.

**Người dùng:** chưa có ai.

Con số thứ hai không phải phỏng đoán. Đếm request vào service `v` trong 7 ngày
gần nhất, chia theo lớp mã trạng thái:

```
  4 bucket đầu   2xx 0–49    3xx 0–8   4xx 0    5xx 147/bucket
  4 bucket cuối  2xx 147     3xx 0     4xx 0    5xx 0
```

147 request mỗi bucket ~11 tiếng, **phẳng tuyệt đối, không một 3xx nào** — đó
đúng bằng nhịp của job nền (`leo-thang-ticket` 5 phút/lần, cộng sáu job ngày,
cộng health check của Railway). Không có 3xx nghĩa là không có luồng đăng nhập
nào. Không có 4xx nghĩa là không ai gõ nhầm địa chỉ. Toàn bộ lưu lượng là máy
gọi máy.

147 con 5xx mỗi bucket ở giai đoạn đầu cũng chính là các job nền, lúc đó đang
đỏ vì PostgREST chưa có khoá ký. Chúng về 0 ngay sau khi khoá được điền — nên
biểu đồ này còn là bằng chứng sự cố đó đã dứt điểm thật.

**Vậy: hệ thống đang chạy đúng, và chưa một cư dân nào mở nó ra.**

---

## 1. THÁNG 2 LÀM GÌ — VÀ KHÔNG LÀM GÌ

`PLAN-30-NGAY.md` mục 4 tự đặt ra một luật:

> Không đạt 3/5 chỉ số → tháng 2 là tháng sửa, không phải tháng thêm tính năng.

Cả 5 chỉ số đều **không đo được**, vì mẫu số bằng 0. Không phải thất bại — là
chưa bắt đầu. Nên áp luật đó theo đúng tinh thần chứ không theo đúng chữ:

**Tháng 2 là tháng ĐƯA VÀO DÙNG.** Không phải tháng sửa (chưa có gì hỏng để
sửa), và dứt khoát không phải tháng thêm tính năng.

Cái giá của việc làm sai chỗ này rất cụ thể: thêm 30 ngày tính năng nữa thì
ngày 60 sẽ có một hệ thống to gấp rưỡi mà vẫn chưa ai dùng, và mọi giả định
dựng nên nó vẫn chưa một lần bị thực tế phản bác. Tính năng thứ 68 không dạy
được điều gì mà cư dân đầu tiên không dạy nhanh hơn.

**Ba việc duy nhất của tháng này:**

1. Đưa production từ "chạy được" sang "đang được dùng thật".
2. Chạy trọn **một kỳ hóa đơn thật**, đối soát từng đồng với sổ cũ của BQL.
3. Đo cho ra 5 chỉ số — để tháng 3 có căn cứ quyết định, thay vì lại đoán.

---

## 2. LỊCH 4 TUẦN

### TUẦN 1 (N1–N7 · 14/09 – 20/09) — Production thật, người thật đầu tiên

> Cả tuần này không viết tính năng nào. Nếu có code thì chỉ là code sửa thứ
> hỏng ra khi có người thật chạm vào.

| Ngày | Việc | Ai làm |
|---|---|---|
| N1 | Áp `schema.sql` + `auth_hooks.sql` lên Postgres production, rồi `notify pgrst, 'reload schema'`. Mở `/bql/go-live` xem bảng "Job nền" có đọc được không. | Anh |
| N1 | Tạo 2 Cron Service còn thiếu: `cron-bao-cao-quy`, `cron-day-thong-bao` (lệnh ở bước B6 của `railway/GD1-runbook.sh`). | Anh |
| N1 | Sinh và điền 3 biến `VAPID_*`. Không có chúng thì `day-thong-bao` đỏ mỗi 15 phút — cố ý, nhưng đừng để nó đỏ cả tháng. | Anh |
| N2 | Tạo tài khoản BQL đầu tiên bằng `bootstrap_bql.sql`. Đăng nhập thử bằng cả hai đường: mã qua email, và mật khẩu. | Anh |
| N2 | Gắn Volume `/data/ticket-photos`, thêm secret cho backup, khai tài khoản nhận tiền của khu. | Anh |
| N3–N4 | **Nhập dữ liệu căn hộ thật** của tòa pilot qua màn Nhập từ Excel. Dữ liệu bẩn là chuyện chắc chắn — màn này có preview và báo lỗi từng dòng, dùng nó, đừng sửa tay trong database. | Anh + BQL |
| N4 | Khai biểu phí thật và SLA thật. **Ngồi với BQL mà chốt, không tự bịa.** Con số ở đây quyết định hóa đơn tháng sau đúng hay sai. | Anh + BQL |
| N5 | Soạn nội quy / sổ tay. Cư dân mở app ngày đầu mà thấy trang trống là ấn tượng đầu tiên, và ấn tượng đầu tiên chỉ có một lần. |  |
| N6–N7 | **Chạy thử nội bộ với 5–10 người thật** (nhân sự BQL + vài hộ quen). Mỗi người: đăng nhập, xem căn của mình, gửi một yêu cầu kèm ảnh, nhận thông báo đẩy. Ghi lại mọi chỗ vấp. |  |

**DoD Tuần 1** — cả bốn, không phải ba:
- Màn `/bql/go-live` **không còn mục bắt buộc nào đỏ**, và bảng Job nền đủ 9 job xanh.
- ≥5 tài khoản thật đăng nhập được, thấy đúng căn của mình.
- ≥1 yêu cầu thật chạy trọn vòng đời: tạo → phân công → xong → cư dân chấm sao.
- Biểu đồ lưu lượng có 3xx và 4xx — nghĩa là đã có người thật, không chỉ có cron.

---

### TUẦN 2 (N8–N14 · 21/09 – 27/09) — Một tòa, và kỳ hóa đơn chạy SONG SONG

> Mở cho **một tòa**, không phải cả khu. Tòa đầu tiên là nơi mọi giả định sai
> sẽ lộ ra; lộ trên 100 căn thì còn dọn được, lộ trên 468 căn thì không.

| Ngày | Việc |
|---|---|
| N8 | In poster QR, dán sảnh và trong thang máy của **một tòa**. BQL nhắn Zalo cho cư dân tòa đó. |
| N8–N10 | **Trực duyệt chủ hộ.** Dán poster buổi sáng thì buổi chiều hàng đợi đầy. Cần người ngồi duyệt trong ngày, không phải để tới hôm sau. |
| N10 | Sinh hóa đơn kỳ đầu ở trạng thái **nháp**. Chưa phát hành. |
| N11–N12 | **Đối chiếu tay từng dòng** hóa đơn nháp với bảng tính hiện hành của BQL. Lệch một đồng cũng dừng lại tìm cho ra — sai số tiền ở kỳ đầu là thứ không patch lại được bằng niềm tin. |
| N13 | Phát hành hóa đơn. Kiểm mã QR quét được bằng ít nhất 3 app ngân hàng khác nhau. |
| N14 | Chờ giao dịch thật đầu tiên về, xem webhook có tự gạch nợ không. Nếu không — đó là việc quan trọng nhất tuần sau. |

**DoD Tuần 2:**
- Hóa đơn hệ thống **khớp 100%** với bảng tính của BQL, đã đối chiếu tay.
- ≥1 giao dịch chuyển khoản thật được gạch nợ **tự động**.
- ≥15% hộ của tòa pilot đã kích hoạt.

---

### TUẦN 3 (N15–N21 · 28/09 – 04/10) — Tiền, và mở rộng dần

> Tuần rủi ro cao nhất của cả tháng, cùng lý do như Tuần 3 tháng trước: sai số
> tiền là thứ mất niềm tin một lần rồi thôi.

| Ngày | Việc |
|---|---|
| N15–N17 | **Chốt sổ hằng ngày.** Mỗi cuối ngày: tổng tiền hệ thống ghi nhận = tổng sao kê ngân hàng. Lệch thì dừng, không để sang ngày hôm sau. |
| N16 | Màn Đối soát: xử lý các giao dịch không khớp (người ghi sai nội dung chuyển khoản — luôn luôn có). Đo xem bao nhiêu phần trăm phải gạch tay. |
| N18 | Mở poster cho tòa thứ hai. |
| N19 | Nhắc nợ tự động chạy lần đầu trên dữ liệu thật (T-3 / T-0 / T+3). Kiểm thông báo có **tới điện thoại** không, không chỉ nằm trong bảng `notifications`. |
| N20 | Đối chiếu quỹ bảo trì 2% với sao kê, khai `so_du_ngan_hang` và `doi_chieu_ngay` trên màn Quỹ. Từ đây màn `/bqt` mới nói được điều gì. |
| N21 | Rà bảo mật trên dữ liệu THẬT: mở tài khoản của một cư dân, thử đọc dữ liệu căn khác. Không rò là điều kiện, không phải mục tiêu. |

**DoD Tuần 3:**
- Chênh lệch sổ hệ thống vs sao kê = **0 đồng**, 7 ngày liên tiếp.
- ≥30% hộ tòa pilot kích hoạt.
- Có ít nhất một cư dân nhận được thông báo nhắc nợ **trên điện thoại**.

---

### TUẦN 4 (N22–N30 · 05/10 – 13/10) — Toàn khu, và đo

| Ngày | Việc |
|---|---|
| N22 | Mở poster cho các tòa còn lại. |
| N23–N26 | Trực vận hành. Ghi lại mọi câu hỏi cư dân hỏi BQL mà app lẽ ra phải tự trả lời — **đây là backlog tháng 3, và nó phải đến từ cư dân chứ không từ trí tưởng tượng của chúng ta.** |
| N27 | Kỳ hóa đơn thứ hai. Lần này không đối chiếu tay toàn bộ — chỉ lấy mẫu. Nếu vẫn phải đối chiếu tay hết thì tự động hóa chưa đạt, và đó là việc tháng 3. |
| N28 | Đo đủ 5 chỉ số ở mục 3. Ghi số thật vào file này. |
| N29 | Họp BQT, mở màn `/bqt` cho họ xem. Đây là lần đầu bảng giám sát có số thật. |
| N30 | Chốt backlog tháng 3 theo mục 5 — **chỉ mở những tính năng mà chỉ số cho phép.** |

**DoD Tuần 4:**
- ≥30% hộ toàn khu kích hoạt.
- BQT đã tự mở `/bqt` và đọc được KPI mà không cần ai hướng dẫn.
- 5 chỉ số đã đo, ghi số thật vào mục 3.

---

## 3. CHỈ SỐ NGÀY 30

Giữ nguyên 5 chỉ số của tháng 1, vì tháng 1 chưa đo được cái nào.

| Chỉ số | Ngưỡng | Đo ngày 13/10 |
|---|---|---|
| Hộ kích hoạt / tổng số hộ | ≥ 30% | _chưa đo_ |
| Ticket qua app / tổng ticket (kể cả gọi điện, Zalo) | ≥ 50% | _chưa đo_ |
| Ticket xử lý đúng SLA | ≥ 70% | _chưa đo_ |
| Hóa đơn gạch nợ tự động, không sửa tay | ≥ 80% | _chưa đo_ |
| Chênh lệch sổ hệ thống vs sao kê | = 0 đồng | _chưa đo_ |

Bốn chỉ số đầu đọc thẳng được ở màn `/bqt`. Chỉ số thứ hai thì không — nó cần
BQL **đếm tay** số ticket đến qua điện thoại và Zalo. Không đếm thì tử số đẹp
mà mẫu số sai, và con số đó sẽ nói rằng app đang được dùng nhiều hơn thực tế.

---

## 4. RỦI RO CỦA THÁNG NÀY

Khác hẳn tháng 1: rủi ro tháng 1 là code không kịp; rủi ro tháng 2 là **code
kịp mà không ai dùng**.

| Rủi ro | Xác suất | Cách chặn |
|---|---|---|
| Dữ liệu căn hộ từ BQL bẩn, nhập vào rồi mới lộ | Rất cao | Màn Nhập từ Excel có preview + báo lỗi từng dòng. Chốt dữ liệu ở N4, không nhận thay đổi giữa chừng |
| Cư dân cài xong rồi không quay lại | Rất cao | Gắn app với thứ họ **cần**: xem hóa đơn và quét QR trả tiền. Poster đặt ở thang máy — chỗ người ta đứng chờ và có thời gian rút điện thoại |
| Biểu phí khai sai, phát hiện sau khi phát hành | Cao | Kỳ đầu chạy song song với sổ cũ, đối chiếu tay từng dòng trước khi phát hành (N11–N12) |
| BQL quay về dùng Excel vì quen tay | Cao | Tuần 1 chạy thử với chính nhân sự BQL trước khi mở cho cư dân. Họ phải thấy nó nhanh hơn Excel, trên việc của họ |
| Thông báo đẩy không tới iPhone | Chắc chắn với hộ chưa "Thêm vào màn hình chính" | Màn Thông báo đã nói thẳng chuyện này. Đo tỷ lệ nhận được, đừng giả định |
| Mở cả khu ngay từ đầu | Cao | Lịch trên cố ý mở **một tòa** ở Tuần 2. Giữ nguyên, kể cả khi tuần 1 trôi chảy |
| Thêm tính năng giữa chừng vì cư dân xin | Rất cao | Ghi vào backlog tháng 3, không làm trong tháng. Xem mục 5 |

---

## 5. CỔNG MỞ TÍNH NĂNG

Danh sách "cố tình bỏ qua" của tháng 1, giờ gắn với **một chỉ số cụ thể** thay
vì gắn với một cái tên tháng. Chỉ số chưa đạt thì cổng chưa mở — kể cả khi có
người xin, kể cả khi rảnh.

| Tính năng | Mở khi |
|---|---|
| Đăng ký tiện ích mở rộng (đặt lịch gym, hồ bơi) | Ticket qua app ≥ 50% — nghĩa là cư dân đã quen mở app để làm việc, không chỉ để xem |
| Zalo ZNS | Có OA duyệt xong. Đến lúc đó adapter kênh đã sẵn, bật là chạy |
| App native (Expo) | Tỷ lệ nhận thông báo đẩy trên iPhone < 50% sau khi đã hướng dẫn — tức là PWA thật sự chạm trần, chứ không phải mình đoán nó chạm trần |
| Multi-tenant SaaS đầy đủ (billing theo tòa, white-label) | Có khách trả tiền thứ 2. Schema đã sẵn `project_id` nên không phải migrate lớn |
| Marketplace nhà cung cấp | Có ≥3 tòa chạy thật. Ít cầu thì chợ không thành chợ |
| AI dự báo hỏng hóc | Có ≥6 tháng lịch sử bảo trì **thật trong hệ thống**. Không đủ dữ liệu thì nó chỉ là bản demo biết nói |
| Gamification | Sau khi tỷ lệ hộ hoạt động ổn định ≥3 tháng. Thưởng cho một hành vi chưa tồn tại là vô nghĩa |

---

## 6. VIỆC CHỈ ANH QUYẾT ĐƯỢC

Hạn: **hết 13/09**, tức trước N1. Chưa chốt thì Tuần 1 tắc ngay từ ngày đầu.

1. **Tòa pilot là tòa nào?** Cả lịch Tuần 2 treo vào câu này.
2. **Ai bên BQL chốt nghiệp vụ, và trả lời trong bao lâu?** Biểu phí và SLA
   phải có người quyết. Không có người đó thì N4 đứng, và mọi thứ sau N4 đứng theo.
3. **Kỳ hóa đơn đầu tiên là kỳ nào?** Chạy song song với sổ cũ nghĩa là BQL phải
   làm hai lần trong một kỳ — cần họ đồng ý trước, không phải thông báo sau.
4. **Ai trực duyệt chủ hộ trong tuần mở poster?** Hàng đợi đầy trong ngày đầu.

---

## 7. MỘT ĐIỀU RÚT RA TỪ THÁNG 1, ĐỂ KHÔNG LẶP LẠI

Lỗi tốn thời gian nhất của tháng 1 không phải lỗi làm hệ thống hỏng. Nó là lỗi
làm hệ thống **hỏng mà không nói gì**, hoặc tệ hơn, nói một câu chỉ sai chỗ:

- Đăng nhập chết vì PostgREST thiếu khoá ký, nhưng thông điệp lỗi chung chung
  khiến ba lần đi tìm nhầm chỗ.
- Hai job nền chưa bao giờ có lịch trên Railway, suốt từ lúc dựng. Không màn
  nào báo. Runbook thì ghi "7 Cron Service" rồi liệt kê 8 dòng.
- Màn quỹ bảo trì so số dư **hôm nay** với sao kê **của ngày đối chiếu** — hai
  mốc thời gian khác nhau — nên sẽ hét "SỔ VÀ NGÂN HÀNG KHÔNG KHỚP" mỗi ngày
  ngay sau lần chi đầu tiên.

Cả ba đều đã sửa, và sửa theo cùng một cách: bắt hệ thống **tự nói ra**, rồi
đặt một test giữ cho nó không im lại được.

Tháng 2 sẽ có người thật dùng, nên luật này càng đắt hơn: **thà một màn hình
báo đỏ ồn ào còn hơn một con số đẹp mà không ai bảo lãnh được.** Gặp bất kỳ chỗ
nào hệ thống biết mà không nói, sửa ngay trong tuần — đó là loại việc duy nhất
được phép chen vào lịch tháng này.
