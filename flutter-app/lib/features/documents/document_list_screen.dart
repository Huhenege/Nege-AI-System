import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/firebase/firebase_providers.dart';
import '../../core/firebase/tenant_providers.dart';
import '../../core/theme/app_theme.dart';
import 'document_upload_sheet.dart';
import 'models/employee_document.dart';

// ---------------------------------------------------------------------------
// Provider — streams documents for the current employee
// ---------------------------------------------------------------------------

final employeeDocumentsProvider =
    StreamProvider<List<EmployeeDocument>>((ref) {
  final tenant = ref.watch(tenantServiceProvider);
  final authUser = ref.watch(authStateProvider).valueOrNull;

  if (tenant == null || authUser == null) return Stream.value([]);

  return tenant
      .collection('documents')
      .where('metadata.employeeId', isEqualTo: authUser.uid)
      .orderBy('createdAt', descending: true)
      .snapshots()
      .map((snap) => snap.docs
          .map((d) => EmployeeDocument.fromFirestore(d.data(), d.id))
          .toList());
});

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

class DocumentListScreen extends ConsumerWidget {
  const DocumentListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final docsAsync = ref.watch(employeeDocumentsProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Баримт бичиг'),
        backgroundColor: AppColors.surface,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showUploadSheet(context),
        icon: const Icon(Icons.upload_file),
        label: const Text('Байршуулах'),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
      ),
      body: docsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Text(
            'Алдаа гарлаа: $e',
            style: const TextStyle(color: AppColors.error),
          ),
        ),
        data: (docs) {
          if (docs.isEmpty) {
            return _EmptyState(onUpload: () => _showUploadSheet(context));
          }
          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
            itemCount: docs.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (context, i) => _DocumentCard(doc: docs[i]),
          );
        },
      ),
    );
  }

  void _showUploadSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const DocumentUploadSheet(),
    );
  }
}

// ---------------------------------------------------------------------------
// Document Card
// ---------------------------------------------------------------------------

class _DocumentCard extends StatelessWidget {
  final EmployeeDocument doc;
  const _DocumentCard({required this.doc});

  @override
  Widget build(BuildContext context) {
    String formattedDate = doc.uploadDate;
    try {
      final dt = DateTime.parse(doc.uploadDate);
      formattedDate = DateFormat('yyyy.MM.dd HH:mm').format(dt);
    } catch (_) {}

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(
              Icons.description_outlined,
              color: AppColors.primary,
              size: 22,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  doc.title,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  doc.documentType,
                  style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  formattedDate,
                  style: const TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
          if (doc.fileSize != null)
            Text(
              _formatSize(doc.fileSize!),
              style: const TextStyle(
                color: AppColors.textMuted,
                fontSize: 11,
              ),
            ),
        ],
      ),
    );
  }

  String _formatSize(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

class _EmptyState extends StatelessWidget {
  final VoidCallback onUpload;
  const _EmptyState({required this.onUpload});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.folder_open_outlined, size: 64, color: AppColors.textMuted),
          const SizedBox(height: 16),
          Text(
            'Баримт бичиг байхгүй',
            style: Theme.of(context)
                .textTheme
                .titleMedium
                ?.copyWith(color: AppColors.textSecondary),
          ),
          const SizedBox(height: 8),
          Text(
            'Баримт байршуулахын тулд доорх товчийг дарна уу',
            style: const TextStyle(color: AppColors.textMuted, fontSize: 13),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),
          ElevatedButton.icon(
            onPressed: onUpload,
            icon: const Icon(Icons.upload_file),
            label: const Text('Байршуулах'),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
            ),
          ),
        ],
      ),
    );
  }
}
