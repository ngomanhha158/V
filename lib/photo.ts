// Nén ảnh TRƯỚC khi upload. Ảnh từ điện thoại thường 3-8MB; gửi thẳng thì cư
// dân ở khu có sóng yếu bấm gửi rồi ngồi đợi, hoặc bucket đầy sau một tháng.
// Chạy trong trình duyệt (canvas), không dùng được ở server.

const MAX_EDGE = 1600
const QUALITY = 0.8

export async function compressImage(file: File): Promise<Blob> {
  // Không phải ảnh (hoặc trình duyệt không giải mã được) -> trả nguyên bản,
  // để tầng trên còn báo lỗi tử tế thay vì ném ra từ đây.
  if (!file.type.startsWith('image/')) return file

  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) return file

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', QUALITY),
  )
  // Nén xong mà to hơn bản gốc (ảnh vốn đã nhỏ) thì giữ bản gốc.
  return blob && blob.size < file.size ? blob : file
}
