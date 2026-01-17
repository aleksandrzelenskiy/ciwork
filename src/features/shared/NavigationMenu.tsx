'use client';

import React, { useEffect, useState } from 'react';
import {
    Avatar,
    Box,
    Button,
    Collapse,
    CircularProgress,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { usePathname } from 'next/navigation';
import HomeIcon from '@mui/icons-material/Home';
import TaskIcon from '@mui/icons-material/Task';
import PermMediaIcon from '@mui/icons-material/PermMedia';
import PlaceIcon from '@mui/icons-material/Place';
import LogoutIcon from '@mui/icons-material/Logout';
import FolderIcon from '@mui/icons-material/Folder';
import BusinessIcon from '@mui/icons-material/Business';
import StoreIcon from '@mui/icons-material/Store';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import { useClerk, useUser } from '@clerk/nextjs';
import type { UserResource } from '@clerk/types';
import {
    fetchUserContext,
    type UserContextResponse,
    resolveRoleFromContext,
} from '@/app/utils/userContext';
import { MANAGER_ROLES } from '@/app/types/roles';
import { withBasePath } from '@/utils/basePath';

type NavigationMenuProps = {
    onNavigateAction: (path: string) => void;
};

type NavChildItem = {
    label: string;
    path: string;
    secondary?: string;
};

type NavItem = {
    label: string;
    path: string;
    icon: React.ReactNode;
    children?: NavChildItem[];
};

type ManagerProjectLink = {
    orgSlug: string;
    orgName: string;
    projectKey: string;
    projectName: string;
};

type ManagerOrgLink = {
    orgSlug: string;
    orgName: string;
};

const BASE_NAV_ITEMS: NavItem[] = [
    { label: 'ГЛАВНАЯ', path: '/', icon: <HomeIcon sx={{ fontSize: 20 }} /> },
    // {
    //     label: 'ФОТООТЧЕТЫ',
    //     path: '/reports',
    //     icon: <PermMediaIcon sx={{ fontSize: 20 }} />,
    // },
];

type DbUserPayload = {
    name?: string;
    fullName?: string;
    email?: string;
    profilePic?: string;
    profileType?: string;
};

export default function NavigationMenu({ onNavigateAction }: NavigationMenuProps) {
    const { user } = useUser();
    const { signOut } = useClerk();
    const pathname = usePathname() ?? '';
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === 'dark';
    const [userContextLoading, setUserContextLoading] = useState(true);
    const [managerNavLoading, setManagerNavLoading] = useState(false);
    const [userContext, setUserContext] = useState<UserContextResponse | null>(
        null
    );
    const [managerProjects, setManagerProjects] = useState<ManagerProjectLink[]>(
        []
    );
    const [managerOrgs, setManagerOrgs] = useState<ManagerOrgLink[]>([]);
    const [managerOrgSlug, setManagerOrgSlug] = useState<string | null>(null);
    const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>(
        {}
    );

    useEffect(() => {
        let isMounted = true;
        const loadUserContext = async () => {
            setUserContextLoading(true);
            const context = await fetchUserContext();
            if (isMounted) {
                setUserContext(context);
                setUserContextLoading(false);
            }
        };

        void loadUserContext();
        return () => {
            isMounted = false;
        };
    }, []);

    const normalizeEmail = (value?: string | null) =>
        typeof value === 'string' ? value.trim().toLowerCase() : '';

    useEffect(() => {
        let isMounted = true;

        const loadManagerProjects = async () => {
            if (userContextLoading) return;
            const effectiveRoleLocal = resolveRoleFromContext(userContext);
            const isSuperAdmin = effectiveRoleLocal === 'super_admin';
            const isOwnerLike =
                effectiveRoleLocal === 'owner' || effectiveRoleLocal === 'org_admin';
            const isManagerRoleLocal = effectiveRoleLocal
                ? MANAGER_ROLES.includes(effectiveRoleLocal)
                : false;
            const profileType =
                (userContext?.profileType ??
                    (userContext?.user as { profileType?: string })?.profileType) ||
                null;

            if (profileType !== 'employer' && !isManagerRoleLocal) {
                if (isMounted) {
                    setManagerProjects([]);
                    setManagerOrgs([]);
                    setManagerOrgSlug(null);
                    setManagerNavLoading(false);
                }
                return;
            }

            if (isMounted) {
                setManagerNavLoading(true);
            }

            const userEmail =
                normalizeEmail(userContext?.email) ||
                normalizeEmail((userContext?.user as DbUserPayload | undefined)?.email) ||
                normalizeEmail(user?.primaryEmailAddress?.emailAddress);

            if (!userEmail && !(isSuperAdmin || isOwnerLike)) {
                if (isMounted) {
                    setManagerProjects([]);
                    setManagerOrgs([]);
                    setManagerOrgSlug(null);
                    setManagerNavLoading(false);
                }
                return;
            }

            const membershipRoles = new Map<string, string>();
            (userContext?.memberships ?? []).forEach((membership) => {
                if (membership?.orgId) {
                    membershipRoles.set(String(membership.orgId), membership.role);
                }
            });

            try {
                const orgResponse = await fetch(withBasePath('/api/org'), { cache: 'no-store' });
                const orgPayload = (await orgResponse.json().catch(() => null)) as
                    | { orgs?: Array<{ _id: string; name: string; orgSlug: string }> }
                    | { error?: string }
                    | null;

                if (
                    !orgResponse.ok ||
                    !orgPayload ||
                    !('orgs' in orgPayload) ||
                    !orgPayload.orgs
                ) {
                    if (isMounted) {
                        setManagerProjects([]);
                        setManagerOrgs([]);
                        setManagerOrgSlug(null);
                        setManagerNavLoading(false);
                    }
                    return;
                }

                const allowedRoles = new Set(['owner', 'org_admin', 'manager']);
                const candidateOrgs = orgPayload.orgs.filter((org) => {
                    const role = membershipRoles.get(String(org._id));
                    return role ? allowedRoles.has(role) : true;
                });

                const orgsToQuery = isSuperAdmin ? orgPayload.orgs : candidateOrgs;

                const orgResults: ManagerOrgLink[] = [];
                const projectResults: ManagerProjectLink[] = [];

                const projectRequests = await Promise.allSettled(
                    orgsToQuery.map(async (org) => {
                        const res = await fetch(
                            `/api/org/${encodeURIComponent(org.orgSlug)}/projects`,
                            { cache: 'no-store' }
                        );
                        const data = (await res.json().catch(() => null)) as
                            | { projects?: Array<{ key: string; name: string; managers?: string[] }> }
                            | { error?: string }
                            | null;

                        if (!res.ok || !data || !('projects' in data) || !Array.isArray(data.projects)) {
                            return { org, projects: [] as ManagerProjectLink[] };
                        }

                        const managedProjects = data.projects.filter((project) => {
                            if (isSuperAdmin || isOwnerLike) return true;
                            const managers = Array.isArray(project.managers) ? project.managers : [];
                            return managers.some(
                                (managerEmail) => normalizeEmail(managerEmail) === userEmail
                            );
                        });

                        const formattedProjects = managedProjects.map((project) => ({
                            orgSlug: org.orgSlug,
                            orgName: org.name,
                            projectKey: project.key,
                            projectName: project.name,
                        }));

                        return { org, projects: formattedProjects };
                    })
                );

                projectRequests.forEach((result) => {
                    if (result.status !== 'fulfilled') return;
                    const { org, projects } = result.value;
                    if (projects.length > 0) {
                        orgResults.push({ orgSlug: org.orgSlug, orgName: org.name });
                        projectResults.push(...projects);
                    }
                });

                if (isMounted) {
                    const uniqueOrgs = new Map<string, ManagerOrgLink>();
                    orgResults.forEach((org) => {
                        if (!uniqueOrgs.has(org.orgSlug)) {
                            uniqueOrgs.set(org.orgSlug, org);
                        }
                    });

                    setManagerOrgs(Array.from(uniqueOrgs.values()));
                    setManagerProjects(projectResults);
                    const activeOrgId =
                        userContext?.activeOrgId ??
                        userContext?.activeMembership?.orgId ??
                        null;
                    const resolvedOrgSlug =
                        (activeOrgId
                            ? orgPayload.orgs.find((org) => String(org._id) === String(activeOrgId))
                                  ?.orgSlug
                            : null) ??
                        orgResults[0]?.orgSlug ??
                        orgPayload.orgs[0]?.orgSlug ??
                        null;
                    setManagerOrgSlug(resolvedOrgSlug ?? null);
                    setManagerNavLoading(false);
                }
            } catch {
                if (isMounted) {
                    setManagerProjects([]);
                    setManagerOrgs([]);
                    setManagerOrgSlug(null);
                    setManagerNavLoading(false);
                }
            }
        };

        void loadManagerProjects();

        return () => {
            isMounted = false;
        };
    }, [user, userContext, userContextLoading]);

    const contextUser = userContext?.user as DbUserPayload | undefined;
    const effectiveRole = resolveRoleFromContext(userContext);
    const isSuperAdminUser =
        effectiveRole === 'super_admin' || Boolean(userContext?.isSuperAdmin);
    const profileType =
        userContext?.profileType ||
        (contextUser?.profileType as string | undefined) ||
        null;
    const isContractor = profileType === 'contractor';
    const isEmployer = profileType === 'employer';
    const isManagerRole = effectiveRole ? MANAGER_ROLES.includes(effectiveRole) : false;
    const isEmployerView = isEmployer || isManagerRole;
    const isContractorView = isContractor || effectiveRole === 'executor';
    const isExecutor = effectiveRole === 'executor' || isContractor;
    const projectMatch = pathname.match(/^\/org\/([^/]+)\/projects\/([^/]+)/);
    const orgSlug = projectMatch?.[1];
    const projectRef = projectMatch?.[2];
    const managerGeoPath =
        orgSlug && projectRef
            ? `/org/${orgSlug}/projects/${projectRef}/tasks/locations`
            : '/tasks/locations';
    const baseGeoPath = isExecutor ? '/tasks/locations' : managerGeoPath;
    const navLoading =
        userContextLoading ||
        (isEmployerView && managerNavLoading) ||
        !profileType;
    const managerOrgPath = isEmployerView
        ? managerOrgSlug
            ? `/org/${encodeURIComponent(managerOrgSlug)}`
            : '/org/new'
        : null;
    const managerProjectPaths = React.useMemo(
        () =>
            managerProjects.map((project) => ({
                ...project,
                tasksPath: `/org/${encodeURIComponent(project.orgSlug)}/projects/${encodeURIComponent(
                    project.projectKey
                )}/tasks`,
                locationsPath: `/org/${encodeURIComponent(project.orgSlug)}/projects/${encodeURIComponent(
                    project.projectKey
                )}/tasks/locations`,
            })),
        [managerProjects]
    );
    const primaryManagerProject = managerProjectPaths[0];
    const employerLocationsPath =
        managerGeoPath !== '/tasks/locations'
            ? managerGeoPath
            : primaryManagerProject?.locationsPath ?? managerGeoPath;
    const tasksPath = isEmployerView
        ? primaryManagerProject?.tasksPath ??
          (managerOrgSlug ? `/org/${encodeURIComponent(managerOrgSlug)}/projects` : '/tasks')
        : '/tasks';
    const locationsPath = isEmployerView
        ? employerLocationsPath
        : baseGeoPath;
    const geoLabel = isContractorView && !isEmployerView ? 'НА КАРТЕ' : 'ГЕОЛОКАЦИИ';
    const tasksChildren =
        isEmployerView && managerProjectPaths.length > 1
            ? managerProjectPaths.map((project) => ({
                  label: project.projectKey,
                  secondary: project.projectName,
                  path: project.tasksPath,
              }))
            : undefined;
    const locationsChildren =
        isEmployerView && managerProjectPaths.length > 1
            ? managerProjectPaths.map((project) => ({
                  label: project.projectKey,
                  secondary: project.projectName,
                  path: project.locationsPath,
              }))
            : undefined;
    const projectsBaseOrgSlug =
        managerOrgs[0]?.orgSlug ?? primaryManagerProject?.orgSlug ?? managerOrgSlug ?? null;
    const projectsPath =
        isEmployerView && projectsBaseOrgSlug
            ? `/org/${encodeURIComponent(projectsBaseOrgSlug)}/projects`
            : isEmployerView
              ? '/org/new'
              : null;
    const projectsChildren =
        isEmployerView && managerProjectPaths.length > 1
            ? managerProjectPaths.map((project) => ({
                  label: project.projectKey,
                  secondary: project.projectName,
                  path: project.tasksPath,
              }))
            : undefined;
    const navItems = React.useMemo<NavItem[]>(() => {
        if (!profileType && !isSuperAdminUser) return [];
        const items: NavItem[] = [...BASE_NAV_ITEMS];
        if (isSuperAdminUser) {
            items.push({
                label: 'АДМИН',
                path: '/admin',
                icon: <AdminPanelSettingsIcon sx={{ fontSize: 20 }} />,
            });
        }
        if (isEmployerView && managerOrgPath) {
            items.push({
                label: 'ОРГАНИЗАЦИЯ',
                path: managerOrgPath,
                icon: <BusinessIcon sx={{ fontSize: 20 }} />,
            });
        }
        if (isEmployerView) {
            if (projectsPath) {
                items.push({
                    label: 'МОИ ПРОЕКТЫ',
                    path: projectsPath,
                    icon: <FolderIcon sx={{ fontSize: 20 }} />,
                    children: projectsChildren,
                });
            }
            items.push({
                label: 'ФОТООТЧЕТЫ',
                path: '/reports',
                icon: <PermMediaIcon sx={{ fontSize: 20 }} />,
            });
            items.push({
                label: 'ГЕОЛОКАЦИИ',
                path: locationsPath,
                icon: <PlaceIcon sx={{ fontSize: 20 }} />,
                children: locationsChildren,
            });
            return items;
        }
        if (isContractorView) {
            items.push({
                label: 'МОИ ЗАДАЧИ',
                path: tasksPath,
                icon: <TaskIcon sx={{ fontSize: 20 }} />,
                children: tasksChildren,
            });
            items.push({
                label: 'БИРЖА',
                path: '/market',
                icon: <StoreIcon sx={{ fontSize: 20 }} />,
            });
        }
        items.push({
            label: geoLabel,
            path: locationsPath,
            icon: <PlaceIcon sx={{ fontSize: 20 }} />,
            children: locationsChildren,
        });
        return items;
    }, [
        managerOrgPath,
        locationsChildren,
        locationsPath,
        projectsChildren,
        projectsPath,
        tasksChildren,
        tasksPath,
        isEmployerView,
        isContractorView,
        profileType,
        isSuperAdminUser,
        geoLabel,
    ]);


    const normalizeValue = (value?: string | null) => {
        if (!value) return undefined;
        const trimmed = value.trim();
        return trimmed.length ? trimmed : undefined;
    };

    const contextName =
        normalizeValue(userContext?.name) ??
        normalizeValue(contextUser?.name) ??
        normalizeValue(contextUser?.fullName);

    const contextEmail =
        normalizeValue(userContext?.email) ??
        normalizeValue(contextUser?.email);
    const namedUser = user as (UserResource & { name?: string | null }) | null;
    const fallbackName =
        contextName ||
        namedUser?.name ||
        namedUser?.username ||
        'Пользователь';
    const userEmail =
        contextEmail || normalizeValue(user?.emailAddresses[0]?.emailAddress);
    const avatarSrc = contextUser?.profilePic || user?.imageUrl || '';

    const handleLogout = async () => {
        await signOut({ redirectUrl: withBasePath('/sign-in') });
    };

    const handleProfileClick = () => {
        onNavigateAction('/profile');
    };

    const palette = {
        cardBg: isDarkMode ? 'rgba(28,28,30,0.85)' : 'rgba(255,255,255,0.7)',
        border: isDarkMode
            ? 'rgba(255,255,255,0.08)'
            : 'rgba(0,0,0,0.05)',
        textPrimary: isDarkMode ? '#f5f5f7' : '#1d1d1f',
        textSecondary: isDarkMode ? '#a1a1a6' : '#515154',
        accent: '#0071e3',
        activeBg: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(245,245,247,0.9)',
        hoverBg: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(245,245,247,0.9)',
        icon: isDarkMode ? '#d2d2d7' : '#6e6e73',
    };

    return (
        <Box
            role='presentation'
            sx={{
                width: 260,
                maxWidth: '100%',
                padding: 2,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
            }}
        >
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 1,
                    textAlign: 'center',
                    padding: 2,
                    borderRadius: 4,
                    backgroundColor: palette.cardBg,
                    border: `1px solid ${palette.border}`,
                    boxShadow: isDarkMode
                        ? '0 6px 14px rgba(0,0,0,0.35)'
                        : '0 10px 20px rgba(15,23,42,0.07)',
                    backdropFilter: 'blur(14px)',
                }}
            >
                <Avatar
                    alt={fallbackName}
                    src={avatarSrc}
                    sx={{
                        width: 72,
                        height: 72,
                        cursor: 'pointer',
                        boxShadow: '0 12px 25px rgba(15,23,42,0.15)',
                    }}
                    onClick={handleProfileClick}
                />
                <Typography
                    fontWeight='600'
                    color={palette.textPrimary}
                    fontSize='1rem'
                    sx={{ cursor: 'pointer', letterSpacing: '0.02em' }}
                    onClick={handleProfileClick}
                >
                    {fallbackName}
                </Typography>
                <Typography
                    fontSize='0.875rem'
                    color={palette.textSecondary}
                    sx={{ cursor: 'pointer', letterSpacing: '0.01em' }}
                    onClick={handleProfileClick}
                >
                    {userEmail}
                </Typography>
                <Button
                    size='small'
                    variant='text'
                    onClick={handleLogout}
                    startIcon={<LogoutIcon fontSize='inherit' />}
                    sx={{
                        textTransform: 'none',
                        mt: 1,
                        fontSize: '0.9rem',
                        lineHeight: 1,
                        padding: '4px 12px',
                        borderRadius: 999,
                        minHeight: 0,
                        width: 'auto',
                        fontWeight: 500,
                        color: palette.accent,
                        '&:hover': {
                            backgroundColor: isDarkMode
                                ? 'rgba(0,113,227,0.15)'
                                : 'rgba(0,113,227,0.08)',
                        },
                    }}
                >
                    Выйти
                </Button>
            </Box>
            <List
                disablePadding
                sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
            >
                {navLoading ? (
                    <Box
                        sx={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            py: 3,
                        }}
                    >
                        <CircularProgress size={28} />
                    </Box>
                ) : (
                    navItems.map((item) => {
                    const hasChildren =
                        Array.isArray(item.children) && item.children.length > 0;
                    const children: NavChildItem[] = hasChildren
                        ? item.children ?? []
                        : [];
                    const childActive =
                        hasChildren &&
                        children.some(
                            (child) =>
                                pathname === child.path ||
                                pathname.startsWith(`${child.path}/`)
                        );
                    const isActive =
                        childActive ||
                        pathname === item.path ||
                        pathname.startsWith(`${item.path}/`);
                    const isExpanded =
                        hasChildren &&
                        ((expandedItems[item.label] ?? false) || childActive);
                    const handleItemClick = () => {
                        if (!hasChildren) {
                            onNavigateAction(item.path);
                            return;
                        }
                        setExpandedItems((prev) => ({
                            ...prev,
                            [item.label]: !(prev[item.label] ?? false),
                        }));
                    };
                    return (
                        <React.Fragment key={item.label}>
                            <ListItemButton
                                disableRipple
                                onClick={handleItemClick}
                                sx={{
                                    borderRadius: 3,
                                    px: 2.5,
                                    py: 1.5,
                                    alignItems: 'center',
                                    backgroundColor: isActive
                                        ? palette.activeBg
                                        : 'transparent',
                                    boxShadow: isActive
                                        ? `inset 0 0 0 1px ${palette.border}`
                                        : 'none',
                                    color: palette.textPrimary,
                                    transition: 'all 0.25s ease',
                                    '&:hover': {
                                        backgroundColor: palette.hoverBg,
                                        transform: 'translateX(4px)',
                                        boxShadow:
                                            isDarkMode
                                                ? '0 15px 35px rgba(0,0,0,0.55)'
                                                : '0 15px 35px rgba(15,23,42,0.12)',
                                    },
                                }}
                            >
                                <ListItemIcon
                                    sx={{
                                        minWidth: 'auto',
                                        mr: 2,
                                        color: isActive
                                            ? palette.textPrimary
                                            : palette.icon,
                                        transition: 'color 0.25s ease',
                                    }}
                                >
                                    {item.icon}
                                </ListItemIcon>
                                <ListItemText
                                    primary={item.label}
                                    slotProps={{
                                        primary: {
                                            sx: {
                                                fontSize: '0.85rem',
                                                letterSpacing: '0.08em',
                                                fontWeight: isActive ? 600 : 500,
                                                color: isActive
                                                    ? palette.textPrimary
                                                    : palette.textSecondary,
                                            },
                                        },
                                    }}
                                />
                                {hasChildren && (
                                    <Box
                                        component='span'
                                        sx={{
                                            ml: 'auto',
                                            display: 'flex',
                                            alignItems: 'center',
                                            color: isActive ? palette.textPrimary : palette.icon,
                                            transform: isExpanded
                                                ? 'rotate(90deg)'
                                                : 'rotate(0deg)',
                                            transition: 'transform 0.25s ease, color 0.25s ease',
                                        }}
                                    >
                                        <KeyboardArrowRightIcon fontSize='small' />
                                    </Box>
                                )}
                            </ListItemButton>
                            {hasChildren && (
                                <Collapse in={Boolean(isExpanded)} timeout='auto' unmountOnExit>
                                    <List
                                        disablePadding
                                        sx={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: 0.5,
                                            pl: 4,
                                            pt: 0.5,
                                        }}
                                    >
                                        {children.map((child) => {
                                            const childIsActive =
                                                pathname === child.path ||
                                                pathname.startsWith(`${child.path}/`);
                                            return (
                                                <ListItemButton
                                                    key={`${item.label}-${child.path}`}
                                                    disableRipple
                                                    onClick={() => onNavigateAction(child.path)}
                                                    sx={{
                                                        borderRadius: 2,
                                                        px: 2.5,
                                                        py: 1,
                                                        alignItems: 'center',
                                                        ml: 1,
                                                        backgroundColor: childIsActive
                                                            ? palette.activeBg
                                                            : 'transparent',
                                                        boxShadow: childIsActive
                                                            ? `inset 0 0 0 1px ${palette.border}`
                                                            : 'none',
                                                        color: palette.textPrimary,
                                                        transition: 'all 0.2s ease',
                                                        '&:hover': {
                                                            backgroundColor: palette.hoverBg,
                                                            transform: 'translateX(4px)',
                                                        },
                                                    }}
                                                >
                                                    <ListItemText
                                                        primary={child.label}
                                                        secondary={child.secondary}
                                                        slotProps={{
                                                            primary: {
                                                                sx: {
                                                                    fontSize: '0.8rem',
                                                                    letterSpacing: '0.04em',
                                                                    fontWeight: childIsActive
                                                                        ? 600
                                                                        : 500,
                                                                    color: childIsActive
                                                                        ? palette.textPrimary
                                                                        : palette.textSecondary,
                                                                },
                                                            },
                                                            secondary: child.secondary
                                                                ? {
                                                                      sx: {
                                                                          color: palette.textSecondary,
                                                                          fontSize: '0.75rem',
                                                                          mt: 0.25,
                                                                      },
                                                                  }
                                                                : undefined,
                                                        }}
                                                    />
                                                </ListItemButton>
                                            );
                                        })}
                                    </List>
                                </Collapse>
                            )}
                        </React.Fragment>
                        );
                    })
                )}
            </List>
        </Box>
    );
}
