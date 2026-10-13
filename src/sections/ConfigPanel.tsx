import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Settings, Key, Globe, Save, TestTube } from 'lucide-react';
import { apiService } from '@/services/api';
import { DEFAULT_API_BASE_URL } from '@/lib/branding';
import { toast } from 'sonner';

interface ConfigPanelProps {
  onConfigChange: () => void;
}

export function ConfigPanel({ onConfigChange }: ConfigPanelProps) {
  const [baseUrl, setBaseUrl] = useState('');
  const [adminToken, setAdminToken] = useState('');
  const [useToken, setUseToken] = useState(true);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    const savedUrl = localStorage.getItem('api_base_url') || '';
    const savedTokenType = localStorage.getItem('api_token_type') || 'permanent';
    const savedUseToken = localStorage.getItem('api_use_token') !== 'false';
    
    // 根据类型获取对应的token
    let savedToken = '';
    if (savedUseToken) {
      if (savedTokenType === 'temp') {
        savedToken = localStorage.getItem('api_temp_token') || '';
      } else {
        savedToken = localStorage.getItem('api_admin_token') || '';
      }
    }
    
    setBaseUrl(savedUrl);
    setAdminToken(savedToken);
    setUseToken(savedUseToken);
    
    apiService.setConfig({
      baseUrl: savedUrl,
      adminToken: savedUseToken ? savedToken : '',
    });
  }, []);

  const handleSave = () => {
    localStorage.setItem('api_base_url', baseUrl);
    localStorage.setItem('api_admin_token', adminToken);
    localStorage.setItem('api_use_token', useToken.toString());
    
    apiService.setConfig({
      baseUrl,
      adminToken: useToken ? adminToken : '',
    });
    
    onConfigChange();
    toast.success('配置已保存');
  };

  const handleTestConnection = async () => {
    if (!baseUrl) {
      toast.error('请先输入API地址');
      return;
    }

    setIsTesting(true);
    try {
      apiService.setConfig({
        baseUrl,
        adminToken: useToken ? adminToken : '',
      });

      // 使用 /room 接口校验 API 是否有效
      await apiService.getRooms();
      toast.success('连接测试成功！');
    } catch (error) {
      toast.error('连接测试失败，请检查API地址');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          API 配置
        </CardTitle>
        <CardDescription>
          配置 API 服务器地址和管理员 TOKEN
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="baseUrl" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            API 地址
          </Label>
          <Input
            id="baseUrl"
            placeholder={DEFAULT_API_BASE_URL}
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            例如: {DEFAULT_API_BASE_URL}
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            <Label htmlFor="useToken">使用管理员 TOKEN</Label>
          </div>
          <Switch
            id="useToken"
            checked={useToken}
            onCheckedChange={setUseToken}
          />
        </div>

        {useToken && (
          <div className="space-y-2">
            <Label htmlFor="adminToken">管理员 TOKEN</Label>
            <Input
              id="adminToken"
              type="password"
              placeholder="your_admin_token"
              value={adminToken}
              onChange={(e) => setAdminToken(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              可选。留空可使用 OTP 方式获取临时 TOKEN
            </p>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button onClick={handleSave} className="flex-1">
            <Save className="h-4 w-4 mr-2" />
            保存配置
          </Button>
          <Button variant="outline" onClick={handleTestConnection} disabled={isTesting}>
            <TestTube className="h-4 w-4 mr-2" />
            {isTesting ? '测试中...' : '测试连接'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
