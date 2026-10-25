/*
 * Statistika RPC'larining qaytaradigan qatorlari.
 *
 * Natijalar, reyting, profil va natija tahlili sahifalari bir xil
 * funksiyalarni chaqiradi — turlar ham bir joyda turadi.
 */

export type RankingTestRpcRow = {
  test_id: number | string;
  title: string;
  created_at: string;
  participants: number | string;
};

export type UserSummaryRpcRow = {
  user_id: string;
  full_name: string;
  is_ranked: boolean;
  overall_rank: number | string;
  overall_participants: number | string;
  rating_points: number | string;
  ranking_tests_total: number | string;
  tests_completed: number | string;
  attempts_completed: number | string;
  excellent_tests: number | string;
  average_percentage: number | string;
  highest_percentage: number | string;
};

export type UserTestStatisticsRpcRow = {
  test_id: number | string;
  title: string;
  attempts_count: number | string;
  completed_attempts: number | string;
  last_attempt_at: string | null;
  best_attempt_id: string | null;
  best_percentage: number | string;
  best_duration_seconds: number | string | null;
  best_completed_at: string | null;
  test_rank: number | string;
  test_participants: number | string;
  is_passed: boolean;
};
