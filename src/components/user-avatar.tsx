"use client";

import { useState } from "react";

type UserAvatarProps = {
  name: string;
  avatarUrl?: string | null;
  className?: string;
};

export function UserAvatar({ name, avatarUrl, className = "" }: UserAvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const classes = `user-avatar ${className}`.trim();
  if (avatarUrl && avatarUrl !== failedUrl) {
    // OAuth image hosts are runtime data. This static export has no Next image
    // optimization server, so the provider URL must be rendered directly.
    // eslint-disable-next-line @next/next/no-img-element
    return <img
      src={avatarUrl}
      alt={`${name}'s profile picture`}
      className={classes}
      referrerPolicy="no-referrer"
      onError={() => setFailedUrl(avatarUrl)}
    />;
  }

  return <span className={`${classes} user-avatar-fallback`} aria-label={`${name}'s profile picture`}>
    {name.trim().slice(0, 1).toUpperCase() || "?"}
  </span>;
}
