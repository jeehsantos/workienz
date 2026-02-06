export function formatJobShareTitle(
  title: string,
  locationSuburb?: string | null,
  locationCity?: string | null
): string {
  const suburb = locationSuburb?.trim();
  const city = locationCity?.trim();

  if (suburb && city) {
    return `${title} in ${suburb}, ${city} - Workie`;
  }

  if (city) {
    return `${title} in ${city} - Workie`;
  }

  return `${title} - Workie`;
}
