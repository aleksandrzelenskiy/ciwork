export const authAppearance = {
    variables: {
        colorPrimary: '#0f4c3a',
        colorText: '#111827',
        colorBackground: '#ffffff',
        colorInputBackground: '#f8fafc',
        colorInputText: '#111827',
        colorTextOnPrimaryBackground: '#ffffff',
        fontFamily: 'inherit',
        borderRadius: '16px',
    },
    elements: {
        rootBox: 'w-full',
        card: 'rounded-t-3xl rounded-b-none border border-white/30 bg-white/80 px-8 py-8 shadow-2xl backdrop-blur',
        headerTitle: 'text-2xl font-semibold text-slate-900',
        headerSubtitle: 'text-sm text-slate-500',
        formFieldLabel: 'text-sm font-medium text-slate-700',
        formFieldInput:
            'rounded-xl border border-slate-200 bg-white/80 text-slate-900 shadow-sm focus:border-emerald-600 focus:ring-emerald-600',
        formButtonPrimary:
            'rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-emerald-800',
        socialButtonsBlockButton:
            'rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50',
        dividerText: 'text-xs uppercase tracking-[0.2em] text-slate-400',
        footerActionText: 'text-sm text-slate-600',
        footerActionLink: 'text-emerald-700 hover:text-emerald-800',
        formFieldErrorText: 'text-xs text-rose-600',
        alertText: 'text-xs text-rose-600',
    },
} as const;
