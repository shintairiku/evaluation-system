export function normalizeTemplateName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

export function buildUniqueTemplateName(
  baseName: string,
  existingNames: string[],
): string {
  const trimmedBaseName = baseName.trim() || "新しいテンプレート";
  const normalizedExistingNames = new Set(
    existingNames.map((name) => normalizeTemplateName(name)),
  );

  if (!normalizedExistingNames.has(normalizeTemplateName(trimmedBaseName))) {
    return trimmedBaseName;
  }

  let suffix = 2;
  while (
    normalizedExistingNames.has(
      normalizeTemplateName(`${trimmedBaseName} ${suffix}`),
    )
  ) {
    suffix += 1;
  }

  return `${trimmedBaseName} ${suffix}`;
}
