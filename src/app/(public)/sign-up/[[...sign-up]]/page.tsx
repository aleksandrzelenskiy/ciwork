'use client';

import { SignUp } from '@clerk/nextjs';
import { ruRU } from '@clerk/localizations';

import { authAppearance } from '../../auth-appearance';

export default function Page() {
    return (
        <div className="flex min-h-screen w-full items-center justify-center bg-signin bg-cover bg-center bg-no-repeat">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-12 lg:flex-row lg:items-center">
                <section className="flex flex-1 flex-col justify-center text-white">
                    <span className="text-xs uppercase tracking-[0.4em] text-white/70">
                        CI Work
                    </span>
                    <h1 className="mt-4 text-4xl font-semibold leading-tight md:text-5xl">
                        Регистрация в платформе
                    </h1>
                    <p className="mt-4 max-w-md text-base text-white/85">
                        Создайте аккаунт, чтобы принимать задачи, отправлять
                        отчёты и видеть прогресс команды в едином рабочем
                        пространстве.
                    </p>
                    <div className="mt-8 flex flex-wrap gap-3 text-xs text-white/70">
                        <span className="rounded-full border border-white/20 px-3 py-1">
                            Приглашения в проекты
                        </span>
                        <span className="rounded-full border border-white/20 px-3 py-1">
                            Быстрый онбординг
                        </span>
                        <span className="rounded-full border border-white/20 px-3 py-1">
                            Уведомления о статусе
                        </span>
                    </div>
                </section>
                <div className="flex w-full max-w-md flex-col">
                    <SignUp
                        afterSignUpUrl="/onboarding"
                        appearance={authAppearance}
                        localization={ruRU}
                    />
                    <p className="mt-4 text-xs text-white/70">
                        Если у вас уже есть доступ, используйте вход в систему.
                    </p>
                </div>
            </div>
        </div>
    );
}
