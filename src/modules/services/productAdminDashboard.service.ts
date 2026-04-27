export interface DashboardMetric {
  value: number;
  changePercent: number;
  changeLabel: string;
}

export interface WeeklyOverviewPoint {
  day: string;
  problems: number;
  users: number;
}

export interface ActivityDistributionPoint {
  day: string;
  activity: number;
}

export interface RecentActivityItem {
  id: string;
  title: string;
  actor: string;
  timeAgo: string;
}

export interface ProductAdminDashboardData {
  overview: {
    totalProblems: DashboardMetric;
    activeUsersToday: DashboardMetric;
    studentActivity: DashboardMetric;
    growthRate: DashboardMetric;
  };
  weeklyOverview: WeeklyOverviewPoint[];
  activityDistribution: ActivityDistributionPoint[];
  recentActivity: RecentActivityItem[];
}

const PRODUCT_ADMIN_DASHBOARD_DATA: ProductAdminDashboardData = {
  overview: {
    totalProblems: {
      value: 1284,
      changePercent: 12,
      changeLabel: "+12% from last week",
    },
    activeUsersToday: {
      value: 328,
      changePercent: 8,
      changeLabel: "+8% from last week",
    },
    studentActivity: {
      value: 2847,
      changePercent: 15,
      changeLabel: "+15% from last week",
    },
    growthRate: {
      value: 23,
      changePercent: 3,
      changeLabel: "+3% from last week",
    },
  },
  weeklyOverview: [
    { day: "Mon", problems: 24, users: 40 },
    { day: "Tue", problems: 30, users: 45 },
    { day: "Wed", problems: 20, users: 50 },
    { day: "Thu", problems: 27, users: 48 },
    { day: "Fri", problems: 35, users: 55 },
    { day: "Sat", problems: 30, users: 52 },
    { day: "Sun", problems: 25, users: 45 },
  ],
  activityDistribution: [
    { day: "Mon", activity: 24 },
    { day: "Tue", activity: 30 },
    { day: "Wed", activity: 28 },
    { day: "Thu", activity: 35 },
    { day: "Fri", activity: 42 },
    { day: "Sat", activity: 38 },
    { day: "Sun", activity: 32 },
  ],
  recentActivity: [
    { id: "activity_1", title: "New problem created", actor: "Admin User", timeAgo: "2 hours ago" },
    { id: "activity_2", title: "User registered", actor: "System", timeAgo: "4 hours ago" },
    { id: "activity_3", title: "Hackathon published", actor: "Super Admin", timeAgo: "6 hours ago" },
    { id: "activity_4", title: "MCQ updated", actor: "Admin User", timeAgo: "1 day ago" },
    { id: "activity_5", title: "New college added", actor: "Super Admin", timeAgo: "2 days ago" },
  ],
};

export function getProductAdminDashboardData(): ProductAdminDashboardData {
  return PRODUCT_ADMIN_DASHBOARD_DATA;
}
