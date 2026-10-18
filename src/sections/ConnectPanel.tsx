import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Copy, Link2, Server, Settings, Smartphone, Users } from 'lucide-react';
import { BRAND } from '@/lib/branding';
import { toast } from 'sonner';
import { useState } from 'react';

/** 连接步骤（与 Phira 客户端内的实际菜单一致） */
const STEPS = [
  {
    icon: Settings,
    title: '点击「设置」',
    detail: '打开 Phira 客户端，在主界面找到并点击设置。',
  },
  {
    icon: Smartphone,
    title: '进入「通用」，打开「多人游戏」',
    detail: '在设置里切到「通用」分类，把「多人游戏」开关打开。',
  },
  {
    icon: Server,
    title: '填入多人游戏服务器地址',
    detail: '开启后，设置里下方会出现「多人游戏服务器」输入框，把上方显示的服务器地址填进去即可。',
  },
];

export function ConnectPanel() {
  const [copied, setCopied] = useState(false);

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(BRAND.joinAddress);
      setCopied(true);
      toast.success('服务器地址已复制');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('复制失败，请手动输入');
    }
  };

  return (
    <div className="flex flex-1 flex-col space-y-4 animate-fade-in">
      <Card className="flex flex-1 flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            如何连接
          </CardTitle>
          <CardDescription>
            按下面三步把 Phira 客户端连到本服务器，全程不需要额外工具
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col space-y-6">
          {/* 服务器地址（最显眼，方便直接复制） */}
          <div className="rounded-xl border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Server className="h-4 w-4" />
              服务器地址
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <span className="font-mono text-lg font-semibold break-all">{BRAND.joinAddress}</span>
              <Button onClick={() => void copyAddress()} className="shrink-0">
                {copied ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    已复制
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    复制地址
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* 步骤 */}
          <div className="space-y-3">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <Card key={step.title} className="card-soft">
                  <CardContent className="flex items-start gap-4 p-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 font-bold text-primary">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{step.title}</span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{step.detail}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* 补充说明 */}
          <div className="rounded-lg border bg-muted/40 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span className="font-medium">本服务器支持最大 64 人联机</span>
              <Badge variant="secondary">房间人数上限可由管理员调整</Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              连上之后可以在「房间查询」看当前所有房间；游玩记录、游玩排行、回放查询等功能可在
              <a
                href={BRAND.panelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mx-1 font-medium text-primary hover:underline"
              >
                tphira.danieluu.top
              </a>
              查看。
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
