// Wolf Botha - 01/04/2025

import React from "react";
import "@/styles/buttons.css";

// PrimaryBtn Properties
interface PrimaryBtnProps {
  onClick?: () => void;
  children?: React.ReactNode;
  className?: string;
  style?: "default" | "black" | "red";
  type?: "button" | "submit";
  primary?: boolean;
  secondary?: boolean;
  icon: React.ReactElement<{ fontSize?: "small" | "medium" | "large" }>;
  disabled?: boolean;
  "aria-label"?: string;
}

// Add props using destructuring
const KoraCircleBtn = ({
  onClick,
  className,
  style,
  type,
  primary,
  secondary = false,
  icon,
  disabled = false,
  "aria-label": ariaLabel,
}: PrimaryBtnProps) => {
  // Default styles
  let btnStyles = "";
  let variantClass = "kora-btn--primary";

  if (secondary) {
    // Secondary variant
    variantClass = "kora-btn--secondary";
    switch (style) {
      case "default":
        btnStyles =
          "bg-transparent text-corigreen-500 border-2 border-corigreen-500 hover:border-corigreen-600 hover:text-corigreen-600";
        break;
      case "black":
        btnStyles =
          "bg-transparent text-zinc-500 border-2 border-zinc-500 hover:border-zinc-900 hover:text-zinc-900";
        break;
      case "red":
        btnStyles =
          "bg-transparent text-red-500 border-2 border-red-500 hover:border-red-700 hover:text-red-700";
        break;
      default:
        btnStyles =
          "bg-transparent text-corigreen-500 border-2 border-corigreen-500 hover:border-corigreen-600 hover:text-corigreen-600";
        break;
    }
  } else {
    // If not secondary, default to primary variant
    variantClass = "kora-btn--primary";
    switch (style) {
      case "default":
        btnStyles =
          "bg-corigreen-500 text-white border-2 border-corigreen-500 hover:bg-corigreen-600 hover:border-corigreen-600";
        break;
      case "black":
        btnStyles =
          "bg-zinc-500 text-zinc-50 border-2 border-zinc-500 hover:bg-zinc-900 hover:text-zinc-50 hover:border-zinc-900";
        break;
      case "red":
        btnStyles =
          "bg-red-500 text-white border-2 border-red-500 hover:bg-red-700 hover:border-red-700";
        break;
      default:
        btnStyles =
          "bg-corigreen-500 text-white border-2 border-corigreen-500 hover:bg-corigreen-600 hover:border-corigreen-600";
        break;
    }
  }

  return (
    <button
      onClick={onClick}
      type={type}
      className={`${btnStyles} flex items-center justify-center h-8 w-8 rounded-full kora-btn ${variantClass} ${className}`}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      {React.isValidElement(icon) && React.cloneElement(icon, { fontSize: "small" })}
    </button>
  );
};

export default KoraCircleBtn;
