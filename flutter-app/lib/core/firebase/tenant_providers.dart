import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../auth/auth_provider.dart';
import 'tenant_service.dart';

/// Provides a TenantService scoped to the current company.
/// Returns null when the user is not authenticated or tenant is loading.
final tenantServiceProvider = Provider<TenantService?>((ref) {
  final tenantState = ref.watch(tenantStateProvider);
  if (tenantState.companyId == null) return null;
  return TenantService(companyId: tenantState.companyId!);
});
