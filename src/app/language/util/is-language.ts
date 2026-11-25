import { languages, type LanguageCode } from '../../../generated/site';

export function isLanguage(value: string | null | undefined): value is LanguageCode {
  return languages.includes(value as LanguageCode);
}
