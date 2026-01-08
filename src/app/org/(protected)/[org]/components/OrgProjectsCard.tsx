import * as React from 'react';
import {
    Box,
    Button,
    CircularProgress,
    IconButton,
    Stack,
    Tooltip,
    Typography,
} from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';

import type { ProjectDTO } from '@/types/org';

type OrgProjectsCardProps = {
    projectsLoading: boolean;
    projectPreview: ProjectDTO[];
    activeProjectsCount: number;
    projectsLimitLabel: string;
    onOpenDialog: () => void;
    onGoToProjects: () => void;
    onCreateProject: () => void;
    onOpenProjectTasks: (project: ProjectDTO) => void;
    disableCreationActions: boolean;
    creationTooltip: string;
    masonryCardSx: SxProps<Theme>;
    cardBorder: string;
    isDarkMode: boolean;
    textSecondary: string;
    buttonRadius: number;
};

export default function OrgProjectsCard({
    projectsLoading,
    projectPreview,
    activeProjectsCount,
    projectsLimitLabel,
    onOpenDialog,
    onGoToProjects,
    onCreateProject,
    onOpenProjectTasks,
    disableCreationActions,
    creationTooltip,
    masonryCardSx,
    cardBorder,
    isDarkMode,
    textSecondary,
    buttonRadius,
}: OrgProjectsCardProps) {
    return (
        <Box sx={{ ...masonryCardSx, p: { xs: 2, md: 2.5 } }}>
            <Stack spacing={2}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="subtitle1" fontWeight={600}>
                        Проекты
                    </Typography>
                    <Stack direction="row" spacing={1}>
                        <Tooltip title="Открыть список">
                            <span>
                                <IconButton onClick={onOpenDialog}>
                                    <OpenInFullIcon />
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Tooltip title="К проектам">
                            <span>
                                <IconButton onClick={onGoToProjects}>
                                    <DriveFileMoveIcon />
                                </IconButton>
                            </span>
                        </Tooltip>
                    </Stack>
                </Stack>
                <Typography variant="body2" color={textSecondary}>
                    Активных проектов: {activeProjectsCount} из {projectsLimitLabel}.
                </Typography>
                {projectsLoading ? (
                    <Stack direction="row" spacing={1} alignItems="center">
                        <CircularProgress size={18} />
                        <Typography variant="body2">Загружаем проекты…</Typography>
                    </Stack>
                ) : projectPreview.length > 0 ? (
                    <Stack spacing={1}>
                        {projectPreview.map((project) => (
                            <Box
                                key={project._id}
                                sx={{
                                    borderRadius: 1,
                                    p: 1.25,
                                    border: `1px solid ${cardBorder}`,
                                    backgroundColor: isDarkMode
                                        ? 'rgba(12,16,26,0.7)'
                                        : 'rgba(255,255,255,0.7)',
                                }}
                            >
                                <Typography
                                    variant="body2"
                                    fontWeight={600}
                                    sx={{
                                        cursor: 'pointer',
                                        '&:hover': { textDecoration: 'underline' },
                                    }}
                                    onClick={() => onOpenProjectTasks(project)}
                                >
                                    {project.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {project.key} · {project.regionCode || '—'}
                                </Typography>
                            </Box>
                        ))}
                    </Stack>
                ) : (
                    <Typography variant="body2" color={textSecondary}>
                        Проектов пока нет.
                    </Typography>
                )}
                <Stack direction="row" spacing={1} flexWrap="wrap" rowGap={1}>
                    <Button
                        variant="contained"
                        onClick={onOpenDialog}
                        sx={{ borderRadius: buttonRadius, textTransform: 'none' }}
                    >
                        Открыть список
                    </Button>
                    <Tooltip title={creationTooltip} disableHoverListener={!disableCreationActions}>
                        <span>
                            <Button
                                variant="outlined"
                                onClick={onCreateProject}
                                disabled={disableCreationActions}
                                sx={{ borderRadius: buttonRadius, textTransform: 'none' }}
                            >
                                Создать проект
                            </Button>
                        </span>
                    </Tooltip>
                </Stack>
            </Stack>
        </Box>
    );
}
