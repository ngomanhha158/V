# MCP server cho VBuilding

Hỏi và ghi việc vận hành toà nhà từ Claude, ngay trong lúc đang nói chuyện với
cư dân qua điện thoại.

```
Anh: công nợ khu Sunrise Riverside giờ thế nào?
Anh: căn P1-10.01 báo vòi bếp rò, mở yêu cầu giúp tôi, mức bình thường
```

## Làm được gì, và cố ý KHÔNG làm gì

| Đọc | Ghi |
|---|---|
| `danh_sach_khu` · `tong_quan` · `cong_no` | `tao_yeu_cau` |
| `ton_kho` · `kien_dang_giu` · `so_ra_vao` | `nhan_kien_hang` · `giao_kien_hang` |
| `tim_yeu_cau` | |

**Không có công cụ nào đụng tiền** — không phát hành hoá đơn, không ghi phiếu
thu, không gán giao dịch ngân hàng. Đó là quyết định, không phải thiếu sót:
một yêu cầu tạo nhầm thì xoá được; một đợt hoá đơn phát nhầm cho 468 căn thì
không, và người phát hiện ra sẽ là cư dân chứ không phải ban quản lý.

## Quyền: không có cửa sau

MCP đi qua PostgREST bằng token của **một người thật**, vai `authenticated`.
Nghĩa là **RLS chặn y hệt như trên web**: nó không phơi ra được thứ mà chính
người đó tự mở web cũng không xem được. Không dùng `service_role`.

## Cài

### 1. Phát token — CHẠY TRÊN RAILWAY

`AUTH_JWT_SECRET` là khoá ký của cả hệ thống: ai cầm nó ký được token cho bất
kỳ ai, kể cả `service_role` vốn bỏ qua mọi RLS. **Nó phải ở lại Railway.**

Railway → service `v` → tab Shell:

```sh
npx tsx scripts/tao-token-mcp.ts email-cua-ban@...
```

In ra một JWT sống 30 ngày — đúng bằng phiên đăng nhập web. Token đó **mạnh
đúng bằng cookie đang nằm trong trình duyệt bạn**, không hơn.

### 2. Khai báo trong Claude Desktop

`claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "vbuilding": {
      "command": "node",
      "args": ["--experimental-strip-types", "/duong/dan/toi/V/mcp/index.ts"],
      "env": {
        "POSTGREST_URL": "https://postgrest-cua-ban.up.railway.app",
        "VBUILDING_TOKEN": "<token vừa phát ở bước 1>"
      }
    }
  }
}
```

`POSTGREST_URL` ở đây phải là địa chỉ **công khai** của PostgREST, không phải
`postgrest.railway.internal` — máy cá nhân không vào được mạng nội bộ Railway.
Mở domain cho PostgREST là đưa tầng dữ liệu ra internet, nên chốt duy nhất còn
lại là chữ ký JWT; cân nhắc kỹ trước khi làm, hoặc chạy qua VPN/tunnel.

### 3. Khi token hết hạn

Sau 30 ngày mọi công cụ trả về câu chỉ thẳng cách phát lại. Phát token mới,
dán đè. Không cần đổi gì khác.

## Vì sao không cần build

Chạy thẳng `.ts` bằng `node --experimental-strip-types`, đúng cách repo này đã
chạy test. Không có bước build nghĩa là không có bản dịch nào lệch pha với
`lib/db/database.types.ts` — MCP dùng chung đúng bộ type với app, nên đổi
schema mà quên sửa MCP thì `tsc` bắt được ngay, không phải đợi lúc chạy.
