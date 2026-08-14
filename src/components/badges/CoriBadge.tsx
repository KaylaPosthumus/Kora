import React from "react";

interface BadgeProps {
  color?: "green" | "black" | "yellow" | "red" | "blue" | "white" | "orange" | "gray";
  size?: "x-small" | "small" | "medium" | "large";
  text: string;
  className?: string;
}

function CoriBadge({ color, size, text, className }: BadgeProps) {
  let textSize: string;
  let pSize: string;
  let bgColor = "bg-corigreen-500";

  // Determine the color of the badge
  switch (color) {
    case "green":
      bgColor = "bg-corigreen-500";
      break;
    case "black":
      bgColor = "bg-zinc-900";
      break;
    case "yellow":
      bgColor = "bg-yellow-300";
      break;
    case "red":
      bgColor = "bg-red-400";
      break;
    case "blue":
      bgColor = "bg-cyan-600";
      break;
    case "white":
      bgColor = "bg-warmstone-50";
      break;
    case "orange":
      bgColor = "bg-amber-600";
      break;
    case "gray":
      bgColor = "bg-zinc-500";
      break;
    default:
      bgColor = "bg-corigreen-500";
      break;
  }

  // Set the size of the badge
  switch (size) {
    case "x-small":
      textSize = "text-sm";
      pSize = "py-1 px-2";
      break;
    case "small":
      textSize = "text-sm";
      pSize = "py-1 px-3";
      break;
    case "medium":
      textSize = "text-base";
      pSize = "py-2 px-3";
      break;
    case "large":
      textSize = "text-lg";
      pSize = "py-2 px-3";
      break;
    default:
      textSize = "text-base";
      pSize = "py-2 px-3";
      break;
  }

  return (
    <div
      className={`${bgColor} ${pSize} ${className} flex items-center justify-center ${
        size === "medium" || size === "large" ? "rounded-xl" : "rounded-lg"
      }`}
    >
      <span
        className={`${textSize} ${
          color === "yellow" || color === "white" ? "text-zinc-900" : "text-warmstone-50"
        }`}
      >
        {text}
      </span>
    </div>
  );
  
}

export default CoriBadge;
