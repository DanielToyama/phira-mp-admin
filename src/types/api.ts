// API 类型定义

export interface ApiConfig {
  baseUrl: string;
  adminToken: string;
}

export interface Room {
  roomid: string;
  max_users: number;
  live: boolean;
  locked: boolean;
  cycle: boolean;
  host: { id: number; name: string };
  state: {
    type: 'select_chart' | 'playing' | 'waiting' | 'waiting_for_ready';
    ready_users?: number[];
    ready_count?: number;
    results_count?: number;
    aborted_count?: number;
    finished_users?: number[];
    aborted_users?: number[];
  };
  chart: { id: number; name: string };
  users: RoomUser[];
  monitors: any[];
  recent_logs?: { message: string; timestamp: number }[];
}

export interface RoomUser {
  id: number;
  name: string;
  connected: boolean;
  is_host: boolean;
  game_time: number;
  language: string;
  finished?: boolean;
  aborted?: boolean;
  record_id?: number;
}

export interface PublicRoom {
  roomid: string;
  cycle: boolean;
  lock: boolean;
  host: { name: string; id: string };
  state: string;
  chart: { name: string; id: string };
  players: { name: string; id: number }[];
  /** 房间人数上限。官方 tphira-mp 的 /room 不含此字段，为可选；
   *  自建服务端会附带返回，取不到时不要伪造默认值。 */
  max_users?: number;
  /** 隐私房间（房号以 h 开头）：服务端会清空所有详情，前端渲染为不可点击的灰块 */
  hidden?: boolean;
}

/** 游玩排行条目（服务端 /stats/leaderboard 返回） */
export interface LeaderboardEntry {
  id: number;
  name: string;
  /** 已完成的对局数 */
  plays: number;
  /** 平均分数 */
  avg_score: number;
  /** 平均准度（0..1） */
  avg_accuracy: number;
  /** 最近一次游玩时间（毫秒时间戳） */
  last_played: number;
}

export interface LeaderboardResponse {
  ok: boolean;
  total: number;
  offset: number;
  limit: number;
  players: LeaderboardEntry[];
}

/**
 * `/stats/leaderboard?user_id=N` 的返回：按用户查名次。
 * rank 从 1 起，未上榜时为 0 且 entry 为 null。
 */
export interface MyRankResponse {
  ok: boolean;
  total: number;
  rank: number;
  entry: LeaderboardEntry | null;
}

/** 每日一句 */
export interface DailyQuote {
  quote: string;
  from: string;
}

/** `/stats/server` 的返回：社区面板数据 */
export interface ServerStatsResponse {
  ok: boolean;
  /** 服务器上线日期（本功能首次启动）YYYY-MM-DD */
  bornDate: string;
  /** 今天是服务器第几天（1 起） */
  serverDay: number;
  today: string;
  /** 累计出现过的账号数 */
  totalAccounts: number;
  /** 今日连接次数 */
  todayConnections: number;
  /** 今日连入的不同账号数 */
  todayUsers: number;
  /** 今日新账号数 */
  todayNewAccounts: number;
  /** 当前在线人数 */
  onlineUsers: number;
  /** 当前房间数 */
  rooms: number;
  /** 今日房间名聚合（只有统计量，没有原文） */
  roomStats: {
    created: number;
    maxNameLength: number;
    withDigit: number;
    digitRatio: number;
    easter: Record<string, number>;
  };
  dailyQuote: DailyQuote;
}

export interface UserInfo {
  id: number;
  name: string;
  monitor: boolean;
  connected: boolean;
  room: string;
  banned: boolean;
}

export interface ReplayChart {
  chartId: number;
  replays: { timestamp: number; recordId: number; scoreId?: number; downloadUrl?: string }[];
}

export interface ReplayAuthResponse {
  ok: boolean;
  userId: number;
  charts: ReplayChart[];
  sessionToken: string;
  expiresAt: number;
}

export interface ApiResponse<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface OtpRequestResponse {
  ok: boolean;
  ssid: string;
  expiresIn: number;
  mode?: OtpMode;
  error?: string;
}

export interface OtpVerifyResponse {
  ok: boolean;
  token: string;
  expiresAt: number;
  expiresIn: number;
  mode?: OtpMode;
  status?: OtpCliStatus;
  error?: string;
}

export type OtpMode = 'otp' | 'cli';
export type OtpCliStatus = 'pending' | 'denied';

export interface CurrentUserInfo {
  id: number;
  name: string;
  avatar: string;
  badges: string[];
  language: string;
  bio: string | null;
  exp: number;
  rks: number;
  joined: string;
  last_login: string;
  roles: number;
  banned: boolean;
  login_banned: boolean;
  follower_count: number;
  following_count: number;
  email: string;
}

// 分享站相关类型
export interface ReplayUploadResponse {
  ok: boolean;
  userId: number;
  chartId: number;
  recordId: number;
  scoreId: number;
  message: string;
  error?: string;
}

export interface AutoUploadConfigResponse {
  ok: boolean;
  userId: number;
  show: boolean;
  shareStationConfigured: boolean;
  autoUploadEnabled: boolean;
  error?: string;
}

export interface AutoUploadConfigRequest {
  token: string;
  show?: boolean;
}
