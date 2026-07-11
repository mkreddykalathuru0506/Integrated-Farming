/**
 * Light user-agent description for the sessions list — browser + OS brand words
 * only, no parsing dependency. Unknowns stay null (the UI shows a generic label).
 */
export type DeviceInfo = { browser: string | null; os: string | null };

export function describeDevice(userAgent: string | null | undefined): DeviceInfo {
  if (!userAgent) return { browser: null, os: null };
  const ua = userAgent;

  // Order matters: Edge/Opera embed "Chrome", Chrome embeds "Safari".
  const browser = /edg(?:e|a|ios)?\//i.test(ua)
    ? 'Edge'
    : /opr\/|opera/i.test(ua)
      ? 'Opera'
      : /firefox\/|fxios/i.test(ua)
        ? 'Firefox'
        : /chrome\/|crios/i.test(ua)
          ? 'Chrome'
          : /safari\//i.test(ua)
            ? 'Safari'
            : null;

  // iPhone/iPad before macOS: iOS UAs contain "like Mac OS X".
  const os = /windows/i.test(ua)
    ? 'Windows'
    : /android/i.test(ua)
      ? 'Android'
      : /iphone|ipad|ipod/i.test(ua)
        ? 'iOS'
        : /mac os|macintosh/i.test(ua)
          ? 'macOS'
          : /linux/i.test(ua)
            ? 'Linux'
            : null;

  return { browser, os };
}

/** "Chrome · Windows" | "Chrome" | "Windows" | '' (caller substitutes the i18n fallback). */
export function deviceLabel(userAgent: string | null | undefined): string {
  const { browser, os } = describeDevice(userAgent);
  return [browser, os].filter(Boolean).join(' · ');
}
