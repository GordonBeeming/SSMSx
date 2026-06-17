import React from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "dashed" | "danger";
export type ButtonSize = "xs" | "sm" | "md";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style. @default "primary" */
  variant?: ButtonVariant;
  /** Control size. @default "sm" */
  size?: ButtonSize;
  /** Optional icon rendered before the label. */
  leadingIcon?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * SSMSX action button — accent primary, bordered secondary, ghost toolbar,
 * dashed add-new, and danger destructive variants.
 *
 * @startingPoint section="Controls" subtitle="Accent / ghost / danger buttons" viewport="700x200"
 */
export function Button(props: ButtonProps): React.ReactElement;
