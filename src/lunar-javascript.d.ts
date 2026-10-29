/** The subset of lunar-javascript 1.7.7 used here, checked against lunar.js. */
declare module "lunar-javascript" {
  interface LunarDate {
    getJieQi(): string;
    getFestivals(): string[];
    getDayInChinese(): string;
    getMonthInChinese(): string;
  }
  interface SolarDate {
    getLunar(): LunarDate;
    getFestivals(): string[];
  }
  export const Solar: { fromYmd(year: number, month: number, day: number): SolarDate };
}
