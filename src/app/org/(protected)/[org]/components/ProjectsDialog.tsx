import * as React from 'react';
import {
    Button,
    Card,
    CardContent,
    CardHeader,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Tooltip,
    Typography,
} from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';

import type { MemberDTO, ProjectDTO } from '@/types/org';
import ProfileDialog from '@/features/profile/ProfileDialog';
import { useI18n } from '@/i18n/I18nProvider';

type ProjectsDialogProps = {
    open: boolean;
    onClose: () => void;
    projects: ProjectDTO[];
    projectsLoading: boolean;
    disableCreationActions: boolean;
    creationTooltip: string;
    onOpenProjectDialog: (project?: ProjectDTO) => void;
    onRemoveProject: (project: ProjectDTO) => void;
    onGoToProjects: () => void;
    onRefresh: () => void;
    onProjectNavigate: (projectKey: string) => void;
    memberByEmail: Map<string, MemberDTO>;
    cardBaseSx: SxProps<Theme>;
    cardHeaderSx: SxProps<Theme>;
    cardContentSx: SxProps<Theme>;
    dialogPaperSx: SxProps<Theme>;
    dialogActionsSx: SxProps<Theme>;
    dialogContentBg?: string;
};

export default function ProjectsDialog({
    open,
    onClose,
    projects,
    projectsLoading,
    disableCreationActions,
    creationTooltip,
    onOpenProjectDialog,
    onRemoveProject,
    onGoToProjects,
    onRefresh,
    onProjectNavigate,
    memberByEmail,
    cardBaseSx,
    cardHeaderSx,
    cardContentSx,
    dialogPaperSx,
    dialogActionsSx,
    dialogContentBg,
}: ProjectsDialogProps) {
    const { t } = useI18n();
    const [profileUserId, setProfileUserId] = React.useState<string | null>(null);
    const [profileOpen, setProfileOpen] = React.useState(false);

    const openProfileDialog = (clerkUserId?: string | null) => {
        if (!clerkUserId) return;
        setProfileUserId(clerkUserId);
        setProfileOpen(true);
    };

    const closeProfileDialog = () => {
        setProfileOpen(false);
        setProfileUserId(null);
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="lg"
            fullWidth
            fullScreen
            slotProps={{
                paper: {
                    sx: { ...dialogPaperSx, borderRadius: 0 },
                },
            }}
        >
            <DialogTitle sx={cardHeaderSx}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="inherit">{t('org.projects.title', 'Проекты организации')}</Typography>
                    <IconButton onClick={onClose}>
                        <CloseFullscreenIcon />
                    </IconButton>
                </Stack>
            </DialogTitle>
            <DialogContent dividers sx={{ backgroundColor: dialogContentBg }}>
                <Card variant="outlined" sx={cardBaseSx}>
                    <CardHeader
                        sx={cardHeaderSx}
                        title={t('org.projects.titleCount', 'Проекты организации ({count})', {
                            count: projects.length,
                        })}
                        action={
                            <Stack direction="row" spacing={1}>
                                <Tooltip title={creationTooltip}>
                                    <span>
                                        <IconButton
                                            onClick={() => onOpenProjectDialog()}
                                            disabled={disableCreationActions}
                                        >
                                            <CreateNewFolderIcon />
                                        </IconButton>
                                    </span>
                                </Tooltip>
                                <Tooltip title={t('org.projects.actions.goToProjects', 'Перейти к проектам')}>
                                    <span>
                                        <IconButton onClick={onGoToProjects}>
                                            <DriveFileMoveIcon />
                                        </IconButton>
                                    </span>
                                </Tooltip>
                                <Tooltip title={t('common.refresh', 'Обновить')}>
                                    <span>
                                        <IconButton onClick={onRefresh} disabled={projectsLoading}>
                                            <RefreshIcon />
                                        </IconButton>
                                    </span>
                                </Tooltip>
                            </Stack>
                        }
                    />
                    <CardContent sx={cardContentSx}>
                        {projectsLoading ? (
                            <Stack direction="row" spacing={1} alignItems="center">
                                <CircularProgress size={20} />
                                <Typography>{t('org.projects.loading', 'Загрузка проектов…')}</Typography>
                            </Stack>
                        ) : (
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>{t('org.projects.table.key', 'Код')}</TableCell>
                                        <TableCell>{t('org.projects.table.project', 'Проект')}</TableCell>
                                        <TableCell>{t('org.projects.table.manager', 'Менеджер')}</TableCell>
                                        <TableCell>{t('org.projects.table.description', 'Описание')}</TableCell>
                                        <TableCell align="right">{t('common.actions', 'Действия')}</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {projects.map((project) => (
                                        <TableRow key={project._id} hover>
                                            <TableCell
                                                sx={{ cursor: 'pointer' }}
                                            onClick={() => onProjectNavigate(project.key)}
                                            >
                                                {project.key}
                                            </TableCell>
                                            <TableCell
                                                sx={{ cursor: 'pointer' }}
                                            onClick={() => onProjectNavigate(project.key)}
                                            >
                                                {project.name}
                                            </TableCell>
                                            <TableCell>
                                                {(() => {
                                                    const rawEmail =
                                                        project.managerEmail ||
                                                        (Array.isArray(project.managers) && project.managers.length > 0
                                                            ? project.managers[0]
                                                            : '');
                                                    const normalized = rawEmail ? rawEmail.trim().toLowerCase() : '';
                                                    const member = normalized ? memberByEmail.get(normalized) : undefined;

                                                    const name = member?.userName || '';
                                                    const email = member?.userEmail || rawEmail || '';

                                                    if (name && email) {
                                                        return (
                                                            <Stack spacing={0}>
                                                                {member?.clerkId ? (
                                                                    <Button
                                                                        variant="text"
                                                                        size="small"
                                                                        onClick={() => openProfileDialog(member.clerkId)}
                                                                        sx={{ textTransform: 'none', px: 0, minWidth: 0 }}
                                                                    >
                                                                        {name}
                                                                    </Button>
                                                                ) : (
                                                                    <Typography variant="body2">{name}</Typography>
                                                                )}
                                                                <Typography variant="caption" color="text.secondary">
                                                                    {email}
                                                                </Typography>
                                                            </Stack>
                                                        );
                                                    }

                                                    if (email) {
                                                        return <Typography variant="body2">{email}</Typography>;
                                                    }

                                                    return (
                                                        <Typography variant="body2" color="text.secondary">
                                                            —
                                                        </Typography>
                                                    );
                                                })()}
                                            </TableCell>
                                            <TableCell sx={{ maxWidth: 360 }}>
                                                <Typography variant="body2" color="text.secondary" noWrap>
                                                    {project.description || '—'}
                                                </Typography>
                                            </TableCell>
                                            <TableCell align="right">
                                                <Tooltip title={t('org.projects.actions.edit', 'Редактировать проект')}>
                                                    <IconButton onClick={() => onOpenProjectDialog(project)}>
                                                        <EditOutlinedIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title={t('org.projects.actions.delete', 'Удалить проект')}>
                                                    <IconButton onClick={() => onRemoveProject(project)}>
                                                        <DeleteOutlineOutlinedIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </TableCell>
                                        </TableRow>
                                    ))}

                                    {projects.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={5}>
                                                <Typography color="text.secondary">
                                                    {t('org.projects.empty', 'Проектов пока нет. Чтобы создать нажмите')}
                                                    <IconButton
                                                        onClick={() => onOpenProjectDialog()}
                                                        disabled={disableCreationActions}
                                                    >
                                                        <CreateNewFolderIcon />
                                                    </IconButton>
                                                </Typography>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </DialogContent>
            <DialogActions sx={dialogActionsSx}>
                <Button onClick={onClose}>{t('common.close', 'Закрыть')}</Button>
            </DialogActions>

            <ProfileDialog
                open={profileOpen}
                onClose={closeProfileDialog}
                clerkUserId={profileUserId}
            />
        </Dialog>
    );
}
