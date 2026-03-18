import 'package:cloud_firestore/cloud_firestore.dart';

/// Company policy / document (Дүрэм, журам) from Firestore companyPolicies.
class CompanyPolicy {
  final String id;
  final String title;
  final String? description;
  final String documentUrl;
  final String? videoUrl;
  final String? type;
  final String? effectiveDate;
  final String uploadDate;
  final bool appliesToAll;
  final List<String>? applicableDepartmentIds;
  final List<String>? applicablePositionIds;
  final String? selectionType; // 'departments' | 'positions'

  const CompanyPolicy({
    required this.id,
    required this.title,
    this.description,
    required this.documentUrl,
    this.videoUrl,
    this.type,
    this.effectiveDate,
    required this.uploadDate,
    this.appliesToAll = true,
    this.applicableDepartmentIds,
    this.applicablePositionIds,
    this.selectionType,
  });

  factory CompanyPolicy.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final d = doc.data() ?? {};
    return CompanyPolicy(
      id: doc.id,
      title: d['title'] as String? ?? '',
      description: d['description'] as String?,
      documentUrl: d['documentUrl'] as String? ?? '',
      videoUrl: d['videoUrl'] as String?,
      type: d['type'] as String?,
      effectiveDate: d['effectiveDate'] as String?,
      uploadDate: d['uploadDate'] as String? ?? '',
      appliesToAll: d['appliesToAll'] as bool? ?? true,
      applicableDepartmentIds: (d['applicableDepartmentIds'] as List<dynamic>?)
          ?.map((e) => e.toString())
          .toList(),
      applicablePositionIds: (d['applicablePositionIds'] as List<dynamic>?)
          ?.map((e) => e.toString())
          .toList(),
      selectionType: d['selectionType'] as String?,
    );
  }

  /// Policy applies to this employee if appliesToAll or positionId is in applicablePositionIds.
  bool appliesToPosition(String? positionId) {
    if (appliesToAll) return true;
    if (positionId == null) return false;
    return applicablePositionIds?.contains(positionId) ?? false;
  }
}
