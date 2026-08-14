// Wolf Botha - 27/03/2025

import React from "react";
import "../../styles/buttons.css";
import { Button } from "react-bootstrap";

// Btn Properties
interface BtnProps {
  onClick?: (e?: any) => void;
  children?: React.ReactNode;
  className?: string;
  primary?: boolean;
  secondary?: boolean;
  style?: "default" | "black" | "red";
  type?: "button" | "submit";
  iconOnly?: boolean;
  disabled?: boolean;
}

// Add props using destructuring
const CoriBtn = ({
  onClick,
  children,
  className,
  primary,
  secondary,
  style,
  type,
  iconOnly,
  disabled,
}: BtnProps) => {
  // Default styles
  let btnStyles = "";
  let btnVariant = "primary";

  if (secondary) {
    btnVariant = "outline-primary";
    switch (style) {
      case "default":
        btnStyles =
          "border-2 border-corigreen-500 text-corigreen-500 hover:bg-corigreen-500 hover:text-white hover:border-corigreen-500 ";
        break;
      case "black":
        btnStyles =
          "border-2 border-zinc-800 text-zinc-800 hover:bg-zinc-800 hover:text-white hover:border-zinc-800";
        break;
      case "red":
        btnStyles =
          "border-2 border-red-700 text-red-700 hover:bg-red-700 hover:text-white hover:border-red-700";
        break;
      default:
        btnStyles =
          "border-2 border-corigreen-500 text-corigreen-500 hover:bg-corigreen-500 hover:text-white hover:border-corigreen-500";
        break;
    }
  } else {
    // Default to primary
    btnVariant = "primary";
    switch (style) {
      case "default":
        btnStyles =
          "bg-corigreen-500 text-white border-2 border-corigreen-500 hover:bg-corigreen-600 hover:border-corigreen-600";
        break;
      case "black":
        btnStyles =
          "bg-zinc-800 text-zinc-50 border-2 border-zinc-800 hover:bg-zinc-900 hover:text-zinc-50 hover:border-zinc-900";
        break;
      case "red":
        btnStyles =
          "bg-red-700 text-white border-2 border-red-700 hover:bg-red-800 hover:border-red-800";
        break;
      default:
        btnStyles =
          "bg-corigreen-500 text-white border-2 border-corigreen-500 hover:bg-corigreen-600 hover:border-corigreen-600";
        break;
    }
  }

  return (
    <Button
      variant={btnVariant}
      onClick={onClick}
      type={type}
      disabled={disabled}
      className={`${btnStyles} text-[14px] font-semibold flex items-center justify-center h-10 px-3 gap-2 rounded-xl cori-btn ${className}
      ${iconOnly ? "w-10" : ""}`}
    >
      {children}
    </Button>
  );
};

export default CoriBtn;
