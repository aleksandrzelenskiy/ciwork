'use client';

import { SignUp } from '@clerk/nextjs';
import { authAppearance } from '../../auth-appearance';

export default function Page() {
    return (
        <div className="flex min-h-screen w-full items-center justify-center bg-signin bg-cover bg-center bg-no-repeat">
            <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-10 px-4 py-12 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:items-stretch lg:px-6">
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
                <div className="flex h-full w-full max-w-full flex-col lg:max-w-md lg:self-stretch">
                    <SignUp
                        afterSignUpUrl="/onboarding"
                        appearance={authAppearance}
                    />
                </div>
            </div>
        </div>
    );
}
