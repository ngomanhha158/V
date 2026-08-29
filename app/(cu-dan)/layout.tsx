// Màn cư dân: đọc trên điện thoại, giữ khung hẹp cho dễ đọc.
// Nhóm route (cu-dan) không đổi URL — /tickets vẫn là /tickets.
export default function CuDanLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-lg">{children}</div>
}
