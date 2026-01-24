export const LOCALES = ['ru', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'ru';

export const resolveLocale = (value?: string | null): Locale =>
    value === 'en' ? 'en' : 'ru';

export type MessageValues = Record<string, string | number | undefined | null>;

export type Translator = (key: string, fallback?: string, values?: MessageValues) => string;

export const formatMessage = (template: string, values?: MessageValues): string => {
    if (!values) return template;
    return template.replace(/\{(\w+)}/g, (_, token: string) => {
        const value = values[token];
        return value === null || typeof value === 'undefined' ? '' : String(value);
    });
};
