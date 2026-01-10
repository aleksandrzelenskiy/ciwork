'use client';

import { useState, type FormEvent } from 'react';
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

const getClerkErrorMessage = (error: unknown) => {
    if (typeof error === 'object' && error && 'errors' in error) {
        const clerkErrors = (error as { errors?: Array<{ message?: string }> }).errors;
        if (clerkErrors?.length) {
            return clerkErrors[0]?.message ?? 'Не удалось создать учетную запись.';
        }
    }

    return 'Не удалось создать учетную запись.';
};

export default function Page() {
    const { isLoaded, signUp, setActive } = useSignUp();
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [pendingVerification, setPendingVerification] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!isLoaded) {
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
            setError(getClerkErrorMessage(signUpError));
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
            setError(getClerkErrorMessage(verifyError));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex min-h-screen w-full items-center justify-center bg-signin bg-cover bg-center bg-no-repeat">
            <div className="mx-auto flex min-h-[100svh] w-full max-w-6xl flex-col items-center justify-center gap-10 px-4 py-0 lg:min-h-0 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:items-stretch lg:px-6 lg:py-12">
                <section className="hidden flex-1 flex-col justify-center rounded-3xl border border-white/10 bg-black/10 p-8 text-white shadow-2xl backdrop-blur-md lg:flex lg:self-stretch">
                    <span className="text-xs font-semibold uppercase tracking-[0.4em] text-white/80">
                        CI Work
                    </span>
                    <h1 className="mt-4 inline-flex w-fit rounded-2xl bg-white/5 px-4 py-2 text-4xl font-semibold leading-tight text-white drop-shadow-md md:text-5xl">
                        РЕГИСТРАЦИЯ
                    </h1>
                    <p className="mt-4 max-w-md border-l-2 border-white/40 pl-4 text-base font-medium text-white/90">
                        Создайте аккаунт, чтобы принимать задачи, отправлять
                        отчёты и видеть прогресс команды в едином рабочем
                        пространстве.
                    </p>
                    <div className="mt-8 flex flex-wrap gap-3 text-xs text-white/90">
                        <span className="rounded-full border border-white/30 bg-white/5 px-3 py-1 shadow-sm">
                            Приглашения в проекты
                        </span>
                        <span className="rounded-full border border-white/30 bg-white/5 px-3 py-1 shadow-sm">
                            Быстрый онбординг
                        </span>
                        <span className="rounded-full border border-white/30 bg-white/5 px-3 py-1 shadow-sm">
                            Уведомления о статусе
                        </span>
                    </div>
                </section>
                <div className="mx-auto flex h-full w-full max-w-lg flex-col lg:mx-0 lg:self-stretch">
                    <div className="flex h-full flex-col justify-center rounded-3xl border border-white/80 bg-gradient-to-br from-white/95 via-blue-50/80 to-slate-50/85 px-8 py-10 shadow-2xl backdrop-blur-2xl">
                        <Typography className="text-sm font-semibold uppercase tracking-[0.4em] text-slate-500">
                            Регистрация
                        </Typography>
                        <Typography className="mt-2 text-2xl font-semibold text-slate-900">
                            Создайте учетную запись
                        </Typography>
                        <Typography className="mt-1 text-sm text-slate-600">
                            Заполните почту и пароль, чтобы начать работу.
                        </Typography>
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
                        <Typography className="mt-6 text-sm text-slate-600">
                            Уже есть аккаунт?{' '}
                            <Link href="/sign-in" className="font-semibold text-blue-600">
                                Войти
                            </Link>
                        </Typography>
                    </div>
                </div>
            </div>
        </div>
    );
}
