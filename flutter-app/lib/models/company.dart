import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:freezed_annotation/freezed_annotation.dart';

part 'company.freezed.dart';
part 'company.g.dart';

@freezed
abstract class Company with _$Company {
  const factory Company({
    required String id,
    required String name,
    String? legalName,
    String? industry,
    String? description,
    String? logoUrl,
    String? website,
    String? phone,
    String? email,
    String? address,
    String? mission,
    String? vision,
    int? employeeCount,
  }) = _Company;

  factory Company.fromJson(Map<String, dynamic> json) =>
      _$CompanyFromJson(json);

  factory Company.fromFirestore(
      DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? {};
    return Company.fromJson({'id': doc.id, ...data});
  }
}

@freezed
abstract class CoreValue with _$CoreValue {
  const factory CoreValue({
    required String id,
    required String title,
    String? description,
    String? emoji,
    String? color,
    @Default(true) bool isActive,
  }) = _CoreValue;

  factory CoreValue.fromJson(Map<String, dynamic> json) =>
      _$CoreValueFromJson(json);

  factory CoreValue.fromFirestore(
      DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? {};
    return CoreValue.fromJson({'id': doc.id, ...data});
  }
}

@freezed
abstract class CompanyPolicy with _$CompanyPolicy {
  const factory CompanyPolicy({
    required String id,
    required String title,
    String? description,
    String? documentUrl,
    String? videoUrl,
    String? type,
    String? effectiveDate,
    String? uploadDate,
    bool? appliesToAll,
  }) = _CompanyPolicy;

  factory CompanyPolicy.fromJson(Map<String, dynamic> json) =>
      _$CompanyPolicyFromJson(json);

  factory CompanyPolicy.fromFirestore(
      DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? {};
    return CompanyPolicy.fromJson({'id': doc.id, ...data});
  }
}
