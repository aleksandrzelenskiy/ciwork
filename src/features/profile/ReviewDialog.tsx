'use client';

import React from 'react';
import {
    Alert,
    Button,
    CircularProgress,
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
    canReview?: boolean;
};

type ReviewItem = {
    id: string;
    rating: number;
    comment: string | null;
    authorName: string;
    createdAt: string;
};

export default function ReviewDialog({
    open,
    onClose,
    targetClerkUserId,
    targetName,
    onSubmitted,
    canReview = true,
}: ReviewDialogProps) {
    const [rating, setRating] = React.useState<number | null>(0);
    const [comment, setComment] = React.useState('');
    const [saving, setSaving] = React.useState(false);
    const [message, setMessage] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [reviews, setReviews] = React.useState<ReviewItem[]>([]);
    const [loadingReviews, setLoadingReviews] = React.useState(false);
    const [reviewsError, setReviewsError] = React.useState<string | null>(null);

    const loadReviews = React.useCallback(async () => {
        if (!targetClerkUserId) return;
        setLoadingReviews(true);
        setReviewsError(null);
        try {
            const res = await fetch(
                `/api/reviews?targetClerkUserId=${encodeURIComponent(targetClerkUserId)}`,
                { cache: 'no-store' }
            );
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setReviewsError(data.error || 'Не удалось загрузить отзывы');
                return;
            }
            setReviews(Array.isArray(data.reviews) ? data.reviews : []);
        } catch (error) {
            setReviewsError(
                error instanceof Error ? error.message : 'Не удалось загрузить отзывы'
            );
        } finally {
            setLoadingReviews(false);
        }
    }, [targetClerkUserId]);

    React.useEffect(() => {
        if (!open) {
            setRating(0);
            setComment('');
            setMessage(null);
            setReviews([]);
            setReviewsError(null);
            return;
        }
        void loadReviews();
    }, [loadReviews, open]);

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
            void loadReviews();
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
            <DialogTitle>Отзывы</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <Stack spacing={1.5}>
                        <Typography variant="subtitle2" color="text.secondary">
                            Опубликованные отзывы
                        </Typography>
                        {loadingReviews && (
                            <Stack direction="row" spacing={1} alignItems="center">
                                <CircularProgress size={18} />
                                <Typography variant="body2" color="text.secondary">
                                    Загружаем отзывы...
                                </Typography>
                            </Stack>
                        )}
                        {!loadingReviews && reviewsError && (
                            <Alert severity="error">{reviewsError}</Alert>
                        )}
                        {!loadingReviews && !reviewsError && reviews.length === 0 && (
                            <Typography variant="body2" color="text.secondary">
                                Отзывов пока нет.
                            </Typography>
                        )}
                        {!loadingReviews && !reviewsError && reviews.length > 0 && (
                            <Stack spacing={1.5}>
                                {reviews.map((review) => {
                                    const reviewDate = new Date(review.createdAt);
                                    return (
                                        <Stack
                                            key={review.id}
                                            spacing={0.5}
                                            sx={(theme) => ({
                                                p: 1.5,
                                                borderRadius: 2,
                                                border: '1px solid',
                                                borderColor: theme.palette.divider,
                                                backgroundColor: theme.palette.background.paper,
                                            })}
                                        >
                                            <Stack
                                                direction="row"
                                                spacing={1}
                                                alignItems="center"
                                                justifyContent="space-between"
                                            >
                                                <Typography
                                                    variant="subtitle2"
                                                    sx={{ fontWeight: 600 }}
                                                >
                                                    {review.authorName || 'Пользователь'}
                                                </Typography>
                                                <Typography
                                                    variant="caption"
                                                    color="text.secondary"
                                                >
                                                    {Number.isNaN(reviewDate.getTime())
                                                        ? ''
                                                        : reviewDate.toLocaleDateString('ru-RU')}
                                                </Typography>
                                            </Stack>
                                            <Rating
                                                value={review.rating}
                                                readOnly
                                                size="small"
                                            />
                                            {review.comment ? (
                                                <Typography variant="body2">
                                                    {review.comment}
                                                </Typography>
                                            ) : (
                                                <Typography
                                                    variant="body2"
                                                    color="text.secondary"
                                                >
                                                    Без комментария.
                                                </Typography>
                                            )}
                                        </Stack>
                                    );
                                })}
                            </Stack>
                        )}
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                        {targetName ? `Оцените пользователя ${targetName}` : 'Оцените пользователя'}
                    </Typography>
                    <Rating
                        value={rating}
                        onChange={(_event, value) => setRating(value)}
                        size="large"
                        readOnly={!canReview}
                    />
                    <TextField
                        label="Комментарий"
                        value={comment}
                        onChange={(event) => setComment(event.target.value)}
                        multiline
                        minRows={3}
                        placeholder="Напишите пару слов о сотрудничестве"
                        disabled={!canReview}
                    />
                    {!canReview && (
                        <Alert severity="info">
                            Оставлять отзыв может только другой пользователь.
                        </Alert>
                    )}
                    {message && <Alert severity={message.type}>{message.text}</Alert>}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Отмена</Button>
                <Button
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={saving || !canReview}
                >
                    {saving ? 'Отправляем...' : 'Отправить'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
