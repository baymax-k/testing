import { prisma } from "../../config/prisma.js";

export interface DashboardStats {
  totalProblems: number;
  solvedProblems: number;
  totalSubmissions: number;
  acceptedSubmissions: number;
  acceptanceRate: number;
  currentStreak: number;
  longestStreak: number;
  lastSolveDate: Date | null;
}

export interface RecentActivity {
  id: string;
  type: 'dsa_solved' | 'arduino_solved' | 'mcq_practice' | 'contest_joined';
  title: string;
  description: string;
  timestamp: Date;
  points?: number;
  difficulty?: string;
}

export interface UpcomingContests {
  id: string;
  title: string;
  startTime: Date;
  duration: number; // minutes
  type: string;
  participantCount: number;
}

export interface StudentDashboardData {
  stats: DashboardStats;
  recentActivity: RecentActivity[];
  upcomingContests: UpcomingContests[];
  potdStreak: {
    current: number;
    longest: number;
    todaySolved: boolean;
  };
  progressToday: {
    problemsSolved: number;
    mcqSolved: number;
    practiceMinutes: number;
  };
  weeklyProgress: {
    date: string;
    problems: number;
    mcq: number;
  }[];
}

export async function getStudentDashboard(userId: string): Promise<StudentDashboardData> {
  // Get all stats in parallel
  const [
    totalSubmissions,
    acceptedSubmissions,
    uniqueAcceptedProblems,
    userStreak,
    recentSubmissions,
    recentArduinoSubmissions,
    recentMCQSessions,
    upcomingContests,
    todayActivity,
    weeklyActivity,
    potdSolveToday,
    totalProblems
  ] = await Promise.all([
    // Total submissions count
    prisma.submission.count({
      where: { userId }
    }),
    
    // Accepted submissions count
    prisma.submission.count({
      where: { userId, status: "accepted" }
    }),
    
    // Unique solved problems
    prisma.submission.findMany({
      where: { userId, status: "accepted" },
      distinct: ["problemId"],
      select: { problemId: true }
    }),
    
    // User streak info
    prisma.userStreak.findUnique({
      where: { userId }
    }),
    
    // Recent DSA submissions (last 10)
    prisma.submission.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        user: { select: { name: true } }
      }
    }),
    
    // Recent Arduino submissions (last 5)
    prisma.arduinoSubmission.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        problem: {
          include: {
            question: { select: { title: true, difficulty: true } }
          }
        }
      }
    }),
    
    // Recent MCQ practice sessions (last 5)
    prisma.mCQPracticeSession.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5
    }),
    
    // Upcoming contests (next 5)
    prisma.contest.findMany({
      where: {
        startTime: {
          gte: new Date()
        }
      },
      orderBy: { startTime: "asc" },
      take: 5,
      include: {
        participations: {
          select: { id: true }
        }
      }
    }),
    
    // Today's activity
    prisma.practiceActivity.findUnique({
      where: {
        userId_date: {
          userId,
          date: new Date()
        }
      }
    }),
    
    // Weekly activity (last 7 days)
    prisma.practiceActivity.findMany({
      where: {
        userId,
        date: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
      },
      orderBy: { date: "desc" }
    }),
    
    // Check if POTD solved today
    prisma.dailyChallengeSolve.findFirst({
      where: {
        userId,
        solvedAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0))
        }
      }
    }),
    
    // Total available problems
    prisma.question.count()
  ]);

  // Build recent activity
  const recentActivity: RecentActivity[] = [];
  
  // Add DSA submissions
  recentSubmissions.forEach(sub => {
    recentActivity.push({
      id: sub.id,
      type: sub.status === 'accepted' ? 'dsa_solved' : 'dsa_solved',
      title: `${sub.status === 'accepted' ? 'Solved' : 'Attempted'} DSA Problem`,
      description: `Problem ${sub.problemId}`,
      timestamp: sub.createdAt,
      difficulty: 'medium' // We'd need to join with question to get real difficulty
    });
  });
  
  // Add Arduino submissions
  recentArduinoSubmissions.forEach(sub => {
    recentActivity.push({
      id: sub.id,
      type: 'arduino_solved',
      title: `${sub.status === 'accepted' ? 'Solved' : 'Attempted'} Arduino Problem`,
      description: sub.problem.question.title,
      timestamp: sub.createdAt,
      difficulty: sub.problem.question.difficulty
    });
  });
  
  // Add MCQ sessions
  recentMCQSessions.forEach(session => {
    recentActivity.push({
      id: session.id,
      type: 'mcq_practice',
      title: 'MCQ Practice Session',
      description: `${session.correctCount}/${session.totalQuestions} correct`,
      timestamp: session.createdAt,
      points: session.score
    });
  });
  
  // Sort by timestamp
  recentActivity.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  
  // Build stats
  const stats: DashboardStats = {
    totalProblems,
    solvedProblems: uniqueAcceptedProblems.length,
    totalSubmissions,
    acceptedSubmissions,
    acceptanceRate: totalSubmissions > 0 ? Math.round((acceptedSubmissions / totalSubmissions) * 100) : 0,
    currentStreak: userStreak?.currentStreak || 0,
    longestStreak: userStreak?.longestStreak || 0,
    lastSolveDate: userStreak?.lastSolveDate || null
  };
  
  // Build upcoming contests
  const upcomingContestsData: UpcomingContests[] = upcomingContests.map(contest => ({
    id: contest.id,
    title: contest.title,
    startTime: contest.startTime!,
    duration: contest.duration || 120,
    type: contest.type,
    participantCount: contest.participations.length
  }));
  
  // Build weekly progress
  const weeklyProgress = weeklyActivity.map(activity => ({
    date: activity.date.toISOString().split('T')[0],
    problems: activity.problemsSolved,
    mcq: activity.mcqSolved
  }));
  
  return {
    stats,
    recentActivity: recentActivity.slice(0, 10),
    upcomingContests: upcomingContestsData,
    potdStreak: {
      current: userStreak?.currentStreak || 0,
      longest: userStreak?.longestStreak || 0,
      todaySolved: !!potdSolveToday
    },
    progressToday: {
      problemsSolved: todayActivity?.problemsSolved || 0,
      mcqSolved: todayActivity?.mcqSolved || 0,
      practiceMinutes: 0 // We'd need to track time spent
    },
    weeklyProgress
  };
}