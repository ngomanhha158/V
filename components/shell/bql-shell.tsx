import Link from 'next/link'
import type { ReactNode } from 'react'
import { NavDoc } from './nav-link'
import { ThemeToggle } from './theme-toggle'
import { NutRa } from './nut-ra'
import {
  IcBanGiao, IcBieuDo, IcCanHo, IcCheck, IcDoiSoat, IcHoaDon, IcLich, IcLoa, IcNguoi, IcNha, IcNhap, IcQR,
  IcBieuQuyet, IcCaTruc, IcChiaDot, IcDatCho, IcKho, IcThiCong, IcKet, IcKhach, IcKien, IcPhieuThu, IcSach, IcSo, IcTaiVe, IcThe, IcTien,
  IcToaNha, IcXe, IcYeuCau,
} from '@/components/icons'

/** Nhãn nhóm. Ẩn trên điện thoại: hàng ngang không diễn đạt được phân cấp,
 *  để lại chỉ tổ chiếm chỗ. */
function Muc({ nhan }: { nhan: string }) {
  return (
    <div className="hidden px-2.5 pt-5 pb-1.5 text-[0.6875rem] font-semibold tracking-wider text-faint uppercase lg:block">
      {nhan}
    </div>
  )
}

/**
 * Vỏ màn BQL. Đây là phần mềm dùng trên máy tính cả ngày: thanh bên cố định,
 * mọi mục nhìn thấy cùng lúc, không giấu sau nút menu. Người trực ban cần nhảy
 * giữa "yêu cầu đang cháy" và "ai chưa đóng tiền" liên tục.
 *
 * Trên điện thoại thanh bên chạy xuống thành dải cuộn ngang phía trên — vẫn
 * thấy hết mục, không cần mở đóng gì.
 */
export function BqlShell({
  children, base = '', duAn,
}: { children: ReactNode; base?: string; duAn?: string }) {
  // Bản demo không có phiên nào để thoát ra — xem ghi chú ở ResidentShell.
  const laThat = base === ''
  const nav = (
    <>
      <Muc nhan="Vận hành" />
      <NavDoc href={`${base}/bql/dashboard`} icon={<IcBieuDo />}>Sức khỏe vận hành</NavDoc>
      <NavDoc href={`${base}/bql/tickets`} icon={<IcYeuCau />}>Điều phối yêu cầu</NavDoc>
      <NavDoc href={`${base}/bql/sla`} icon={<IcCheck />}>Cam kết thời gian</NavDoc>
      <NavDoc href={`${base}/bql/bao-tri`} icon={<IcLich />}>Bảo trì định kỳ</NavDoc>
      <NavDoc href={`${base}/bql/kho`} icon={<IcKho />}>Kho vật tư</NavDoc>
      <NavDoc href={`${base}/quet`} icon={<IcThe />}>Quét thẻ cư dân</NavDoc>
      <NavDoc href={`${base}/bql/ca-truc`} icon={<IcCaTruc />}>Ca trực</NavDoc>
      <NavDoc href={`${base}/bql/so-ra-vao`} icon={<IcKhach />}>Sổ ra vào</NavDoc>
      <NavDoc href={`${base}/bql/tien-ich`} icon={<IcDatCho />}>Tiện ích</NavDoc>
      <NavDoc href={`${base}/bql/kien-hang`} icon={<IcKien />}>Nhận hàng hộ</NavDoc>
      <NavDoc href={`${base}/bql/thi-cong`} icon={<IcThiCong />}>Chuyển nhà &amp; thi công</NavDoc>
      <NavDoc href={`${base}/bql/bai-xe`} icon={<IcXe />}>Chỗ đỗ xe</NavDoc>

      <Muc nhan="Truyền thông" />
      <NavDoc href={`${base}/bql/bang-tin`} icon={<IcLoa />}>Bảng tin</NavDoc>
      <NavDoc href={`${base}/bql/so-tay`} icon={<IcSach />}>Sổ tay cư dân</NavDoc>
      <NavDoc href={`${base}/bql/bieu-quyet`} icon={<IcBieuQuyet />}>Biểu quyết hội nghị</NavDoc>

      <Muc nhan="Tài chính" />
      <NavDoc href={`${base}/bql/bieu-phi`} icon={<IcTien />}>Biểu phí</NavDoc>
      <NavDoc href={`${base}/bql/billing`} icon={<IcHoaDon />}>Hóa đơn</NavDoc>
      <NavDoc href={`${base}/bql/cong-no`} icon={<IcTien />}>Công nợ</NavDoc>
      <NavDoc href={`${base}/bql/doi-soat`} icon={<IcDoiSoat />}>Đối soát tiền về</NavDoc>
      <NavDoc href={`${base}/bql/phieu-thu`} icon={<IcPhieuThu />}>Phiếu thu</NavDoc>
      <NavDoc href={`${base}/bql/quy-bao-tri`} icon={<IcKet />}>Quỹ bảo trì 2%</NavDoc>
      <NavDoc href={`${base}/bql/tra-gop`} icon={<IcChiaDot />}>Thu theo đợt</NavDoc>
      <NavDoc href={`${base}/bql/ban-giao`} icon={<IcBanGiao />}>Chốt sổ bàn giao</NavDoc>
      <NavDoc href={`${base}/bql/xuat`} icon={<IcTaiVe />}>Xuất Excel</NavDoc>

      {/* Tòa nhà và import là việc DỰNG hệ thống, làm vài lần rồi thôi. Để
          chúng cạnh việc trực ban hằng ngày là bắt người trực lướt qua mỗi lần. */}
      <Muc nhan="Vận hành khu" />
      <NavDoc href={`${base}/bql/duyet-chu-ho`} icon={<IcNguoi />}>Duyệt chủ hộ</NavDoc>
      <NavDoc href={`${base}/bql/go-live`} icon={<IcCheck />}>Sẵn sàng go-live</NavDoc>
      <NavDoc href={`${base}/bql/poster`} icon={<IcQR />}>Poster QR</NavDoc>
      <NavDoc href={`${base}/bql/nhat-ky`} icon={<IcSo />}>Nhật ký kiểm toán</NavDoc>

      <Muc nhan="Dữ liệu" />
      <NavDoc href={`${base}/bql/nguoi-dung`} icon={<IcNguoi />}>Người dùng & phân quyền</NavDoc>
      <NavDoc href={`${base}/bql`} icon={<IcToaNha />} chinhXac>Tòa nhà</NavDoc>
      <NavDoc href={`${base}/bql/can-ho`} icon={<IcCanHo />}>Căn hộ & diện tích</NavDoc>
      <NavDoc href={`${base}/bql/import`} icon={<IcNhap />}>Nhập từ Excel</NavDoc>
      <NavDoc href={base || '/'} icon={<IcNha />} chinhXac>Về màn cư dân</NavDoc>
    </>
  )

  return (
    <div className="min-h-dvh bg-canvas lg:flex">
      <aside className="border-b border-line bg-surface lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-64 lg:shrink-0 lg:flex-col lg:border-r lg:border-b-0">
        <div className="flex h-14 items-center gap-2.5 px-4 lg:border-b lg:border-line">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand text-[0.8125rem] font-bold text-on-brand">
            VB
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm leading-tight font-semibold text-ink">VBuilding</span>
            <span className="block truncate text-[0.75rem] leading-tight text-faint">
              {duAn ?? 'Ban quản lý'}
            </span>
          </span>
          <ThemeToggle className="lg:hidden" />
        </div>

        {/* Máy tính: cột dọc. Điện thoại: dải ngang cuộn được, các nhãn nhóm
            ẩn đi vì hàng ngang không đủ chỗ diễn đạt phân cấp. */}
        <nav className="scroll-x flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:gap-0.5 lg:overflow-x-visible lg:overflow-y-auto lg:pt-1 lg:pb-4">
          {nav}
        </nav>

        {/* mt-auto đẩy khối này xuống đáy cột — nếu không nó dính ngay dưới
            mục nav cuối và lửng lơ giữa thanh bên. */}
        <div className="mt-auto hidden shrink-0 border-t border-line px-3 py-3 lg:block">
          <div className="flex items-center gap-2 rounded-ctl px-2 py-1.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-sunken text-[0.75rem] font-semibold text-muted">
              BQL
            </span>
            <span className="min-w-0 flex-1 text-[0.8125rem] leading-tight">
              <span className="block truncate font-medium text-ink">Ban quản lý</span>
              <span className="block truncate text-faint">Đang trực</span>
            </span>
            <ThemeToggle />
            {laThat && <NutRa />}
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </div>
    </div>
  )
}
