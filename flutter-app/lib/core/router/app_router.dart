import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../firebase/firebase_providers.dart';
import '../../shared/widgets/app_shell.dart';
import '../../features/auth/login_screen.dart';
import '../../features/home/home_screen.dart';
import '../../features/attendance/attendance_screen.dart';
import '../../features/company/company_screen.dart';
import '../../features/company/policies/company_policies_screen.dart';
import '../../features/company/policies/company_policy_detail_screen.dart';
import '../../models/company_policy.dart';
import '../../features/user/user_screen.dart';
import '../../features/employees/employees_screen.dart';
import '../../features/vacation/vacation_screen.dart';
import '../../features/projects/projects_screen.dart';
import '../../features/points/points_screen.dart';
import '../../features/survey/survey_screen.dart';
import '../../features/document_review/document_review_screen.dart';
import '../../features/profile/profile_edit_screen.dart';
import '../../features/questionnaire/questionnaire_screen.dart';
import '../../features/user/my_abt_screen.dart';
import '../../features/user/my_department_screen.dart';

final _rootNavigatorKey = GlobalKey<NavigatorState>();
final _homeTabKey = GlobalKey<NavigatorState>();
final _attendanceTabKey = GlobalKey<NavigatorState>();
final _companyTabKey = GlobalKey<NavigatorState>();
final _userTabKey = GlobalKey<NavigatorState>();

final appRouterProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authStateProvider);

  return GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: '/home',
    redirect: (context, state) {
      final isLoggedIn = authState.valueOrNull != null;
      final isLoginRoute = state.matchedLocation == '/login';

      if (!isLoggedIn && !isLoginRoute) return '/login';
      if (isLoggedIn && isLoginRoute) return '/home';
      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) {
          return AppShell(navigationShell: navigationShell);
        },
        branches: [
          // Tab 1: Home
          StatefulShellBranch(
            navigatorKey: _homeTabKey,
            routes: [
              GoRoute(
                path: '/home',
                builder: (context, state) => const HomeScreen(),
                routes: [
                  GoRoute(
                    path: 'employees',
                    builder: (context, state) => const EmployeesScreen(),
                  ),
                  GoRoute(
                    path: 'vacation',
                    builder: (context, state) => const VacationScreen(),
                  ),
                  GoRoute(
                    path: 'projects',
                    builder: (context, state) => const ProjectsScreen(),
                  ),
                  GoRoute(
                    path: 'points',
                    builder: (context, state) => const PointsScreen(),
                  ),
                  GoRoute(
                    path: 'survey',
                    builder: (context, state) => const SurveyScreen(),
                  ),
                ],
              ),
            ],
          ),
          // Tab 2: Attendance
          StatefulShellBranch(
            navigatorKey: _attendanceTabKey,
            routes: [
              GoRoute(
                path: '/attendance',
                builder: (context, state) => const AttendanceScreen(),
              ),
            ],
          ),
          // Tab 3: Company
          StatefulShellBranch(
            navigatorKey: _companyTabKey,
            routes: [
              GoRoute(
                path: '/company',
                builder: (context, state) => const CompanyScreen(),
                routes: [
                  GoRoute(
                    path: 'policies',
                    builder: (context, state) =>
                        const CompanyPoliciesScreen(),
                    routes: [
                      GoRoute(
                        path: ':id',
                        builder: (context, state) {
                          final id = state.pathParameters['id'] ?? '';
                          final extra = state.extra;
                          return CompanyPolicyDetailScreen(
                            policyId: id,
                            policyFromExtra: extra is CompanyPolicy
                                ? extra
                                : null,
                          );
                        },
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
          // Tab 4: User
          StatefulShellBranch(
            navigatorKey: _userTabKey,
            routes: [
              GoRoute(
                path: '/user',
                builder: (context, state) => const UserScreen(),
                routes: [
                  GoRoute(
                    path: 'document-review',
                    builder: (context, state) =>
                        const DocumentReviewScreen(),
                  ),
                  GoRoute(
                    path: 'profile-edit',
                    builder: (context, state) => const ProfileEditScreen(),
                  ),
                  GoRoute(
                    path: 'questionnaire',
                    builder: (context, state) =>
                        const QuestionnaireScreen(),
                  ),
                  GoRoute(
                    path: 'my-abt',
                    builder: (context, state) => const MyAbtScreen(),
                  ),
                  GoRoute(
                    path: 'my-department',
                    builder: (context, state) => const MyDepartmentScreen(),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    ],
  );
});
