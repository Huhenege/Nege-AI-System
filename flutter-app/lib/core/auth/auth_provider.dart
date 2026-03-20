import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../firebase/firebase_providers.dart';
import '../config/app_config.dart';
import 'auth_service.dart';
import 'tenant_state.dart';

final authServiceProvider = Provider<AuthService>((ref) {
  return AuthService(auth: ref.watch(firebaseAuthProvider));
});

final tenantStateProvider =
    StateNotifierProvider<TenantNotifier, TenantState>((ref) {
  final auth = ref.watch(firebaseAuthProvider);
  return TenantNotifier(auth);
});

class TenantNotifier extends StateNotifier<TenantState> {
  final FirebaseAuth _auth;

  TenantNotifier(this._auth) : super(const TenantState.loading()) {
    _init();
  }

  Future<void> _init() async {
    _auth.authStateChanges().listen((user) async {
      if (user == null) {
        state = const TenantState.empty();
        return;
      }
      await _resolveTenant(user);
    });
  }

  Future<void> _resolveTenant(User user) async {
    state = const TenantState.loading();
    try {
      final tokenResult = await user.getIdTokenResult(true);
      final claims = tokenResult.claims;
      final companyId = claims?['companyId'] as String?;
      final role = claims?['role'] as String?;

      if (companyId != null && role != null) {
        state = TenantState(companyId: companyId, role: role);
        return;
      }

      // Claims not set — try ensure-claims API
      final authService = AuthService(auth: _auth);
      final result = await authService.ensureClaims(
        apiBaseUrl: AppConfig.apiBaseUrl,
      );

      if (result != null) {
        final freshToken = await user.getIdTokenResult(true);
        state = TenantState(
          companyId: freshToken.claims?['companyId'] as String?,
          role: freshToken.claims?['role'] as String?,
        );
      } else {
        state = const TenantState(error: 'Компани тодорхойлогдоогүй');
      }
    } catch (e) {
      state = TenantState(error: e.toString());
    }
  }

  Future<void> refresh() async {
    final user = _auth.currentUser;
    if (user != null) {
      await _resolveTenant(user);
    }
  }
}
