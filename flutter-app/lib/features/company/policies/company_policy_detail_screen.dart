import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../../../core/firebase/tenant_providers.dart';
import '../../../models/company_policy.dart';

/// Нэг бичиг баримтын дэлгэрэнгүй — гарчиг, тайлбар, баримт нээх товч (mobile web-тай ижил).
class CompanyPolicyDetailScreen extends ConsumerWidget {
  final String policyId;
  final CompanyPolicy? policyFromExtra;

  const CompanyPolicyDetailScreen({
    super.key,
    required this.policyId,
    this.policyFromExtra,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (policyFromExtra != null) {
      return _DetailBody(policy: policyFromExtra!);
    }

    final tenantService = ref.watch(tenantServiceProvider);
    if (tenantService == null) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
      stream: tenantService.doc('companyPolicies', policyId).snapshots(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }
        final doc = snapshot.data;
        if (doc == null || !doc.exists || doc.data() == null) {
          return Scaffold(
            appBar: AppBar(
              leading: IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: () => context.pop(),
              ),
            ),
            body: const Center(
              child: Text('Дүрэм, журам олдсонгүй.'),
            ),
          );
        }
        final policy = CompanyPolicy.fromFirestore(doc);
        return _DetailBody(policy: policy);
      },
    );
  }
}

class _DetailBody extends StatelessWidget {
  final CompanyPolicy policy;

  const _DetailBody({required this.policy});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text(
          policy.title,
          overflow: TextOverflow.ellipsis,
          maxLines: 1,
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF334155),
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Card(
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: const BorderSide(color: Color(0xFFE2E8F0)),
              ),
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      policy.title,
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            fontWeight: FontWeight.w600,
                            color: const Color(0xFF1E293B),
                          ),
                    ),
                    if (policy.description != null &&
                        policy.description!.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text(
                        policy.description!,
                        style: TextStyle(
                          fontSize: 14,
                          color: Colors.grey.shade700,
                          height: 1.4,
                        ),
                      ),
                    ],
                    const SizedBox(height: 20),
                    _DocumentViewer(policy: policy),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DocumentViewer extends StatelessWidget {
  final CompanyPolicy policy;

  const _DocumentViewer({required this.policy});

  @override
  Widget build(BuildContext context) {
    if (policy.documentUrl.isEmpty) {
      return Container(
        height: 160,
        decoration: BoxDecoration(
          color: const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.insert_drive_file_outlined,
                size: 48, color: Colors.grey.shade400),
            const SizedBox(height: 8),
            Text(
              'Баримт бичиг хавсаргаагүй байна.',
              style: TextStyle(color: Colors.grey.shade600, fontSize: 14),
            ),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        OutlinedButton.icon(
          onPressed: () => _openUrl(policy.documentUrl),
          icon: const Icon(Icons.open_in_new, size: 20),
          label: const Text('Баримт нээх'),
          style: OutlinedButton.styleFrom(
            padding: const EdgeInsets.symmetric(vertical: 12),
            foregroundColor: const Color(0xFF0F766E),
            side: const BorderSide(color: Color(0xFF0F766E)),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'PDF эсвэл файлыг гадаад аппаар нээнэ.',
          style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
        ),
      ],
    );
  }

  Future<void> _openUrl(String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }
}
