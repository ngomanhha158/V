import { accessSync, constants, statSync } from 'node:fs'
import { thuMuc } from './anh.ts'
import { soatKho, type KetQuaKho, type SuThatKho } from './kho-anh.ts'

/**
 * Đọc sự thật từ đĩa rồi đưa cho soatKho() phán xét.
 *
 * Tách khỏi lib/kho-anh.ts vì phần này KHÔNG test được bằng node:test — nó phụ
 * thuộc vào filesystem đang chạy. Phần phán xét thì test được, và đó là phần
 * chứa mọi quyết định. Gộp hai thứ là mất luôn khả năng test phần quan trọng.
 */
export function docKhoAnh(): KetQuaKho {
  const duong = thuMuc()
  const laProduction = process.env.NODE_ENV === 'production'
  const s: SuThatKho = {
    duong, laProduction, coThuMuc: false, ghiDuoc: false, devKho: null, devGoc: null,
  }

  try {
    const st = statSync(duong)
    s.coThuMuc = st.isDirectory()
    s.devKho = st.dev
  } catch {
    return soatKho(s)
  }

  try {
    accessSync(duong, constants.W_OK)
    s.ghiDuoc = true
  } catch {
    s.ghiDuoc = false
  }

  try {
    s.devGoc = statSync('/').dev
  } catch {
    s.devGoc = null
  }

  return soatKho(s)
}
