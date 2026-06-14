export function isPrelaunchLockEnabled() {
  return process.env.YORIAX_PRELAUNCH_LOCK !== 'false';
}

export function getPrelaunchBonusUntil() {
  const now = new Date();
  now.setMonth(now.getMonth() + 3);
  return now;
}
