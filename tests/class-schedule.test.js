import test from 'node:test';
import assert from 'node:assert/strict';
import { classScheduleForDate } from '../server/class-schedule.js';

test('class schedule includes ordinary weekdays and excludes weekends', () => {
  assert.deepEqual(classScheduleForDate('2026-09-28'), { hasClass: true, holidayName: '' });
  assert.equal(classScheduleForDate('2026-09-27').hasClass, false);
});

test('class schedule excludes Korean public and substitute holidays', () => {
  assert.deepEqual(classScheduleForDate('2026-10-09'), { hasClass: false, holidayName: '한글날' });
  const substitute = classScheduleForDate('2026-10-05');
  assert.equal(substitute.hasClass, false);
  assert.match(substitute.holidayName, /대체공휴일/);
});
