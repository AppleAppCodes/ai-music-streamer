export function isPrelaunchLockEnabled() {
  return process.env.YORIAX_PRELAUNCH_LOCK !== 'false';
}

export function isUserWhitelisted(email: string | undefined | null) {
  if (!email) return false;
  const whitelisted = [
    'onroya@gmail.com',
  ];
  return whitelisted.includes(email.toLowerCase());
}

export function getPrelaunchBonusUntil() {
  const now = new Date();
  now.setMonth(now.getMonth() + 3);
  return now;
}

