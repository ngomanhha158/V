import Link from 'next/link'
import type { ReactNode } from 'react'
import { NavDoc } from './nav-link'
import { NhomNav } from './nhom-nav'
import { ChonKhu } from './chon-khu'
import { nenHienHopChon, type Khu } from '@/lib/khu'
import { ThemeToggle } from './theme-toggle'
import { NutRa } from './nut-ra'
import {
  IcBanGiao, IcBieuDo, IcCanHo, IcCheck, IcDoiSoat, IcHoaDon, IcLich, IcLoa, IcNguoi, IcNha, IcNhap, IcQR,
  IcBaoCao, IcBieuQuyet, IcCaTruc, IcChiaDot, IcDatCho, IcKho, IcThiCong, IcKet, IcKhach, IcKien, IcPhieuThu, IcSach, IcSo, IcTaiVe, IcThe, IcTien,
  IcToaNha, IcXe, IcYeuCau,
} from '@/components/icons'

export function BqlShell({
  children, base = '', duAn, khu, dsKhu, chonKhu,
}: {
  children: ReactNode; base?: string; duAn?: string
  khu?: Khu | null; dsKhu?: Khu[]; chonKhu?: (formData: FormData) => void
}) {
  // Bản demo không có phiên nào để thoát ra — xem ghi chú ở ResidentShell.
  const laThat = base === ''
  // Hộp chọn khu luôn hiện tên khu đang xem. Để dòng phụ dưới "VBuilding" nói
  // lại đúng cái tên đó là in hai lần cùng một chữ trong bốn chục pixel.
  const coHopChon = !!(khu && chonKhu && nenHienHopChon(dsKhu ?? []))
  const nav = (
    <>
      {/* NHÓM THEO TẦN SUẤT ĐỤNG TỚI, không theo chủ đề.
          Chủ đề nghe hợp lý khi vẽ sơ đồ, nhưng người trực ban không mở thanh
          bên để duyệt cây chức năng — họ nhảy giữa "yêu cầu đang cháy" và "ai
          chưa đóng tiền" cả ngày. Xếp "Nhập từ Excel" (đụng ba lần trong đời)
          cạnh "Ca trực" (đụng hai lần mỗi ca) là bắt họ lướt qua nó mãi mãi. */}
      <NhomNav nhan="Trực ban">
        <NavDoc href={`${base}/bql/dashboard`} icon={<IcBieuDo />}>Sức khỏe vận hành</NavDoc>
        <NavDoc href={`${base}/bql/tickets`} icon={<IcYeuCau />}>Điều phối yêu cầu</NavDoc>
        <NavDoc href={`${base}/bql/sla`} icon={<IcCheck />}>Cam kết thời gian</NavDoc>
        <NavDoc href={`${base}/bql/ca-truc`} icon={<IcCaTruc />}>Ca trực</NavDoc>
        <NavDoc href={`${base}/quet`} icon={<IcThe />}>Quét thẻ cư dân</NavDoc>
        <NavDoc href={`${base}/bql/so-ra-vao`} icon={<IcKhach />}>Sổ ra vào</NavDoc>
        <NavDoc href={`${base}/bql/kien-hang`} icon={<IcKien />}>Nhận hàng hộ</NavDoc>
        <NavDoc href={`${base}/bql/tien-ich`} icon={<IcDatCho />}>Tiện ích</NavDoc>
      </NhomNav>

      <NhomNav nhan="Kỹ thuật & tài sản" moSan={false}>
        <NavDoc href={`${base}/bql/bao-tri`} icon={<IcLich />}>Bảo trì định kỳ</NavDoc>
        <NavDoc href={`${base}/bql/kho`} icon={<IcKho />}>Kho vật tư</NavDoc>
        <NavDoc href={`${base}/bql/thi-cong`} icon={<IcThiCong />}>Chuyển nhà &amp; thi công</NavDoc>
        <NavDoc href={`${base}/bql/bai-xe`} icon={<IcXe />}>Chỗ đỗ xe</NavDoc>
      </NhomNav>

      <NhomNav nhan="Tiền">
        <NavDoc href={`${base}/bql/billing`} icon={<IcHoaDon />}>Hóa đơn</NavDoc>
        <NavDoc href={`${base}/bql/cong-no`} icon={<IcTien />}>Công nợ</NavDoc>
        <NavDoc href={`${base}/bql/doi-soat`} icon={<IcDoiSoat />}>Đối soát tiền về</NavDoc>
        <NavDoc href={`${base}/bql/phieu-thu`} icon={<IcPhieuThu />}>Phiếu thu</NavDoc>
        <NavDoc href={`${base}/bql/tra-gop`} icon={<IcChiaDot />}>Thu theo đợt</NavDoc>
        <NavDoc href={`${base}/bql/quy-bao-tri`} icon={<IcKet />}>Quỹ bảo trì 2%</NavDoc>
        <NavDoc href={`${base}/bql/bieu-phi`} icon={<IcTien />}>Biểu phí</NavDoc>
        <NavDoc href={`${base}/bql/ban-giao`} icon={<IcBanGiao />}>Chốt sổ bàn giao</NavDoc>
        <NavDoc href={`${base}/bql/xuat`} icon={<IcTaiVe />}>Xuất Excel</NavDoc>
      </NhomNav>

      <NhomNav nhan="Cư dân" moSan={false}>
        <NavDoc href={`${base}/bql/bang-tin`} icon={<IcLoa />}>Bảng tin</NavDoc>
        <NavDoc href={`${base}/bql/duyet-chu-ho`} icon={<IcNguoi />}>Duyệt chủ hộ</NavDoc>
        <NavDoc href={`${base}/bql/so-tay`} icon={<IcSach />}>Sổ tay cư dân</NavDoc>
        <NavDoc href={`${base}/bql/bieu-quyet`} icon={<IcBieuQuyet />}>Biểu quyết hội nghị</NavDoc>
      </NhomNav>

      {/* MỞ SẴN ĐÚNG HAI NHÓM: trực ban và tiền. Đó là hai chỗ người ta sống
          cả ngày, và cú nhảy hay gặp nhất — "sức khỏe vận hành" sang "công nợ"
          — nằm vắt qua đúng hai nhóm này, nên cả hai phải mở cùng lúc.
          Bốn nhóm còn lại gập sẵn: mở ra mất một nhịp, MỘT LẦN, rồi được nhớ.
          Bày cả 34 mục ra thì không màn hình 900px nào chứa nổi — và một danh
          sách phải cuộn mới hết thì mục cuối coi như không tồn tại. */}
      <NhomNav nhan="Sổ sách" moSan={false}>
        <NavDoc href={`${base}/bql/bao-cao`} icon={<IcBaoCao />}>Báo cáo quý</NavDoc>
        <NavDoc href={`${base}/bql/nhat-ky`} icon={<IcSo />}>Nhật ký kiểm toán</NavDoc>
      </NhomNav>

      <NhomNav nhan="Thiết lập" moSan={false}>
        <NavDoc href={`${base}/bql/khu`} icon={<IcToaNha />}>Khu đang quản lý</NavDoc>
        <NavDoc href={`${base}/bql`} icon={<IcToaNha />} chinhXac>Tòa nhà</NavDoc>
        <NavDoc href={`${base}/bql/can-ho`} icon={<IcCanHo />}>Căn hộ &amp; diện tích</NavDoc>
        <NavDoc href={`${base}/bql/import`} icon={<IcNhap />}>Nhập từ Excel</NavDoc>
        <NavDoc href={`${base}/bql/nguoi-dung`} icon={<IcNguoi />}>Người dùng &amp; phân quyền</NavDoc>
        <NavDoc href={`${base}/bql/poster`} icon={<IcQR />}>Poster QR</NavDoc>
        <NavDoc href={`${base}/bql/go-live`} icon={<IcCheck />}>Sẵn sàng go-live</NavDoc>
      </NhomNav>

      {/* Không nằm trong nhóm nào: đây không phải một màn BQL mà là đổi vai —
          xem hệ thống bằng con mắt cư dân. Trên điện thoại nó là mục cuối của
          dải cuộn; trên máy tính nó xuống chân thanh bên, cạnh nút thoát, vì
          đổi vai và thoát ra là hai việc cùng một loại. */}
      <span className="contents lg:hidden">
        <NavDoc href={base || '/'} icon={<IcNha />} chinhXac>Về màn cư dân</NavDoc>
      </span>
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
              {coHopChon ? `${dsKhu?.length} khu đang quản lý` : (duAn ?? 'Ban quản lý')}
            </span>
          </span>
          <ThemeToggle className="lg:hidden" />
        </div>

        {/* Chọn khu chỉ hiện khi có từ hai khu trở lên — xem ghi chú ở ChonKhu. */}
        {coHopChon && (
          <div className="px-3 pt-3">
            <ChonKhu dang={khu} ds={dsKhu ?? []} chon={chonKhu} />
          </div>
        )}

        {/* Máy tính: cột dọc. Điện thoại: dải ngang cuộn được, các nhãn nhóm
            ẩn đi vì hàng ngang không đủ chỗ diễn đạt phân cấp. */}
        <nav className="scroll-x flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:gap-0.5 lg:overflow-x-visible lg:overflow-y-auto lg:pt-1 lg:pb-2">
          {nav}
        </nav>

        {/* mt-auto đẩy khối này xuống đáy cột — nếu không nó dính ngay dưới
            mục nav cuối và lửng lơ giữa thanh bên. */}
        <div className="mt-auto hidden shrink-0 border-t border-line px-3 py-3 lg:block">
          {/* Không còn vòng tròn "BQL" cạnh dòng chữ "Ban quản lý": nó nhắc lại
              đúng cái vừa viết, và 40px nó chiếm là thứ làm cả hàng này vỡ chữ
              khi thêm nút thứ ba. */}
          <div className="flex items-center gap-1 rounded-ctl px-1 py-1.5">
            <span className="min-w-0 flex-1 px-1.5 text-[0.8125rem] leading-tight">
              <span className="block truncate font-medium text-ink">Ban quản lý</span>
              <span className="block truncate text-faint">Đang trực</span>
            </span>
            {/* Ba nút cùng một loại việc: rời khỏi màn BQL. Để "Về màn cư dân"
                thành một dòng nav riêng thì nó trông như một màn BQL nữa, mà nó
                là đổi vai — và một dòng ở đây tốn 40px của phần cuộn bên trên. */}
            <Link
              href={base || '/'}
              title="Về màn cư dân" aria-label="Về màn cư dân"
              className="inline-flex size-9 items-center justify-center rounded-ctl text-muted transition-colors hover:bg-sunken hover:text-ink"
            >
              <IcNha />
            </Link>
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
