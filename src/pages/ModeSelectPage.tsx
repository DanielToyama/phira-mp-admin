import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle,
  ChevronRight,
  Clock,
  Copy,
  Edit2,
  Gamepad2,
  Globe,
  History,
  Hourglass,
  KeyRound,
  Loader2,
  Lock,
  LogIn,
  Mail,
  RefreshCw,
  Save,
  Shield,
  SkipForward,
  Sparkles,
  Terminal,
  TestTube,
  Trash2,
  Unlock,
  User,
  X,
  XCircle,
} from 'lucide-react';
import { apiService } from '@/services/api';
import { phiraApiService } from '@/services/phiraApi';
import { useOtpAuth } from '@/hooks/useOtpAuth';
import { setLastMode, type AppMode } from '@/lib/app-mode';
import { BRAND, DEFAULT_API_BASE_URL } from '@/lib/branding';
import { toast } from 'sonner';
import type { OtpMode } from '@/types/api';

const TOKEN_TYPE_PERMANENT = 'permanent';
const TOKEN_TYPE_TEMP = 'temp';

interface ApiConfigItem {
  id: string;
  name: string;
  baseUrl: string;
  createdAt: number;
}

interface TokenConfig {
  configId: string;
  adminToken: string;
  tokenType: typeof TOKEN_TYPE_PERMANENT | typeof TOKEN_TYPE_TEMP;
  useToken: boolean;
}

type Step = 'api' | 'mode' | 'player-auth' | 'admin-auth';

function loadSavedConfigs(): ApiConfigItem[] {
  try {
    const raw = localStorage.getItem('api_saved_configs_v2');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveConfigsToStorage(configs: ApiConfigItem[]) {
  localStorage.setItem('api_saved_configs_v2', JSON.stringify(configs));
}

function saveTokenForConfig(configId: string, tokenConfig: TokenConfig) {
  try {
    const raw = localStorage.getItem('api_config_tokens');
    const map: Record<string, TokenConfig> = raw ? JSON.parse(raw) : {};
    map[configId] = tokenConfig;
    localStorage.setItem('api_config_tokens', JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function ModeSelectPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isHttpsPage = typeof window !== 'undefined' && window.location.protocol === 'https:';

  const apiUrlFromQuery = searchParams.get('api_url');

  const [step, setStep] = useState<Step>(() => {
    const savedUrl = localStorage.getItem('api_base_url');
    return savedUrl || apiUrlFromQuery ? 'mode' : 'api';
  });

  // ===== API URL 配置状态 =====
  const [baseUrl, setBaseUrl] = useState(() => localStorage.getItem('api_base_url') || apiUrlFromQuery || '');
  const [savedConfigs, setSavedConfigs] = useState<ApiConfigItem[]>(loadSavedConfigs);
  const [selectedConfigId, setSelectedConfigId] = useState(() => localStorage.getItem('api_config_id') || '');
  const [isCheckingUrl, setIsCheckingUrl] = useState(false);
  const [isUrlValid, setIsUrlValid] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renamingValue, setRenamingValue] = useState('');

  const selectedConfig = savedConfigs.find(c => c.id === selectedConfigId);

  // ===== 玩家模式登录状态 =====
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!phiraApiService.getUserToken());

  // ===== 管理员 Token 状态 =====
  const [tokenType, setTokenType] = useState<typeof TOKEN_TYPE_PERMANENT | typeof TOKEN_TYPE_TEMP | null>(null);
  const [adminToken, setAdminToken] = useState('');
  const otpAuth = useOtpAuth();

  useEffect(() => {
    document.title = `初始化 - ${BRAND.pageTitle}`;
    return () => {
      document.title = BRAND.pageTitle;
    };
  }, []);

  // URL 安全策略检查
  const urlSecurity = useMemo(() => {
    if (!baseUrl) return { valid: true as const };
    try {
      const u = new URL(baseUrl);
      if (isHttpsPage && u.protocol === 'http:') {
        const host = u.hostname;
        const isLocal =
          host === '127.0.0.1' ||
          host === 'localhost' ||
          host.startsWith('192.168.') ||
          host.startsWith('10.') ||
          host.startsWith('172.') ||
          host === '[::1]';
        if (!isLocal) {
          return {
            valid: false as const,
            message: 'HTTPS 页面只能访问 HTTPS 地址或本地地址',
          };
        }
      }
      return { valid: true as const };
    } catch {
      return { valid: true as const };
    }
  }, [baseUrl, isHttpsPage]);

  // URL 实时验证（防抖）
  useEffect(() => {
    if (!baseUrl || !urlSecurity.valid) {
      setIsUrlValid(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsCheckingUrl(true);
      try {
        const res = await fetch(`${baseUrl}/room`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });
        setIsUrlValid(res.ok);
      } catch {
        setIsUrlValid(false);
      } finally {
        setIsCheckingUrl(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [baseUrl, urlSecurity.valid]);

  const stepIndex = step === 'api' ? 0 : step === 'mode' ? 1 : 2;
  const totalSteps = 3;

  // ============= 步骤切换 =============
  const handleSelectMode = (mode: AppMode) => {
    setLastMode(mode);
    if (mode === 'player') {
      if (isLoggedIn) {
        navigate('/player/rooms');
      } else {
        setStep('player-auth');
      }
    } else {
      setStep('admin-auth');
    }
  };

  const handleBack = () => {
    if (step === 'mode') {
      setStep('api');
    } else if (step === 'player-auth') {
      setStep('mode');
    } else if (step === 'admin-auth') {
      if (tokenType !== null) {
        setTokenType(null);
        setAdminToken('');
        otpAuth.reset();
      } else {
        setStep('mode');
      }
    }
  };

  // ============= API URL 步骤 =============
  const handleSelectSavedConfig = (id: string) => {
    const config = savedConfigs.find(c => c.id === id);
    if (!config) return;
    setBaseUrl(config.baseUrl);
    setSelectedConfigId(id);
    localStorage.setItem('api_base_url', config.baseUrl);
    localStorage.setItem('api_config_id', id);
    apiService.setConfig({ baseUrl: config.baseUrl, adminToken: '' });
    toast.success(`已切换到: ${config.name}`);
  };

  const handleStartRename = () => {
    if (!selectedConfig) return;
    setRenamingValue(selectedConfig.name);
    setIsRenaming(true);
  };

  const handleConfirmRename = () => {
    const trimmed = renamingValue.trim();
    if (!selectedConfigId || !trimmed) {
      setIsRenaming(false);
      return;
    }
    const updated = savedConfigs.map(c =>
      c.id === selectedConfigId ? { ...c, name: trimmed } : c
    );
    setSavedConfigs(updated);
    saveConfigsToStorage(updated);
    setIsRenaming(false);
    toast.success('配置名称已更新');
  };

  const handleDeleteConfig = () => {
    if (!selectedConfigId) return;
    const target = savedConfigs.find(c => c.id === selectedConfigId);
    if (!target) return;
    const updated = savedConfigs.filter(c => c.id !== selectedConfigId);
    setSavedConfigs(updated);
    saveConfigsToStorage(updated);
    setSelectedConfigId('');
    setBaseUrl('');
    localStorage.removeItem('api_config_id');
    localStorage.removeItem('api_base_url');
    apiService.setConfig({ baseUrl: '', adminToken: '' });
    toast.success(`已删除配置: ${target.name}`);
  };

  const handleTestConnection = async () => {
    if (!baseUrl) {
      toast.error('请先输入 API 地址');
      return;
    }
    if (!urlSecurity.valid) {
      toast.error(urlSecurity.message || 'API 地址不符合安全策略');
      return;
    }
    setIsTesting(true);
    try {
      apiService.setConfig({ baseUrl, adminToken: '' });
      await apiService.getRooms();
      setIsUrlValid(true);
      toast.success('连接测试成功！');
    } catch {
      setIsUrlValid(false);
      toast.error('连接测试失败，请检查 API 地址');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveUrlAndContinue = () => {
    if (!baseUrl) {
      toast.error('请输入 API 地址');
      return;
    }
    if (!urlSecurity.valid) {
      toast.error(urlSecurity.message || 'API 地址不符合安全策略');
      return;
    }
    if (!isUrlValid) {
      toast.error('API 地址无效，请检查');
      return;
    }

    let configId = selectedConfigId;
    if (!configId) {
      const newConfig: ApiConfigItem = {
        id: Date.now().toString(),
        name: baseUrl,
        baseUrl,
        createdAt: Date.now(),
      };
      const updated = [...savedConfigs, newConfig];
      setSavedConfigs(updated);
      saveConfigsToStorage(updated);
      configId = newConfig.id;
      setSelectedConfigId(configId);
    } else {
      const updated = savedConfigs.map(c =>
        c.id === configId ? { ...c, baseUrl } : c
      );
      setSavedConfigs(updated);
      saveConfigsToStorage(updated);
    }

    localStorage.setItem('api_base_url', baseUrl);
    localStorage.setItem('api_config_id', configId);
    apiService.setConfig({ baseUrl, adminToken: '' });
    toast.success('API 地址已保存');
    setStep('mode');
  };

  // ============= 玩家登录步骤 =============
  const handleLogin = async () => {
    if (!email || !password) {
      toast.error('请输入邮箱和密码');
      return;
    }
    setLoginLoading(true);
    try {
      const data = await phiraApiService.login(email, password);
      setIsLoggedIn(true);
      toast.success(`登录成功！欢迎，用户 ${data.id}`);
      navigate('/player/rooms');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '登录失败';
      toast.error(msg);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSkipLogin = () => {
    navigate('/player/rooms');
  };

  // ============= 管理员 Token 步骤 =============
  const persistTokenAndEnter = (token: string, type: typeof TOKEN_TYPE_PERMANENT | typeof TOKEN_TYPE_TEMP) => {
    if (!selectedConfigId) {
      toast.error('未找到 API 配置 ID，请重新配置 API 地址');
      setStep('api');
      return;
    }
    saveTokenForConfig(selectedConfigId, {
      configId: selectedConfigId,
      adminToken: token,
      tokenType: type,
      useToken: true,
    });

    localStorage.setItem('api_use_token', 'true');
    localStorage.setItem('api_token_type', type);
    if (type === TOKEN_TYPE_TEMP) {
      localStorage.setItem('api_temp_token', token);
    } else {
      localStorage.setItem('api_admin_token', token);
    }

    apiService.setConfig({ baseUrl, adminToken: token });
    toast.success('管理员 TOKEN 已保存');
    navigate('/admin/rooms');
  };

  const handleSavePermanentToken = () => {
    if (!adminToken) {
      toast.error('请输入管理员 TOKEN');
      return;
    }
    persistTokenAndEnter(adminToken, TOKEN_TYPE_PERMANENT);
  };

  const handleOtpSuccess = (token: string) => {
    persistTokenAndEnter(token, TOKEN_TYPE_TEMP);
  };

  // ============= 渲染 =============
  return (
    <div className="flex min-h-[calc(100vh-220px)] flex-1 items-start justify-center px-4 py-8">
      <div className="w-full max-w-2xl space-y-6 animate-fade-in">
        <div className="space-y-3 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            初始化向导
          </div>
          <h2 className="text-3xl font-bold tracking-tight">欢迎使用 {BRAND.name}</h2>
          <p className="text-sm text-muted-foreground">
            按步骤完成配置，几秒钟即可开始使用 · 联机地址 {BRAND.joinAddress}
          </p>
        </div>

        <Stepper currentIndex={stepIndex} total={totalSteps} step={step} />

        {step === 'api' && (
          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                第一步：配置 API 地址
              </CardTitle>
              <CardDescription>
                填入你的 Phira 多人联机服务器地址，所有功能都依赖此配置
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isHttpsPage && (
                <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
                  <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <AlertDescription className="text-xs text-amber-700 dark:text-amber-300">
                    当前页面使用 HTTPS，只能访问 HTTPS 地址或本地地址（127.0.0.1、localhost、192.168.x.x、10.x.x.x）
                  </AlertDescription>
                </Alert>
              )}

              {savedConfigs.length > 0 && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-xs">
                    <History className="h-3 w-3" />
                    选择已保存的配置
                  </Label>
                  {isRenaming ? (
                    <div className="flex gap-2">
                      <Input
                        value={renamingValue}
                        onChange={e => setRenamingValue(e.target.value)}
                        placeholder="输入新的配置名称"
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleConfirmRename();
                          else if (e.key === 'Escape') setIsRenaming(false);
                        }}
                      />
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={handleConfirmRename}
                        title="确认"
                        className="shrink-0"
                      >
                        <Check className="h-4 w-4 text-green-500" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => setIsRenaming(false)}
                        title="取消"
                        className="shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Select value={selectedConfigId} onValueChange={handleSelectSavedConfig}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="选择已保存的配置..." />
                        </SelectTrigger>
                        <SelectContent>
                          {savedConfigs.map(config => (
                            <SelectItem key={config.id} value={config.id}>
                              <div className="flex items-center gap-3">
                                <span className="truncate font-medium">{config.name}</span>
                                <span className="text-xs text-muted-foreground">{config.baseUrl}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={handleStartRename}
                        disabled={!selectedConfig}
                        title="重命名"
                        className="shrink-0"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={handleDeleteConfig}
                        disabled={!selectedConfig}
                        title="删除当前配置"
                        className="shrink-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="baseUrl" className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  API 地址
                </Label>
                <div className="relative">
                  <Input
                    id="baseUrl"
                    placeholder={DEFAULT_API_BASE_URL}
                    value={baseUrl}
                    onChange={e => setBaseUrl(e.target.value)}
                    className="pr-10"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {isCheckingUrl ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : baseUrl && urlSecurity.valid ? (
                      <span className={`block h-2.5 w-2.5 rounded-full ${isUrlValid ? 'bg-green-500' : 'bg-red-500'}`} />
                    ) : null}
                  </div>
                </div>
                {baseUrl && !urlSecurity.valid && (
                  <p className="text-xs text-red-600">{urlSecurity.message}</p>
                )}
                {baseUrl && urlSecurity.valid && !isCheckingUrl && (
                  <p className={`text-xs ${isUrlValid ? 'text-green-600' : 'text-red-600'}`}>
                    {isUrlValid ? 'API 地址有效，可继续下一步' : 'API 地址无法连接'}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                <Button
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={isTesting || !baseUrl || !urlSecurity.valid}
                  className="sm:w-32"
                >
                  {isTesting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <TestTube className="mr-2 h-4 w-4" />
                  )}
                  测试连接
                </Button>
                <Button
                  onClick={handleSaveUrlAndContinue}
                  disabled={!isUrlValid || !urlSecurity.valid}
                  className="flex-1"
                >
                  <Save className="mr-2 h-4 w-4" />
                  保存并继续
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'mode' && (
          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                第二步：选择使用模式
              </CardTitle>
              <CardDescription>
                选择适合你的模式，可以在头部随时切换
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <ModeCard
                  icon={<Gamepad2 className="h-7 w-7" />}
                  title="玩家模式"
                  description="查询公开房间、查看回放记录"
                  features={['浏览公开房间', '查看回放记录', '上传回放至分享站']}
                  onSelect={() => handleSelectMode('player')}
                  accent="border-rose-400/40 hover:border-rose-400/70 bg-gradient-to-br from-rose-400/5 to-transparent"
                  iconClass="bg-rose-400/10 text-rose-400"
                />
                <ModeCard
                  icon={<Shield className="h-7 w-7" />}
                  title="管理员模式"
                  description="管理房间、用户、广播与比赛"
                  features={['解散/查询所有房间', '封禁/解封玩家', '广播消息与功能开关']}
                  onSelect={() => handleSelectMode('admin')}
                  accent="border-fuchsia-500/30 hover:border-fuchsia-500/60 bg-gradient-to-br from-fuchsia-500/5 to-transparent"
                  iconClass="bg-fuchsia-500/10 text-fuchsia-500"
                  badge="需 TOKEN"
                />
              </div>

              <div className="flex justify-between border-t pt-4">
                <Button variant="ghost" size="sm" onClick={handleBack}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  返回上一步
                </Button>
                <p className="text-xs text-muted-foreground self-center">
                  当前 API：<span className="font-mono">{baseUrl}</span>
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'player-auth' && (
          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                第三步：登录 Phira 账号（可选）
              </CardTitle>
              <CardDescription>
                登录后可查看自己的回放记录、上传回放到分享站；也可以稍后登录
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoggedIn ? (
                <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <AlertDescription className="text-xs text-green-700 dark:text-green-300">
                    已登录 Phira 账号，可直接进入玩家模式
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="loginEmail" className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      邮箱
                    </Label>
                    <Input
                      id="loginEmail"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleLogin()}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="loginPassword" className="flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      密码
                    </Label>
                    <Input
                      id="loginPassword"
                      type="password"
                      placeholder="输入密码"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleLogin()}
                    />
                  </div>
                </>
              )}

              <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:justify-between">
                <Button variant="ghost" size="sm" onClick={handleBack}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  返回选择
                </Button>
                <div className="flex gap-2">
                  {!isLoggedIn && (
                    <Button variant="outline" onClick={handleSkipLogin}>
                      <SkipForward className="mr-2 h-4 w-4" />
                      跳过
                    </Button>
                  )}
                  {isLoggedIn ? (
                    <Button onClick={() => navigate('/player/rooms')}>
                      进入玩家模式
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button onClick={handleLogin} disabled={loginLoading}>
                      {loginLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <LogIn className="mr-2 h-4 w-4" />
                      )}
                      登录并进入
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'admin-auth' && (
          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                第三步：配置管理员 TOKEN
              </CardTitle>
              <CardDescription>
                {tokenType === null
                  ? '选择获取 TOKEN 的方式'
                  : tokenType === TOKEN_TYPE_PERMANENT
                  ? '输入服务器配置的永久 TOKEN'
                  : '通过验证码或终端批准获取临时 TOKEN'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {tokenType === null && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <ModeCard
                    icon={<Lock className="h-7 w-7" />}
                    title="永久 TOKEN"
                    description="服务器启动时配置的 ADMIN_TOKEN"
                    features={['长期有效', '直接输入即可', '需事先获取']}
                    onSelect={() => setTokenType(TOKEN_TYPE_PERMANENT)}
                    accent="border-amber-500/30 hover:border-amber-500/60 bg-gradient-to-br from-amber-500/5 to-transparent"
                    iconClass="bg-amber-500/10 text-amber-500"
                  />
                  <ModeCard
                    icon={<Clock className="h-7 w-7" />}
                    title="临时 TOKEN"
                    description="通过验证码或终端批准获取"
                    features={['有效期 4 小时', '无需提前知道 TOKEN', '受 IP 限制']}
                    onSelect={() => setTokenType(TOKEN_TYPE_TEMP)}
                    accent="border-blue-500/30 hover:border-blue-500/60 bg-gradient-to-br from-blue-500/5 to-transparent"
                    iconClass="bg-blue-500/10 text-blue-500"
                  />
                </div>
              )}

              {tokenType === TOKEN_TYPE_PERMANENT && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="adminToken" className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      管理员 TOKEN
                    </Label>
                    <Input
                      id="adminToken"
                      type="password"
                      placeholder="服务器配置的 ADMIN_TOKEN"
                      value={adminToken}
                      onChange={e => setAdminToken(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSavePermanentToken()}
                    />
                  </div>
                  <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
                    <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <AlertDescription className="text-xs text-amber-700 dark:text-amber-300">
                      永久 TOKEN 是服务器启动时配置的 ADMIN_TOKEN，长期有效
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              {tokenType === TOKEN_TYPE_TEMP && (
                <OtpFlow otpAuth={otpAuth} onSuccess={handleOtpSuccess} />
              )}

              <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:justify-between">
                <Button variant="ghost" size="sm" onClick={handleBack}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {tokenType === null ? '返回选择' : '换一种方式'}
                </Button>
                {tokenType === TOKEN_TYPE_PERMANENT && (
                  <Button onClick={handleSavePermanentToken} disabled={!adminToken}>
                    <Save className="mr-2 h-4 w-4" />
                    保存并进入
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

interface StepperProps {
  currentIndex: number;
  total: number;
  step: Step;
}

function Stepper({ currentIndex, step }: StepperProps) {
  const labels = [
    { key: 'api', label: 'API 地址', icon: Globe },
    { key: 'mode', label: '选择模式', icon: Sparkles },
    {
      key: 'auth',
      label:
        step === 'admin-auth'
          ? '管理员 TOKEN'
          : step === 'player-auth'
          ? '账号配置'
          : '账号配置',
      icon: step === 'admin-auth' ? Shield : User,
    },
  ];

  return (
    <div className="flex items-center justify-center gap-2">
      {labels.map((item, index) => {
        const Icon = item.icon;
        const isActive = index === currentIndex;
        const isDone = index < currentIndex;

        return (
          <div key={item.key} className="flex items-center">
            <div
              className={[
                'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-all',
                isActive
                  ? 'border-primary bg-primary text-primary-foreground'
                  : isDone
                  ? 'border-green-500/50 bg-green-500/10 text-green-600 dark:text-green-400'
                  : 'border-border bg-card text-muted-foreground',
              ].join(' ')}
            >
              {isDone ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
              <span className="font-medium">{item.label}</span>
            </div>
            {index < labels.length - 1 && (
              <ChevronRight className="mx-1 h-4 w-4 text-muted-foreground/50" />
            )}
          </div>
        );
      })}
    </div>
  );
}

interface ModeCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  features: string[];
  accent: string;
  iconClass: string;
  badge?: string;
  onSelect: () => void;
}

function ModeCard({ icon, title, description, features, accent, iconClass, badge, onSelect }: ModeCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative flex flex-col gap-3 overflow-hidden rounded-lg border p-4 text-left transition-all duration-200 hover:scale-[1.01] hover:shadow-md ${accent}`}
    >
      <div className="flex items-center justify-between">
        <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${iconClass}`}>
          {icon}
        </div>
        {badge && (
          <span className="rounded-full border bg-background/70 px-2 py-0.5 text-[10px] text-muted-foreground">
            {badge}
          </span>
        )}
      </div>
      <div>
        <div className="text-lg font-semibold">{title}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{description}</div>
      </div>
      <ul className="space-y-1 text-xs text-muted-foreground">
        {features.map(feature => (
          <li key={feature} className="flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-current" />
            {feature}
          </li>
        ))}
      </ul>
      <div className="mt-1 flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
        进入{title}
        <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
      </div>
    </button>
  );
}

interface OtpFlowProps {
  otpAuth: ReturnType<typeof useOtpAuth>;
  onSuccess: (token: string) => void;
}

function OtpFlow({ otpAuth, onSuccess }: OtpFlowProps) {
  return (
    <div className="space-y-3">
      <Tabs value={otpAuth.mode} onValueChange={v => otpAuth.setMode(v as OtpMode)}>
        <TabsList className="relative grid w-full grid-cols-2">
          <div
            aria-hidden
            className={`pointer-events-none absolute top-[3px] bottom-[3px] left-[3px] w-[calc(50%-3px)] rounded-md bg-white shadow-md transition-transform duration-500 ease-spring ${
              otpAuth.mode === 'cli' ? 'translate-x-full' : 'translate-x-0'
            }`}
          />
          <TabsTrigger
            value="otp"
            className="group relative z-10 flex items-center gap-1.5 border-transparent bg-transparent shadow-none transition-colors duration-300 data-[state=active]:border-transparent data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-black data-[state=active]:shadow-none dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-transparent dark:data-[state=active]:text-black"
          >
            <KeyRound className="h-3.5 w-3.5 transition-colors duration-300 group-data-[state=active]:text-blue-600" />
            验证码
          </TabsTrigger>
          <TabsTrigger
            value="cli"
            className="group relative z-10 flex items-center gap-1.5 border-transparent bg-transparent shadow-none transition-colors duration-300 data-[state=active]:border-transparent data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-black data-[state=active]:shadow-none dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-transparent dark:data-[state=active]:text-black"
          >
            <Terminal className="h-3.5 w-3.5 transition-colors duration-300 group-data-[state=active]:text-blue-600" />
            在终端中批准
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {otpAuth.step === 'request' && (
        <div className="space-y-3 rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">
            {otpAuth.mode === 'cli'
              ? '向服务器终端发起一次提权申请，由管理员手动 approve 后下发临时 TOKEN'
              : '点击下方按钮请求验证码，验证码将显示在服务器终端'}
          </p>
          <Button
            onClick={otpAuth.requestOtp}
            size="sm"
            className="w-full"
            disabled={otpAuth.loading}
          >
            {otpAuth.loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : otpAuth.mode === 'cli' ? (
              <Terminal className="mr-2 h-4 w-4" />
            ) : (
              <Lock className="mr-2 h-4 w-4" />
            )}
            {otpAuth.mode === 'cli' ? '发起提权申请' : '请求验证码'}
          </Button>
          {otpAuth.errorMessage && (
            <p className="text-xs text-red-600 dark:text-red-400">{otpAuth.errorMessage}</p>
          )}
        </div>
      )}

      {otpAuth.step === 'verify' && otpAuth.mode === 'otp' && (
        <div className="space-y-3 rounded-lg border p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>会话 ID: {otpAuth.ssid.slice(0, 8)}...</span>
          </div>
          <p className="text-xs text-muted-foreground">
            请查看服务器终端获取 8 位验证码（1 分钟内有效）
          </p>
          <Input
            placeholder="输入 8 位验证码"
            value={otpAuth.otp}
            onChange={e => otpAuth.setOtp(e.target.value)}
            maxLength={8}
          />
          <div className="flex gap-2">
            <Button
              onClick={async () => {
                const token = await otpAuth.verifyOtp();
                if (token) onSuccess(token);
              }}
              size="sm"
              className="flex-1"
              disabled={otpAuth.loading}
            >
              {otpAuth.loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Unlock className="mr-2 h-4 w-4" />
              )}
              验证并进入
            </Button>
            <Button variant="outline" size="sm" onClick={otpAuth.reset}>
              重置
            </Button>
          </div>
        </div>
      )}

      {otpAuth.step === 'pending' && otpAuth.mode === 'cli' && (
        <div className="space-y-3 rounded-lg border p-3">
          <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <Hourglass className="h-4 w-4 animate-pulse text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-xs text-blue-700 dark:text-blue-300">
              已通知服务器终端，等待管理员执行{' '}
              <code className="rounded bg-blue-100 px-1 font-mono dark:bg-blue-900">
                approve {otpAuth.ssid.slice(0, 8)}
              </code>{' '}
              进行批准...
            </AlertDescription>
          </Alert>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              正在轮询批准结果
            </span>
            <span>会话 ID: {otpAuth.ssid.slice(0, 8)}...</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={otpAuth.cancelCliPolling}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            取消等待
          </Button>
        </div>
      )}

      {otpAuth.step === 'denied' && otpAuth.mode === 'cli' && (
        <div className="space-y-3 rounded-lg border p-3">
          <Alert className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
            <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <AlertDescription className="text-xs text-red-700 dark:text-red-300">
              管理员已拒绝此次提权申请
            </AlertDescription>
          </Alert>
          <Button
            onClick={otpAuth.requestOtp}
            size="sm"
            className="w-full"
            disabled={otpAuth.loading}
          >
            {otpAuth.loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            重新发起申请
          </Button>
        </div>
      )}

      {otpAuth.step === 'success' && (
        <div className="space-y-3 rounded-lg border p-3">
          <div className="rounded border border-green-200 bg-green-50 p-2 dark:border-green-800 dark:bg-green-950">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm font-medium">
                {otpAuth.mode === 'cli' ? '管理员已批准' : '认证成功'}
              </span>
            </div>
            <p className="mt-1 text-xs text-green-700 dark:text-green-300">
              有效期至: {new Date(otpAuth.expiresAt).toLocaleString()}
            </p>
          </div>
          <div className="flex gap-2">
            <Input value={otpAuth.tempToken} readOnly type="password" />
            <Button variant="outline" size="sm" onClick={otpAuth.copyToken}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <Button
            onClick={() => onSuccess(otpAuth.tempToken)}
            size="sm"
            className="w-full"
          >
            <Save className="mr-2 h-4 w-4" />
            保存并进入管理员模式
          </Button>
        </div>
      )}
    </div>
  );
}
