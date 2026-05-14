export const normalizeSearchTerm = (value = "") => String(value || "").trim();

export const escapeRegex = (value = "") => {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

export const safeContainsRegex = (value, options = "i") => {
  return {
    $regex: escapeRegex(normalizeSearchTerm(value)),
    $options: options,
  };
};

export const safeWhitespaceRegex = (value) => {
  return escapeRegex(normalizeSearchTerm(value)).replace(/\s+/g, "\\s+");
};
