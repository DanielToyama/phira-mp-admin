import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Play, 
  Download, 
  Trash2, 
  Film,
  FileAudio,
  Music,
  ChevronDown,
  ChevronUp,
  LogIn,
  LogOut,
  User,
  Upload,
  Settings,
  CircleAlert
} from 'lucide-react';
import { apiService } from '@/services/api';
import { phiraApiService } from '@/services/phiraApi';
import { toast } from 'sonner';
import { ChartDetailDialog } from '@/components/ChartDetailDialog';
import { LoginDialog } from '@/components/LoginDialog';
import { applyApiConfig } from '@/hooks/useApiConfig';
import type { ReplayAuthResponse, ReplayChart, AutoUploadConfigResponse } from '@/types/api';
import type { ChartInfo } from '@/services/phiraApi';

export function ReplayPanel() {
  const [replayData, setReplayData] = useState<ReplayAuthResponse | null>(null);
  const [sessionToken, setSessionToken] = useState('');
  const [expandedCharts, setExpandedCharts] = useState<Set<number>>(new Set());
  const [chartInfos, setChartInfos] = useState<Map<number, ChartInfo>>(new Map());
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userId, setUserId] = useState<number>(0);
  const [userName, setUserName] = useState<string>('');
  const [autoLoading, setAutoLoading] = useState(false);
  const [uploadingReplays, setUploadingReplays] = useState<Set<string>>(new Set());

  // 谱面详情弹窗状态
  const [selectedChartId, setSelectedChartId] = useState<number | null>(null);
  const [chartDialogOpen, setChartDialogOpen] = useState(false);

  // 自动上传配置状态
  const [autoUploadConfig, setAutoUploadConfig] = useState<AutoUploadConfigResponse | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);

  // 上传确认对话框状态
  const [uploadConfirmOpen, setUploadConfirmOpen] = useState(false);
  const [pendingUpload, setPendingUpload] = useState<{ chartId: number; timestamp: number } | null>(null);

  // 加载谱面信息
  const loadChartInfo = useCallback(async (chartId: number) => {
    const info = await phiraApiService.getChartInfoCached(chartId);
    if (info) {
      setChartInfos(prev => new Map(prev).set(chartId, info));
    }
    return info;
  }, []);

  // 从本地存储加载配置
  useEffect(() => {
    applyApiConfig();

    // 检查登录状态并自动获取回放
    const token = phiraApiService.getUserToken();
    const uid = phiraApiService.getUserId();
    const savedUrl = localStorage.getItem('api_base_url') || '';

    if (!token || !uid) return;

    setIsLoggedIn(true);
    setUserId(uid);

    // 先校验登录态：判为失效时事件会通知本组件切回未登录，这里直接中止；
    // 网络异常等无法判定的情况按「未失效」处理，继续尝试拉取回放
    void phiraApiService.validateSession().then((result) => {
      if (result.status === 'expired') return;
      if (result.status === 'valid') setUserName(result.profile.name);

      // 如果API已配置，自动获取回放
      if (!savedUrl) return;
      setAutoLoading(true);
      apiService.replayAuth(token).then((data) => {
        if (data.ok) {
          setReplayData(data);
          setSessionToken(data.sessionToken);
          toast.success(`已自动加载 ${data.charts?.length || 0} 个谱面的回放记录`);
          // 预加载谱面信息
          data.charts?.forEach((chart: ReplayChart) => {
            loadChartInfo(chart.chartId);
          });
        }
      }).catch((err) => {
        console.error('[ReplayPanel] 自动获取回放失败:', err);
      }).finally(() => {
        setAutoLoading(false);
      });
    });
  }, []);

  // TOKEN 失效时清空回放列表并切回未登录
  useEffect(() => {
    const handleExpired = () => {
      setIsLoggedIn(false);
      setUserId(0);
      setUserName('');
      setReplayData(null);
      setSessionToken('');
    };
    window.addEventListener('phiraSessionExpired', handleExpired);
    return () => window.removeEventListener('phiraSessionExpired', handleExpired);
  }, []);

  // 监听登录成功事件，自动更新回放列表
  useEffect(() => {
    const handleReplayAuthSuccess = (event: CustomEvent<ReplayAuthResponse>) => {
      const data = event.detail;
      setReplayData(data);
      setSessionToken(data.sessionToken);
      
      // 预加载谱面信息
      data.charts?.forEach((chart: ReplayChart) => {
        loadChartInfo(chart.chartId);
      });
    };

    window.addEventListener('replayAuthSuccess', handleReplayAuthSuccess as EventListener);
    return () => {
      window.removeEventListener('replayAuthSuccess', handleReplayAuthSuccess as EventListener);
    };
  }, [loadChartInfo]);

  const handleLoginSuccess = () => {
    const token = phiraApiService.getUserToken();
    const uid = phiraApiService.getUserId();
    if (token && uid) {
      setIsLoggedIn(true);
      setUserId(uid);
      // 获取用户信息
      apiService.getCurrentUser().then((userInfo) => {
        setUserName(userInfo.name);
      }).catch(() => {
        // 获取失败时不影响其他功能
      });
      // 登录成功后自动获取回放
      handleFetchReplay();
    }
  };

  const handleLogout = () => {
    phiraApiService.clearAuth();
    setIsLoggedIn(false);
    setUserId(0);
    setUserName('');
    setReplayData(null);
    setSessionToken('');
    toast.success('已退出登录');
  };

  const handleFetchReplay = async () => {
    const config = apiService.getConfig();
    if (!config.baseUrl) {
      toast.error('请先配置 API 地址');
      return;
    }

    const tokenToUse = phiraApiService.getUserToken();
    if (!tokenToUse) {
      toast.error('请先登录 Phira 账号');
      return;
    }

    setAutoLoading(true);
    try {
      const data = await apiService.replayAuth(tokenToUse);
      if (data.ok) {
        setReplayData(data);
        setSessionToken(data.sessionToken);
        toast.success(`已加载 ${data.charts?.length || 0} 个谱面的回放记录`);
        // 预加载谱面信息
        data.charts?.forEach((chart: ReplayChart) => {
          loadChartInfo(chart.chartId);
        });
      } else {
        toast.error('获取回放失败');
      }
    } catch {
      toast.error('获取回放请求失败');
    } finally {
      setAutoLoading(false);
    }
  };

  const handleDownloadReplay = (chartId: number, timestamp: number) => {
    const url = apiService.getReplayDownloadUrl(sessionToken, chartId, timestamp);
    window.open(url, '_blank');
  };

  const handleDeleteReplay = async (chartId: number, timestamp: number) => {
    try {
      const result = await apiService.deleteReplay(sessionToken, chartId, timestamp);
      if (result.ok) {
        toast.success('回放已删除');
        handleFetchReplay();
      } else {
        toast.error('删除失败');
      }
    } catch {
      toast.error('删除请求失败');
    }
  };

  const toggleChartExpand = (chartId: number) => {
    setExpandedCharts(prev => {
      const next = new Set(prev);
      if (next.has(chartId)) {
        next.delete(chartId);
      } else {
        next.add(chartId);
      }
      return next;
    });
  };

  const handleOpenChartDetail = (chartId: number) => {
    setSelectedChartId(chartId);
    setChartDialogOpen(true);
  };

  // 打开上传确认对话框
  const openUploadConfirm = (chartId: number, timestamp: number) => {
    const token = phiraApiService.getUserToken();
    if (!token) {
      toast.error('请先登录 Phira 账号');
      return;
    }
    setPendingUpload({ chartId, timestamp });
    setUploadConfirmOpen(true);
  };

  // 确认上传回放到分享站
  const confirmUploadReplay = async () => {
    if (!pendingUpload) return;

    const token = phiraApiService.getUserToken();
    if (!token) {
      toast.error('请先登录 Phira 账号');
      return;
    }

    const { chartId, timestamp } = pendingUpload;
    const uploadKey = `${chartId}-${timestamp}`;
    setUploadingReplays(prev => new Set(prev).add(uploadKey));
    setUploadConfirmOpen(false);

    try {
      const result = await apiService.uploadReplay(token, chartId, timestamp);
      if (result.ok) {
        toast.success('上传成功', {
          description: `记录ID: ${result.recordId}, 成绩ID: ${result.scoreId}`,
        });
      } else {
        toast.error('上传失败', {
          description: result.error || '未知错误',
        });
      }
    } catch (err) {
      toast.error('上传请求失败');
    } finally {
      setUploadingReplays(prev => {
        const next = new Set(prev);
        next.delete(uploadKey);
        return next;
      });
      setPendingUpload(null);
    }
  };

  // 获取自动上传配置
  const handleFetchAutoUploadConfig = async () => {
    const token = phiraApiService.getUserToken();
    if (!token) {
      toast.error('请先登录 Phira 账号');
      return;
    }

    setConfigLoading(true);
    try {
      const result = await apiService.getAutoUploadConfig(token);
      if (result.ok) {
        setAutoUploadConfig(result);
        setConfigDialogOpen(true);
      } else {
        toast.error('获取配置失败', {
          description: result.error || '未知错误',
        });
      }
    } catch {
      toast.error('获取配置请求失败');
    } finally {
      setConfigLoading(false);
    }
  };

  // 修改自动上传配置
  const handleUpdateAutoUploadConfig = async (show: boolean) => {
    const token = phiraApiService.getUserToken();
    if (!token) {
      toast.error('请先登录 Phira 账号');
      return;
    }

    setConfigLoading(true);
    try {
      const result = await apiService.setAutoUploadConfig({ token, show });
      if (result.ok) {
        setAutoUploadConfig(result);
        toast.success('配置已更新');
      } else {
        toast.error('更新配置失败', {
          description: result.error || '未知错误',
        });
      }
    } catch {
      toast.error('更新配置请求失败');
    } finally {
      setConfigLoading(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col space-y-4 animate-fade-in">
      <Card className="flex flex-1 flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Film className="h-5 w-5" />
            谱面回放
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="回放文件说明"
                  className="inline-flex items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <CircleAlert className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[260px] text-center">
                下载的文件可使用Phira Pro等支持phirarec的客户端访问！
              </TooltipContent>
            </Tooltip>
          </CardTitle>
          <CardDescription>查看和下载用户的游戏回放记录</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" />
              {isLoggedIn ? (
                <span className="text-sm">
                  已登录 <span className="font-medium">{userName || `用户 ${userId}`}</span>
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">未登录</span>
              )}
            </div>
            <div className="flex gap-2">
              {isLoggedIn ? (
                <>
                  <Button 
                    size="sm" 
                    onClick={handleFetchReplay} 
                    disabled={autoLoading}
                  >
                    <Play className={`h-4 w-4 mr-2 ${autoLoading ? 'animate-spin' : ''}`} />
                    {autoLoading ? '加载中...' : '获取回放'}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={handleFetchAutoUploadConfig}
                    disabled={configLoading}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    自动上传
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    退出
                  </Button>
                </>
              ) : (
                <LoginDialog onLoginSuccess={handleLoginSuccess}>
                  <Button size="sm">
                    <LogIn className="h-4 w-4 mr-2" />
                    登录
                  </Button>
                </LoginDialog>
              )}
            </div>
          </div>

          {replayData && replayData.charts && replayData.charts.length > 0 && (
            <div className="space-y-3 animate-fade-in">
              <Separator />
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">用户 ID: {replayData.userId}</span>
                <span className="text-muted-foreground">|</span>
                <span className="text-muted-foreground">
                  过期: {new Date(replayData.expiresAt).toLocaleString()}
                </span>
              </div>
              
              <ScrollArea className="h-[450px]">
                <div className="space-y-3">
                  {replayData.charts.map((chart: ReplayChart) => {
                    const chartInfo = chartInfos.get(chart.chartId);
                    const isExpanded = expandedCharts.has(chart.chartId);
                    
                    return (
                      <div
                        key={chart.chartId}
                        className="p-3 border rounded-lg transition-all duration-200"
                      >
                        <div 
                          className="flex items-center justify-between cursor-pointer"
                          onClick={() => toggleChartExpand(chart.chartId)}
                        >
                          <div className="flex items-center gap-2">
                            <Music className="h-4 w-4 text-muted-foreground" />
                            <span 
                              className="font-medium hover:text-primary transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenChartDetail(chart.chartId);
                              }}
                            >
                              {chartInfo ? chartInfo.name : `谱面 ID: ${chart.chartId}`}
                            </span>
                            {chartInfo && (
                              <Badge 
                                variant="secondary" 
                                className="text-xs hover:bg-secondary/80"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenChartDetail(chart.chartId);
                                }}
                              >
                                {chartInfo.level}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{chart.replays.length} 个回放</Badge>
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </div>
                        </div>
                        
                        {isExpanded && (
                          <div className="mt-3 space-y-2 animate-fade-in">
                            {chartInfo && (
                              <div className="text-xs text-muted-foreground space-y-1 p-2 bg-muted rounded">
                                <div>谱师: {chartInfo.charter}</div>
                                <div>曲师: {chartInfo.composer}</div>
                                <div>难度: {chartInfo.difficulty.toFixed(1)}</div>
                              </div>
                            )}
                            {chart.replays.map((replay) => {
                              const isUploaded = !!replay.scoreId;
                              const uploadKey = `${chart.chartId}-${replay.timestamp}`;
                              return (
                                <div
                                  key={replay.timestamp}
                                  className="flex items-center justify-between p-2 bg-muted rounded transition-colors hover:bg-muted/80"
                                >
                                  <div className="flex items-center gap-2 text-sm">
                                    <FileAudio className="h-4 w-4" />
                                    <span>{new Date(replay.timestamp).toLocaleString()}</span>
                                    <Badge variant="outline" className="text-xs">
                                      ID: {replay.recordId}
                                    </Badge>
                                    {isUploaded && (
                                      <Badge variant="secondary" className="text-xs">
                                        已上传
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex gap-1">
                                    {isUploaded && replay.downloadUrl ? (
                                      <Button 
                                        size="sm" 
                                        variant="ghost"
                                        onClick={() => window.open(replay.downloadUrl, '_blank')}
                                      >
                                        <Download className="h-4 w-4" />
                                      </Button>
                                    ) : (
                                      <>
                                        <Button 
                                          size="sm" 
                                          variant="ghost"
                                          onClick={() => handleDownloadReplay(chart.chartId, replay.timestamp)}
                                        >
                                          <Download className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => openUploadConfirm(chart.chartId, replay.timestamp)}
                                          disabled={uploadingReplays.has(uploadKey)}
                                        >
                                          <Upload className={`h-4 w-4 ${uploadingReplays.has(uploadKey) ? 'animate-spin' : ''}`} />
                                        </Button>
                                        <Button 
                                          size="sm" 
                                          variant="ghost"
                                          onClick={() => handleDeleteReplay(chart.chartId, replay.timestamp)}
                                        >
                                          <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}

          {replayData && (!replayData.charts || replayData.charts.length === 0) && (
            <div className="text-center py-4 text-muted-foreground">
              该用户暂无回放记录
            </div>
          )}
        </CardContent>
      </Card>

      {/* 谱面详情弹窗 */}
      {selectedChartId && (
        <ChartDetailDialog
          chartId={selectedChartId}
          open={chartDialogOpen}
          onOpenChange={setChartDialogOpen}
        />
      )}

      {/* 自动上传配置弹窗 */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              自动上传配置
            </DialogTitle>
            <DialogDescription>
              配置游戏结束后是否自动将回放上传到分享站
            </DialogDescription>
          </DialogHeader>
          {autoUploadConfig && (
            <div className="space-y-6 py-4">
              {!autoUploadConfig.shareStationConfigured && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
                  服务器未配置分享站，自动上传功能不可用
                </div>
              )}
              {autoUploadConfig.shareStationConfigured && !autoUploadConfig.autoUploadEnabled && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
                  服务器已关闭自动上传功能，请联系管理员开启
                </div>
              )}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="show-replay">上传后显示</Label>
                  <p className="text-sm text-muted-foreground">
                    自动上传的回放在分享站是否可见
                  </p>
                </div>
                <Switch
                  id="show-replay"
                  checked={autoUploadConfig.show}
                  onCheckedChange={(checked) =>
                    handleUpdateAutoUploadConfig(checked)
                  }
                  disabled={configLoading || !autoUploadConfig.shareStationConfigured || !autoUploadConfig.autoUploadEnabled}
                />
              </div>
            </div>
          )}
          <CardFooter className="flex justify-end px-0">
            <Button onClick={() => setConfigDialogOpen(false)}>
              关闭
            </Button>
          </CardFooter>
        </DialogContent>
      </Dialog>

      {/* 上传确认对话框 */}
      <AlertDialog open={uploadConfirmOpen} onOpenChange={setUploadConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认上传</AlertDialogTitle>
            <AlertDialogDescription>
              确定要将此回放上传到 Phira Replay 分享站吗？上传后该回放将对其他用户可见（根据您的显示设置）。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingUpload(null)}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUploadReplay}>确认上传</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
