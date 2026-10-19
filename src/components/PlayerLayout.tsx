import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Activity, Film, Link2, MessagesSquare, Trophy, Users } from 'lucide-react';

const playerSubTabs = [
  { path: '/player/connect', matchPath: '/player/connect', label: '如何连接', icon: Link2 },
  { path: '/player/rooms', matchPath: '/player/rooms', label: '房间查询', icon: Users },
  { path: '/player/status', matchPath: '/player/status', label: '服务器状态', icon: Activity },
  { path: '/player/replay', matchPath: '/player/replay', label: '查询回放', icon: Film },
  { path: '/player/ranking', matchPath: '/player/ranking', label: '游玩排行', icon: Trophy },
  { path: '/player/community', matchPath: '/player/community', label: '社群加入', icon: MessagesSquare },
];

export function PlayerLayout() {
  const location = useLocation();

  return (
    <div className="flex flex-1 flex-col space-y-4 animate-fade-in">
      <nav className="border-b bg-card/50 -mx-4 px-4 md:mx-0 md:px-0 md:rounded-lg md:border md:bg-card md:py-1">
        {/* 移动端用 3×2 网格：六个标签全部可见，避免横向滚动把后几项藏起来 */}
        <div className="grid grid-cols-3 gap-1.5 py-2 md:flex md:gap-1 md:overflow-x-auto md:py-0">
          {playerSubTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive =
              location.pathname === tab.matchPath ||
              location.pathname.startsWith(`${tab.matchPath}/`);

            return (
              <NavLink
                key={tab.path}
                to={tab.path}
                className={[
                  'relative flex flex-col items-center justify-center gap-1 whitespace-nowrap rounded-lg px-1 py-2 text-xs font-medium transition-all duration-200',
                  'md:flex-row md:gap-2 md:px-4 md:text-sm',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                ].join(' ')}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{tab.label}</span>
                {isActive && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-primary" />
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>

      <Outlet />
    </div>
  );
}
