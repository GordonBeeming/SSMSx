import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Field size. @default "sm" */
  size?: "sm" | "md";
}

/** SSMSX text field — white surface, accent focus border. Used for search and connection forms. */
export function Input(props: InputProps): React.ReactElement;
