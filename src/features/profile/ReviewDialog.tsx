'use client';

import React from 'react';
import {
    Alert,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Rating,
    Stack,
    TextField,
    Typography,
} from '@mui/material';

type ReviewDialogProps = {
    open: boolean;
    onClose: () => void;
    targetClerkUserId?: string;
    targetName?: string;
    onSubmitted?: () => void;
};

export default function ReviewDialog({
    open,
    onClose,
    targetClerkUserId,
    targetName,
    onSubmitted,
}: ReviewDialogProps) {
    const [rating, setRating] = React.useState<number | null>(0);
    const [comment, setComment] = React.useState('');
    const [saving, setSaving] = React.useState(false);
    const [message, setMessage] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);

    React.useEffect(() => {
        if (!open) {
            setRating(0);
            setComment('');
            setMessage(null);
        }
    }, [open]);

    const handleSubmit = async () => {
        if (!targetClerkUserId) return;
        if (!rating || rating < 1) {
            setMessage({ type: 'error', text: 'Поставьте оценку от 1 до 5.' });
            return;
        }
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch('/api/reviews', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    targetClerkUserId,
                    rating,
                    comment: comment.trim() || null,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setMessage({
                    type: 'error',
                    text: data.error || 'Не удалось отправить отзыв',
                });
                return;
            }
            setMessage({ type: 'success', text: 'Отзыв отправлен.' });
            onSubmitted?.();
            setTimeout(() => {
                onClose();
            }, 600);
        } catch (error) {
            setMessage({
                type: 'error',
                text: error instanceof Error ? error.message : 'Ошибка отправки отзыва',
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>Оставить отзыв</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                        {targetName ? `Оцените пользователя ${targetName}` : 'Оцените пользователя'}
                    </Typography>
                    <Rating
                        value={rating}
                        onChange={(_event, value) => setRating(value)}
                        size="large"
                    />
                    <TextField
                        label="Комментарий"
                        value={comment}
                        onChange={(event) => setComment(event.target.value)}
                        multiline
                        minRows={3}
                        placeholder="Напишите пару слов о сотрудничестве"
                    />
                    {message && <Alert severity={message.type}>{message.text}</Alert>}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Отмена</Button>
                <Button variant="contained" onClick={handleSubmit} disabled={saving}>
                    {saving ? 'Отправляем...' : 'Отправить'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
