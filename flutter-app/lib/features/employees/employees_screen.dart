import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../../core/firebase/tenant_providers.dart';
import '../../core/theme/app_theme.dart';
import '../../models/employee.dart';

class EmployeesScreen extends ConsumerWidget {
  const EmployeesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tenantService = ref.watch(tenantServiceProvider);

    if (tenantService == null) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Ажилтнууд')),
      body: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
        stream: tenantService
            .collection('employees')
            .orderBy('firstName')
            .snapshots(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          final docs = snapshot.data?.docs ?? [];
          final employees = docs
              .map((d) => Employee.fromFirestore(d))
              .where((e) => isActiveStatus(e.status))
              .toList();

          if (employees.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.people_outline,
                      size: 48, color: AppColors.textMuted),
                  const SizedBox(height: 12),
                  Text(
                    'Ажилтан олдсонгүй',
                    style: TextStyle(color: AppColors.textSecondary),
                  ),
                ],
              ),
            );
          }

          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: employees.length,
            separatorBuilder: (_, _) => const SizedBox(height: 8),
            itemBuilder: (context, index) {
              final emp = employees[index];
              return Card(
                child: ListTile(
                  leading: CircleAvatar(
                    backgroundColor:
                        AppColors.primary.withValues(alpha: 0.1),
                    backgroundImage: emp.photoURL != null
                        ? NetworkImage(emp.photoURL!)
                        : null,
                    child: emp.photoURL == null
                        ? Text(
                            emp.firstName.isNotEmpty
                                ? emp.firstName[0].toUpperCase()
                                : '?',
                            style: const TextStyle(
                              color: AppColors.primary,
                              fontWeight: FontWeight.w600,
                            ),
                          )
                        : null,
                  ),
                  title: Text(
                    '${emp.lastName} ${emp.firstName}',
                    style: const TextStyle(fontWeight: FontWeight.w500),
                  ),
                  subtitle: Text(
                    emp.jobTitle ?? employeeStatusLabels[emp.status] ?? '',
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 13,
                    ),
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
