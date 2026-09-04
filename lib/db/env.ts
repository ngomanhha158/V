/**
 * Hai biến môi trường mà cả hệ thống đứng lên, kèm câu báo lỗi nói ra phải làm
 * gì. Trước đây chỗ này là `process.env.X!` — dấu chấm than biến "quên đặt
 * biến" thành một lỗi runtime mơ hồ ở tận đâu đó trong thư viện.
 */

/**
 * Soát cấu hình mà KHÔNG ném lỗi, trả về danh sách chỗ hỏng.
 *
 * Có hàm này vì hai hàm bên dưới ném lỗi là đúng — nhưng lỗi ném ra từ trong
 * một Server Component thì Next thay bằng chữ "Internal Server Error" trơ trọi,
 * và câu hướng dẫn viết sẵn ở đây không bao giờ tới được người đang sửa. Đây là
 * đường để nó tới nơi: middleware soát trước, rồi đưa sang màn /loi-cau-hinh.
 */
export function kiemCauHinh(): string[] {
  const loi: string[] = []
  const url = process.env.POSTGREST_URL
  if (!url) {
    loi.push(
      'Thiếu POSTGREST_URL. Trên Railway đặt là http://postgrest.railway.internal:3000 '
      + '— đúng tên service PostgREST của bạn, kèm cổng.',
    )
  } else if (!/^https?:\/\//.test(url)) {
    // Dán mỗi tên máy vào là lỗi dễ mắc nhất, và nó KHÔNG làm app chết ngay:
    // mọi truy vấn lặng lẽ hỏng và màn hình hiện "chưa có dữ liệu".
    loi.push(
      `POSTGREST_URL ("${url}") thiếu http:// ở đầu. Không có scheme thì mọi truy vấn `
      + 'hỏng lặng lẽ và màn hình hiện "chưa có dữ liệu" thay vì báo lỗi.',
    )
  }

  const bm = process.env.AUTH_JWT_SECRET
  if (!bm) {
    loi.push(
      'Thiếu AUTH_JWT_SECRET. Phải TRÙNG KHÍT PGRST_JWT_SECRET của service PostgREST.',
    )
  } else if (bm.length < 32) {
    loi.push(
      `AUTH_JWT_SECRET chỉ dài ${bm.length} ký tự, cần ít nhất 32 — PostgREST từ chối khóa ngắn hơn.`,
    )
  }
  return loi
}

export function urlPostgrest(): string {
  const v = process.env.POSTGREST_URL
  if (!v) {
    throw new Error(
      'Thiếu POSTGREST_URL. Trên Railway đặt là http://postgrest.railway.internal:3000 '
      + '(xem railway/GD1-runbook.sh phần B4).',
    )
  }
  return v.replace(/\/+$/, '')
}

export function biMatJwt(): string {
  const v = process.env.AUTH_JWT_SECRET
  if (!v) {
    throw new Error(
      'Thiếu AUTH_JWT_SECRET. Phải trùng khít PGRST_JWT_SECRET của service PostgREST '
      + '(xem railway/GD1-runbook.sh phần B4).',
    )
  }
  // PostgREST từ chối khóa ngắn hơn 32 ký tự. Bắt ở đây để lỗi rơi vào lúc
  // khởi động app chứ không phải vào lúc cư dân đầu tiên bấm đăng nhập.
  if (v.length < 32) {
    throw new Error(`AUTH_JWT_SECRET chỉ dài ${v.length} ký tự, cần ít nhất 32.`)
  }
  return v
}

/** Phiên sống 30 ngày. Đủ dài để cư dân không phải đăng nhập lại mỗi lần mở
 *  app — họ vào app mỗi tháng một lần lúc đóng phí — và middleware tự gia hạn
 *  khi còn dưới 7 ngày, nên người dùng thường xuyên không bao giờ rơi ra. */
export const PHIEN_SONG_GIAY = 30 * 24 * 60 * 60
export const PHIEN_GIA_HAN_GIAY = 7 * 24 * 60 * 60

/** Token service_role sống ngắn: nó bỏ qua toàn bộ RLS nên không có lý do gì
 *  để tồn tại lâu hơn một request. */
export const SERVICE_SONG_GIAY = 60
