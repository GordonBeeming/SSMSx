import React from "react";

export type BadgeTone = "neutral" | "accent" | "success" | "error" | "warning";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Color tone. @default "neutral" */
  tone?: BadgeTone;
  children?: React.ReactNode;
}

/** Compact metadata chip — auth-type labels and status tags. */
export function Badge(props: BadgeProps): React.ReactElement;
