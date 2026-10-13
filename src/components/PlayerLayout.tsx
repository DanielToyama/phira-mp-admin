import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Film, Users } from 'lucide-react';

const playerSubTabs = [
  { path: '/player/rooms', matchPath: '/player/rooms', label: '房间查询', icon: Users },
  { path: '/player/replay', matchPath: '/player/replay', label: '录制回放', icon: Film },
];

export function PlayerLayout() {
  const location = useLocation();

  return (
    <div className="flex flex-1 flex-col space-y-4 animate-fade-in">
      <nav className="border-b bg-card/50 -mx-4 px-4 md:-mx-0 md:px-0 md:rounded-lg md:border md:bg-card md:py-1">
        <div className="flex gap-1 overflow-x-auto py-2 md:py-0">
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
                  'relative flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                ].join(' ')}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
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
