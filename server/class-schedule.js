import Holidays from 'date-holidays';

const koreanHolidays = new Holidays('KR');
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export function classScheduleForDate(date) {
  if (!datePattern.test(String(date || ''))) return { hasClass: false, holidayName: '' };
  const target = new Date(`${date}T12:00:00+09:00`);
  if (Number.isNaN(target.valueOf())) return { hasClass: false, holidayName: '' };
  const day = target.getDay();
  const holidays = koreanHolidays.isHoliday(target);
  const publicHoliday = Array.isArray(holidays) ? holidays.find((holiday) => holiday.type === 'public') : null;
  return {
    hasClass: day >= 1 && day <= 5 && !publicHoliday,
    holidayName: publicHoliday?.name || '',
  };
}
