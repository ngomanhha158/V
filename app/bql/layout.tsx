// Màn BQL: bảng công nợ, danh sách hóa đơn, điều phối — đều là việc làm trên
// máy tính. Bó vào khung điện thoại thì bảng phải kéo ngang mới đọc hết.
export default function BqlLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-6xl">{children}</div>
}
