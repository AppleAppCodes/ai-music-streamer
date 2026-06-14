export function getAppVersionLabel() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA;
  const ref = process.env.VERCEL_GIT_COMMIT_REF || 'local';

  if (sha) {
    return `${ref}@${sha.slice(0, 7)}`;
  }

  return `local@${process.env.npm_package_version || 'dev'}`;
}
