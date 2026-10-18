import { useState, useEffect } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { User, LogOut, Copy, Check, Star, Mail, Calendar } from 'lucide-react';
import { phiraApiService } from '@/services/phiraApi';
import { apiService } from '@/services/api';
import { LoginDialog } from './LoginDialog';
import { toast } from 'sonner';
import type { CurrentUserInfo } from '@/types/api';

interface UserMenuProps {
  onLoginSuccess?: () => void;
}

export function UserMenu({ onLoginSuccess }: UserMenuProps) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userId, setUserId] = useState(0);
  const [copied, setCopied] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUserInfo | null>(null);

  useEffect(() => {
    checkLoginStatus();
  }, []);

  // TOKEN 失效（取不到账号资料）时同步切回未登录
  useEffect(() => {
    const handleExpired = () => {
      setIsLoggedIn(false);
      setUserId(0);
      setCurrentUser(null);
    };
    window.addEventListener('phiraSessionExpired', handleExpired);
    return () => window.removeEventListener('phiraSessionExpired', handleExpired);
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      fetchCurrentUser();
    }
  }, [isLoggedIn]);

  const checkLoginStatus = () => {
    const token = phiraApiService.getUserToken();
    const id = phiraApiService.getUserId();
    setIsLoggedIn(!!token);
    setUserId(id);
  };

  const fetchCurrentUser = async () => {
    // 用 validateSession 而不是直接取资料：既拿到资料，又能在 TOKEN 失效时触发登出
    const result = await phiraApiService.validateSession();
    if (result.status === 'valid') {
      setCurrentUser(result.profile);
    }
  };

  const handleLoginSuccess = () => {
    checkLoginStatus();
    onLoginSuccess?.();
    
    // 登录成功后自动尝试拉取谱面回放列表
    fetchReplayList();
  };

  // 自动拉取谱面回放列表
  const fetchReplayList = async () => {
    const userToken = phiraApiService.getUserToken();
    if (!userToken) return;

    try {
      const data = await apiService.replayAuth(userToken);
      if (data.ok) {
        console.log('[UserMenu] 谱面回放列表获取成功:', data);
        toast.success(`已获取 ${data.charts?.length || 0} 个谱面的回放记录`);
        
        // 触发全局事件，通知 PublicApiPanel 更新回放列表
        window.dispatchEvent(new CustomEvent('replayAuthSuccess', { detail: data }));
      } else {
        console.log('[UserMenu] 谱面回放认证失败:', (data as any).error);
      }
    } catch (error) {
      console.error('[UserMenu] 获取谱面回放列表失败:', error);
    }
  };

  const handleLogout = () => {
    phiraApiService.clearAuth();
    checkLoginStatus();
    toast.success('已退出登录');
  };

  const copyToken = async () => {
    const token = phiraApiService.getUserToken();
    if (token) {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      toast.success('TOKEN 已复制');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isLoggedIn) {
    return (
      <LoginDialog onLoginSuccess={handleLoginSuccess}>
        <Button variant="outline" size="sm">
          <User className="h-4 w-4 mr-2" />
          登录
        </Button>
      </LoginDialog>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Avatar className="h-6 w-6">
            {currentUser?.avatar ? (
              <AvatarImage src={currentUser.avatar} alt={currentUser.name} />
            ) : null}
            <AvatarFallback className="text-xs bg-primary text-primary-foreground">
              {currentUser?.name?.[0]?.toUpperCase() || userId.toString().slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden sm:inline">
            {currentUser?.name || `用户 ${userId}`}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{currentUser?.name || '用户'}</p>
            <p className="text-xs text-muted-foreground">ID: {userId}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {currentUser && (
          <>
            <div className="px-2 py-2 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Star className="h-3 w-3" />
                  RKS
                </span>
                <span className="font-medium">{currentUser.rks.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  邮箱
                </span>
                <span className="text-xs truncate max-w-[120px]">{currentUser.email}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  加入时间
                </span>
                <span className="text-xs">{new Date(currentUser.joined).toLocaleDateString()}</span>
              </div>
              {currentUser.banned && (
                <Badge variant="destructive" className="w-full justify-center">
                  账号已被封禁
                </Badge>
              )}
            </div>
            <DropdownMenuSeparator />
          </>
        )}
        
        <DropdownMenuItem onClick={copyToken} className="cursor-pointer">
          <span className="flex-1">复制 TOKEN</span>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive">
          <LogOut className="h-4 w-4 mr-2" />
          退出登录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
