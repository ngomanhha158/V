/**
 * Sổ sách của job đẩy thông báo — phần phán xét, tách khỏi phần gọi mạng.
 *
 * Job `day-thong-bao` làm hai việc: đẩy thông báo tới điện thoại, rồi GHI SỔ
 * lại việc đó. Phần đẩy có xử lý lỗi tử tế. Phần ghi sổ thì không — ba lời gọi
 * cuối hàm đều vứt `error` đi:
 *
 *     await db.rpc('push_go_endpoint_chet', …)          ← lỗi biến mất
 *     await db.rpc('push_ghi_nhan_day', …)              ← lỗi biến mất
 *     const { data: n } = await db.rpc('thong_bao_da_day', …)   ← lỗi biến mất
 *
 * Lời gọi thứ ba là chỗ nặng nhất trong cả repo này. `thong_bao_can_day()` lấy
 * hàng đợi bằng `where n.sent_push_at is null`, và `thong_bao_da_day()` chính
 * là hàm đặt cột đó. Nó hỏng thì thông báo VẪN nằm trong hàng đợi dù đã đẩy đi
 * rồi — nên mười lăm phút sau job đẩy lại đúng những thông báo ấy. Cửa sổ của
 * hàng đợi là 24 giờ và lịch là mười lăm phút một lần, nên một lần hỏng nghĩa
 * là:
 *
 *     96 lần rung, cùng một câu, trên điện thoại của TỪNG cư dân
 *
 * mà job vẫn trả về "ok" và lịch cron vẫn xanh. Cả hệ thống biết chính xác
 * chuyện gì vừa xảy ra — `gui: 40` cạnh `danhDau: 0` nằm ngay trong kết quả —
 * nhưng không ai đối chiếu hai con số đó, nên không chỗ nào nói ra.
 *
 * Triệu chứng ồn ào nhất mà phần mềm này có thể gây ra cho người dùng, sinh ra
 * từ một nhánh code hoàn toàn im lặng.
 *
 * File này KHÔNG import gì, để test được bằng node:test mà không cần mạng.
 */

export type LoiDb = { message: string } | null | undefined

/** Một bước ghi sổ sau khi đã đẩy xong. */
export type BuocGhiSo = {
  /** Tên hàm SQL — câu lỗi phải chỉ thẳng chỗ chạy lại được. */
  ten: string
  loi: LoiDb
  /** Chuyện xảy ra với NGƯỜI DÙNG nếu bỏ qua bước này. */
  hauQua: string
  /** true = job phải đỏ. false = ghi cảnh báo, job vẫn xanh. */
  chan: boolean
}

export type PhanXetGhiSo = {
  /** Câu để ném ra, hoặc null nếu không có bước chặn nào hỏng. */
  nem: string | null
  /** Câu để ghi log, cho những bước hỏng mà không đáng làm job đỏ. */
  canhBao: string[]
}

function cau(b: BuocGhiSo, msg: string): string {
  return `${b.ten}() hỏng: ${msg}. Hậu quả: ${b.hauQua}.`
}

/**
 * Chia các bước hỏng thành "phải đỏ" và "chỉ cảnh báo".
 *
 * Ranh giới đặt ở chỗ NGƯỜI DÙNG có thấy hay không, chứ không ở chỗ lời gọi có
 * quan trọng hay không:
 *
 *   • thong_bao_da_day      → điện thoại rung lại 96 lần         → ĐỎ
 *   • push_go_endpoint_chet → endpoint chết nằm lại, tỷ lệ lỗi
 *                             phình lên và che mất lỗi thật      → ĐỎ
 *   • push_ghi_nhan_day     → một màn không phân biệt được
 *                             "chưa có gì" với "chưa nhận được"  → cảnh báo
 *
 * Cho tất cả thành đỏ thì job đỏ vì một chuyện hình thức, và người trực ban học
 * cách lờ màu đỏ đi — đúng cái phải tránh nhất trên một bảng job.
 */
export function soatGhiSo(ds: BuocGhiSo[]): PhanXetGhiSo {
  const chan: string[] = []
  const canhBao: string[] = []
  for (const b of ds) {
    if (!b.loi) continue
    ;(b.chan ? chan : canhBao).push(cau(b, b.loi.message))
  }
  return { nem: chan.length > 0 ? chan.join(' ') : null, canhBao }
}

/**
 * Đẩy đi `daGui` lượt mà database chỉ đánh dấu `daDanhDau`.
 *
 * KHÔNG làm job đỏ, và lý do đáng ghi lại: `thong_bao_da_day()` chỉ đếm những
 * dòng nó thật sự đổi (`and sent_push_at is null`). Đếm hụt nghĩa là dòng đó đã
 * được đánh dấu bởi một lần chạy KHÁC đang chồng lên lần này — hoặc đã bị xoá.
 * Cả hai ca đều không làm thông báo lặp lại, nên không phải chuyện phải đỏ.
 *
 * Nhưng hai lần chạy chồng nhau thì cả hai cùng đọc một hàng đợi và cùng đẩy —
 * tức là cư dân đã nhận hai lần. Đó là chuyện phải biết, nên nó kêu.
 */
export function lechDanhDau(daGui: number, daDanhDau: number): string | null {
  if (daDanhDau >= daGui) return null
  return `Đẩy ${daGui} lượt nhưng chỉ đánh dấu được ${daDanhDau} thông báo. `
    + 'Thường là hai lần chạy chồng lên nhau — nghĩa là có người đã nhận hai lần. '
    + 'Xem lịch cron có đang gọi dày hơn thời gian một lần chạy không.'
}
