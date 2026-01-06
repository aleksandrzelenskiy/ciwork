'use client';

import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Box,
} from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import { UI_RADIUS } from '@/config/uiTokens';

const HoverCard = styled(Card)<{ $selected?: boolean }>(
  ({ theme, $selected }) => ({
    borderWidth: 1,
  borderColor: alpha(
    theme.palette.common.white,
    theme.palette.mode === 'dark' ? 0.2 : 0.35
  ),
  borderRadius: UI_RADIUS.surface,
  backgroundColor:
    theme.palette.mode === 'dark'
      ? 'rgba(15, 20, 30, 0.75)'
      : 'rgba(255, 255, 255, 0.9)',
  backdropFilter: 'blur(22px)',
  boxShadow:
    theme.palette.mode === 'dark'
      ? '0 30px 50px rgba(0,0,0,0.45)'
      : '0 35px 55px rgba(15,23,42,0.08)',
    transition:
      'transform 0.35s ease, box-shadow 0.35s ease, border-color 0.35s ease',
    '&:hover': {
      transform: 'translateY(-4px)',
      boxShadow:
        theme.palette.mode === 'dark'
          ? '0 40px 60px rgba(0,0,0,0.6)'
          : '0 45px 65px rgba(15,23,42,0.18)',
      borderColor: theme.palette.primary.main,
    },
    '& .role-card-button': {
      transition: 'all 0.3s ease',
      ...( $selected
        ? {
            backgroundColor: theme.palette.primary.main,
            color: theme.palette.common.white,
          }
        : {
            backgroundColor: 'transparent',
            color: theme.palette.text.primary,
          }),
    },
    '&:hover .role-card-button': {
      backgroundColor: theme.palette.primary.main,
      color: theme.palette.common.white,
      borderColor: theme.palette.primary.main,
    },
  })
);

interface RoleCardProps {
  title: string;
  description: string;
  helperText?: string;
  actionLabel?: string;
  onSelect: () => void;
  disabled?: boolean;
  selected?: boolean;
  icon?: React.ReactNode;
}

export default function RoleCard({
  title,
  description,
  helperText,
  actionLabel = 'Выбрать',
  onSelect,
  disabled,
  selected,
  icon,
}: RoleCardProps) {
  const handleCardClick = () => {
    if (disabled) return;
    onSelect();
  };

  const handleButtonClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (disabled) return;
    onSelect();
  };

  return (
    <HoverCard
      variant='outlined'
      onClick={handleCardClick}
      sx={{
        borderColor: selected ? 'primary.main' : undefined,
        height: '100%',
        maxWidth: 360,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        cursor: disabled ? 'not-allowed' : 'pointer',
        mx: 'auto',
      }}
    >
      <CardContent sx={{ flexGrow: 1, px: 3.5, pt: 3.5 }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: 1.25,
            mb: 1.5,
          }}
        >
          <Box
            sx={(theme) => ({
              fontSize: 42,
              color: selected
                ? theme.palette.primary.main
                : theme.palette.text.secondary,
              transition: 'color 0.3s ease',
              '& svg': {
                fontSize: 42,
                color: 'inherit',
              },
            })}
          >
            {icon}
          </Box>
          <Typography
            variant='h5'
            fontWeight={700}
            sx={{ letterSpacing: 1.2 }}
          >
            {title}
          </Typography>
        </Box>
        <Typography variant='body1' color='text.secondary' sx={{ mb: 1.5 }}>
          {description}
        </Typography>
        {helperText && (
          <Typography variant='body2' color='text.secondary'>
            {helperText}
          </Typography>
        )}
      </CardContent>
      <CardActions sx={{ px: 3.5, pb: 3.5 }}>
        <Button
          variant='outlined'
          onClick={handleButtonClick}
          disabled={disabled}
          fullWidth
          className='role-card-button'
          sx={{
            borderRadius: UI_RADIUS.button,
            fontWeight: 700,
            py: 1,
          }}
        >
          {actionLabel}
        </Button>
      </CardActions>
    </HoverCard>
  );
}
