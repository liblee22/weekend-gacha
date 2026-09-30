export const CITIES = Object.freeze([
  ['Taipei', '臺北市'],
  ['NewTaipei', '新北市'],
  ['Keelung', '基隆市'],
  ['Taoyuan', '桃園市'],
  ['Hsinchu', '新竹市'],
  ['HsinchuCounty', '新竹縣'],
  ['MiaoliCounty', '苗栗縣'],
  ['Taichung', '臺中市'],
  ['ChanghuaCounty', '彰化縣'],
  ['NantouCounty', '南投縣'],
  ['YunlinCounty', '雲林縣'],
  ['Chiayi', '嘉義市'],
  ['ChiayiCounty', '嘉義縣'],
  ['Tainan', '臺南市'],
  ['Kaohsiung', '高雄市'],
  ['PingtungCounty', '屏東縣'],
  ['YilanCounty', '宜蘭縣'],
  ['HualienCounty', '花蓮縣'],
  ['TaitungCounty', '臺東縣'],
  ['PenghuCounty', '澎湖縣'],
  ['KinmenCounty', '金門縣'],
  ['LienchiangCounty', '連江縣'],
].map(([code, name]) => Object.freeze({ code, name })))

const NAMES = new Map(CITIES.map((c) => [c.code, c.name]))

export function isValidCity(code) {
  return typeof code === 'string' && NAMES.has(code)
}
