export function numberedVariantHeadings(sections: { heading?: string }[]) {
  return sections.filter((section) => /^变式\s*\d+/.test((section.heading ?? "").trim()));
}
