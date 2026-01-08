// src/app/ClientApp.tsx
'use client';

import React, {
  useState,
  useMemo,
  useEffect,
} from 'react';
import { useUser } from '@clerk/nextjs';
import type { ProfileType } from '@/server/models/UserModel';
import {
    Box,
    CssBaseline,
    Drawer,
    Toolbar,
    AppBar,
    Typography,
    ThemeProvider,
    createTheme,
    CircularProgress,
    IconButton,
    Menu as MuiMenu,
    Divider,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    List,
    ListItem,
    ListItemText,
    Button,
} from '@mui/material';
import { Menu as MenuIcon } from '@mui/icons-material';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import Badge from '@mui/material/Badge'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import { useRouter, usePathname } from 'next/navigation';
import { fetchUserContext } from '@/app/utils/userContext';
import NavigationMenu from '@/features/shared/NavigationMenu';
import NotificationBell from '@/features/messenger/NotificationBell';
import MessengerTrigger from '@/features/messenger/MessengerTrigger';
import RubleAmount from '@/features/shared/RubleAmount';
import dayjs from 'dayjs';
import { UI_RADIUS } from '@/config/uiTokens';

export default function ClientApp({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<'light' | 'dark'>('light');
  const [profileSetupCompleted, setProfileSetupCompleted] = useState<boolean | null>(null);
  const [profileType, setProfileType] = useState<ProfileType | null>(null);
  const [walletAnchor, setWalletAnchor] = useState<null | HTMLElement>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [walletInfo, setWalletInfo] = useState<{
      balance: number;
      bonusBalance: number;
      total: number;
      currency: string;
  } | null>(null);
  const [transactionsOpen, setTransactionsOpen] = useState(false);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<
      Array<{
          id: string;
          amount: number;
          type: 'credit' | 'debit';
          source: string;
          createdAt?: string | Date;
          balanceAfter?: number;
          bonusBalanceAfter?: number;
      }>
  >([]);

  const router = useRouter();
  const pathname = usePathname();
  const isOnboardingRoute = pathname === '/onboarding';

  useEffect(() => {
    const fetchUserRole = async () => {
      const data = await fetchUserContext();
      if (data) {
        const userPayload = (data.user ?? {}) as {
          profileSetupCompleted?: boolean;
          profileType?: ProfileType;
        };
        const resolvedProfileType: ProfileType | null =
          data.profileType ??
          (typeof userPayload.profileType === 'string'
            ? userPayload.profileType
            : null);
        const setupCompleted =
          typeof data.profileSetupCompleted !== 'undefined'
            ? data.profileSetupCompleted
            : userPayload.profileSetupCompleted;

        const normalizedSetupCompleted =
          typeof setupCompleted === 'boolean' ? setupCompleted : null;

        setProfileSetupCompleted(normalizedSetupCompleted);
        setProfileType(resolvedProfileType ?? null);
        const onboardingCompleteRedirect =
          resolvedProfileType === 'employer' ? '/org/new' : '/';

        if (normalizedSetupCompleted === false && pathname !== '/onboarding') {
          router.replace('/onboarding');
        }
        if (normalizedSetupCompleted === true && pathname === '/onboarding') {
          router.replace(onboardingCompleteRedirect);
        }
      } else {
        setProfileSetupCompleted(null);
        setProfileType(null);
      }
    };

    void fetchUserRole();
  }, [router, pathname]);

  // Инициализация темы из localStorage
  useEffect(() => {
    const storedMode = localStorage.getItem('themeMode') as
      | 'light'
      | 'dark'
      | null;
    if (storedMode) {
      setMode(storedMode);
    } else {
      // Опционально: определение системных предпочтений
      const prefersDark =
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches;
      setMode(prefersDark ? 'dark' : 'light');
    }
  }, []);

  // Обновление localStorage при изменении режима + data-атрибут для глобальных стилей
  useEffect(() => {
    localStorage.setItem('themeMode', mode);
  }, [mode]);

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          background: {
            default: mode === 'dark' ? '#1e1e1e' : '#f5f5f5',
          },
        },
        components: {
          MuiPaper: {
            styleOverrides: {
              root: {
                borderRadius: UI_RADIUS.surface,
              },
            },
          },
          MuiCard: {
            styleOverrides: {
              root: {
                borderRadius: UI_RADIUS.surface,
              },
            },
          },
          MuiDialog: {
            styleOverrides: {
              paper: {
                borderRadius: UI_RADIUS.surface,
              },
            },
          },
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: UI_RADIUS.button,
                textTransform: 'none',
                fontWeight: 600,
              },
            },
          },
          MuiIconButton: {
            styleOverrides: {
              root: {
                borderRadius: UI_RADIUS.icon,
              },
            },
          },
          MuiOutlinedInput: {
            styleOverrides: {
              root: {
                borderRadius: UI_RADIUS.input,
              },
            },
          },
          MuiAppBar: {
            styleOverrides: {
              root: {
                borderRadius: UI_RADIUS.none,
              },
            },
          },
          MuiDrawer: {
            styleOverrides: {
              paper: {
                borderRadius: UI_RADIUS.none,
              },
            },
          },
        },
      }),
    [mode]
  );

  const toggleTheme = () =>
    setMode((prev) => (prev === 'light' ? 'dark' : 'light'));

  const backgroundGradient =
    mode === 'dark'
      ? 'linear-gradient(135deg, #0b0d11 0%, #151b24 60%, #0c1017 100%)'
      : 'linear-gradient(135deg, #f6f7fa 0%, #e8ecf4 50%, #f5f7fb 100%)';

  const isDarkMode = mode === 'dark';
  const appBarBg = isDarkMode ? 'rgba(12, 14, 20, 0.78)' : 'rgba(255,255,255,0.82)';
  const appBarBorder = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
  const appBarShadow = isDarkMode ? '0 18px 40px rgba(0,0,0,0.45)' : '0 20px 45px rgba(15,23,42,0.12)';
  const appBarText = isDarkMode ? '#f5f7ff' : '#080c1a';

  const [open, setOpen] = useState(false);

  const handleToggleDrawer = () => {
    setOpen((prev) => !prev);
  };

  const handleNavigation = (path: string) => {
    router.push(path);
    setOpen(false);
  };

  const DrawerList = (
    <NavigationMenu onNavigateAction={handleNavigation} />
  );

  const currentYear = new Date().getFullYear();
  const appBarIconSize = 42;
  const appBarIconGap = 0.9;
  const toolbarIconButtonSx = {
      borderRadius: UI_RADIUS.icon,
      border: `1px solid ${appBarBorder}`,
      backdropFilter: 'blur(6px)',
      width: appBarIconSize,
      height: appBarIconSize,
      padding: 0.65,
  } as const;

  const normalizeCurrency = (currency?: string) => (currency ?? 'RUB').toUpperCase();

  const formatForeignCurrency = (value: number, currency?: string) =>
      new Intl.NumberFormat('ru-RU', {
          style: 'currency',
          currency: normalizeCurrency(currency),
          maximumFractionDigits: 0,
      }).format(Math.max(0, Math.round(value)));

  const walletMenuOpen = Boolean(walletAnchor);
  const walletCurrency = normalizeCurrency(walletInfo?.currency);
  const isWalletRuble = walletCurrency === 'RUB';
  const isContractor = profileType === 'contractor';

  type WalletResponse =
      | { balance: number; bonusBalance: number; total: number; currency?: string }
      | { error: string };

  const isWalletPayload = (payload: WalletResponse | null): payload is Extract<WalletResponse, { balance: number }> =>
      !!payload && 'balance' in payload;

  const loadWalletInfo = async () => {
      setWalletLoading(true);
      setWalletError(null);
      const res = await fetch('/api/wallet/me', { cache: 'no-store' });
      const data = (await res.json().catch(() => null)) as WalletResponse | null;
      if (!res.ok || !data || !isWalletPayload(data)) {
          setWalletInfo(null);
          setWalletError(
              data && 'error' in data ? data.error : 'Не удалось загрузить кошелёк',
          );
          setWalletLoading(false);
          return;
      }
      setWalletInfo({
          balance: data.balance,
          bonusBalance: data.bonusBalance,
          total: data.total,
          currency: normalizeCurrency(data.currency),
      });
      setWalletLoading(false);
  };

  const handleWalletClick = (event: React.MouseEvent<HTMLElement>) => {
      setWalletAnchor(event.currentTarget);
      void loadWalletInfo();
  };

  const handleWalletClose = () => {
      setWalletAnchor(null);
  };

  const handleOpenTransactions = async () => {
      setTransactionsOpen(true);
      setTransactionsLoading(true);
      setTransactionsError(null);
      const res = await fetch('/api/wallet/transactions?limit=20', { cache: 'no-store' });
      const data = (await res.json().catch(() => null)) as
          | {
              wallet?: { balance: number; bonusBalance: number; total: number; currency?: string };
              transactions?: Array<{
                  id: string;
                  amount: number;
                  type: 'credit' | 'debit';
                  source: string;
                  createdAt?: string;
                  balanceAfter?: number;
                  bonusBalanceAfter?: number;
              }>;
              error?: string;
          }
          | null;
      if (!res.ok || !data || 'error' in (data ?? {}) || !data) {
          setTransactions([]);
          setTransactionsError((data as { error?: string })?.error ?? 'Не удалось загрузить транзакции');
          setTransactionsLoading(false);
          return;
      }

      setTransactions(data.transactions ?? []);
      if (data.wallet) {
          setWalletInfo({
              balance: data.wallet.balance ?? 0,
              bonusBalance: data.wallet.bonusBalance ?? 0,
              total: data.wallet.total ?? 0,
              currency: normalizeCurrency(data.wallet.currency),
          });
      }
      setTransactionsLoading(false);
  };

  const handleCloseTransactions = () => {
      setTransactionsOpen(false);
  };

  // Получаем состояние пользователя из Clerk
  const { isLoaded, isSignedIn } = useUser();

  if (!isLoaded) {
    // Отображаем индикатор загрузки пока состояние аутентификации не загружено
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          width: '100vw',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  const onboardingContent = (
    <Box
      component='main'
      sx={{
        flexGrow: 1,
        bgcolor: 'transparent',
        color: 'text.primary',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
      }}
    >
      {children}
    </Box>
  );

  const blockingScreen = (
    <Box
      component='main'
      sx={{
        flexGrow: 1,
        bgcolor: 'transparent',
        color: 'text.primary',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        width: '100vw',
      }}
    >
      <CircularProgress />
    </Box>
  );

  return (
    <ThemeProvider theme={theme}>
      <Box
        sx={{
          position: 'relative',
          minHeight: '100vh',
          backgroundImage: backgroundGradient,
          backgroundAttachment: 'fixed',
          backgroundSize: 'cover',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: -80,
            right: -60,
            width: 240,
            height: 240,
            bgcolor: (theme) => theme.palette.primary.main,
            opacity: 0.25,
            filter: 'blur(120px)',
            zIndex: 0,
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            bottom: -120,
            left: -40,
            width: 260,
            height: 260,
            bgcolor: (theme) => theme.palette.secondary.main,
            opacity: 0.18,
            filter: 'blur(130px)',
            zIndex: 0,
          }}
        />
        <Box
          sx={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            minHeight: '100vh',
            flexDirection: 'column',
            backgroundColor: 'transparent',
          }}
        >
          <CssBaseline />
        {isSignedIn ? (
          isOnboardingRoute
            ? onboardingContent
            : profileSetupCompleted
            ? (
              <>
                {/* AppBar */}
                <AppBar
                  position='fixed'
                  elevation={0}
                  color='transparent'
                  sx={{
                    backgroundColor: appBarBg,
                    backdropFilter: 'blur(24px)',
                    borderBottom: `1px solid ${appBarBorder}`,
                    boxShadow: appBarShadow,
                    color: appBarText,
                  }}
                >
                  <Toolbar
                    sx={{
                        gap: appBarIconGap,
                        minHeight: 70,
                        px: 2,
                    }}
                  >
                    <IconButton
                      onClick={handleToggleDrawer}
                      edge='start'
                      color='inherit'
                      sx={{
                          ...toolbarIconButtonSx,
                          mr: 0.5,
                      }}
                    >
                      <MenuIcon fontSize='small' />
                    </IconButton>
                    <Box
                      sx={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}
                    >
                      <Badge
                        badgeContent={`Pro`}
                        color='primary'
                        anchorOrigin={{
                          vertical: 'top',
                          horizontal: 'right',
                        }}
                      >
                        <Typography variant='h6'>CI Work</Typography>
                      </Badge>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: appBarIconGap }}>
                      <IconButton
                        onClick={toggleTheme}
                        color='inherit'
                        sx={toolbarIconButtonSx}
                        aria-label='Переключить тему'
                      >
                        {mode === 'dark' ? (
                          <WbSunnyIcon fontSize='small' />
                        ) : (
                          <DarkModeIcon fontSize='small' />
                        )}
                      </IconButton>
                      <MessengerTrigger buttonSx={toolbarIconButtonSx} />
                      {isContractor ? (
                        <IconButton
                          color='inherit'
                          sx={toolbarIconButtonSx}
                          aria-label='Баланс'
                          onClick={handleWalletClick}
                        >
                          <AccountBalanceWalletIcon fontSize='small' />
                        </IconButton>
                      ) : null}
                      <NotificationBell buttonSx={toolbarIconButtonSx} />
                    </Box>
                  </Toolbar>
                </AppBar>
                {isContractor ? (
                  <>
                    <MuiMenu
                      anchorEl={walletAnchor}
                      open={walletMenuOpen}
                      onClose={handleWalletClose}
                      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                      slotProps={{
                        paper: {
                          sx: {
                            minWidth: 280,
                            p: 2,
                            border: `1px solid ${appBarBorder}`,
                            boxShadow: appBarShadow,
                            borderRadius: UI_RADIUS.tooltip,
                            backdropFilter: 'blur(18px)',
                            background: isDarkMode
                              ? 'linear-gradient(145deg, rgba(17,20,28,0.96), rgba(12,15,23,0.92))'
                              : 'linear-gradient(145deg, rgba(255,255,255,0.98), rgba(239,244,255,0.96))',
                          },
                        },
                      }}
                    >
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <Typography variant='subtitle1' sx={{ letterSpacing: '0.02em', fontWeight: 700 }}>
                            Баланс
                          </Typography>
                          <Typography
                            variant='caption'
                            color='text.secondary'
                            sx={{ textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.08em' }}
                          >
                            {walletCurrency}
                          </Typography>
                        </Box>
                        {walletLoading ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CircularProgress size={18} />
                            <Typography variant='body2'>Загрузка…</Typography>
                          </Box>
                        ) : walletError ? (
                          <Typography variant='body2' color='error'>
                            {walletError}
                          </Typography>
                        ) : walletInfo ? (
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            {isWalletRuble ? (
                              <RubleAmount
                                value={walletInfo.total ?? 0}
                                variant='h4'
                                fontWeight={800}
                                iconSize={22}
                              />
                            ) : (
                              <Typography variant='h4' sx={{ lineHeight: 1.1, fontWeight: 700 }}>
                                {formatForeignCurrency(walletInfo.total ?? 0, walletCurrency)}
                              </Typography>
                            )}
                            <Typography variant='caption' color='text.secondary' sx={{ letterSpacing: '0.03em' }}>
                              Основной баланс
                            </Typography>
                          </Box>
                        ) : null}
                        <Divider sx={{ opacity: 0.7 }} />
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}>
                          <Button
                            variant='contained'
                            size='small'
                            fullWidth
                            onClick={() => {
                              handleWalletClose();
                              void handleOpenTransactions();
                            }}
                          >
                            Транзакции
                          </Button>
                          <Button
                            variant='outlined'
                            size='small'
                            fullWidth
                            onClick={() =>
                              setWalletError((prev) => prev ?? 'Пополнение скоро будет доступно')
                            }
                          >
                            Пополнить
                          </Button>
                        </Box>
                      </Box>
                    </MuiMenu>
                    <Dialog
                      open={transactionsOpen}
                      onClose={handleCloseTransactions}
                      fullWidth
                      maxWidth='sm'
                    >
                      <DialogTitle>Транзакции баланса</DialogTitle>
                      <DialogContent dividers>
                        {transactionsLoading ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
                            <CircularProgress size={18} />
                            <Typography variant='body2'>Загрузка…</Typography>
                          </Box>
                        ) : transactionsError ? (
                          <Typography color='error'>{transactionsError}</Typography>
                        ) : transactions.length === 0 ? (
                          <Typography variant='body2'>Нет транзакций.</Typography>
                        ) : (
                          <List>
                            {transactions.map((tx) => {
                              const amount = Math.abs(tx.amount ?? 0);
                              const amountColor = tx.type === 'credit' ? 'success.main' : 'error.main';
                              const amountSign = tx.type === 'credit' ? 'positive' : 'negative';
                              const ts =
                                tx.createdAt && dayjs(tx.createdAt).isValid()
                                  ? dayjs(tx.createdAt).format('DD.MM.YYYY HH:mm')
                                  : '';
                              return (
                                <ListItem
                                  key={tx.id}
                                  divider
                                  sx={{ alignItems: 'flex-start', gap: 1 }}
                                >
                                  <ListItemText
                                    primary={
                                      <Box
                                        sx={{
                                          display: 'flex',
                                          justifyContent: 'space-between',
                                          gap: 1,
                                          alignItems: 'center',
                                        }}
                                      >
                                        <Typography
                                          variant='body1'
                                          color={amountColor}
                                          sx={{ display: 'inline-flex', alignItems: 'baseline', gap: 0.25 }}
                                        >
                                          {isWalletRuble ? (
                                            <RubleAmount
                                              value={amount}
                                              sign={amountSign}
                                              variant='body1'
                                              color='inherit'
                                              fontWeight={600}
                                              iconSize={16}
                                            />
                                          ) : (
                                            `${amountSign === 'positive' ? '+ ' : '- '}${formatForeignCurrency(amount, walletCurrency)}`
                                          )}
                                        </Typography>
                                        <Typography variant='caption' color='text.secondary'>
                                          {ts}
                                        </Typography>
                                      </Box>
                                    }
                                    secondary={
                                      <Typography variant='body2' color='text.secondary'>
                                        {tx.source}
                                      </Typography>
                                    }
                                  />
                                </ListItem>
                              );
                            })}
                          </List>
                        )}
                      </DialogContent>
                      <DialogActions>
                        <Button onClick={handleCloseTransactions}>Закрыть</Button>
                      </DialogActions>
                    </Dialog>
                  </>
                ) : null}
                {/* Sidebar Drawer */}
                <Drawer
                  open={open}
                  onClose={handleToggleDrawer}
                  slotProps={{
                    paper: {
                      sx: {
                        width: 260,
                        height: '100vh',
                        backgroundColor: isDarkMode ? 'rgba(12,14,20,0.9)' : 'rgba(255,255,255,0.9)',
                        borderRight: `1px solid ${appBarBorder}`,
                        backdropFilter: 'blur(28px)',
                        boxShadow: appBarShadow,
                      },
                    },
                  }}
                >
                  {DrawerList}
                </Drawer>
                {/* Основное содержимое */}
                <Box
                  component='main'
                  sx={{
                    flexGrow: 1,
                    bgcolor: 'transparent',
                    color: 'text.primary',
                    p: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'auto',
                  }}
                >
                  <Toolbar />
                  <Box sx={{ flexGrow: 1 }}>{children}</Box>
                  {/* Футер */}
                  <Box
                    component='footer'
                    sx={{
                      p: 2,
                      textAlign: 'center',
                      borderTop: `1px solid ${theme.palette.divider}`,
                      mt: 2,
                    }}
                  >
                    © CI Work {currentYear}
                  </Box>
                </Box>
              </>
              )
            : blockingScreen
        ) : (
          <Box
            component='main'
            sx={{
              flexGrow: 1,
              bgcolor: 'transparent',
              color: 'text.primary',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100vh',
              width: '100vw',
              padding: 0,
              overflowY: 'auto',
            }}
          >
            {children}
          </Box>
        )}
      </Box>
    </Box>
    </ThemeProvider>
  );
}
