import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Settings,
  Globe,
  Save,
  TestTube,
  Loader2,
  AlertCircle,
  ArrowRight,
  Plus,
  Trash2,
  Edit2,
  Check,
  XCircle,
  History
} from 'lucide-react';
import { apiService } from '@/services/api';
import { DEFAULT_API_BASE_URL } from '@/lib/branding';
import { toast } from 'sonner';

// API 配置项接口
interface ApiConfigItem {
  id: string;
  name: string;
  baseUrl: string;
  createdAt: number;
}

interface ConfigDialogProps {
  onConfigChange?: () => void;
  children?: React.ReactNode;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ConfigDialog({ onConfigChange, children, defaultOpen, onOpenChange }: ConfigDialogProps) {
  const [baseUrl, setBaseUrl] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [open, setOpen] = useState(defaultOpen || false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [isUrlValid, setIsUrlValid] = useState(false);
  const [isCheckingUrl, setIsCheckingUrl] = useState(false);

  // 配置列表相关状态
  const [savedConfigs, setSavedConfigs] = useState<ApiConfigItem[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState('');
  const [currentConfigName, setCurrentConfigName] = useState('');

  // 检测当前页面协议
  const isHttpsPage = typeof window !== 'undefined' && window.location.protocol === 'https:';

  // 检查URL是否符合安全策略
  const checkUrlSecurity = (url: string): { valid: boolean; message?: string } => {
    if (!url) return { valid: true };

    try {
      const urlObj = new URL(url);

      // 如果是 https 页面，检查 http 限制
      if (isHttpsPage && urlObj.protocol === 'http:') {
        // 检查是否是本地地址
        const hostname = urlObj.hostname;
        const isLocalAddress =
          hostname === '127.0.0.1' ||
          hostname === 'localhost' ||
          hostname.startsWith('192.168.') ||
          hostname.startsWith('10.') ||
          hostname.startsWith('172.') ||
          hostname === '[::1]';

        if (!isLocalAddress) {
          return {
            valid: false,
            message: '当前页面使用 HTTPS，只能访问 HTTPS 地址或本地地址（127.0.0.1、localhost、192.168.x.x、10.x.x.x）',
          };
        }
      }

      return { valid: true };
    } catch {
      return { valid: true };
    }
  };

  // 从 localStorage 加载配置列表
  const loadSavedConfigs = (): ApiConfigItem[] => {
    try {
      const configs = localStorage.getItem('api_saved_configs_v2');
      if (configs) {
        return JSON.parse(configs);
      }
    } catch {
      // 解析失败返回空数组
    }
    return [];
  };

  // 保存配置列表到 localStorage
  const saveConfigsToStorage = (configs: ApiConfigItem[]) => {
    localStorage.setItem('api_saved_configs_v2', JSON.stringify(configs));
  };

  // 加载指定配置
  const loadConfig = (config: ApiConfigItem) => {
    setBaseUrl(config.baseUrl);
    setCurrentConfigName(config.name);
    setSelectedConfigId(config.id);

    // 保存到当前配置
    localStorage.setItem('api_base_url', config.baseUrl);
    localStorage.setItem('api_config_id', config.id);
    // 清除旧的token相关配置，让ProtectedPanel来处理
    localStorage.removeItem('api_use_token');
    localStorage.removeItem('api_token_type');
    localStorage.removeItem('api_admin_token');
    localStorage.removeItem('api_temp_token');

    apiService.setConfig({
      baseUrl: config.baseUrl,
      adminToken: '',
    });

    setIsConfigured(!!config.baseUrl);
    if (config.baseUrl) {
      checkUrlValidity(config.baseUrl);
    }
  };

  // 保存当前配置到列表
  const saveCurrentConfig = () => {
    if (!baseUrl) {
      toast.error('请先输入API地址');
      return;
    }

    const newConfig: ApiConfigItem = {
      id: selectedConfigId || Date.now().toString(),
      name: currentConfigName || baseUrl,
      baseUrl,
      createdAt: Date.now(),
    };

    const existingIndex = savedConfigs.findIndex(c => c.id === newConfig.id);
    let updatedConfigs: ApiConfigItem[];

    if (existingIndex >= 0) {
      // 更新现有配置
      updatedConfigs = [...savedConfigs];
      updatedConfigs[existingIndex] = newConfig;
    } else {
      // 添加新配置
      updatedConfigs = [...savedConfigs, newConfig];
    }

    setSavedConfigs(updatedConfigs);
    saveConfigsToStorage(updatedConfigs);
    setSelectedConfigId(newConfig.id);
    toast.success('配置已保存到列表');
  };

  // 删除配置
  const deleteConfig = (configId: string) => {
    const updatedConfigs = savedConfigs.filter(c => c.id !== configId);
    setSavedConfigs(updatedConfigs);
    saveConfigsToStorage(updatedConfigs);

    if (selectedConfigId === configId) {
      setSelectedConfigId('');
      setCurrentConfigName('');
    }
    toast.success('配置已删除');
  };

  // 更新配置名称
  const updateConfigName = () => {
    if (!editingName.trim()) {
      setIsEditingName(false);
      return;
    }

    setCurrentConfigName(editingName.trim());

    if (selectedConfigId) {
      const updatedConfigs = savedConfigs.map(c =>
        c.id === selectedConfigId ? { ...c, name: editingName.trim() } : c
      );
      setSavedConfigs(updatedConfigs);
      saveConfigsToStorage(updatedConfigs);
    }

    setIsEditingName(false);
  };

  // 创建新配置
  const createNewConfig = () => {
    setBaseUrl('');
    setCurrentConfigName('');
    setSelectedConfigId('');
    setIsUrlValid(false);
  };

  useEffect(() => {
    // 加载保存的配置列表
    const configs = loadSavedConfigs();
    setSavedConfigs(configs);

    // 加载当前使用的配置
    const savedUrl = localStorage.getItem('api_base_url') || '';
    const savedConfigId = localStorage.getItem('api_config_id') || '';

    setBaseUrl(savedUrl);
    setIsConfigured(!!savedUrl);

    // 查找当前配置是否在列表中
    const currentConfig = configs.find(c => c.id === savedConfigId);
    if (currentConfig) {
      setSelectedConfigId(currentConfig.id);
      setCurrentConfigName(currentConfig.name);
    } else if (savedUrl) {
      setCurrentConfigName(savedUrl);
    }

    if (savedUrl) {
      checkUrlValidity(savedUrl);
    }

    apiService.setConfig({
      baseUrl: savedUrl,
      adminToken: '',
    });
  }, []);

  // 当URL改变时检查有效性
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (baseUrl) {
        checkUrlValidity(baseUrl);
      } else {
        setIsUrlValid(false);
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [baseUrl]);

  // 同步外部 open 状态
  useEffect(() => {
    if (defaultOpen !== undefined) {
      setOpen(defaultOpen);
    }
  }, [defaultOpen]);

  const checkUrlValidity = async (url: string) => {
    if (!url) return;
    setIsCheckingUrl(true);
    try {
      // 使用 /room 接口校验 API 是否有效
      const response = await fetch(`${url}/room`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
      setIsUrlValid(response.ok);
    } catch {
      setIsUrlValid(false);
    } finally {
      setIsCheckingUrl(false);
    }
  };

  const handleSaveUrl = () => {
    if (!baseUrl) {
      toast.error('请输入API地址');
      return;
    }

    // 检查URL安全策略
    const securityCheck = checkUrlSecurity(baseUrl);
    if (!securityCheck.valid) {
      toast.error(securityCheck.message || 'API地址不符合安全策略');
      return;
    }

    if (!isUrlValid) {
      toast.error('API地址无效，请检查');
      return;
    }

    localStorage.setItem('api_base_url', baseUrl);
    apiService.setConfig({
      baseUrl,
      adminToken: '',
    });

    setIsConfigured(true);
    onConfigChange?.();

    // 自动保存到配置列表（如果不存在）
    if (!selectedConfigId) {
      const newConfig: ApiConfigItem = {
        id: Date.now().toString(),
        name: currentConfigName || baseUrl,
        baseUrl,
        createdAt: Date.now(),
      };
      const updatedConfigs = [...savedConfigs, newConfig];
      setSavedConfigs(updatedConfigs);
      saveConfigsToStorage(updatedConfigs);
      setSelectedConfigId(newConfig.id);
      localStorage.setItem('api_config_id', newConfig.id);
      toast.success('API地址已保存并添加到配置列表');
    } else {
      toast.success('API地址已保存');
    }

    setOpen(false);
  };

  const handleTestConnection = async () => {
    if (!baseUrl) {
      toast.error('请先输入API地址');
      return;
    }

    // 检查URL安全策略
    const securityCheck = checkUrlSecurity(baseUrl);
    if (!securityCheck.valid) {
      toast.error(securityCheck.message || 'API地址不符合安全策略');
      return;
    }

    setIsTesting(true);
    try {
      apiService.setConfig({
        baseUrl,
        adminToken: '',
      });

      await apiService.getRooms();
      setIsUrlValid(true);
      toast.success('连接测试成功！');
    } catch (error) {
      setIsUrlValid(false);
      toast.error('连接测试失败，请检查API地址');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      setOpen(newOpen);
      onOpenChange?.(newOpen);
    }}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm" className="relative">
            <Settings className="h-4 w-4 mr-2" />
            API 配置
            {isConfigured && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
            )}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              API 配置
            </DialogTitle>
          </div>
          <DialogDescription>
            配置 API 服务器地址
          </DialogDescription>
        </DialogHeader>

        <div className="pt-2 space-y-4">
          {isHttpsPage && (
            <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertDescription className="text-xs text-amber-700 dark:text-amber-300">
                当前页面使用 HTTPS，只能访问 HTTPS 地址或本地地址（127.0.0.1、localhost、192.168.x.x、10.x.x.x）
              </AlertDescription>
            </Alert>
          )}

          {/* 配置切换区域 */}
          {savedConfigs.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <History className="h-4 w-4" />
                切换已保存的配置
              </Label>
              <div className="flex gap-2">
                <Select
                  value={selectedConfigId}
                  onValueChange={(value) => {
                    const config = savedConfigs.find(c => c.id === value);
                    if (config) {
                      loadConfig(config);
                      toast.success(`已切换到: ${config.name}`);
                    }
                  }}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="选择已保存的配置..." />
                  </SelectTrigger>
                  <SelectContent>
                    {savedConfigs.map((config) => (
                      <SelectItem key={config.id} value={config.id}>
                        <div className="flex items-center justify-between w-full gap-4">
                          <span className="truncate">{config.name}</span>
                          <span className="text-xs text-muted-foreground">{config.baseUrl}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={createNewConfig}
                  title="新建配置"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* 配置名称编辑 */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Edit2 className="h-4 w-4" />
              配置名称
            </Label>
            {isEditingName ? (
              <div className="flex gap-2">
                <Input
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  placeholder="输入配置名称"
                  autoFocus
                />
                <Button size="icon" variant="ghost" onClick={updateConfigName}>
                  <Check className="h-4 w-4 text-green-500" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setIsEditingName(false)}>
                  <XCircle className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  value={currentConfigName}
                  placeholder="默认使用API地址作为名称"
                  readOnly
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setEditingName(currentConfigName);
                    setIsEditingName(true);
                  }}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                {selectedConfigId && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => deleteConfig(selectedConfigId)}
                    className="text-red-500 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>

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
                onChange={(e) => setBaseUrl(e.target.value)}
              />
              {isCheckingUrl ? (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              ) : baseUrl && (
                <div className={`absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${isUrlValid && checkUrlSecurity(baseUrl).valid ? 'bg-green-500' : 'bg-red-500'}`} />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {`例如: ${DEFAULT_API_BASE_URL} 或 http://127.0.0.1:12347`}
            </p>
            {baseUrl && !isCheckingUrl && (
              <p className={`text-xs ${isUrlValid && checkUrlSecurity(baseUrl).valid ? 'text-green-600' : 'text-red-600'}`}>
                {!checkUrlSecurity(baseUrl).valid
                  ? checkUrlSecurity(baseUrl).message
                  : isUrlValid
                    ? 'API 地址有效'
                    : 'API 地址无效或无法连接'}
              </p>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSaveUrl} className="flex-1" disabled={!isUrlValid || !checkUrlSecurity(baseUrl).valid}>
              <Save className="h-4 w-4 mr-2" />
              保存配置
            </Button>
            <Button variant="outline" onClick={handleTestConnection} disabled={isTesting || !baseUrl || !checkUrlSecurity(baseUrl).valid}>
              {isTesting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <TestTube className="h-4 w-4 mr-2" />
              )}
              测试
            </Button>
          </div>

          {/* 保存到列表按钮 */}
          {baseUrl && (
            <Button
              variant="secondary"
              className="w-full"
              onClick={saveCurrentConfig}
            >
              <ArrowRight className="h-4 w-4 mr-2" />
              {selectedConfigId ? '更新到配置列表' : '保存到配置列表'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
