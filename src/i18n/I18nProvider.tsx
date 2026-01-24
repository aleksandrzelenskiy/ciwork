'use client';

import React, { createContext, useCallback, useContext, useMemo, useState, useEffect } from 'react';
import type { Locale, MessageValues, Translator } from '@/i18n';
import { DEFAULT_LOCALE, resolveLocale, formatMessage } from '@/i18n';
import ruMessages from '@/i18n/messages/ru';
import enMessages from '@/i18n/messages/en';

const STORAGE_KEY = 'ciwork.locale';

const MESSAGES: Record<Locale, Record<string, string>> = {
    ru: ruMessages,
    en: enMessages,
};

type I18nContextValue = {
    locale: Locale;
    setLocale: (locale: Locale) => void;
    t: Translator;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children, initialLocale }: { children: React.ReactNode; initialLocale?: Locale }) {
    const [locale, setLocaleState] = useState<Locale>(initialLocale ?? DEFAULT_LOCALE);

    useEffect(() => {
        const stored = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
        const resolved = resolveLocale(stored);
        if (stored && resolved !== locale) {
            setLocaleState(resolved);
        }
    }, [locale]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(STORAGE_KEY, locale);
    }, [locale]);

    const setLocale = useCallback((next: Locale) => {
        setLocaleState(next);
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(STORAGE_KEY, next);
        }
    }, []);

    const t = useMemo<Translator>(() => {
        return (key: string, fallback?: string, values?: MessageValues) => {
            const dictionary = MESSAGES[locale] ?? {};
            const message = dictionary[key] ?? fallback ?? key;
            return formatMessage(message, values);
        };
    }, [locale]);

    const value = useMemo<I18nContextValue>(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

    return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
    const context = useContext(I18nContext);
    if (!context) {
        throw new Error('useI18n must be used within I18nProvider');
    }
    return context;
}
