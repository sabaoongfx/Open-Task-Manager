import type { ReactNode } from "react";

type IconProps = { size?: number };

const base = (children: ReactNode, size = 16) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);

export const IconMenu = ({ size }: IconProps) =>
  base(
    <>
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </>,
    size
  );

export const IconProcesses = ({ size }: IconProps) =>
  base(
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>,
    size
  );

export const IconPerformance = ({ size }: IconProps) =>
  base(<polyline points="3 17 9 9 13 13 21 5" />, size);

export const IconHistory = ({ size }: IconProps) =>
  base(
    <>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 16 14" />
    </>,
    size
  );

export const IconStartup = ({ size }: IconProps) =>
  base(
    <>
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </>,
    size
  );

export const IconUsers = ({ size }: IconProps) =>
  base(
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17.5" cy="9" r="2.5" />
      <path d="M15.5 14.2c2.7.3 4.8 2.6 4.8 5.4" />
    </>,
    size
  );

export const IconDetails = ({ size }: IconProps) =>
  base(
    <>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="4" cy="6" r="0.8" fill="currentColor" />
      <circle cx="4" cy="12" r="0.8" fill="currentColor" />
      <circle cx="4" cy="18" r="0.8" fill="currentColor" />
    </>,
    size
  );

export const IconServices = ({ size }: IconProps) =>
  base(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13.5a7.4 7.4 0 0 0 0-3l2-1.5-2-3.4-2.3.9a7.4 7.4 0 0 0-2.6-1.5L14 2.4h-4l-.5 2.6a7.4 7.4 0 0 0-2.6 1.5l-2.3-.9-2 3.4 2 1.5a7.4 7.4 0 0 0 0 3l-2 1.5 2 3.4 2.3-.9c.76.66 1.64 1.17 2.6 1.5l.5 2.6h4l.5-2.6a7.4 7.4 0 0 0 2.6-1.5l2.3.9 2-3.4Z" />
    </>,
    size
  );

export const IconSettings = ({ size }: IconProps) => IconServices({ size });

export const IconChevron = ({ size }: IconProps) =>
  base(<polyline points="9 6 15 12 9 18" />, size);

export const IconChevronDown = ({ size }: IconProps) =>
  base(<polyline points="6 9 12 15 18 9" />, size);

export const IconSearch = ({ size }: IconProps) =>
  base(
    <>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </>,
    size
  );

export const IconPlay = ({ size }: IconProps) =>
  base(<polygon points="6 4 20 12 6 20 6 4" fill="currentColor" stroke="none" />, size);

export const IconBolt = ({ size }: IconProps) =>
  base(<polygon points="13 2 3 14 11 14 9 22 21 10 13 10 13 2" />, size);

export const IconRunNewTask = ({ size }: IconProps) =>
  base(
    <>
      <rect x="2" y="2" width="8" height="8" rx="1" />
      <rect x="11" y="2" width="8" height="8" rx="1" />
      <rect x="2" y="11" width="8" height="8" rx="1" />
      <circle cx="15.5" cy="15.5" r="6.5" fill="currentColor" stroke="none" />
      <line x1="15.5" y1="12.5" x2="15.5" y2="18.5" style={{ stroke: "var(--bg-elevated)" }} strokeWidth="1.6" />
      <line x1="12.5" y1="15.5" x2="18.5" y2="15.5" style={{ stroke: "var(--bg-elevated)" }} strokeWidth="1.6" />
    </>,
    size
  );

export const IconProhibit = ({ size }: IconProps) =>
  base(
    <>
      <circle cx="12" cy="12" r="9" />
      <line x1="6" y1="18" x2="18" y2="6" />
    </>,
    size
  );

export const IconLeafPair = ({ size }: IconProps) =>
  base(
    <>
      <path d="M11.5 4c-3 .5-6 3-6 7.5 0 3 1.5 5.5 3.5 7 .5-4 1-8.5 2.5-14.5Z" />
      <path d="M12.5 20c3-.5 6-3 6-7.5 0-3-1.5-5.5-3.5-7-.5 4-1 8.5-2.5 14.5Z" />
    </>,
    size
  );
