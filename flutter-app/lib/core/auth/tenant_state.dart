class TenantState {
  final String? companyId;
  final String? role;
  final bool isLoading;
  final String? error;

  const TenantState({
    this.companyId,
    this.role,
    this.isLoading = false,
    this.error,
  });

  const TenantState.loading()
      : companyId = null,
        role = null,
        isLoading = true,
        error = null;

  const TenantState.empty()
      : companyId = null,
        role = null,
        isLoading = false,
        error = null;

  bool get isAuthenticated => companyId != null && role != null;
  bool get isAdmin => role == 'admin' || role == 'super_admin';
  String? get companyPath =>
      companyId != null ? 'companies/$companyId' : null;

  TenantState copyWith({
    String? companyId,
    String? role,
    bool? isLoading,
    String? error,
  }) {
    return TenantState(
      companyId: companyId ?? this.companyId,
      role: role ?? this.role,
      isLoading: isLoading ?? this.isLoading,
      error: error ?? this.error,
    );
  }
}
