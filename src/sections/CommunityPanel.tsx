import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, ExternalLink, Heart, MessagesSquare, Users } from 'lucide-react';
import { BRAND } from '@/lib/branding';
import { toast } from 'sonner';

export function CommunityPanel() {
  const copyJoinAddress = async () => {
    try {
      await navigator.clipboard.writeText(BRAND.joinAddress);
      toast.success('联机地址已复制');
    } catch {
      toast.error('复制失败，请手动输入');
    }
  };

  return (
    <div className="flex flex-1 flex-col space-y-4 animate-fade-in">
      <Card className="flex flex-1 flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessagesSquare className="h-5 w-5" />
            加入社群
          </CardTitle>
          <CardDescription>
            欢迎大家来访交流，讨论各种音游话题！
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col space-y-6">
          {/* 欢迎横幅 */}
          <div className="rounded-xl border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-primary/15 p-2">
                <Heart className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold">欢迎来到 {BRAND.owner} 的 Phira 服务器！</p>
                <p className="text-sm text-muted-foreground">
                  无论是想找人一起打歌、交流谱面心得，还是单纯想找人聊天，聊各种音游，都欢迎加入我们的群组哦！
                  有服务器相关的问题也可以在群里询问我们哦！
                </p>
              </div>
            </div>
          </div>

          {/* QQ 群 */}
          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Users className="h-4 w-4" />
              交流群
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {BRAND.groups.map((group, index) => (
                <Card key={group.url} className="card-soft">
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{group.label}</span>
                        <Badge variant="secondary">#{index + 1}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">QQ 群 · 点击右侧按钮加入</p>
                    </div>
                    <Button asChild className="shrink-0">
                      <a href={group.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        加入
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* 联机地址 */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">联机地址</h3>
            <Card className="card-soft">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <span className="font-mono text-sm">{BRAND.joinAddress}</span>
                <Button variant="outline" size="sm" onClick={() => void copyJoinAddress()}>
                  <Copy className="mr-2 h-4 w-4" />
                  复制
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* 相关站点 */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">相关站点</h3>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href={BRAND.siteUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {BRAND.owner} 的主页
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
