'use client';

import { SignUp } from '@clerk/nextjs';
import { authAppearance } from '../../auth-appearance';

export default function Page() {
    return (
        <div className="flex min-h-screen w-full items-center justify-center bg-signin bg-cover bg-center bg-no-repeat">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-12 lg:flex-row lg:items-center">
                <section className="flex flex-1 flex-col justify-center rounded-3xl border border-white/10 bg-white/5 p-8 text-white shadow-lg backdrop-blur-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.4em] text-white/80">
                        CI Work
                    </span>
                    <h1 className="mt-4 inline-flex w-fit rounded-2xl bg-white/10 px-4 py-2 text-4xl font-semibold leading-tight text-white drop-shadow-md md:text-5xl">
                        РЕГИСТРАЦИЯ
                    </h1>
                    <p className="mt-4 max-w-md border-l-2 border-white/40 pl-4 text-base font-medium text-white/90">
                        Создайте аккаунт, чтобы принимать задачи, отправлять
                        отчёты и видеть прогресс команды в едином рабочем
                        пространстве.
                    </p>
                    <div className="mt-8 flex flex-wrap gap-3 text-xs text-white/90">
                        <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 shadow-sm">
                            Приглашения в проекты
                        </span>
                        <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 shadow-sm">
                            Быстрый онбординг
                        </span>
                        <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 shadow-sm">
                            Уведомления о статусе
                        </span>
                    </div>
                </section>
                <div className="flex w-full max-w-md flex-col">
                    <SignUp
                        afterSignUpUrl="/onboarding"
                        appearance={authAppearance}
                    />
                    <p className="mt-4 text-xs text-white/70">
                        Если у вас уже есть доступ, используйте вход в систему.
                    </p>
                </div>
            </div>
        </div>
    );
}
