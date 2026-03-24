import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/firebase/firebase_providers.dart';
import '../../core/firebase/tenant_providers.dart';
import '../../core/theme/app_theme.dart';

class MyAbtScreen extends ConsumerWidget {
  const MyAbtScreen({super.key});

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
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Миний АБТ'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/user'),
        ),
      ),
      body: StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
        stream: tenantService.doc('employees', userId).snapshots(),
        builder: (context, empSnap) {
          if (empSnap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          final empData = empSnap.data?.data();
          if (empData == null) {
            return _buildEmpty(context, 'Ажилтны мэдээлэл олдсонгүй');
          }

          final departmentId = empData['departmentId'] as String?;
          final positionId = empData['positionId'] as String?;
          final employeeName =
              '${empData['lastName'] ?? ''} ${empData['firstName'] ?? ''}'
                  .trim();

          if (positionId == null && departmentId == null) {
            return _buildEmpty(
                context, 'Алба нэгж эсвэл ажлын байр оноогдоогүй байна');
          }

          return _AbtContent(
            tenantService: tenantService,
            departmentId: departmentId,
            positionId: positionId,
            employeeName: employeeName,
          );
        },
      ),
    );
  }

  Widget _buildEmpty(BuildContext context, String message) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.work_outline, size: 64, color: AppColors.textMuted),
            const SizedBox(height: 16),
            Text(
              message,
              style: Theme.of(context)
                  .textTheme
                  .bodyLarge
                  ?.copyWith(color: AppColors.textSecondary),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

class _AbtContent extends StatelessWidget {
  final dynamic tenantService;
  final String? departmentId;
  final String? positionId;
  final String employeeName;

  const _AbtContent({
    required this.tenantService,
    required this.departmentId,
    required this.positionId,
    required this.employeeName,
  });

  @override
  Widget build(BuildContext context) {
    if (positionId != null) {
      return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
        stream: tenantService.doc('positions', positionId).snapshots(),
        builder: (context, posSnap) {
          final posData = posSnap.data?.data();
          final resolvedDeptId = departmentId
              ?? posData?['departmentId'] as String?;

          return SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (resolvedDeptId != null) ...[
                  _DepartmentSection(
                    tenantService: tenantService,
                    departmentId: resolvedDeptId,
                  ),
                  const SizedBox(height: 20),
                ],
                if (posData != null)
                  _PositionContent(data: posData, tenantService: tenantService),
              ],
            ),
          );
        },
      );
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (departmentId != null)
            _DepartmentSection(
              tenantService: tenantService,
              departmentId: departmentId!,
            ),
        ],
      ),
    );
  }
}

// ── Department: зорилго, чиг үүрэг ──────────────────────────────────────

class _DepartmentSection extends StatelessWidget {
  final dynamic tenantService;
  final String departmentId;

  const _DepartmentSection({
    required this.tenantService,
    required this.departmentId,
  });

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
      stream: tenantService.doc('departments', departmentId).snapshots(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const _SectionSkeleton();
        }

        final data = snapshot.data?.data();
        if (data == null) return const SizedBox.shrink();

        final name = data['name'] as String? ?? '';
        final vision = data['vision'] as String?;
        final description = data['description'] as String?;

        final hasInfo = (vision != null && vision.isNotEmpty) ||
            (description != null && description.isNotEmpty);

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _SectionHeader(
              icon: Icons.account_tree_outlined,
              title: name.isNotEmpty ? name : 'Алба нэгж',
              subtitle: 'Нэгжийн мэдээлэл',
            ),
            const SizedBox(height: 12),
            if (vision != null && vision.isNotEmpty) ...[
              _InfoCard(
                icon: Icons.flag_outlined,
                title: 'Албаны зорилго',
                content: vision,
                accentColor: AppColors.primary,
              ),
              const SizedBox(height: 12),
            ],
            if (description != null && description.isNotEmpty)
              _InfoCard(
                icon: Icons.checklist_outlined,
                title: 'Албаны чиг үүрэг',
                content: description,
                accentColor: AppColors.info,
              ),
            if (!hasInfo)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Center(
                    child: Text(
                      'Нэгжийн зорилго, чиг үүрэг оруулаагүй байна',
                      style: Theme.of(context)
                          .textTheme
                          .bodyMedium
                          ?.copyWith(color: AppColors.textSecondary),
                    ),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}

// ── Position: АБТ (purpose, responsibilities, skills, experience) ───────

class _PositionContent extends StatelessWidget {
  final Map<String, dynamic> data;
  final dynamic tenantService;

  const _PositionContent({required this.data, required this.tenantService});

  static const _conditionLabels = {
    'NORMAL': 'Хэвийн',
    'NON_STANDARD': 'Хэвийн бус',
    'HEAVY': 'Хүнд',
    'HAZARDOUS': 'Хортой',
    'EXTREMELY_HAZARDOUS': 'Маш хортой',
  };

  @override
  Widget build(BuildContext context) {
    final title = data['title'] as String? ?? '';
    final purpose = data['purpose'] as String?;
    final rawResponsibilities = data['responsibilities'];
    final rawSkills = data['skills'];
    final rawExperience = data['experience'];
    final jobFile = data['jobDescriptionFile'] as Map<String, dynamic>?;
    final workingCondition = data['workingCondition'] as String?;
    final reportsToId = data['reportsToId'] as String? ?? data['reportsTo'] as String?;

    final responsibilities = _parseResponsibilities(rawResponsibilities);
    final skills = _parseSkills(rawSkills);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionHeader(
          icon: Icons.badge_outlined,
          title: title.isNotEmpty ? title : 'Ажлын байр',
          subtitle: 'Ажлын байрны тодорхойлолт',
        ),
        const SizedBox(height: 12),

        _PositionOverviewCard(
          tenantService: tenantService,
          workingCondition: workingCondition != null
              ? _conditionLabels[workingCondition] ?? workingCondition
              : null,
          reportsToId: reportsToId,
        ),
        const SizedBox(height: 12),

        if (purpose != null && purpose.isNotEmpty) ...[
          _InfoCard(
            icon: Icons.track_changes_outlined,
            title: 'Зорилго',
            content: purpose,
            accentColor: AppColors.primary,
          ),
          const SizedBox(height: 12),
        ],

        if (responsibilities.isNotEmpty) ...[
          _ResponsibilitiesCard(responsibilities: responsibilities),
          const SizedBox(height: 12),
        ],

        if (skills.isNotEmpty) ...[
          _SkillsCard(skills: skills),
          const SizedBox(height: 12),
        ],

        if (rawExperience != null) ...[
          _ExperienceCard(
              experience: rawExperience as Map<String, dynamic>),
          const SizedBox(height: 12),
        ],

        if (jobFile != null) _JobFileCard(file: jobFile),

        if (purpose == null && responsibilities.isEmpty &&
            skills.isEmpty && rawExperience == null && jobFile == null)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Center(
                child: Column(
                  children: [
                    Icon(Icons.info_outline, size: 32, color: AppColors.textMuted),
                    const SizedBox(height: 8),
                    Text(
                      'АБТ дэлгэрэнгүй мэдээлэл оруулаагүй байна',
                      style: Theme.of(context)
                          .textTheme
                          .bodyMedium
                          ?.copyWith(color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }

  static List<Map<String, String>> _parseResponsibilities(dynamic raw) {
    if (raw == null) return [];
    if (raw is List) {
      return raw.map((item) {
        if (item is Map) {
          return {
            'title': (item['title'] ?? '').toString(),
            'description': (item['description'] ?? '').toString(),
          };
        }
        return {'title': item.toString(), 'description': ''};
      }).toList();
    }
    return [];
  }

  static List<Map<String, String>> _parseSkills(dynamic raw) {
    if (raw == null) return [];
    if (raw is List) {
      return raw.map((item) {
        if (item is Map) {
          return {
            'name': (item['name'] ?? '').toString(),
            'level': (item['level'] ?? '').toString(),
          };
        }
        return {'name': item.toString(), 'level': ''};
      }).toList();
    }
    return [];
  }
}

class _PositionOverviewCard extends StatelessWidget {
  final dynamic tenantService;
  final String? workingCondition;
  final String? reportsToId;

  const _PositionOverviewCard({
    required this.tenantService,
    this.workingCondition,
    this.reportsToId,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.supervisor_account_outlined, size: 18, color: AppColors.textSecondary),
                const SizedBox(width: 8),
                Text(
                  'Шууд удирдлага',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppColors.textSecondary,
                      ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            if (reportsToId != null && reportsToId!.isNotEmpty)
              _ManagerInfo(tenantService: tenantService, positionId: reportsToId!)
            else
              Text(
                'Шууд удирдлага тодорхойлоогүй байна',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppColors.textSecondary,
                    ),
              ),

            if (workingCondition != null && workingCondition!.isNotEmpty) ...[
              const SizedBox(height: 12),
              const Divider(height: 1),
              const SizedBox(height: 12),
              _overviewRow(context, 'Хөдөлмөрийн нөхцөл', workingCondition!),
            ],
          ],
        ),
      ),
    );
  }

  Widget _overviewRow(BuildContext context, String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 130,
          child: Text(
            label,
            style: Theme.of(context)
                .textTheme
                .bodySmall
                ?.copyWith(color: AppColors.textSecondary),
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: Theme.of(context)
                .textTheme
                .bodySmall
                ?.copyWith(fontWeight: FontWeight.w600),
          ),
        ),
      ],
    );
  }
}

class _ManagerInfo extends StatelessWidget {
  final dynamic tenantService;
  final String positionId;

  const _ManagerInfo({required this.tenantService, required this.positionId});

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
      stream: tenantService.doc('positions', positionId).snapshots()
          as Stream<DocumentSnapshot<Map<String, dynamic>>>,
      builder: (context, posSnap) {
        final posTitle = posSnap.data?.data()?['title'] as String? ?? '';

        return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
          stream: (tenantService.collection('employees') as CollectionReference<Map<String, dynamic>>)
              .where('positionId', isEqualTo: positionId)
              .limit(1)
              .snapshots(),
          builder: (context, empSnap) {
            if (empSnap.connectionState == ConnectionState.waiting) {
              return const SizedBox(
                height: 40,
                child: Center(child: SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))),
              );
            }

            String managerName = '';
            if (empSnap.hasData && empSnap.data!.docs.isNotEmpty) {
              final emp = empSnap.data!.docs.first.data();
              final firstName = emp['firstName'] as String? ?? '';
              final lastName = emp['lastName'] as String? ?? '';
              managerName = '$lastName $firstName'.trim();
            }

            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    CircleAvatar(
                      radius: 18,
                      backgroundColor: AppColors.primary.withValues(alpha: 0.1),
                      child: Icon(Icons.person_outline, size: 20, color: AppColors.primary),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            managerName.isNotEmpty ? managerName : 'Томилогдоогүй',
                            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                  fontWeight: FontWeight.w600,
                                ),
                          ),
                          if (posTitle.isNotEmpty)
                            Text(
                              posTitle,
                              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: AppColors.textSecondary,
                                  ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            );
          },
        );
      },
    );
  }
}

// ── Shared UI components ────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;

  const _SectionHeader({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: AppColors.primary, size: 22),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: Theme.of(context)
                    .textTheme
                    .titleMedium
                    ?.copyWith(fontWeight: FontWeight.w600),
              ),
              Text(
                subtitle,
                style: Theme.of(context)
                    .textTheme
                    .bodySmall
                    ?.copyWith(color: AppColors.textMuted),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _InfoCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String content;
  final Color accentColor;

  const _InfoCard({
    required this.icon,
    required this.title,
    required this.content,
    required this.accentColor,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 18, color: accentColor),
                const SizedBox(width: 8),
                Text(
                  title,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w600,
                        color: accentColor,
                      ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              content,
              style: Theme.of(context)
                  .textTheme
                  .bodyMedium
                  ?.copyWith(height: 1.6, color: AppColors.textPrimary),
            ),
          ],
        ),
      ),
    );
  }
}

class _ResponsibilitiesCard extends StatelessWidget {
  final List<Map<String, String>> responsibilities;

  const _ResponsibilitiesCard({required this.responsibilities});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.list_alt_outlined, size: 18, color: AppColors.info),
                const SizedBox(width: 8),
                Text(
                  'Үндсэн чиг үүрэг',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppColors.info,
                      ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            ...responsibilities.asMap().entries.map((entry) {
              final i = entry.key;
              final r = entry.value;
              final title = r['title'] ?? '';
              final desc = r['description'] ?? '';

              return Padding(
                padding: EdgeInsets.only(bottom: i < responsibilities.length - 1 ? 12 : 0),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 24,
                      height: 24,
                      margin: const EdgeInsets.only(right: 12),
                      decoration: BoxDecoration(
                        color: AppColors.info.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Center(
                        child: Text(
                          '${i + 1}',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: AppColors.info,
                          ),
                        ),
                      ),
                    ),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (title.isNotEmpty)
                            Text(
                              title,
                              style: Theme.of(context)
                                  .textTheme
                                  .bodyMedium
                                  ?.copyWith(fontWeight: FontWeight.w600),
                            ),
                          if (desc.isNotEmpty) ...[
                            if (title.isNotEmpty) const SizedBox(height: 2),
                            Text(
                              desc,
                              style: Theme.of(context)
                                  .textTheme
                                  .bodySmall
                                  ?.copyWith(
                                    color: AppColors.textSecondary,
                                    height: 1.5,
                                  ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              );
            }),
          ],
        ),
      ),
    );
  }
}

class _SkillsCard extends StatelessWidget {
  final List<Map<String, String>> skills;

  const _SkillsCard({required this.skills});

  static const _levelLabels = {
    'beginner': 'Анхан',
    'intermediate': 'Дунд',
    'advanced': 'Ахисан',
    'expert': 'Мэргэжилтэн',
  };

  static const _levelColors = {
    'beginner': AppColors.textMuted,
    'intermediate': AppColors.info,
    'advanced': AppColors.warning,
    'expert': AppColors.success,
  };

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.psychology_outlined,
                    size: 18, color: AppColors.warning),
                const SizedBox(width: 8),
                Text(
                  'Шаардагдах ур чадвар',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppColors.warning,
                      ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: skills.map((skill) {
                final name = skill['name'] ?? '';
                final level = skill['level'] ?? '';
                final label = _levelLabels[level] ?? level;
                final color = _levelColors[level] ?? AppColors.textMuted;

                return Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: color.withValues(alpha: 0.2)),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        name,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              fontWeight: FontWeight.w600,
                              color: AppColors.textPrimary,
                            ),
                      ),
                      if (label.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(
                          label,
                          style:
                              Theme.of(context).textTheme.labelSmall?.copyWith(
                                    color: color,
                                    fontWeight: FontWeight.w500,
                                  ),
                        ),
                      ],
                    ],
                  ),
                );
              }).toList(),
            ),
          ],
        ),
      ),
    );
  }
}

class _ExperienceCard extends StatelessWidget {
  final Map<String, dynamic> experience;

  const _ExperienceCard({required this.experience});

  @override
  Widget build(BuildContext context) {
    final totalYears = experience['totalYears'];
    final educationLevel = experience['educationLevel'] as String?;
    final leadershipYears = experience['leadershipYears'];
    final professions = experience['professions'] as List<dynamic>?;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.school_outlined, size: 18, color: AppColors.success),
                const SizedBox(width: 8),
                Text(
                  'Боловсрол & Туршлага',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppColors.success,
                      ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (educationLevel != null && educationLevel.isNotEmpty)
              _ExperienceRow(
                  label: 'Боловсролын түвшин', value: educationLevel),
            if (totalYears != null)
              _ExperienceRow(
                  label: 'Нийт туршлага', value: '$totalYears жил'),
            if (leadershipYears != null)
              _ExperienceRow(
                  label: 'Удирдлагын туршлага', value: '$leadershipYears жил'),
            if (professions != null && professions.isNotEmpty)
              _ExperienceRow(
                  label: 'Мэргэжил', value: professions.join(', ')),
          ],
        ),
      ),
    );
  }
}

class _ExperienceRow extends StatelessWidget {
  final String label;
  final String value;

  const _ExperienceRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 140,
            child: Text(
              label,
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(color: AppColors.textSecondary),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}

class _JobFileCard extends StatelessWidget {
  final Map<String, dynamic> file;

  const _JobFileCard({required this.file});

  Future<void> _openFile(BuildContext context) async {
    final url = file['url'] as String?;
    if (url == null || url.isEmpty) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Файлын холбоос олдсонгүй')),
        );
      }
      return;
    }

    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Файл нээх боломжгүй байна')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final name = file['name'] as String? ?? 'АБТ файл';
    final size = file['size'];
    final sizeText = size != null ? _formatFileSize(size) : null;

    return Card(
      child: InkWell(
        onTap: () => _openFile(context),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.error.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.picture_as_pdf,
                    color: AppColors.error, size: 28),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      style: Theme.of(context)
                          .textTheme
                          .bodyMedium
                          ?.copyWith(fontWeight: FontWeight.w600),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      sizeText != null
                          ? 'Батлагдсан АБТ файл · $sizeText'
                          : 'Батлагдсан АБТ файл',
                      style: Theme.of(context)
                          .textTheme
                          .bodySmall
                          ?.copyWith(color: AppColors.textMuted),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.open_in_new,
                    size: 18, color: AppColors.primary),
              ),
            ],
          ),
        ),
      ),
    );
  }

  static String _formatFileSize(dynamic bytes) {
    final b = bytes is int ? bytes : (bytes as num).toInt();
    if (b < 1024) return '$b B';
    if (b < 1024 * 1024) return '${(b / 1024).toStringAsFixed(0)} KB';
    return '${(b / (1024 * 1024)).toStringAsFixed(1)} MB';
  }
}

class _SectionSkeleton extends StatelessWidget {
  const _SectionSkeleton();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: 24),
      child: Center(
        child: SizedBox(
          width: 24,
          height: 24,
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
      ),
    );
  }
}
