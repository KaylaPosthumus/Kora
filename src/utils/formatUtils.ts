// Utility functions for formatting data

// Format phone number
const formatPhone = (phoneNumber: string) => {
  // Remove any non-digit characters
  const cleaned = phoneNumber.replace(/\D/g, "");

  // Cut off any extra digits
  const trimmed = cleaned.slice(0, 10);

  // Format: +27 12 345 6789
  return `+27 ${trimmed.slice(1, 3)} ${trimmed.slice(3, 6)} ${trimmed.slice(6)}`;
};

// Format to Rand Amount (E.g. 12312345678900 -> R123,123,456,789.00)
const formatRandAmount = (amount: number) => {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
  }).format(amount);
};

// Format to short Rand Amount (E.g. 123456789 -> R123M)
const formatShortRandAmount = (amount: number) => {
  const absAmount = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";

  let formattedValue: string;

  if (absAmount >= 1_000_000_000_000) {
    // Trillions
    formattedValue = (absAmount / 1_000_000_000_000).toFixed(1) + "T";
  } else if (absAmount >= 1_000_000_000) {
    // Billions
    formattedValue = (absAmount / 1_000_000_000).toFixed(1) + "B";
  } else if (absAmount >= 1_000_000) {
    // Millions
    formattedValue = (absAmount / 1_000_000).toFixed(1) + "M";
  } else if (absAmount >= 1_000) {
    // Thousands
    formattedValue = (absAmount / 1_000).toFixed(1) + "K";
  } else {
    // Less than 1000, show as regular currency
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
    }).format(amount);
  }

  // Remove unnecessary .0 at the end
  if (
    formattedValue.endsWith(".0K") ||
    formattedValue.endsWith(".0M") ||
    formattedValue.endsWith(".0B") ||
    formattedValue.endsWith(".0T")
  ) {
    formattedValue = formattedValue.slice(0, -3) + formattedValue.slice(-1);
  }

  return `${sign}R${formattedValue}`;
};

export { formatPhone, formatRandAmount, formatShortRandAmount };
