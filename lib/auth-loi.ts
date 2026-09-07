/**
 * Thông điệp lỗi đăng nhập, CÓ HÀNH ĐỘNG KÈM THEO.
 *
 * Trước đây file này dịch mã lỗi của Supabase Auth. Giờ hệ thống tự cấp phiên
 * nên trạng thái do chính mình đặt tên — nhưng nguyên tắc thì không đổi: mỗi
 * câu phải trả lời được "vậy giờ tôi làm gì". Cư dân đọc "invalid credentials"
 * thì không biết mình gõ sai mã hay sai mật khẩu, nên họ bấm lại vài lần rồi
 * gọi cho ban quản lý.
 *
 * Danh sách trạng thái này khớp với railway/03_auth.sql. Thêm trạng thái ở SQL
 * mà quên thêm ở đây thì người dùng nhận đúng cái chuỗi mã máy — có test chốt.
 */
export type TrangThai =
  | 'cho' | 'sai' | 'het_han' | 'qua_nhieu'
  | 'sai_mat_khau' | 'chua_dat_mat_khau'
  | 'khong_gui_duoc' | 'chua_co_sms' | 'mang' | 'he_thong' | 'la'
  // Bốn nhánh CON của 'he_thong'. Cùng một triệu chứng với cư dân, nhưng bốn
  // chỗ sửa khác hẳn nhau — và người sửa thường chính là người đang đứng trước
  // màn này. Gộp chung một câu là bắt họ đi mở log máy chủ mới biết bắt đầu từ
  // đâu.
  | 'he_thong_khoa' | 'he_thong_thieu_khoa'
  | 'he_thong_thieu_lop' | 'he_thong_mat_ket_noi'

/** "47 giây", "3 phút" — làm tròn LÊN. Nói "2 phút" cho 121 giây rồi để người
 *  ta bấm ở giây thứ 120 và lại bị chặn là hỏng đúng lúc họ đã kiên nhẫn. */
export function doiCho(giay: number): string {
  if (giay <= 90) return `${Math.max(1, Math.ceil(giay))} giây`
  return `${Math.ceil(giay / 60)} phút`
}

const CAU: Record<TrangThai, string> = {
  cho: '',   // ghép động ở dưới, cần số giây

  sai: 'Mã không đúng. Kiểm tra lại dãy số trong thư — mã mới nhất mới là mã '
    + 'dùng được, thư cũ bỏ qua.',

  het_han: 'Mã đã hết hạn hoặc đã dùng rồi. Bấm gửi lại để nhận mã mới.',

  qua_nhieu: 'Đã nhập sai quá nhiều lần nên hệ thống tạm khóa mã này. Chờ 10 '
    + 'phút rồi xin mã mới, hoặc đăng nhập bằng mật khẩu nếu ban quản lý đã đặt '
    + 'cho bạn.',

  sai_mat_khau: 'Sai mật khẩu, hoặc tài khoản này chưa được đăng ký. Nhờ ban '
    + 'quản lý đặt lại mật khẩu, hoặc chuyển sang nhận mã một lần.',

  chua_dat_mat_khau: 'Tài khoản này chưa có mật khẩu. Đăng nhập bằng mã một '
    + 'lần, rồi nhờ ban quản lý đặt mật khẩu nếu bạn muốn dùng cách này.',

  khong_gui_duoc: 'Hệ thống không gửi được thư lúc này. Đây là trục trặc của '
    + 'hệ thống, không phải do bạn nhập sai. Thử lại sau ít phút, hoặc đăng '
    + 'nhập bằng mật khẩu.',

  chua_co_sms: 'Hệ thống chưa gửi được tin nhắn SMS. Dùng địa chỉ email đã '
    + 'đăng ký với ban quản lý, hoặc đăng nhập bằng mật khẩu.',

  mang: 'Không kết nối được tới máy chủ. Kiểm tra mạng rồi thử lại.',

  // Khác 'mang' ở chỗ: mạng của NGƯỜI DÙNG thì họ tự xử được, còn cái này thì
  // không — và khác 'la' ở chỗ 'la' bảo họ thử lại, mà thử lại không bao giờ
  // qua được. Câu này phải đẩy họ đi báo người sửa được, ngay từ lần đầu.
  he_thong: 'Hệ thống đang không đọc được dữ liệu đăng nhập. Đây là sự cố của '
    + 'hệ thống, không phải bạn nhập sai — thử lại cũng sẽ như vậy. Báo ban '
    + 'quản lý để họ kiểm tra máy chủ.',

  la: 'Có lỗi không rõ. Thử lại giúp em, nếu vẫn vậy thì báo ban quản lý.',

  // Ba câu dưới đây vẫn viết cho CƯ DÂN đọc — không tên biến, không tên hàm.
  // Phần kỹ thuật nằm ở goYNguoiSua() bên dưới, hiện thành một khối riêng.
  he_thong_khoa: 'Máy chủ đang từ chối chính app này, nên chưa ai đăng nhập '
    + 'được — không riêng bạn. Đây là sai cấu hình phía hệ thống, thử lại cũng '
    + 'sẽ như vậy. Báo ban quản lý.',

  he_thong_thieu_khoa: 'Máy chủ dữ liệu chưa được cấu hình xong nên nó chưa '
    + 'nhận đăng nhập của bất kỳ ai. Không riêng bạn, và thử lại cũng sẽ như '
    + 'vậy. Báo ban quản lý.',

  he_thong_thieu_lop: 'Phần đăng nhập chưa được cài đặt xong trên máy chủ. '
    + 'Chưa ai vào được, và thử lại cũng sẽ như vậy. Báo ban quản lý.',

  he_thong_mat_ket_noi: 'App không nối được tới máy chủ dữ liệu. Không phải '
    + 'mạng của bạn — mạng bạn vẫn đang tải được trang này. Báo ban quản lý.',
}

/**
 * Gợi ý cho NGƯỜI SỬA, không phải cho cư dân.
 *
 * Vì sao tách hẳn khỏi CAU: hai người đọc, hai ngôn ngữ. Cư dân đọc tên biến
 * môi trường thì vô nghĩa và đáng sợ; người dựng hệ thống đọc "báo ban quản lý"
 * thì đúng nhưng vô dụng — họ CHÍNH LÀ ban quản lý, và họ đang đứng trước màn
 * hình này. Trước đây họ phải mở log Railway mới biết là cái nào trong ba.
 *
 * Chỉ trả về cho ba nhánh sự cố hệ thống. Mọi trạng thái khác trả null: sai
 * mật khẩu thì không có gì để gợi ý cho ai sửa cả.
 */
export function goYNguoiSua(tt: string): string | null {
  switch (tt) {
    case 'he_thong_khoa':
      return 'AUTH_JWT_SECRET của service `v` không trùng khít PGRST_JWT_SECRET '
        + 'của service PostgREST. Copy lại nguyên vẹn — coi chừng dấu cách hoặc '
        + 'xuống dòng dính ở cuối — rồi deploy lại.'
    // KHÁC he_thong_khoa ở chỗ phải sửa service NÀO. Gộp hai ca này lại từng
    // đẩy người đi sửa sang đúng cái service không hỏng — họ dán lại
    // AUTH_JWT_SECRET ba lượt, trong khi phía PostgREST không có khoá nào để
    // mà lệch. Câu cuối nói thẳng điều đó, để không ai lặp lại vòng đó nữa.
    case 'he_thong_thieu_khoa':
      return 'PostgREST trả PGRST300 "Server lacks JWT secret": service '
        + 'PostgREST CHƯA CÓ biến PGRST_JWT_SECRET — thiếu hẳn, để rỗng, hoặc '
        + 'gõ sai tên biến. Đặt nó bằng đúng chuỗi AUTH_JWT_SECRET của service '
        + '`v` rồi deploy lại PostgREST. Dán lại AUTH_JWT_SECRET không giải '
        + 'quyết được gì: thiếu ở phía bên kia.'
    case 'he_thong_thieu_lop':
      return 'PostgREST không thấy hàm đăng nhập. Hoặc chưa chạy '
        + 'railway/03_auth.sql trên database, hoặc đã chạy rồi mà quên chạy tiếp: '
        + "notify pgrst, 'reload schema'"
    case 'he_thong_mat_ket_noi':
      return 'Không nối được tới POSTGREST_URL. Kiểm đúng tên service PostgREST '
        + 'kèm cổng, và PGRST_SERVER_HOST phải đặt là :: — mặc định PostgREST '
        + 'chỉ nghe IPv4, còn mạng nội bộ Railway là IPv6.'
    default:
      return null
  }
}

/**
 * Những trạng thái bản này BIẾT. Dùng để phân biệt "lỗi lạ thật" với "máy chủ
 * mới hơn trình duyệt".
 *
 * Vì sao cần: câu chữ nằm ở trình duyệt, còn chẩn đoán thì máy chủ mới biết.
 * Thêm một trạng thái ở máy chủ mà tab của người dùng vẫn đang giữ bản JS cũ
 * thì trạng thái mới rơi vào câu chung "có lỗi không rõ, thử lại giúp em" —
 * và thử lại là đúng thứ KHÔNG bao giờ qua được. Gặp thật ngay lần deploy đầu
 * sau khi thêm ba nhánh he_thong_*.
 */
export const BIET_TRANG_THAI: ReadonlySet<string> = new Set(Object.keys(CAU))

export function loiDangNhap(tt: string, giay = 0): string {
  if (tt === 'cho') {
    return `Vừa gửi rồi — chờ ${doiCho(giay)} nữa mới gửi lại được. `
      + 'Kiểm tra cả hộp thư rác trong lúc chờ.'
  }
  return CAU[tt as TrangThai] ?? CAU.la
}

/**
 * Một lỗi PostgREST -> ĐÚNG nguyên nhân, không phải "hệ thống hỏng" chung.
 *
 * Ở đây chứ không ở lib/db/dang-nhap.ts: file đó import next/headers nên node
 * chạy test không nạp nổi, và một bảng phân loại không có test thì vẫn "chạy"
 * trong khi trả về đúng một nhánh chung cho mọi thứ — tức là không làm gì cả.
 *
 * Ba nguyên nhân, một triệu chứng — và trước đây cả ba đều ra cùng một câu, nên
 * người đi sửa phải mở log máy chủ mới biết bắt đầu từ đâu. Mà người đi sửa
 * thường chính là người đang đứng trước màn đăng nhập.
 *
 * Phân loại theo NỘI DUNG lỗi chứ không theo mã HTTP: PostgREST trả 404 cho cả
 * "không có hàm này" lẫn vài chuyện khác, còn chữ ký sai thì nằm trong message.
 */
export function phanLoaiLoiHeThong(
  e: { code?: string; message?: string; details?: string } | null,
): 'he_thong_khoa' | 'he_thong_thieu_khoa' | 'he_thong_thieu_lop'
  | 'he_thong_mat_ket_noi' | 'he_thong' {
  const chu = `${e?.code ?? ''} ${e?.message ?? ''} ${e?.details ?? ''}`
  // XÉT TRƯỚC mẫu JWT chung, vì câu của ca này — "Server lacks JWT secret" —
  // cũng chứa chữ JWT và sẽ bị mẫu kia nuốt mất. Thứ tự ở đây không phải tiểu
  // tiết: xếp sau thì màn hình báo "hai khoá lệch nhau" trong khi sự thật là
  // một bên không có khoá nào, và người đọc đi sửa nhầm service. Đã xảy ra
  // thật trên production, mất ba lượt thử của người dùng.
  if (e?.code === 'PGRST300' || /lacks jwt secret/i.test(chu)) return 'he_thong_thieu_khoa'
  // Chữ ký JWT: PostgREST trả "JWSError JWSInvalidSignature" / "JWT expired".
  if (/jws|jwt|signature|invalid token|expired/i.test(chu)) return 'he_thong_khoa'
  // Không thấy hàm: PGRST202, hoặc câu "Could not find the function ... in the
  // schema cache" — bao gồm cả ca đã áp SQL mà quên notify pgrst.
  if (e?.code === 'PGRST202' || /could not find the function|schema cache|does not exist/i.test(chu)) {
    return 'he_thong_thieu_lop'
  }
  // fetch hỏng: postgrest-js gói lỗi mạng thành message "TypeError: fetch failed".
  if (/fetch failed|econnrefused|enotfound|etimedout|network|socket/i.test(chu)) {
    return 'he_thong_mat_ket_noi'
  }
  return 'he_thong'
}
