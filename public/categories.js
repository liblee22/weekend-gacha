// 前端（瀏覽器）和資料建置腳本（Node）共用
// 代碼：觀光資料標準 V2.1 AttractionClassEnum
export const CATEGORY_GROUPS = Object.freeze({
  all: null,
  nature: Object.freeze([2, 7, 8, 10, 11, 15, 16, 17, 18, 19]),
  // 不含 12 遊憩：幾乎所有景點都掛這個標籤（臺北 412/431），放進來等於沒篩
  play: Object.freeze([9, 13, 14, 20]),
  // 不含 1 文化：太籠統（臺北 307/431）
  culture: Object.freeze([3, 4, 5, 21, 22]),
})

export function matchesCategory(spot, category) {
  const group = CATEGORY_GROUPS[category]
  if (group === undefined) throw new Error(`未知的分類：${category}`)
  return group === null || spot.classCodes.some((c) => group.includes(c))
}
