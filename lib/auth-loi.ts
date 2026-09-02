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
  | 'khong_gui_duoc' | 'chua_co_sms' | 'mang' | 'la'

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

  la: 'Có lỗi không rõ. Thử lại giúp em, nếu vẫn vậy thì báo ban quản lý.',
}

export function loiDangNhap(tt: string, giay = 0): string {
  if (tt === 'cho') {
    return `Vừa gửi rồi — chờ ${doiCho(giay)} nữa mới gửi lại được. `
      + 'Kiểm tra cả hộp thư rác trong lúc chờ.'
  }
  return CAU[tt as TrangThai] ?? CAU.la
}
