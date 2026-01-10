import { UI_RADIUS } from '@/config/uiTokens';

export const authAppearance = {
    variables: {
        colorPrimary: '#2563eb',
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
        card: 'mx-auto w-full max-w-md rounded-t-3xl rounded-b-none border border-white/40 bg-gradient-to-br from-blue-50/55 via-indigo-50/40 to-violet-100/30 px-8 py-8 shadow-2xl backdrop-blur-2xl',
        cardBox: 'bg-transparent',
        cardInner: 'bg-transparent',
        header: 'bg-transparent',
        headerTitle: 'text-2xl font-semibold text-slate-900',
        headerSubtitle: 'text-sm text-slate-500',
        main: 'bg-transparent',
        form: 'bg-transparent',
        formFieldLabel: 'text-sm font-medium text-slate-700',
        formFieldInput:
            'w-full rounded-xl border border-white/50 bg-white/50 text-slate-900 shadow-sm backdrop-blur-md focus:border-blue-500 focus:ring-blue-500',
        formButtonPrimary:
            'w-full rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:from-blue-700 hover:via-indigo-700 hover:to-violet-700',
        socialButtonsBlockButton:
            'w-full rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50',
        dividerText: 'text-xs uppercase tracking-[0.2em] text-slate-400',
        footer: 'rounded-b-3xl bg-gradient-to-br from-blue-50/55 via-indigo-50/40 to-violet-100/30 backdrop-blur-2xl',
        footerActionText: 'text-sm text-slate-600',
        footerActionLink: 'text-blue-600 hover:text-blue-700',
        formFieldErrorText: 'text-xs text-rose-600',
        alertText: 'text-xs text-rose-600',
    },
} as const;
