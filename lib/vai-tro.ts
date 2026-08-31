/**
 * Tên tiếng Việt của các vai trò nhân sự.
 *
 * Để riêng một file không phụ thuộc gì: màn thật và màn demo cùng dùng, mà
 * màn demo thì KHÔNG được kéo theo server action nào — import từ form.tsx là
 * lôi cả actions.ts vào bản demo.
 */
export const TEN_VAI_TRO: Record<string, string> = {
  bql_manager: 'Trưởng ban quản lý',
  bql_staff: 'Nhân viên BQL',
  technician: 'Kỹ thuật',
  security: 'Bảo vệ',
  bqt: 'Ban quản trị',
}

export const tenVaiTro = (v: string) => TEN_VAI_TRO[v] ?? v
