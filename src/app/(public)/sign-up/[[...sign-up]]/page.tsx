'use client';

import { useState, type CSSProperties, type FormEvent } from 'react';
import { useSignUp } from '@clerk/nextjs';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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

export default function Page() {
    const { isLoaded, signUp, setActive } = useSignUp();
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [pendingVerification, setPendingVerification] = useState(false);
    const [confirmTouched, setConfirmTouched] = useState(false);
    const [error, setError] = useState<string | null>(null);
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
    const isPasswordMismatch = confirmTouched && confirmPassword !== password;
    const isSubmitDisabled =
        isSubmitting ||
        !isLoaded ||
        !email ||
        !password ||
        !confirmPassword ||
        confirmPassword !== password;

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!isLoaded) {
            return;
        }

        if (confirmPassword !== password) {
            setConfirmTouched(true);
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const result = await signUp.create({
                emailAddress: email,
                password,
            });

            if (result.status === 'complete') {
                await setActive({ session: result.createdSessionId });
                router.push('/onboarding');
                return;
            }

            await signUp.prepareEmailAddressVerification({
                strategy: 'email_code',
            });
            setPendingVerification(true);
        } catch (signUpError) {
            setError(getClerkErrorMessage(signUpError, 'Не удалось создать учетную запись.'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleVerify = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!isLoaded) {
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const result = await signUp.attemptEmailAddressVerification({
                code: verificationCode,
            });

            if (result.status === 'complete') {
                await setActive({ session: result.createdSessionId });
                router.push('/onboarding');
                return;
            }

            setError('Не удалось подтвердить код. Попробуйте еще раз.');
        } catch (verifyError) {
            setError(getClerkErrorMessage(verifyError, 'Не удалось подтвердить код.'));
        } finally {
            setIsSubmitting(false);
        }
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
                        РЕГИСТРАЦИЯ
                    </h1>
                    <p className="mt-5 max-w-md border-l-2 border-white/30 pl-4 text-base font-medium text-white/85">
                        Все проекты, задачи и статусы в одном пространстве —
                        удобно и для команд, и для исполнителей. Для заказчиков —
                        полный обзор задач, дедлайнов и загрузки команды.
                        <br />
                        Для подрядчиков — все назначенные задачи и статусы в одном месте.
                    </p>
                    <div className="mt-8 flex flex-wrap gap-3 text-xs text-white/80">
                        <span className="auth-chip rounded-full border border-white/20 bg-white/10 px-3 py-1 shadow-sm">
                            Приглашения в проекты
                        </span>
                        <span className="auth-chip rounded-full border border-white/20 bg-white/10 px-3 py-1 shadow-sm">
                            Быстрый онбординг
                        </span>
                        <span className="auth-chip rounded-full border border-white/20 bg-white/10 px-3 py-1 shadow-sm">
                            Уведомления о статусе
                        </span>
                    </div>
                </section>
                <div className="mx-auto flex h-full w-full max-w-lg flex-col lg:mx-0 lg:self-stretch">
                    <div
                        className="auth-card flex h-full flex-col justify-center rounded-[32px] px-8 py-10"
                        style={cardGlassStyle}
                    >
                        <h2 className="text-[32px] font-semibold leading-[1.05] tracking-[-0.02em] text-slate-900 md:text-[36px]">
                        Зарегистрироваться
                        </h2>
                        <p className="mt-2 text-sm text-slate-600">
                            {pendingVerification
                                ? 'Код подтверждения отправлен на e-mail.'
                                : 'Заполните почту и пароль, чтобы начать работу.'}
                        </p>
                        {!pendingVerification ? (
                            <form
                                onSubmit={handleSubmit}
                                className="mt-6 flex flex-col gap-4"
                            >
                                <TextField
                                    id="email"
                                    label="Почта"
                                    variant="outlined"
                                    fullWidth
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    autoComplete="email"
                                />
                                <FormControl variant="outlined" fullWidth>
                                    <InputLabel htmlFor="password">Пароль</InputLabel>
                                    <OutlinedInput
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(event) => setPassword(event.target.value)}
                                        autoComplete="new-password"
                                        endAdornment={
                                            <InputAdornment position="end">
                                                <IconButton
                                                    aria-label={
                                                        showPassword
                                                            ? 'скрыть пароль'
                                                            : 'показать пароль'
                                                    }
                                                    onClick={() => setShowPassword((prev) => !prev)}
                                                    onMouseDown={(event) => event.preventDefault()}
                                                    onMouseUp={(event) => event.preventDefault()}
                                                    edge="end"
                                                >
                                                    {showPassword ? (
                                                        <VisibilityOff />
                                                    ) : (
                                                        <Visibility />
                                                    )}
                                                </IconButton>
                                            </InputAdornment>
                                        }
                                        label="Пароль"
                                    />
                                </FormControl>
                                <FormControl variant="outlined" fullWidth>
                                    <InputLabel htmlFor="confirm-password">
                                        Подтвердите пароль
                                    </InputLabel>
                                    <OutlinedInput
                                        id="confirm-password"
                                        type={showPassword ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={(event) => setConfirmPassword(event.target.value)}
                                        onBlur={() => setConfirmTouched(true)}
                                        autoComplete="new-password"
                                        endAdornment={
                                            <InputAdornment position="end">
                                                <IconButton
                                                    aria-label={
                                                        showPassword
                                                            ? 'скрыть пароль'
                                                            : 'показать пароль'
                                                    }
                                                    onClick={() => setShowPassword((prev) => !prev)}
                                                    onMouseDown={(event) => event.preventDefault()}
                                                    onMouseUp={(event) => event.preventDefault()}
                                                    edge="end"
                                                >
                                                    {showPassword ? (
                                                        <VisibilityOff />
                                                    ) : (
                                                        <Visibility />
                                                    )}
                                                </IconButton>
                                            </InputAdornment>
                                        }
                                        label="Подтвердите пароль"
                                        error={isPasswordMismatch}
                                    />
                                </FormControl>
                                {isPasswordMismatch ? (
                                    <Typography className="text-xs text-rose-600">
                                        Пароли не совпадают.
                                    </Typography>
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
                                    disabled={isSubmitDisabled}
                                >
                                    {isSubmitting ? 'Создаем...' : 'Создать аккаунт'}
                                </Button>
                            </form>
                        ) : (
                            <form
                                onSubmit={handleVerify}
                                className="mt-6 flex flex-col gap-4"
                            >
                                <TextField
                                    id="email-code"
                                    label="Код из письма"
                                    variant="outlined"
                                    fullWidth
                                    value={verificationCode}
                                    onChange={(event) => setVerificationCode(event.target.value)}
                                />
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
                                    {isSubmitting ? 'Проверяем...' : 'Подтвердить почту'}
                                </Button>
                            </form>
                        )}
                        <p className="mt-8 text-sm text-slate-600">
                            Уже есть аккаунт?{' '}
                            <Link href="/sign-in" className="font-semibold text-blue-600">
                                Войти
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
