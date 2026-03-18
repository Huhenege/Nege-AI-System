import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:go_router/go_router.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/firebase/firebase_providers.dart';
import '../../core/firebase/tenant_providers.dart';
import '../../core/theme/app_theme.dart';

class UserScreen extends ConsumerWidget {
  const UserScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authStateProvider);
    final tenantService = ref.watch(tenantServiceProvider);
    final user = authState.valueOrNull;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Хэрэглэгч')),
      body: user == null || tenantService == null
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  // Profile card
                  StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
                    stream:
                        tenantService.doc('employees', user.uid).snapshots(),
                    builder: (context, snapshot) {
                      final data = snapshot.data?.data();
                      final firstName = data?['firstName'] ?? '';
                      final lastName = data?['lastName'] ?? '';
                      final jobTitle = data?['jobTitle'];
                      final photoURL = data?['photoURL'];

                      return Card(
                        child: Padding(
                          padding: const EdgeInsets.all(20),
                          child: Column(
                            children: [
                              CircleAvatar(
                                radius: 36,
                                backgroundColor:
                                    AppColors.primary.withValues(alpha: 0.1),
                                backgroundImage: photoURL != null
                                    ? NetworkImage(photoURL)
                                    : null,
                                child: photoURL == null
                                    ? Text(
                                        firstName.isNotEmpty
                                            ? firstName[0].toUpperCase()
                                            : '?',
                                        style: const TextStyle(
                                          color: AppColors.primary,
                                          fontSize: 24,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      )
                                    : null,
                              ),
                              const SizedBox(height: 12),
                              Text(
                                '$lastName $firstName',
                                style: Theme.of(context)
                                    .textTheme
                                    .titleMedium
                                    ?.copyWith(fontWeight: FontWeight.w600),
                              ),
                              if (jobTitle != null) ...[
                                const SizedBox(height: 4),
                                Text(
                                  jobTitle,
                                  style: Theme.of(context)
                                      .textTheme
                                      .bodyMedium
                                      ?.copyWith(
                                          color: AppColors.textSecondary),
                                ),
                              ],
                              const SizedBox(height: 4),
                              Text(
                                user.email ?? '',
                                style: Theme.of(context)
                                    .textTheme
                                    .bodySmall
                                    ?.copyWith(
                                        color: AppColors.textMuted),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                  const SizedBox(height: 16),

                  // Menu items
                  Card(
                    child: Column(
                      children: [
                        _MenuItem(
                          icon: Icons.edit_outlined,
                          label: 'Профайл засах',
                          onTap: () => context.go('/user/profile-edit'),
                        ),
                        const Divider(height: 1),
                        _MenuItem(
                          icon: Icons.description_outlined,
                          label: 'Баримт бичиг шалгах',
                          onTap: () =>
                              context.go('/user/document-review'),
                        ),
                        const Divider(height: 1),
                        _MenuItem(
                          icon: Icons.star_outline,
                          label: 'Оноо & Шагнал',
                          onTap: () => context.go('/home/points'),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Logout
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: () async {
                        final confirmed = await showDialog<bool>(
                          context: context,
                          builder: (context) => AlertDialog(
                            title: const Text('Гарах'),
                            content: const Text(
                                'Системээс гарахдаа итгэлтэй байна уу?'),
                            actions: [
                              TextButton(
                                onPressed: () =>
                                    Navigator.pop(context, false),
                                child: const Text('Үгүй'),
                              ),
                              ElevatedButton(
                                onPressed: () =>
                                    Navigator.pop(context, true),
                                child: const Text('Тийм'),
                              ),
                            ],
                          ),
                        );

                        if (confirmed == true) {
                          await ref.read(authServiceProvider).signOut();
                          if (context.mounted) {
                            context.go('/login');
                          }
                        }
                      },
                      icon: const Icon(Icons.logout, color: AppColors.error),
                      label: const Text(
                        'Системээс гарах',
                        style: TextStyle(color: AppColors.error),
                      ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}

class _MenuItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _MenuItem({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon, color: AppColors.textSecondary),
      title: Text(label),
      trailing:
          const Icon(Icons.chevron_right, color: AppColors.textMuted),
      onTap: onTap,
    );
  }
}
