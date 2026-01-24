'use client';

import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { useSignIn, useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    Button,
    FormControl,
    IconButton,
    InputAdornment,
    InputLabel,
    OutlinedInput,
    TextField,
    Typography,
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { getClerkErrorMessage } from '@/utils/clerkErrorMessages';
import { withBasePath } from '@/utils/basePath';
import { useI18n } from '@/i18n/I18nProvider';

export default function Page() {
    const { t } = useI18n();
    const { isLoaded, signIn, setActive } = useSignIn();
    const { isLoaded: isUserLoaded, isSignedIn } = useUser();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [info, setInfo] = useState<string | null>(null);
    const [secondFactorRequired, setSecondFactorRequired] = useState(false);
    const [secondFactorCode, setSecondFactorCode] = useState('');
    const backgroundStyle = {
        '--signin-bg': "url('/bg/sign-in-bg.jpg')",
    } as CSSProperties;
    const panelGlassStyle = {
        '--auth-panel-bg': 'linear-gradient(135deg, rgba(12, 18, 32, 0.72), rgba(12, 18, 32, 0.38))',
        '--auth-panel-border': 'rgba(255, 255, 255, 0.16)',
        '--auth-panel-shadow':
            '0 34px 72px -40px rgba(10, 16, 28, 0.95), 0 1px 0 rgba(255, 255, 255, 0.08) inset',
        '--auth-panel-blur': 'blur(26px) saturate(135%)',
    } as CSSProperties;
    const cardGlassStyle = {
        '--auth-card-bg': 'linear-gradient(135deg, rgba(255, 255, 255, 0.92), rgba(255, 255, 255, 0.7))',
        '--auth-card-border': 'rgba(255, 255, 255, 0.78)',
        '--auth-card-shadow':
            '0 24px 55px -35px rgba(15, 23, 42, 0.4), 0 1px 0 rgba(255, 255, 255, 0.7) inset',
        '--auth-card-blur': 'blur(28px) saturate(165%)',
    } as CSSProperties;

    const resolveRedirectTarget = (redirectUrl: string | null) => {
        if (!redirectUrl) {
            return withBasePath('/');
        }
        if (redirectUrl.startsWith('/')) {
            return withBasePath(redirectUrl);
        }
        try {
            const url = new URL(redirectUrl, window.location.origin);
            if (url.origin === window.location.origin) {
                return withBasePath(`${url.pathname}${url.search}${url.hash}`);
            }
        } catch {
            // ignore malformed redirectUrl
        }
        return withBasePath('/');
    };

    useEffect(() => {
        if (!isUserLoaded || !isSignedIn) {
            return;
        }
        const redirectUrl = searchParams?.get('redirect_url') ?? null;
        router.replace(resolveRedirectTarget(redirectUrl));
    }, [isUserLoaded, isSignedIn, router, searchParams]);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!isLoaded) {
            return;
        }

        setIsSubmitting(true);
        setError(null);
        setInfo(null);

        try {
            const result = await signIn.create({
                identifier: email,
                password,
            });

            if (result.status === 'complete') {
                await setActive({ session: result.createdSessionId });
                const redirectUrl = searchParams?.get('redirect_url') ?? null;
                router.push(resolveRedirectTarget(redirectUrl));
                return;
            }

            if (result.status === 'needs_second_factor') {
                const supported = result.supportedSecondFactors ?? [];
                const hasEmailCode = supported.some(
                    (factor) => factor.strategy === 'email_code',
                );

                if (!hasEmailCode) {
                    setError(t('auth.signin.error.secondFactorUnavailable', 'Дополнительная проверка недоступна. Обратитесь к администратору.'));
                    return;
                }

                await result.prepareSecondFactor({ strategy: 'email_code' });
                setSecondFactorRequired(true);
                setSecondFactorCode('');
                setInfo(t('auth.signin.info.secondFactorSent', 'Вход с нового устройства. Код подтверждения отправлен на e-mail.'));
                return;
            }

            if (result.status === 'needs_new_password') {
                setError(t('auth.signin.error.passwordResetRequired', 'Нужно обновить пароль. Обратитесь к администратору.'));
                return;
            }

            setError(t('auth.signin.error.generic', 'Не удалось завершить вход. Попробуйте ещё раз или обратитесь к администратору.'));
        } catch (signInError) {
            setError(getClerkErrorMessage(signInError, t('auth.signin.error.failed', 'Не удалось выполнить вход.')));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSecondFactorSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!isLoaded || !signIn) {
            return;
        }

        setIsSubmitting(true);
        setError(null);
        setInfo(null);

        try {
            const result = await signIn.attemptSecondFactor({
                strategy: 'email_code',
                code: secondFactorCode,
            });

            if (result.status === 'complete') {
                await setActive({ session: result.createdSessionId });
                const redirectUrl = searchParams?.get('redirect_url') ?? null;
                router.push(resolveRedirectTarget(redirectUrl));
                return;
            }

            setError(t('auth.signin.error.codeInvalid', 'Не удалось подтвердить код. Попробуйте ещё раз.'));
        } catch (signInError) {
            setError(getClerkErrorMessage(signInError, t('auth.signin.error.codeFailed', 'Не удалось подтвердить код.')));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResendSecondFactor = async () => {
        if (!isLoaded || !signIn) {
            return;
        }

        setIsSubmitting(true);
        setError(null);
        setInfo(null);

        try {
            await signIn.prepareSecondFactor({ strategy: 'email_code' });
            setInfo(t('auth.signin.info.secondFactorResent', 'Вход с нового устройства. Отправили новый код на e-mail.'));
        } catch (signInError) {
            setError(getClerkErrorMessage(signInError, t('auth.signin.error.codeSendFailed', 'Не удалось отправить код.')));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleBackToSignIn = () => {
        setSecondFactorRequired(false);
        setSecondFactorCode('');
        setInfo(null);
        setError(null);
    };


    return (
        <div
            className="auth-shell relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-signin bg-cover bg-center bg-no-repeat"
            style={backgroundStyle}
        >
            <div className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-6xl flex-col items-center justify-center gap-10 px-4 py-0 lg:min-h-0 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:items-stretch lg:px-6 lg:py-12">
                <section
                    className="auth-panel hidden flex-1 flex-col justify-center rounded-[32px] p-9 text-white lg:flex lg:self-stretch"
                    style={panelGlassStyle}
                >
                    <span className="text-xs font-semibold uppercase tracking-[0.45em] text-white/75">
                        CI Work
                    </span>
                    <h1 className="mt-5 inline-flex w-fit rounded-2xl bg-white/10 px-5 py-3 text-4xl font-semibold leading-[1.1] text-white drop-shadow-md md:text-5xl">
                        {t('auth.signin.hero.title', 'АВТОРИЗАЦИЯ')}
                    </h1>
                    <p className="mt-5 max-w-md border-l-2 border-white/30 pl-4 text-base font-medium text-white/85">
                        {t('auth.signin.hero.body1', 'Все проекты, задачи и статусы в одном пространстве — удобно и для команд, и для исполнителей. Для заказчиков — полный обзор задач, дедлайнов и загрузки команды.')}
                        <br />
                        {t('auth.signin.hero.body2', 'Для подрядчиков — все назначенные задачи и статусы в одном месте.')}
                    </p>
                    <div className="mt-8 flex flex-wrap gap-3 text-xs text-white/80">
                        <span className="auth-chip rounded-full border border-white/20 bg-white/10 px-3 py-1 shadow-sm">
                            {t('auth.signin.hero.chip.control', 'Контроль задач')}
                        </span>
                        <span className="auth-chip rounded-full border border-white/20 bg-white/10 px-3 py-1 shadow-sm">
                            {t('auth.signin.hero.chip.status', 'Статусы в реальном времени')}
                        </span>
                        <span className="auth-chip rounded-full border border-white/20 bg-white/10 px-3 py-1 shadow-sm">
                            {t('auth.signin.hero.chip.security', 'Безопасный доступ')}
                        </span>
                    </div>
                </section>
                <div className="mx-auto flex h-full w-full max-w-lg flex-col lg:mx-0 lg:self-stretch">
                    <div
                        className="auth-card flex h-full flex-col justify-center rounded-[32px] px-8 py-10"
                        style={cardGlassStyle}
                    >
                        <h2 className="text-[34px] font-semibold leading-[1.05] tracking-[-0.02em] text-slate-900 md:text-[38px]">
                            {t('auth.signin.title', 'Добро пожаловать')}
                        </h2>
                        <p className="mt-2 text-sm text-slate-600">
                            {secondFactorRequired
                                ? t('auth.signin.codePrompt', 'Введите код из письма, чтобы подтвердить вход.')
                                : t('auth.signin.prompt', 'Введите почту и пароль, чтобы продолжить работу.')}
                        </p>
                        {!secondFactorRequired ? (
                            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
                                <TextField
                                    id="email"
                                    label={t('auth.signin.email', 'Почта')}
                                    variant="outlined"
                                    fullWidth
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    autoComplete="email"
                                />
                                <FormControl variant="outlined" fullWidth>
                                    <InputLabel htmlFor="password">{t('auth.signin.password', 'Пароль')}</InputLabel>
                                    <OutlinedInput
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(event) => setPassword(event.target.value)}
                                        endAdornment={
                                            <InputAdornment position="end">
                                                <IconButton
                                                    aria-label={
                                                        showPassword
                                                            ? t('auth.signin.password.hide', 'скрыть пароль')
                                                            : t('auth.signin.password.show', 'показать пароль')
                                                    }
                                                    onClick={() => setShowPassword((prev) => !prev)}
                                                    onMouseDown={(event) => event.preventDefault()}
                                                    onMouseUp={(event) => event.preventDefault()}
                                                    edge="end"
                                                >
                                                    {showPassword ? <VisibilityOff /> : <Visibility />}
                                                </IconButton>
                                            </InputAdornment>
                                        }
                                        label={t('auth.signin.password', 'Пароль')}
                                    />
                                </FormControl>
                                {error ? (
                                    <Typography className="text-sm text-rose-600">
                                        {error}
                                    </Typography>
                                ) : null}
                                <Button
                                    type="submit"
                                    variant="contained"
                                    size="large"
                                    disabled={isSubmitting || !isLoaded}
                                >
                                    {isSubmitting ? t('auth.signin.submit.loading', 'Входим...') : t('auth.signin.submit', 'Войти')}
                                </Button>
                            </form>
                        ) : (
                            <form
                                onSubmit={handleSecondFactorSubmit}
                                className="mt-6 flex flex-col gap-4"
                            >
                                <TextField
                                    id="second-factor-code"
                                    label={t('auth.signin.code', 'Код из письма')}
                                    variant="outlined"
                                    fullWidth
                                    value={secondFactorCode}
                                    onChange={(event) => setSecondFactorCode(event.target.value)}
                                    inputProps={{ inputMode: 'numeric' }}
                                    autoComplete="one-time-code"
                                />
                                {info ? (
                                    <Typography className="text-sm text-slate-600">{info}</Typography>
                                ) : null}
                                {error ? (
                                    <Typography className="text-sm text-rose-600">
                                        {error}
                                    </Typography>
                                ) : null}
                                <Button
                                    type="submit"
                                    variant="contained"
                                    size="large"
                                    disabled={isSubmitting || !isLoaded}
                                >
                                    {isSubmitting ? t('auth.signin.codeSubmit.loading', 'Проверяем...') : t('auth.signin.codeSubmit', 'Подтвердить')}
                                </Button>
                                <Button
                                    type="button"
                                    variant="text"
                                    disabled={isSubmitting || !isLoaded}
                                    onClick={handleResendSecondFactor}
                                >
                                    {t('auth.signin.codeResend', 'Отправить код ещё раз')}
                                </Button>
                                <Button
                                    type="button"
                                    variant="text"
                                    disabled={isSubmitting}
                                    onClick={handleBackToSignIn}
                                >
                                    {t('auth.signin.back', 'Вернуться ко входу')}
                                </Button>
                            </form>
                        )}
                        <p className="mt-8 text-sm text-slate-600">
                            {t('auth.signin.noAccount', 'Нет аккаунта?')}{' '}
                            <Link href="/sign-up" className="font-semibold text-blue-600">
                                {t('auth.signin.register', 'Зарегистрироваться')}
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
