type ClerkErrorDetail = {
    code?: string;
    message?: string;
};

type ClerkError = {
    errors?: ClerkErrorDetail[];
};

const clerkCodeMessages: Record<string, string> = {
    form_password_pwned:
        'Пароль найден в утечке данных. Для безопасности используйте другой пароль.',
    form_password_length_too_short: 'Пароль слишком короткий.',
    form_password_too_common: 'Пароль слишком простой. Используйте более сложный.',
    form_password_invalid: 'Пароль не соответствует требованиям безопасности.',
    form_password_complexity: 'Пароль не соответствует требованиям безопасности.',
    form_identifier_exists: 'Почта уже используется.',
    form_identifier_not_found: 'Пользователь с такой почтой не найден.',
    form_password_incorrect: 'Неверный пароль.',
    form_email_address_invalid: 'Некорректный адрес почты.',
    form_code_incorrect: 'Неверный код подтверждения.',
    form_code_expired: 'Срок действия кода истек. Запросите новый код.',
    form_rate_limited: 'Слишком много попыток. Подождите и попробуйте снова.',
    form_param_format_invalid: 'Неверный формат данных.',
};

const clerkMessagePatterns: Array<{
    pattern: RegExp;
    message: string | ((match: RegExpExecArray) => string);
}> = [
    {
        pattern: /password has been found in an online data breach/i,
        message:
            'Пароль найден в утечке данных. Для безопасности используйте другой пароль.',
    },
    {
        pattern: /password must be at least (\d+)/i,
        message: (match) => `Пароль должен содержать минимум ${match[1]} символов.`,
    },
    {
        pattern: /password is too short/i,
        message: 'Пароль слишком короткий.',
    },
    {
        pattern: /password is too common/i,
        message: 'Пароль слишком простой. Используйте более сложный.',
    },
    {
        pattern: /password.*(weak|simple)/i,
        message: 'Пароль слишком простой. Используйте более сложный.',
    },
    {
        pattern: /email address.*(invalid|incorrect)/i,
        message: 'Некорректный адрес почты.',
    },
    {
        pattern: /(identifier|email).*(already|exists|taken)/i,
        message: 'Почта уже используется.',
    },
    {
        pattern: /(account|user|identifier).*(not found|doesn’t exist|doesn't exist)/i,
        message: 'Пользователь с такой почтой не найден.',
    },
    {
        pattern: /(incorrect|invalid) password/i,
        message: 'Неверный пароль.',
    },
    {
        pattern: /(invalid|incorrect) verification code/i,
        message: 'Неверный код подтверждения.',
    },
    {
        pattern: /(verification code|code).*(expired)/i,
        message: 'Срок действия кода истек. Запросите новый код.',
    },
    {
        pattern: /(too many requests|rate limit|too many attempts)/i,
        message: 'Слишком много попыток. Подождите и попробуйте снова.',
    },
];

const resolveClerkMessage = (detail: ClerkErrorDetail): string | null => {
    if (detail.code && clerkCodeMessages[detail.code]) {
        return clerkCodeMessages[detail.code];
    }

    if (!detail.message) {
        return null;
    }

    for (const entry of clerkMessagePatterns) {
        const match = entry.pattern.exec(detail.message);
        if (match) {
            return typeof entry.message === 'string' ? entry.message : entry.message(match);
        }
    }

    return null;
};

export const getClerkErrorMessage = (error: unknown, fallback: string): string => {
    if (typeof error === 'object' && error && 'errors' in error) {
        const clerkErrors = (error as ClerkError).errors;
        if (clerkErrors?.length) {
            return resolveClerkMessage(clerkErrors[0]) ?? fallback;
        }
    }

    return fallback;
};
