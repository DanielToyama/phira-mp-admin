import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ConfigDialog } from './ConfigDialog';
import { AdminTokenDialog, getTokenForConfig } from './AdminTokenDialog';
import { Lock, Settings, AlertCircle, Shield } from 'lucide-react';
import { apiService } from '@/services/api';
import { applyApiConfig } from '@/hooks/useApiConfig';

interface ProtectedPanelProps {
  children: React.ReactNode;
  onAuthSuccess?: () => void;
}

// 检查用户是否在当前会话中跳过过 token 配置
const hasSkippedTokenInSession = (configId: string): boolean => {
  const skipped = sessionStorage.getItem(`api_token_skipped_${configId}`);
  return skipped === 'true';
};

// 标记用户跳过了 token 配置
const markTokenSkippedInSession = (configId: string) => {
  sessionStorage.setItem(`api_token_skipped_${configId}`, 'true');
};

// 清除跳过标记（当用户成功配置 token 后）
const clearTokenSkippedInSession = (configId: string) => {
  sessionStorage.removeItem(`api_token_skipped_${configId}`);
};

export function ProtectedPanel({ children, onAuthSuccess }: ProtectedPanelProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [configOpen, setConfigOpen] = useState(false);
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [currentConfigId, setCurrentConfigId] = useState<string>('');

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    if (!apiService.getBaseUrl()) {
      applyApiConfig();
    }

    const savedUrl = localStorage.getItem('api_base_url') || '';
    const savedConfigId = localStorage.getItem('api_config_id') || '';

    setCurrentConfigId(savedConfigId);

    // 检查是否已配置API地址
    if (!savedUrl) {
      setIsAuthenticated(false);
      setIsChecking(false);
      setAuthError('请先配置 API 地址');
      return;
    }

    // 获取当前配置的 token
    const tokenConfig = savedConfigId ? getTokenForConfig(savedConfigId) : null;
    
    // 如果没有配置 token，显示 token 配置对话框
    // 但如果用户在本会话中已经跳过过，则不再自动弹出
    if (!tokenConfig || !tokenConfig.useToken) {
      setIsAuthenticated(false);
      setIsChecking(false);
      setAuthError('请先配置管理员 TOKEN');
      
      // 检查用户是否在本会话中跳过过配置
      if (!hasSkippedTokenInSession(savedConfigId)) {
        // 自动打开 token 配置对话框
        setTimeout(() => {
          setTokenDialogOpen(true);
        }, 500);
      }
      return;
    }

    // 设置 apiService 配置
    apiService.setConfig({
      baseUrl: savedUrl,
      adminToken: tokenConfig.adminToken,
    });

    // 验证 token 是否有效
    try {
      const data = await apiService.getAdminRooms();
      if (data.ok) {
        setIsAuthenticated(true);
        setAuthError(null);
        // 验证成功后清除跳过标记
        clearTokenSkippedInSession(savedConfigId);
        onAuthSuccess?.();
      } else {
        setIsAuthenticated(false);
        const errorMsg = (data as any).error || '未知错误';
        if (errorMsg === 'unauthorized') {
          setAuthError('管理员 TOKEN 无效或已过期，请重新配置');
        } else if (errorMsg === 'admin-disabled') {
          setAuthError('服务器未配置管理员 TOKEN，无法使用管理功能');
        } else {
          setAuthError('验证失败: ' + errorMsg);
        }
        
        // 验证失败时，如果用户没有跳过过，则自动打开对话框
        if (!hasSkippedTokenInSession(savedConfigId)) {
          setTimeout(() => {
            setTokenDialogOpen(true);
          }, 500);
        }
      }
    } catch (error) {
      setIsAuthenticated(false);
      setAuthError('TOKEN 验证失败，请检查 API 地址和 TOKEN');
      
      // 验证失败时，如果用户没有跳过过，则自动打开对话框
      if (!hasSkippedTokenInSession(savedConfigId)) {
        setTimeout(() => {
          setTokenDialogOpen(true);
        }, 500);
      }
    }
    setIsChecking(false);
  };

  const handleConfigChange = () => {
    checkAuth();
  };

  const handleTokenSaved = () => {
    // 清除跳过标记
    if (currentConfigId) {
      clearTokenSkippedInSession(currentConfigId);
    }
    checkAuth();
  };

  const handleTokenSkipped = () => {
    // 标记用户跳过了配置
    if (currentConfigId) {
      markTokenSkippedInSession(currentConfigId);
    }
    // 关闭对话框，保持未认证状态
    setTokenDialogOpen(false);
  };

  if (isChecking) {
    return null;
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto mt-8 animate-fade-in">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>需要管理员权限</CardTitle>
            <CardDescription>
              请配置管理员TOKEN后再访问此处
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {authError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                <p className="text-sm text-destructive">{authError}</p>
              </div>
            )}
            
            {/* API 配置按钮 */}
            <ConfigDialog
              onConfigChange={handleConfigChange}
              defaultOpen={configOpen}
              onOpenChange={setConfigOpen}
            >
              <Button className="w-full" variant="outline">
                <Settings className="h-4 w-4 mr-2" />
                配置 API 地址
              </Button>
            </ConfigDialog>
            
            {/* TOKEN 配置按钮 */}
            {currentConfigId && (
              <Button 
                className="w-full" 
                onClick={() => setTokenDialogOpen(true)}
              >
                <Shield className="h-4 w-4 mr-2" />
                配置管理员 TOKEN
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Token 配置对话框 */}
        {currentConfigId && (
          <AdminTokenDialog
            open={tokenDialogOpen}
            onOpenChange={setTokenDialogOpen}
            onTokenSaved={handleTokenSaved}
            onTokenSkipped={handleTokenSkipped}
            configId={currentConfigId}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col animate-fade-in">
      {children}
    </div>
  );
}
