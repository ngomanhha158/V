/**
 * Kho ảnh có thật sự nằm trên một Volume không.
 *
 * GO-LIVE.md và màn go-live đều xếp việc này vào "nằm ngoài phần mềm" — tức hệ
 * thống tự tuyên bố không kiểm được, và bảo người dựng tự sang Railway mà nhìn.
 * Nhưng kiểm được, và hậu quả của việc không kiểm thì đúng như comment trong
 * lib/anh.ts đã viết: không có volume thì mọi ảnh biến mất ở lần deploy kế
 * tiếp, LẶNG LẼ, và chỉ lộ ra lúc có người mở lại một yêu cầu cũ để đối chất.
 *
 * Ảnh hỏng hóc là bằng chứng trong tranh chấp giữa cư dân và ban quản lý. Mất
 * nó không phải là mất một tệp, mà là mất khả năng chứng minh.
 *
 * CÁCH KIỂM: một volume đã gắn là một filesystem KHÁC với filesystem gốc của
 * container, nên `stat().dev` của hai bên khác nhau. Đó là câu hỏi đúng — khác
 * hẳn "thư mục có tồn tại không", vì thư mục luôn tồn tại (app tự tạo) kể cả
 * khi nó nằm trên đĩa tạm.
 */

/** Sự thật đọc được từ đĩa. Tách khỏi phần phán xét để phần đó test được. */
export type SuThatKho = {
  duong: string
  /** Thư mục có mở ra được không. */
  coThuMuc: boolean
  /** Ghi vào được không. */
  ghiDuoc: boolean
  /** stat().dev của thư mục và của `/`. Null khi không đọc được. */
  devKho: number | null
  devGoc: number | null
  /** Đang chạy ở production hay không — quyết định mức độ nghiêm trọng. */
  laProduction: boolean
}

export type TinhKho =
  /** Thư mục nằm trên một filesystem riêng: đúng là volume. */
  | 'co_volume'
  /** Thư mục cùng filesystem với container: ảnh sẽ mất ở lần deploy sau. */
  | 'dia_tam'
  /** Không mở được thư mục. */
  | 'khong_co_thu_muc'
  /** Mở được nhưng không ghi được. */
  | 'khong_ghi_duoc'
  /** Không đọc được thông tin filesystem — không kết luận gì. */
  | 'khong_ro'

export type KetQuaKho = {
  tinh: TinhKho
  /** Có phải chuyện phải sửa trước khi mở cho cư dân không. */
  chan: boolean
  cau: string
}

/**
 * Phán xét, thuần tuý từ sự thật đã đọc.
 *
 * 'dia_tam' KHÔNG chặn ở môi trường dev: ở máy lập trình viên thì `.anh` nằm
 * ngay trong repo và đó là đúng ý. Báo đỏ ở đó là dạy người ta bỏ qua màu đỏ
 * trước khi họ kịp gặp lần đỏ thật.
 */
export function soatKho(s: SuThatKho): KetQuaKho {
  if (!s.coThuMuc) {
    return {
      tinh: 'khong_co_thu_muc', chan: s.laProduction,
      cau: `Không mở được thư mục ảnh ${s.duong}. Ảnh kèm theo yêu cầu sẽ không lưu được.`,
    }
  }
  if (!s.ghiDuoc) {
    return {
      tinh: 'khong_ghi_duoc', chan: s.laProduction,
      cau: `Thư mục ảnh ${s.duong} không ghi được. Cư dân gửi ảnh lên sẽ báo lỗi.`,
    }
  }
  if (s.devKho === null || s.devGoc === null) {
    return {
      tinh: 'khong_ro', chan: false,
      cau: `Không đọc được thông tin ổ đĩa của ${s.duong}, nên chưa kết luận được `
        + 'đây có phải Volume hay không. Kiểm tay trên Railway.',
    }
  }
  if (s.devKho === s.devGoc) {
    return {
      tinh: 'dia_tam', chan: s.laProduction,
      cau: s.laProduction
        ? `Thư mục ảnh ${s.duong} đang nằm trên đĩa TẠM của container, không phải `
          + 'Volume. App vẫn nhận ảnh bình thường — rồi mất sạch ở lần deploy kế '
          + 'tiếp, lặng lẽ, và chỉ lộ ra lúc có người mở lại một yêu cầu cũ để '
          + 'đối chất. Gắn Volume vào service `v` tại đúng đường dẫn này.'
        : `Thư mục ảnh ${s.duong} nằm cùng ổ với hệ thống — bình thường ở máy dev.`,
    }
  }
  return {
    tinh: 'co_volume', chan: false,
    cau: `Thư mục ảnh ${s.duong} nằm trên một ổ riêng — đúng là Volume đã gắn.`,
  }
}

/**
 * PostgREST đang được gọi qua địa chỉ nội bộ hay địa chỉ công khai.
 *
 * KHÔNG trả lời được câu "PostgREST có tên miền công khai không" — muốn biết
 * điều đó phải hỏi Railway, và app không hỏi được. Nó chỉ trả lời câu hẹp hơn:
 * app này đang đi đường nào. Giữ đúng phạm vi là quan trọng; một màn hình nói
 * "đã kiểm, an toàn" trong khi chỉ kiểm được một nửa thì tệ hơn là không nói gì.
 */
export function laNoiBo(url: string | undefined): boolean | null {
  if (!url) return null
  try {
    const u = new URL(url)
    // BẮT BUỘC có scheme http/https, và hostname không rỗng. Thiếu "http://" là
    // lỗi dễ mắc nhất (lib/db/env.ts đã cảnh báo riêng về nó), mà Node lại NHẬN
    // "postgrest.railway.internal:3000" — nó đọc phần trước dấu hai chấm thành
    // scheme, hostname thành rỗng. Không chặn ở đây thì một cấu hình thiếu
    // scheme bị báo là "công khai": báo động sai, và sai về đúng chuyện đáng
    // sợ nhất trên màn này.
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    const h = u.hostname
    if (!h) return null
    return h.endsWith('.railway.internal')
      || h === 'localhost' || h === '127.0.0.1' || h === '[::1]'
  } catch {
    return null
  }
}
