/** Lowercases text and removes diacritics, so "Configuratie" matches "configuratie". */
export function normalize(text: string): string {
  return text.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
}
