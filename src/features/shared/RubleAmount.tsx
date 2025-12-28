'use client';

import CurrencyRubleRounded from '@mui/icons-material/CurrencyRubleRounded';
import { Box, Typography, type SxProps, type Theme, type TypographyProps } from '@mui/material';

export const formatRubleValue = (value: number) =>
    new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.max(0, Math.round(value)));

type RubleAmountProps = {
    value: number;
    variant?: TypographyProps['variant'];
    color?: TypographyProps['color'];
    sign?: 'positive' | 'negative';
    iconSize?: number;
    fontWeight?: TypographyProps['fontWeight'];
    sx?: SxProps<Theme>;
};

export default function RubleAmount({
    value,
    variant = 'body1',
    color = 'inherit',
    sign,
    iconSize = 18,
    fontWeight = 700,
    sx,
}: RubleAmountProps) {
    const formatted = formatRubleValue(value);
    const prefix = sign === 'positive' ? '+ ' : sign === 'negative' ? '- ' : '';

    return (
        <Box
            sx={{
                display: 'inline-flex',
                alignItems: 'baseline',
                gap: 0.35,
                lineHeight: 1,
                ...sx,
            }}
        >
            <Typography
                variant={variant}
                color={color}
                sx={{
                    fontWeight,
                    lineHeight: 1.1,
                }}
            >
                {`${prefix}${formatted}`}
            </Typography>
            <CurrencyRubleRounded
                sx={{
                    fontSize: iconSize,
                    color: 'inherit',
                    transform: 'translateY(1px)',
                }}
            />
        </Box>
    );
}
