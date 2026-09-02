import type { SVGProps } from 'react'

/**
 * Icon vẽ thẳng bằng SVG thay vì kéo cả thư viện về. Toàn bộ app dùng chưa tới
 * 20 hình; một gói icon là thêm vài trăm KB vào bundle của cư dân đang dùng 3G
 * ở hầm gửi xe.
 *
 * Đều là nét 1.75 trên lưới 24 để đặt cạnh nhau không cái nào đậm hơn cái nào.
 */
function I({ children, ...p }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      width={20} height={20} {...p}
    >
      {children}
    </svg>
  )
}

export const IcNha = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /><path d="M9.5 20v-6h5v6" /></I>
)
export const IcHoaDon = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><path d="M5 3h14v18l-2.5-1.5L14 21l-2-1.5L10 21l-2.5-1.5L5 21Z" /><path d="M9 8h6M9 12h6" /></I>
)
export const IcYeuCau = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><path d="M14.5 3.5a4.5 4.5 0 0 0-5.9 5.9L3.6 14.4a2 2 0 1 0 2.8 2.8l5-5a4.5 4.5 0 0 0 5.9-5.9l-2.6 2.6-2.1-2.1Z" /><path d="m15 15 5.5 5.5" /></I>
)
export const IcToaNha = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16" /><path d="M14 9h4a2 2 0 0 1 2 2v10" /><path d="M2 21h20" /><path d="M8 7h2M8 11h2M8 15h2M17 13h1M17 17h1" /></I>
)
export const IcTien = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v10M9.5 9.5h4a1.8 1.8 0 0 1 0 3.6h-4M9 12.5h6" /></I>
)
/** Hai mũi tên đối nhau: so hai sổ với nhau, đó là việc đối soát làm. */
export const IcDoiSoat = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}>
    <path d="M4 8h13m-3-3 3 3-3 3" /><path d="M20 16H7m3-3-3 3 3 3" />
  </I>
)
export const IcCheck = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><path d="M20 6 9 17l-5-5" /></I>
)
export const IcQR = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20h1" />
  </I>
)
export const IcNguoi = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><circle cx="12" cy="8" r="3.5" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></I>
)
export const IcChuong = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" /><path d="M10.5 19a2 2 0 0 0 3 0" /></I>
)
export const IcNhap = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><path d="M12 3v11" /><path d="m8 10 4 4 4-4" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></I>
)
export const IcCanh = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><path d="M12 3.5 2.5 20h19L12 3.5Z" /><path d="M12 10v4.5M12 17.5v.01" /></I>
)
export const IcXong = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.5 2.5 4.5-5" /></I>
)
export const IcDienThoai = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><path d="M6.5 3h3l1.5 4-2 1.5a12 12 0 0 0 5.5 5.5l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.2 2 2 0 0 1 6.5 3Z" /></I>
)
export const IcTrai = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><path d="M14.5 5 8 12l6.5 7" /></I>
)
export const IcPhai = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><path d="M9.5 5 16 12l-6.5 7" /></I>
)
export const IcThem = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><path d="M12 5v14M5 12h14" /></I>
)
export const IcDongHo = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5.2l3.2 2" /></I>
)
export const IcBieuDo = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></I>
)
export const IcMenu = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><path d="M4 7h16M4 12h16M4 17h16" /></I>
)
export const IcLoa = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><path d="M4 9v6h3.5L14 20V4L7.5 9H4Z" /><path d="M17.5 9.5a4 4 0 0 1 0 5" /><path d="M20 7a8 8 0 0 1 0 10" /></I>
)
export const IcSach = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v14H6.5A2.5 2.5 0 0 0 4 19.5Z" /><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H19v4H6.5A2.5 2.5 0 0 1 4 19.5Z" /><path d="M8 7h7M8 10.5h7" /></I>
)
export const IcTim = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></I>
)
export const IcGui = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><path d="M21 3 10.5 13.5" /><path d="M21 3 14.5 21l-4-7.5L3 9.5 21 3Z" /></I>
)
export const IcSang = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></I>
)
export const IcToi = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" /></I>
)

/** Lưới ô: từng căn một. Khác IcToaNha ở chỗ đó vẽ cả tòa, đây vẽ các căn bên trong. */
export const IcCanHo = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
  </I>
)

/** Mũi tên xuống khay: tải file về. IcNhap là mũi tên vào hệ thống, đây là chiều ngược lại. */
export const IcTaiVe = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><path d="M12 3v11m0 0 4-4m-4 4-4-4" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></I>
)

/** Danh sách có dấu tích: sổ ghi việc đã xảy ra, không phải việc sắp làm. */
export const IcSo = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}>
    <path d="M4 5h16v14H4z" /><path d="M8 3v4M8 12h8M8 16h5" />
    <path d="m6.5 8.5 1 1 2-2" />
  </I>
)

/** Lịch có một ngày được khoanh: việc lặp theo chu kỳ, có hạn cụ thể. */
export const IcLich = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" />
    <circle cx="12" cy="15" r="2" />
  </I>
)
export const IcRa = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 17l-5-5 5-5" /><path d="M5 12h11" /></I>
)
export const IcThe = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="M6.5 16c.6-1.3 1.5-2 2.5-2s1.9.7 2.5 2" /><path d="M15 10h4M15 13.5h4" /></I>
)
export const IcXe = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><path d="M5 16.5V19a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1v-2.5" /><path d="M21.5 16.5V19a1 1 0 0 1-1 1H20a1 1 0 0 1-1-1v-2.5" /><path d="M3 16.5h18v-4l-1.6-4.2A2 2 0 0 0 17.5 7h-11a2 2 0 0 0-1.9 1.3L3 12.5z" /><circle cx="6.75" cy="14.25" r=".9" /><circle cx="17.25" cy="14.25" r=".9" /></I>
)
