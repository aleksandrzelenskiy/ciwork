import 'server-only';

import ReportModel from '@/server/models/ReportModel';
import TaskModel from '@/server/models/TaskModel';
import ProjectModel from '@/server/models/ProjectModel';
import UserModel from '@/server/models/UserModel';
import { sendEmail } from '@/server/email/mailer';
import { signInitiatorAccessToken } from '@/utils/initiatorAccessToken';
import { getServerEnv } from '@/config/env';

const REPORT_REMINDER_STATUSES = new Set(['Pending', 'Fixed', 'Issues']);
const REMINDER_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000;
const REMINDER_EVENT_ACTION = 'REMINDER_SENT';
const REVIEW_REMINDER_KIND = 'photo_report_review';
const ISSUES_REMINDER_KIND = 'photo_report_issues';

type ReportStatusEvent = {
    action?: string;
    author?: string;
    date?: Date | string;
    details?: Record<string, unknown>;
};

type SubmissionContext = {
    submittedAt: Date;
    submittedBy: string;
};

type ReminderStats = {
    scanned: number;
    eligible: number;
    reminded: number;
    skippedNoRecipients: number;
    failed: number;
};

const normalizeEmail = (value?: string | null) =>
    typeof value === 'string' ? value.trim().toLowerCase() : '';

const toDate = (value: unknown): Date | null => {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    if (typeof value === 'string') {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return null;
};

const getSubmissionContext = (
    report: {
        status?: string;
        createdAt?: Date;
        updatedAt?: Date;
        createdByName?: string;
        events?: ReportStatusEvent[];
    }
): SubmissionContext => {
    const events = Array.isArray(report.events) ? report.events : [];
    const matchingEvent = [...events]
        .reverse()
        .find((event) => {
            if (event?.action !== 'STATUS_CHANGED') return false;
            const newStatus = event?.details?.newStatus;
            return typeof newStatus === 'string' && newStatus === report.status;
        });

    const submittedAt =
        toDate(matchingEvent?.date) ||
        toDate(report.updatedAt) ||
        toDate(report.createdAt) ||
        new Date();
    const submittedBy =
        (typeof matchingEvent?.author === 'string' && matchingEvent.author.trim()) ||
        (typeof report.createdByName === 'string' && report.createdByName.trim()) ||
        'Пользователь';

    return { submittedAt, submittedBy };
};

const getLatestReminderDate = (
    events?: ReportStatusEvent[],
    submittedAt?: Date,
    kind?: string
): Date | null => {
    const normalizedEvents = Array.isArray(events) ? events : [];
    for (let i = normalizedEvents.length - 1; i >= 0; i -= 1) {
        const event = normalizedEvents[i];
        if (event?.action !== REMINDER_EVENT_ACTION) continue;
        const eventKind = event?.details?.kind;
        if (kind && eventKind !== kind) continue;
        const eventDate = toDate(event.date);
        if (!eventDate) continue;
        if (submittedAt && eventDate < submittedAt) continue;
        return eventDate;
    }
    return null;
};

const formatDate = (date: Date) =>
    new Intl.DateTimeFormat('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).format(date);

export const sendPendingReportReviewReminders = async (
    now = new Date()
): Promise<ReminderStats> => {
    const stats: ReminderStats = {
        scanned: 0,
        eligible: 0,
        reminded: 0,
        skippedNoRecipients: 0,
        failed: 0,
    };

    const reports = await ReportModel.find({
        status: { $in: Array.from(REPORT_REMINDER_STATUSES) },
    })
        .select(
            'taskId baseId status createdAt updatedAt createdByName events'
        )
        .exec();
    stats.scanned = reports.length;

    if (reports.length === 0) {
        return stats;
    }

    const taskIds = Array.from(new Set(reports.map((report) => report.taskId)));
    const tasks = await TaskModel.find({ taskId: { $in: taskIds } })
        .select(
            'taskId taskName initiatorEmail authorEmail projectId executorEmail executorId'
        )
        .lean()
        .exec();
    const taskById = new Map(tasks.map((task) => [task.taskId, task]));
    const executorClerkIds = Array.from(
        new Set(
            tasks
                .map((task) =>
                    typeof task.executorId === 'string' ? task.executorId.trim() : ''
                )
                .filter(Boolean)
        )
    );
    const executorsByClerkId = new Map<string, string>();
    if (executorClerkIds.length > 0) {
        const users = await UserModel.find({
            clerkUserId: { $in: executorClerkIds },
        })
            .select('clerkUserId email')
            .lean()
            .exec();
        users.forEach((user) => {
            const clerkUserId =
                typeof user.clerkUserId === 'string' ? user.clerkUserId.trim() : '';
            const email = normalizeEmail(user.email);
            if (clerkUserId && email) {
                executorsByClerkId.set(clerkUserId, email);
            }
        });
    }

    const projectIds = Array.from(
        new Set(
            tasks
                .map((task) =>
                    task.projectId ? task.projectId.toString() : ''
                )
                .filter(Boolean)
        )
    );

    const projects =
        projectIds.length > 0
            ? await ProjectModel.find({ _id: { $in: projectIds } })
                  .select('_id managers')
                  .lean()
                  .exec()
            : [];
    const managerEmailByProjectId = new Map<string, string>();
    projects.forEach((project) => {
        const managers = Array.isArray(project.managers) ? project.managers : [];
        const firstManagerEmail = managers
            .map((email) => normalizeEmail(email))
            .find(Boolean);
        if (firstManagerEmail) {
            managerEmailByProjectId.set(project._id.toString(), firstManagerEmail);
        }
    });

    const { FRONTEND_URL } = getServerEnv();
    const frontendUrl = FRONTEND_URL || 'https://ciwork.ru';
    const approvalText =
        'Выполните пожалуйста проверку фотоотчета и выставите замечания или согласуйте фотоотчет пользователя в случае отсутствия замечаний.';
    const fixesApprovalText =
        'Замечания по задаче устранены, пользователь загрузил фотографии исправлений. Выполните пожалуйста проверку фотоотчета и выставите замечания или согласуйте фотоотчет пользователя в случае отсутствия замечаний.';
    const issuesText =
        'По задаче есть замечания к фотоотчету. Необходимо устранить замечания и загрузить фотографии исправлений.';

    for (const report of reports) {
        try {
            const submission = getSubmissionContext(report);
            if (now.getTime() - submission.submittedAt.getTime() < REMINDER_INTERVAL_MS) {
                continue;
            }

            const reminderKind =
                report.status === 'Issues' ? ISSUES_REMINDER_KIND : REVIEW_REMINDER_KIND;
            const lastReminderAt = getLatestReminderDate(
                report.events,
                submission.submittedAt,
                reminderKind
            );
            if (
                lastReminderAt &&
                now.getTime() - lastReminderAt.getTime() < REMINDER_INTERVAL_MS
            ) {
                continue;
            }

            stats.eligible += 1;

            const task = taskById.get(report.taskId);
            const initiatorEmail = normalizeEmail(task?.initiatorEmail);
            const taskTitle =
                (typeof task?.taskName === 'string' && task.taskName.trim()) ||
                report.taskId;
            const reportLink = `${frontendUrl}/reports/${encodeURIComponent(
                report.taskId
            )}/${encodeURIComponent(report.baseId)}`;

            let recipients: string[] = [];
            let subject = '';
            let text = '';
            let html = '';

            if (report.status === 'Issues') {
                const executorEmail =
                    normalizeEmail(task?.executorEmail) ||
                    normalizeEmail(
                        task?.executorId
                            ? executorsByClerkId.get(task.executorId.trim())
                            : ''
                    );
                recipients = executorEmail ? [executorEmail] : [];
                const issuesDateText = formatDate(submission.submittedAt);
                const summaryLine = `${issuesDateText} по задаче «${taskTitle}» (БС ${report.baseId}) были выставлены замечания по фотоотчету.`;
                subject = `Напоминание: устраните замечания по фотоотчету «${taskTitle}»`;
                text = `${summaryLine}\n\n${issuesText}`;
                html = `<p>${summaryLine}</p><p>${issuesText}</p>`;
            } else {
                const managerEmail =
                    normalizeEmail(
                        task?.projectId
                            ? managerEmailByProjectId.get(task.projectId.toString())
                            : ''
                    ) || normalizeEmail(task?.authorEmail);
                recipients = Array.from(new Set([managerEmail, initiatorEmail].filter(Boolean)));
                const submittedDateText = formatDate(submission.submittedAt);
                const summaryLine =
                    report.status === 'Fixed'
                        ? `${submittedDateText} пользователем ${submission.submittedBy} устранены замечания и загружены фотографии исправлений по задаче «${taskTitle}» (БС ${report.baseId}).`
                        : `${submittedDateText} пользователем ${submission.submittedBy} отправлен фотоотчет по задаче «${taskTitle}» (БС ${report.baseId}).`;
                const actionText =
                    report.status === 'Fixed' ? fixesApprovalText : approvalText;
                subject = `Напоминание: проверьте фотоотчет по задаче «${taskTitle}»`;
                text = `${summaryLine}\n\n${actionText}`;
                html = `<p>${summaryLine}</p><p>${actionText}</p>`;
            }

            if (recipients.length === 0) {
                stats.skippedNoRecipients += 1;
                continue;
            }

            const initiatorLink = initiatorEmail
                ? `${reportLink}?token=${encodeURIComponent(
                      signInitiatorAccessToken({
                          taskId: report.taskId,
                          email: initiatorEmail,
                      })
                  )}`
                : '';

            await Promise.all(
                recipients.map(async (recipient) => {
                    const link =
                        recipient === initiatorEmail && initiatorLink
                            ? initiatorLink
                            : reportLink;
                    await sendEmail({
                        to: recipient,
                        subject,
                        text: `${text}\n\nСсылка на фотоотчет: ${link}`,
                        html: `${html}<p><a href="${link}">Перейти к фотоотчету</a></p>`,
                    });
                })
            );

            report.events = Array.isArray(report.events) ? report.events : [];
            report.events.push({
                action: REMINDER_EVENT_ACTION,
                author: 'System',
                authorId: 'system:photo-report-reminder',
                date: now,
                details: {
                    kind: reminderKind,
                    recipients,
                    status: report.status,
                },
            });
            await report.save();
            stats.reminded += 1;
        } catch (error) {
            stats.failed += 1;
            console.error('Failed to send photo report review reminder', {
                taskId: report.taskId,
                baseId: report.baseId,
                error,
            });
        }
    }

    return stats;
};
