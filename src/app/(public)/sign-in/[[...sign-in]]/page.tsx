'use client';

import { useState, type CSSProperties, type FormEvent } from 'react';
import { useSignIn } from '@clerk/nextjs';
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

const getClerkErrorMessage = (error: unknown) => {
    if (typeof error === 'object' && error && 'errors' in error) {
        const clerkErrors = (error as { errors?: Array<{ message?: string }> }).errors;
        if (clerkErrors?.length) {
            return clerkErrors[0]?.message ?? 'Не удалось выполнить вход.';
        }
    }

    return 'Не удалось выполнить вход.';
};

export default function Page() {
    const { isLoaded, signIn, setActive } = useSignIn();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const backgroundStyle = { '--signin-bg': "url('/bg/sign-in-bg.jpg')" } as CSSProperties;

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!isLoaded) {
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const result = await signIn.create({
                identifier: email,
                password,
            });

            if (result.status === 'complete') {
                await setActive({ session: result.createdSessionId });
                const redirectUrl = searchParams?.get('redirect_url') ?? '/';
                router.push(redirectUrl);
                return;
            }

            setError('Требуется дополнительная проверка. Завершите вход в следующем шаге.');
        } catch (signInError) {
            setError(getClerkErrorMessage(signInError));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div
            className="auth-shell relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-signin bg-cover bg-center bg-no-repeat"
            style={backgroundStyle}
        >
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-950/50 via-slate-900/40 to-slate-900/70" />
            <div className="pointer-events-none absolute -top-32 left-10 h-64 w-64 rounded-full bg-white/30 blur-3xl" />
            <div className="pointer-events-none absolute bottom-[-6rem] right-[-3rem] h-72 w-72 rounded-full bg-sky-200/30 blur-[90px]" />
            <div className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-6xl flex-col items-center justify-center gap-10 px-4 py-0 lg:min-h-0 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:items-stretch lg:px-6 lg:py-12">
                <section className="auth-panel hidden flex-1 flex-col justify-center rounded-3xl border border-white/15 bg-white/5 p-8 text-white shadow-[0_30px_70px_-40px_rgba(15,23,42,0.85)] backdrop-blur-xl lg:flex lg:self-stretch">
                    <span className="text-xs font-semibold uppercase tracking-[0.4em] text-white/80">
                        CI Work
                    </span>
                    <h1 className="mt-4 inline-flex w-fit rounded-2xl bg-white/5 px-4 py-2 text-4xl font-semibold leading-tight text-white drop-shadow-md md:text-5xl">
                        АВТОРИЗАЦИЯ
                    </h1>
                    <p className="mt-4 max-w-md border-l-2 border-white/40 pl-4 text-base font-medium text-white/90">
                        Управляйте задачами, отчётами и коммуникацией в одном
                        месте. Войдите, чтобы продолжить работу с проектами и
                        командой.
                    </p>
                    <div className="mt-8 flex flex-wrap gap-3 text-xs text-white/90">
                        <span className="auth-chip rounded-full border border-white/30 bg-white/5 px-3 py-1 shadow-sm">
                            Контроль задач
                        </span>
                        <span className="auth-chip rounded-full border border-white/30 bg-white/5 px-3 py-1 shadow-sm">
                            Статусы в реальном времени
                        </span>
                        <span className="auth-chip rounded-full border border-white/30 bg-white/5 px-3 py-1 shadow-sm">
                            Безопасный доступ
                        </span>
                    </div>
                </section>
                <div className="mx-auto flex h-full w-full max-w-lg flex-col lg:mx-0 lg:self-stretch">
                    <div className="auth-card flex h-full flex-col justify-center rounded-3xl border border-white/60 bg-white/70 px-8 py-10 shadow-[0_25px_60px_-35px_rgba(15,23,42,0.7)] backdrop-blur-3xl ring-1 ring-white/70">
                        <Typography className="text-sm font-semibold uppercase tracking-[0.4em] text-slate-500">
                            Вход
                        </Typography>
                        <Typography className="mt-2 text-2xl font-semibold text-slate-900">
                            Добро пожаловать
                        </Typography>
                        <Typography className="mt-1 text-sm text-slate-600">
                            Введите почту и пароль, чтобы продолжить работу.
                        </Typography>
                        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
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
                                                {showPassword ? <VisibilityOff /> : <Visibility />}
                                            </IconButton>
                                        </InputAdornment>
                                    }
                                    label="Пароль"
                                />
                            </FormControl>
                            {error ? (
                                <Typography className="text-sm text-rose-600">{error}</Typography>
                            ) : null}
                            <Button
                                type="submit"
                                variant="contained"
                                size="large"
                                disabled={isSubmitting || !isLoaded}
                            >
                                {isSubmitting ? 'Входим...' : 'Войти'}
                            </Button>
                        </form>
                        <Typography className="mt-6 text-sm text-slate-600">
                            Нет аккаунта?{' '}
                            <Link href="/sign-up" className="font-semibold text-blue-600">
                                Зарегистрироваться
                            </Link>
                        </Typography>
                    </div>
                </div>
            </div>
        </div>
    );
}
