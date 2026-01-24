//app/workspace/components/TaskContextMenu.tsx

'use client';

import React from 'react';
import {
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
    Divider,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { UI_RADIUS } from '@/config/uiTokens';
import { useI18n } from '@/i18n/I18nProvider';

type Props = {
    anchorPosition: { top: number; left: number } | null;
    onClose: () => void;
    onOpenTask?: () => void;
    onEditTask?: () => void;
    onDeleteTask?: () => void;
};

export default function TaskContextMenu({
    anchorPosition,
    onClose,
    onOpenTask,
    onEditTask,
    onDeleteTask,
}: Props) {
    const { t } = useI18n();
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const menuBg = isDark ? 'rgba(12,16,26,0.95)' : 'rgba(255,255,255,0.96)';
    const menuBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
    const menuShadow = isDark ? '0 30px 70px rgba(0,0,0,0.65)' : '0 20px 50px rgba(15,23,42,0.12)';
    const hoverBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)';
    const textColor = isDark ? '#e5e7eb' : 'inherit';

    return (
        <Menu
            open={!!anchorPosition}
            onClose={onClose}
            anchorReference="anchorPosition"
            anchorPosition={anchorPosition ?? undefined}
            slotProps={{
                paper: {
                    sx: {
                        minWidth: 180,
                        borderRadius: UI_RADIUS.compact,
                        backgroundColor: menuBg,
                        border: `1px solid ${menuBorder}`,
                        boxShadow: menuShadow,
                        backdropFilter: 'blur(10px)',
                    },
                },
            }}
        >
            <MenuItem
                onClick={() => {
                    onOpenTask?.();
                    onClose();
                }}
                sx={{ color: textColor, '&:hover': { backgroundColor: hoverBg } }}
            >
                <ListItemIcon>
                    <OpenInNewIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={t('common.open', 'Открыть')} />
            </MenuItem>

            <MenuItem
                onClick={() => {
                    onEditTask?.();
                    onClose();
                }}
                sx={{ color: textColor, '&:hover': { backgroundColor: hoverBg } }}
            >
                <ListItemIcon>
                    <EditIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={t('common.edit', 'Редактировать')} />
            </MenuItem>

            <Divider sx={{ borderColor: menuBorder }} />

            <MenuItem
                onClick={() => {
                    onDeleteTask?.();
                    onClose();
                }}
                sx={{
                    color: 'error.main',
                    '&:hover': { backgroundColor: hoverBg },
                }}
            >
                <ListItemIcon>
                    <DeleteOutlineIcon fontSize="small" color="error" />
                </ListItemIcon>
                <ListItemText primary={t('common.delete', 'Удалить')} />
            </MenuItem>
        </Menu>
    );
}
