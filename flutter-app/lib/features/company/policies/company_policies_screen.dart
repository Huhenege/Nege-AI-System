import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../../../core/firebase/firebase_providers.dart';
import '../../../core/firebase/tenant_providers.dart';
import '../../../models/company_policy.dart';

/// Дүрэм, журам — жагсаалт (mobile web-тай ижил).
class CompanyPoliciesScreen extends ConsumerWidget {
  const CompanyPoliciesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tenantService = ref.watch(tenantServiceProvider);
    final userId = ref.watch(authStateProvider).valueOrNull?.uid;

    if (tenantService == null || userId == null) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Дүрэм, журам'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/company'),
        ),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF334155),
        elevation: 0,
      ),
      body: StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
        stream: tenantService.doc('employees', userId).snapshots(),
        builder: (context, empSnap) {
          final positionId = empSnap.data?.data()?['positionId'] as String?;

          return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
            stream: tenantService
                .collection('companyPolicies')
                .orderBy('uploadDate', descending: true)
                .snapshots(),
            builder: (context, policiesSnap) {
              if (policiesSnap.connectionState == ConnectionState.waiting) {
                return _buildLoading(context);
              }

              final docs = policiesSnap.data?.docs ?? [];
              final policies = docs
                  .map((d) => CompanyPolicy.fromFirestore(d))
                  .where((p) => p.appliesToPosition(positionId))
                  .toList();

              if (policies.isEmpty) {
                return _buildEmpty(context);
              }

              return ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: policies.length,
                itemBuilder: (context, index) {
                  final policy = policies[index];
                  return _PolicyTile(
                    policy: policy,
                    onTap: () => context.push(
                      '/company/policies/${policy.id}',
                      extra: policy,
                    ),
                  );
                },
              );
            },
          );
        },
      ),
    );
  }

  Widget _buildLoading(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: List.generate(
        3,
        (_) => Container(
          height: 80,
          margin: const EdgeInsets.only(bottom: 12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.04),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
        ),
      ),
    );
  }

  Widget _buildEmpty(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.description_outlined, size: 48, color: Colors.grey.shade300),
            const SizedBox(height: 16),
            Text(
              'Мэдээлэл алга',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: const Color(0xFF334155),
                    fontWeight: FontWeight.w600,
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              'Танд хамааралтай дүрэм, журам одоогоор олдсонгүй.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                color: Colors.grey.shade600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PolicyTile extends StatelessWidget {
  final CompanyPolicy policy;
  final VoidCallback onTap;

  const _PolicyTile({required this.policy, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(16),
          margin: const EdgeInsets.only(bottom: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFF1F5F9)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.04),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: const Color(0xFFFFFBEB),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFFDE68A)),
                ),
                child: const Icon(
                  Icons.description_outlined,
                  color: Color(0xFFD97706),
                  size: 24,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      policy.title,
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF334155),
                        fontSize: 14,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (policy.description != null &&
                        policy.description!.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        policy.description!,
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey.shade600,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ],
                ),
              ),
              const Icon(
                Icons.chevron_right,
                color: Color(0xFFCBD5E1),
                size: 24,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
