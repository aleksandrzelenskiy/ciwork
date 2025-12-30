'use client';

import { SignIn } from '@clerk/nextjs';
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
                        Вход в рабочую среду
                    </h1>
                    <p className="mt-4 max-w-md text-base text-white/85">
                        Управляйте задачами, отчётами и коммуникацией в одном
                        месте. Войдите, чтобы продолжить работу с проектами и
                        командой.
                    </p>
                    <div className="mt-8 flex flex-wrap gap-3 text-xs text-white/70">
                        <span className="rounded-full border border-white/20 px-3 py-1">
                            Контроль задач
                        </span>
                        <span className="rounded-full border border-white/20 px-3 py-1">
                            Статусы в реальном времени
                        </span>
                        <span className="rounded-full border border-white/20 px-3 py-1">
                            Безопасный доступ
                        </span>
                    </div>
                </section>
                <div className="flex w-full max-w-md flex-col">
                    <SignIn appearance={authAppearance} />
                    <p className="mt-4 text-xs text-white/70">
                        Возникли вопросы? Напишите руководителю проекта или в
                        поддержку.
                    </p>
                </div>
            </div>
        </div>
    );
}
