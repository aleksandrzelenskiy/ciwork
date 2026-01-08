'use client';

import * as React from 'react';
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    Stack,
    Tooltip,
    Typography,
} from '@mui/material';
import { DataGrid, GridColDef, GridRowId } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FullscreenRoundedIcon from '@mui/icons-material/FullscreenRounded';
import FullscreenExitRoundedIcon from '@mui/icons-material/FullscreenExitRounded';
import { useTheme } from '@mui/material/styles';
import type { ParsedWorkItem } from '@/app/workspace/components/T2/T2EstimateParser';
import { UI_RADIUS } from '@/config/uiTokens';

type WorkItemRow = {
    id: GridRowId;
    workType: string;
    quantity: string | number;
    unit: string;
    note: string;
};

type Props = {
    open: boolean;
    initialItems?: ParsedWorkItem[];
    onClose: () => void;
    onSave: (items: ParsedWorkItem[]) => void;
};

const createEmptyRow = (): WorkItemRow => ({
    id: `row-${
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : Math.random().toString(16).slice(2)
    }`,
    workType: '',
    quantity: '',
    unit: '',
    note: '',
});

function normalizeRows(items?: ParsedWorkItem[]): WorkItemRow[] {
    if (!items || !items.length) {
        return [createEmptyRow()];
    }

    return items.map((item, idx) => ({
        id: `row-${idx}-${Math.random().toString(16).slice(2)}`,
        workType: item.workType ?? '',
        quantity: String(item.quantity ?? ''),
        unit: item.unit ?? '',
        note: item.note ?? '',
    }));
}

function toWorkItems(rows: WorkItemRow[]): ParsedWorkItem[] {
    return rows
        .map((row) => ({
            workType: row.workType.trim(),
            unit: row.unit.trim(),
            quantity: Number(row.quantity),
            note: row.note.trim() || undefined,
        }))
        .filter(
            (item) =>
                item.workType &&
                item.unit &&
                Number.isFinite(item.quantity) &&
                item.quantity >= 0
        );
}

export default function WorkItemsEditorDialog({
                                                   open,
                                                   initialItems,
                                                   onClose,
                                                   onSave,
                                               }: Props) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const dialogBg = isDark
        ? 'linear-gradient(180deg, rgba(11,14,22,0.95), rgba(15,20,32,0.94))'
        : 'linear-gradient(180deg, rgba(250,252,255,0.95), rgba(237,242,248,0.92))';
    const dialogBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(148,163,184,0.25)';
    const dialogShadow = isDark ? '0 40px 90px rgba(0,0,0,0.75)' : '0 30px 80px rgba(15,23,42,0.28)';
    const gridBg = isDark ? 'rgba(16,21,32,0.95)' : 'rgba(255,255,255,0.9)';
    const gridBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(148,163,184,0.35)';
    const gridHeaderBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(241,245,249,0.9)';
    const gridHover = isDark ? 'rgba(59,130,246,0.18)' : 'rgba(59,130,246,0.08)';

    const [rows, setRows] = React.useState<WorkItemRow[]>(() => normalizeRows(initialItems));
    const [isFullscreen, setIsFullscreen] = React.useState(false);

    React.useEffect(() => {
        if (open) {
            setRows(normalizeRows(initialItems));
        }
    }, [open, initialItems]);

    const handleDeleteRow = React.useCallback(
        (id: GridRowId) => {
            setRows((prev) => {
                if (prev.length <= 1) return prev;
                return prev.filter((row) => row.id !== id);
            });
        },
        []
    );

    const columns = React.useMemo<GridColDef<WorkItemRow>[]>(
        () => [
            {
                field: 'index',
                headerName: '№',
                width: 70,
                sortable: false,
                filterable: false,
                disableColumnMenu: true,
                renderCell: (params) => (
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {rows.findIndex((r) => r.id === params.id) + 1}
                    </Typography>
                ),
            },
            {
                field: 'workType',
                headerName: 'Вид работ',
                flex: 1.4,
                minWidth: 180,
                editable: true,
            },
            {
                field: 'quantity',
                headerName: 'Кол-во',
                type: 'number',
                width: 120,
                editable: true,
            },
            {
                field: 'unit',
                headerName: 'Ед.',
                width: 120,
                editable: true,
            },
            {
                field: 'note',
                headerName: 'Примечание',
                flex: 1,
                minWidth: 200,
                editable: true,
            },
            {
                field: 'actions',
                headerName: '',
                width: 70,
                sortable: false,
                filterable: false,
                disableColumnMenu: true,
                renderCell: (params) => (
                    <Tooltip title="Удалить строку">
                        <span>
                            <IconButton
                                size="small"
                                color="error"
                                disabled={rows.length <= 1}
                                onClick={() => handleDeleteRow(params.id)}
                            >
                                <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                ),
            },
        ],
        [rows, handleDeleteRow]
    );

    const handleRowChange = React.useCallback((updatedRow: WorkItemRow) => {
        setRows((prev) => prev.map((row) => (row.id === updatedRow.id ? updatedRow : row)));
        return updatedRow;
    }, []);

    const handleAddRow = () => setRows((prev) => [...prev, createEmptyRow()]);

    const handleSave = () => {
        onSave(toWorkItems(rows));
    };

    const handleClose = () => {
        setIsFullscreen(false);
        onClose();
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="lg"
            fullWidth
            fullScreen={isFullscreen}
            PaperProps={{
                sx: {
                    borderRadius: isFullscreen ? UI_RADIUS.none : UI_RADIUS.surface,
                    background: dialogBg,
                    boxShadow: isFullscreen ? '0 0 0 rgba(0,0,0,0)' : dialogShadow,
                    border: `1px solid ${dialogBorder}`,
                    backdropFilter: 'blur(18px)',
                },
            }}
        >
            <DialogTitle
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    pr: 1.5,
                    pb: 1,
                }}
            >
                <Stack spacing={0.5}>
                    <Typography variant="h6" fontWeight={700}>
                        Состав работ
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Заполните позиции так же просто, как в Excel
                    </Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                    <Tooltip title={isFullscreen ? 'Свернуть' : 'На весь экран'}>
                        <IconButton onClick={() => setIsFullscreen((prev) => !prev)} size="small">
                            {isFullscreen ? (
                                <FullscreenExitRoundedIcon />
                            ) : (
                                <FullscreenRoundedIcon />
                            )}
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Добавить строку">
                        <IconButton onClick={handleAddRow} size="small">
                            <AddIcon />
                        </IconButton>
                    </Tooltip>
                </Stack>
            </DialogTitle>

            <DialogContent sx={{ pt: 0.5 }}>
                <Box
                    sx={{
                        borderRadius: UI_RADIUS.tooltip,
                        overflow: 'hidden',
                        border: `1px solid ${gridBorder}`,
                        boxShadow: isFullscreen
                            ? '0 10px 30px rgba(0,0,0,0.45)'
                            : '0 25px 60px rgba(15,23,42,0.2)',
                        backgroundColor: gridBg,
                    }}
                >
                    <DataGrid
                        autoHeight
                        density="comfortable"
                        disableRowSelectionOnClick
                        rows={rows}
                        columns={columns}
                        processRowUpdate={handleRowChange}
                        onProcessRowUpdateError={(err) => console.error(err)}
                        hideFooter
                        sx={{
                            '& .MuiDataGrid-columnHeaders': {
                                backgroundColor: gridHeaderBg,
                                backdropFilter: 'blur(8px)',
                                borderBottom: `1px solid ${gridBorder}`,
                            },
                            '& .MuiDataGrid-cell': {
                                borderColor: gridBorder,
                            },
                            '& .MuiDataGrid-row:hover': {
                                backgroundColor: gridHover,
                            },
                            '& .MuiDataGrid-withBorderColor': {
                                borderColor: gridBorder,
                            },
                            '& .MuiDataGrid-footerContainer': {
                                borderTop: `1px solid ${gridBorder}`,
                                backgroundColor: gridHeaderBg,
                            },
                        }}
                    />
                </Box>
            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
                <Button onClick={handleClose} color="inherit">
                    Отменить
                </Button>
                <Button
                    variant="contained"
                    onClick={handleSave}
                    sx={{
                        borderRadius: UI_RADIUS.item,
                        boxShadow: '0 20px 45px rgba(59,130,246,0.35)',
                        textTransform: 'none',
                    }}
                >
                    Сохранить
                </Button>
            </DialogActions>
        </Dialog>
    );
}
