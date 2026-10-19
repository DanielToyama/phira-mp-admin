import { useEffect, useState } from 'react';
import { HashRouter, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfigDialog } from '@/components/ConfigDialog';
import { UserMenu } from '@/components/UserMenu';
import { ProtectedPanel } from '@/components/ProtectedPanel';
import { PlayerLayout } from '@/components/PlayerLayout';
import { RoomQueryPanel } from '@/sections/RoomQueryPanel';
import { ReplayPanel } from '@/sections/ReplayPanel';
import { LeaderboardPanel } from '@/sections/LeaderboardPanel';
import { CommunityPanel } from '@/sections/CommunityPanel';
import { ConnectPanel } from '@/sections/ConnectPanel';
import { StatusPanel } from '@/sections/StatusPanel';
import { AdminApiPanel } from '@/sections/AdminApiPanel';
import { ModeSelectPage } from '@/pages/ModeSelectPage';
import { getLastMode, setLastMode, type AppMode } from '@/lib/app-mode';
import { RoomDetailPage } from '@/pages/RoomDetailPage';
import { PublicRoomDetailPage } from '@/pages/PublicRoomDetailPage';
import { phiraApiService } from '@/services/phiraApi';
import { applyApiConfig } from '@/hooks/useApiConfig';
import { useUrlConfig } from '@/hooks/useUrlConfig';
import { useIsNarrowViewport } from '@/hooks/use-mobile';
import { ThemeToggle } from '@/components/theme-toggle';
import { ChangelogDialog } from '@/components/ChangelogDialog';
import { BRAND } from '@/lib/branding';
import { toast } from 'sonner';
import { version } from '../package.json';
import {
  Code2,
  Gamepad2,
  Heart,
  Loader2,
  Menu,
  Server,
  Settings,
  Shield,
  Tag,
  X,
  ChevronDown,
  Home,
} from 'lucide-react';

function MainLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isConfigured, setIsConfigured] = useState(() => !!localStorage.getItem('api_base_url'));
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!phiraApiService.getUserToken());
  const [configKey, setConfigKey] = useState(0);
  const { hasUrlConfig, isValidating, applyConfig } = useUrlConfig();
  const isMobile = useIsNarrowViewport(1024);
  const location = useLocation();
  const navigate = useNavigate();

  const currentMode: AppMode | null = location.pathname.startsWith('/player')
    ? 'player'
    : location.pathname.startsWith('/admin')
    ? 'admin'
    : null;

  useEffect(() => {
    applyApiConfig();
  }, []);

  // 登录态校验：本地 TOKEN 取不到账号资料（邮箱/头像等）即视为已失效，自动退出登录
  useEffect(() => {
    if (phiraApiService.getUserToken()) {
      void phiraApiService.validateSession();
    }
    const handleExpired = () => {
      setIsLoggedIn(false);
      toast.error('登录已过期，请重新登录');
    };
    window.addEventListener('phiraSessionExpired', handleExpired);
    return () => window.removeEventListener('phiraSessionExpired', handleExpired);
  }, []);

  useEffect(() => {
    if (hasUrlConfig) {
      applyConfig().then((success) => {
        if (success) {
          setIsConfigured(true);
        }
      });
    }
  }, [applyConfig, hasUrlConfig]);

  useEffect(() => {
    if (currentMode) {
      setLastMode(currentMode);
    }
  }, [currentMode]);

  const handleConfigChange = () => {
    const savedUrl = localStorage.getItem('api_base_url') || '';
    setIsConfigured(!!savedUrl);
    setConfigKey((prev) => prev + 1);
  };

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
  };

  const handleSwitchMode = (mode: AppMode) => {
    setLastMode(mode);
    navigate(mode === 'player' ? '/player/rooms' : '/admin/rooms');
  };

  return (
    <div className="flex min-h-screen flex-col bg-background app-gradient-bg">
      <header className="sticky top-0 z-50 border-b bg-card animate-fade-in">
        <div className="brand-topline h-1 w-full" />
        <div className="container mx-auto px-4 py-3 md:py-4">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              className="flex min-w-0 items-center gap-3 rounded-md text-left transition-opacity hover:opacity-80"
              onClick={() => navigate('/select')}
              title="返回模式选择页"
            >
              <div className="brand-logo shrink-0 rounded-lg p-2 transition-transform hover:scale-105">
                <Server className="h-6 w-6 text-primary-foreground" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-bold md:text-xl">{BRAND.name}</h1>
                <p className="truncate text-xs text-muted-foreground md:text-sm">{BRAND.subtitle}</p>
              </div>
            </button>

            <div className="hidden shrink-0 items-center gap-2 md:flex lg:gap-3">
              {isValidating && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在验证配置...
                </div>
              )}
              <ModeSwitcher currentMode={currentMode} onSwitch={handleSwitchMode} />
              <ThemeToggle />
              <ConfigDialog onConfigChange={handleConfigChange}>
                <Button variant="outline" size="sm" className="relative">
                  <Settings className="mr-2 h-4 w-4" />
                  API 配置
                  {isConfigured && (
                    <span className="absolute -top-1 -right-1 h-3 w-3 animate-pulse rounded-full border-2 border-background bg-green-500" />
                  )}
                </Button>
              </ConfigDialog>
              <UserMenu onLoginSuccess={handleLoginSuccess} />
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 md:hidden"
              aria-label={isMobileMenuOpen ? '收起菜单' : '展开菜单'}
              aria-expanded={isMobileMenuOpen}
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>

          {isMobileMenuOpen && (
            <div className="mt-3 space-y-2 border-t pt-3 animate-slide-in md:hidden">
              {isValidating && (
                <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在验证配置...
                </div>
              )}
              {/* 模式切换占满剩余宽度，主题按钮独立成列，两者等高对齐 */}
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <ModeSwitcher
                  currentMode={currentMode}
                  onSwitch={(mode) => {
                    handleSwitchMode(mode);
                    setIsMobileMenuOpen(false);
                  }}
                  fullWidth
                />
                <ThemeToggle size="icon-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <ConfigDialog onConfigChange={handleConfigChange}>
                  <Button variant="outline" size="sm" className="relative w-full">
                    <Settings className="mr-2 h-4 w-4" />
                    API 配置
                    {isConfigured && (
                      <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full border-2 border-background bg-green-500" />
                    )}
                  </Button>
                </ConfigDialog>
                <UserMenu onLoginSuccess={handleLoginSuccess} fullWidth />
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="container mx-auto flex w-full flex-1 flex-col px-4 py-6">
        <div key={configKey} className="flex flex-1 flex-col animate-slide-in">
          <Outlet />
        </div>
      </main>

      <footer className="border-t bg-card animate-fade-in" style={{ animationDelay: '0.3s' }}>
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col items-center justify-between gap-3 text-sm text-muted-foreground lg:flex-row">
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center">
              <Heart className="h-4 w-4 shrink-0 text-primary" />
              <span>
                <a
                  href={BRAND.siteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  {BRAND.owner}
                </a>{' '}
                的 Phira 服务器面板 · 联机地址{' '}
                <span className="font-mono">{BRAND.joinAddress}</span>
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
              <a
                href={BRAND.statusUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="whitespace-nowrap transition-colors hover:text-primary"
              >
                服务器状态
              </a>
              {BRAND.groups.map((group) => (
                <a
                  key={group.url}
                  href={group.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="whitespace-nowrap transition-colors hover:text-primary"
                >
                  {group.label}
                </a>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
              {isConfigured && (
                <span className="flex items-center gap-1 whitespace-nowrap text-green-600">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-green-500" />
                  API 已配置
                </span>
              )}
              {isLoggedIn && (
                <span className="flex items-center gap-1 whitespace-nowrap text-blue-600">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                  已登录
                </span>
              )}
              <ChangelogDialog>
                <button className="flex cursor-pointer items-center gap-1 whitespace-nowrap text-muted-foreground transition-colors hover:text-primary">
                  <Tag className="h-3 w-3 shrink-0" />
                  前端版本 v{version}
                </button>
              </ChangelogDialog>
              <span className="flex items-center gap-1 whitespace-nowrap text-muted-foreground" title="Git Commit Hash">
                <span className="text-xs">({__GIT_COMMIT_HASH__})</span>
              </span>
            </div>
          </div>

          {/* 原作者署名与开源协议（遵循 MIT License，请勿移除） */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
            <Code2 className="h-3.5 w-3.5" />
            <span>
              本面板基于{' '}
              <a
                href="https://github.com/Pimeng/mp-admin"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                mp-admin
              </a>{' '}
              二次开发 · 原作者{' '}
              <a
                href="https://github.com/Pimeng"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Pimeng
              </a>{' '}
              · MIT License | 兼容{' '}
              <a
                href="https://github.com/Pimeng/tphira-mp"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                tphira-mp
              </a>{' '}
              的 API 格式 |{' '}
              <a
                href="https://phira.dmocken.top/status"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                多人联机服务可用性
              </a>
            </span>
          </div>
        </div>
      </footer>

      <Toaster position={isMobile ? 'bottom-center' : 'top-right'} />
    </div>
  );
}

interface ModeSwitcherProps {
  currentMode: AppMode | null;
  onSwitch: (mode: AppMode) => void;
  fullWidth?: boolean;
}

function ModeSwitcher({ currentMode, onSwitch, fullWidth }: ModeSwitcherProps) {
  const navigate = useNavigate();
  const Icon = currentMode === 'admin' ? Shield : currentMode === 'player' ? Gamepad2 : Home;
  const label = currentMode === 'admin' ? '管理员模式' : currentMode === 'player' ? '玩家模式' : '选择模式';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={fullWidth ? 'w-full justify-between' : undefined}>
          <Icon className="mr-2 h-4 w-4" />
          {label}
          <ChevronDown className="ml-2 h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>切换使用模式</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => onSwitch('player')}
          className={currentMode === 'player' ? 'bg-accent' : undefined}
        >
          <Gamepad2 className="mr-2 h-4 w-4" />
          玩家模式
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onSwitch('admin')}
          className={currentMode === 'admin' ? 'bg-accent' : undefined}
        >
          <Shield className="mr-2 h-4 w-4" />
          管理员模式
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate('/select')}>
          <Home className="mr-2 h-4 w-4" />
          返回选择页
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AdminLayout() {
  return (
    <ProtectedPanel>
      <Outlet />
    </ProtectedPanel>
  );
}

function RootRedirect() {
  const hasApiUrl = !!localStorage.getItem('api_base_url');
  const lastMode = getLastMode();

  // 没有配置 API URL → 强制走 onboarding
  if (!hasApiUrl) return <ModeSelectPage />;

  // 已配置 + 有上次模式 → 直接进入
  if (lastMode === 'player') return <Navigate to="/player/rooms" replace />;
  if (lastMode === 'admin') return <Navigate to="/admin/rooms" replace />;

  // 已配置但没选过模式 → 直接进房间页（首页直达，不再挡一层模式选择）
  return <Navigate to="/player/rooms" replace />;
}

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<RootRedirect />} />
          <Route path="select" element={<ModeSelectPage />} />

          <Route path="player" element={<PlayerLayout />}>
            <Route index element={<Navigate to="/player/rooms" replace />} />
            <Route path="connect" element={<ConnectPanel />} />
            <Route path="rooms" element={<RoomQueryPanel />} />
            <Route path="status" element={<StatusPanel />} />
            <Route path="replay" element={<ReplayPanel />} />
            <Route path="ranking" element={<LeaderboardPanel />} />
            <Route path="community" element={<CommunityPanel />} />
          </Route>

          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/rooms" replace />} />
            <Route path="rooms" element={<AdminApiPanel />} />
            <Route path="users" element={<AdminApiPanel />} />
            <Route path="messages" element={<AdminApiPanel />} />
            <Route path="settings" element={<AdminApiPanel />} />
            <Route path="contest" element={<AdminApiPanel />} />
          </Route>

          <Route path="rooms" element={<Navigate to="/player/rooms" replace />} />
          <Route path="replay" element={<Navigate to="/player/replay" replace />} />
        </Route>
        <Route path="/room/:roomId" element={<RoomDetailPage />} />
        <Route path="/public/room/:roomId" element={<PublicRoomDetailPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
