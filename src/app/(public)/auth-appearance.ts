import { UI_RADIUS } from '@/config/uiTokens';

export const authAppearance = {
    variables: {
        colorPrimary: '#0f4c3a',
        colorText: '#111827',
        colorBackground: '#ffffff',
        colorInputBackground: '#f8fafc',
        colorInputText: '#111827',
        colorTextOnPrimaryBackground: '#ffffff',
        fontFamily: 'inherit',
        borderRadius: `${UI_RADIUS.overlay}px`,
    },
    elements: {
        rootBox: 'w-full flex justify-center',
        card: 'mx-auto w-full max-w-md rounded-t-3xl rounded-b-none border border-white/30 bg-gradient-to-br from-white/75 via-white/65 to-white/55 px-8 py-8 shadow-2xl backdrop-blur-xl',
        headerTitle: 'text-2xl font-semibold text-slate-900',
        headerSubtitle: 'text-sm text-slate-500',
        formFieldLabel: 'text-sm font-medium text-slate-700',
        formFieldInput:
            'w-full rounded-xl border border-slate-200 bg-white/80 text-slate-900 shadow-sm focus:border-emerald-600 focus:ring-emerald-600',
        formButtonPrimary:
            'w-full rounded-xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:from-emerald-800 hover:via-emerald-700 hover:to-teal-700',
        socialButtonsBlockButton:
            'w-full rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50',
        dividerText: 'text-xs uppercase tracking-[0.2em] text-slate-400',
        footer: 'rounded-b-3xl bg-gradient-to-br from-white/70 via-white/55 to-white/45 backdrop-blur-xl',
        footerActionText: 'text-sm text-slate-600',
        footerActionLink: 'text-emerald-700 hover:text-emerald-800',
        formFieldErrorText: 'text-xs text-rose-600',
        alertText: 'text-xs text-rose-600',
    },
} as const;
