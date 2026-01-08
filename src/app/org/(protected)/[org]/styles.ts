import type { Theme } from '@mui/material/styles';

import { UI_RADIUS } from '@/config/uiTokens';

export function getOrgPageStyles(theme: Theme) {
    const isDarkMode = theme.palette.mode === 'dark';
    const surfaceRadius = UI_RADIUS.surface;
    const buttonRadius = UI_RADIUS.button;
    const iconRadius = UI_RADIUS.icon;
    const headerBg = isDarkMode ? 'rgba(11,16,26,0.82)' : 'rgba(255,255,255,0.88)';
    const headerBorder = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.12)';
    const headerShadow = isDarkMode ? '0 35px 90px rgba(0,0,0,0.65)' : '0 35px 90px rgba(15,23,42,0.2)';
    const cardBg = isDarkMode ? 'rgba(13,18,30,0.85)' : 'rgba(255,255,255,0.92)';
    const cardBorder = isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.08)';
    const cardShadow = isDarkMode ? '0 35px 80px rgba(0,0,0,0.55)' : '0 35px 80px rgba(15,23,42,0.15)';
    const textPrimary = isDarkMode ? '#f8fafc' : '#0f172a';
    const textSecondary = isDarkMode ? 'rgba(226,232,240,0.78)' : 'rgba(15,23,42,0.65)';
    const iconBorderColor = isDarkMode ? 'rgba(255,255,255,0.18)' : 'rgba(15,23,42,0.12)';
    const iconBg = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.85)';
    const iconHoverBg = isDarkMode ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.95)';
    const iconShadow = isDarkMode ? '0 6px 20px rgba(0,0,0,0.45)' : '0 6px 20px rgba(15,23,42,0.12)';
    const disabledIconColor = isDarkMode ? 'rgba(148,163,184,0.6)' : 'rgba(148,163,184,0.45)';
    const buttonShadow = isDarkMode ? '0 25px 45px rgba(0,0,0,0.55)' : '0 25px 45px rgba(15,23,42,0.15)';
    const pageWrapperSx = {
        minHeight: '100%',
        py: { xs: 4, md: 6 },
        position: 'relative' as const,
        overflow: 'hidden',
    };
    const panelPadding = { xs: 2, md: 3 };
    const panelBaseSx = {
        borderRadius: surfaceRadius,
        py: panelPadding,
        px: 0,
        backgroundColor: headerBg,
        border: `1px solid ${headerBorder}`,
        boxShadow: headerShadow,
        color: textPrimary,
        backdropFilter: 'blur(26px)',
        position: 'relative' as const,
        overflow: 'hidden',
    };
    const statCardSx = {
        borderRadius: surfaceRadius,
        px: { xs: 2, md: 2.5 },
        py: { xs: 1.25, md: 1.5 },
        border: `1px solid ${cardBorder}`,
        backgroundColor: cardBg,
        boxShadow: cardShadow,
        backdropFilter: 'blur(20px)',
        flex: '1 1 220px',
        minWidth: { xs: '100%', md: 220 },
    };
    const actionButtonBaseSx = {
        borderRadius: buttonRadius,
        textTransform: 'none',
        fontWeight: 600,
        px: { xs: 2.5, md: 3 },
        py: 1,
        boxShadow: buttonShadow,
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: buttonShadow,
        },
        '&:disabled': {
            opacity: 0.55,
            boxShadow: 'none',
        },
    };
    const getAlertSx = (tone: 'error' | 'warning' | 'info') => {
        const palette = {
            error: {
                bg: isDarkMode ? 'rgba(239,68,68,0.12)' : 'rgba(254,242,242,0.95)',
                border: isDarkMode ? 'rgba(248,113,113,0.35)' : 'rgba(239,68,68,0.25)',
            },
            warning: {
                bg: isDarkMode ? 'rgba(251,191,36,0.14)' : 'rgba(255,251,235,0.95)',
                border: isDarkMode ? 'rgba(251,191,36,0.35)' : 'rgba(251,191,36,0.25)',
            },
            info: {
                bg: isDarkMode ? 'rgba(59,130,246,0.12)' : 'rgba(219,234,254,0.9)',
                border: isDarkMode ? 'rgba(59,130,246,0.35)' : 'rgba(59,130,246,0.2)',
            },
        };
        const paletteEntry = palette[tone];
        return {
            borderRadius: buttonRadius,
            border: `1px solid ${paletteEntry.border}`,
            backgroundColor: paletteEntry.bg,
            backdropFilter: 'blur(18px)',
            color: textPrimary,
            '& .MuiAlert-icon': {
                color: paletteEntry.border,
            },
        };
    };
    const cardBaseSx = {
        backdropFilter: 'blur(24px)',
        backgroundColor: cardBg,
        border: `1px solid ${cardBorder}`,
        boxShadow: cardShadow,
        borderRadius: surfaceRadius,
        color: textPrimary,
    };
    const masonryCardSx = {
        ...cardBaseSx,
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: isDarkMode ? '0 40px 90px rgba(0,0,0,0.6)' : '0 40px 90px rgba(15,23,42,0.22)',
        },
    };
    const cardHeaderSx = {
        borderBottom: `1px solid ${cardBorder}`,
        backgroundColor: isDarkMode ? 'rgba(15,18,28,0.72)' : 'rgba(255,255,255,0.9)',
        borderTopLeftRadius: surfaceRadius,
        borderTopRightRadius: surfaceRadius,
    };
    const cardContentSx = {
        backgroundColor: isDarkMode ? 'rgba(12,16,26,0.75)' : 'rgba(247,249,255,0.8)',
        borderBottomLeftRadius: surfaceRadius,
        borderBottomRightRadius: surfaceRadius,
    };
    const masonrySpacing = { xs: 1, sm: 1.5, md: 2, lg: 2, xl: 2 } as const;
    const contentContainerSx = {
        maxWidth: 1200,
        mx: 'auto',
        width: '100%',
        px: {
            xs: `calc(${theme.spacing(masonrySpacing.xs)} / 2)`,
            sm: `calc(${theme.spacing(masonrySpacing.sm)} / 2)`,
            md: `calc(${theme.spacing(masonrySpacing.md)} / 2)`,
            lg: `calc(${theme.spacing(masonrySpacing.lg)} / 2)`,
            xl: `calc(${theme.spacing(masonrySpacing.xl)} / 2)`,
        },
        boxSizing: 'border-box' as const,
    };
    const masonrySx = {
        width: '100%',
        boxSizing: 'border-box' as const,
        '& > *': {
            minWidth: 0,
            boxSizing: 'border-box' as const,
        },
    };

    return {
        isDarkMode,
        surfaceRadius,
        buttonRadius,
        iconRadius,
        headerBg,
        headerBorder,
        headerShadow,
        cardBg,
        cardBorder,
        cardShadow,
        textPrimary,
        textSecondary,
        iconBorderColor,
        iconBg,
        iconHoverBg,
        iconShadow,
        disabledIconColor,
        buttonShadow,
        pageWrapperSx,
        panelPadding,
        panelBaseSx,
        statCardSx,
        actionButtonBaseSx,
        getAlertSx,
        cardBaseSx,
        masonryCardSx,
        cardHeaderSx,
        cardContentSx,
        contentContainerSx,
        masonrySpacing,
        masonrySx,
    };
}
