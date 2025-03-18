export default class Timer {
  isRunning = false;
  startTime = null;
  overallTime = 0;
  maxTime = 0;

  gameStartTime = null;
  gameEndTime = null;

  constructor(starting) {
    this.overallTime = starting;
    this.maxTime = starting;
  }

  // 마지막 startTime 이후 경과 시간 반환
  getElapsedTimeSinceLastStart() {
    if (!this.startTime) return 0;
    console.log(Date.now() - this.startTime);
    return Date.now() - this.startTime;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.startTime = Date.now();

    if (!this.gameStartTime) {
      this.gameStartTime = this.startTime;
    }
  }

  stop() {
    if (!this.isRunning) return;
    this.isRunning = false;
    this.overallTime -= this.getElapsedTimeSinceLastStart();
  }

  endGame() {
    this.gameEndTime = Date.now();
  }

  setTime(newTime) {
    this.overallTime = +newTime;
  }

  reset() {
    this.overallTime = this.maxTime;
    if (this.isRunning) {
      this.startTime = Date.now();
      return;
    }
    this.startTime = 0;
    this.gameStartTime = 0;
    this.gameEndTime = 0;
  }

  getTime() {
    // startTime이 null인 상태 => 처음 한 번도 start() 안 했거나 reset된 직후 정지 상태
    if (!this.startTime) return this.overallTime;

    // 타이머가 동작 중이라면 실시간으로 경과 시간만큼 차감
    if (this.isRunning) {
      return this.overallTime - this.getElapsedTimeSinceLastStart();
    }
    return this.overallTime;
  }

  getTotalGameTime() {
    if (!this.gameStartTime || !this.gameEndTime) return 0;
    return this.gameEndTime - this.gameStartTime;
  }
}

export function msToSec(ms) {
  return (ms / 1000).toFixed(2);
}

export function secToMs(sec) {
  return sec * 1000;
}
export function timeString(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds - hours * 3600) / 60);
  const secondsLeft = seconds - hours * 3600 - minutes * 60;

  let str = "";
  if (hours > 0) {
    str += `${hours}:`;
  }
  if (minutes < 10) {
    str += "0";
  }
  str += `${minutes}:`;
  if (secondsLeft < 10) {
    str += "0";
  }
  str += secondsLeft.toFixed(1);
  return str;
}
