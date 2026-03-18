import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:freezed_annotation/freezed_annotation.dart';

part 'department.freezed.dart';
part 'department.g.dart';

@freezed
abstract class Department with _$Department {
  const factory Department({
    required String id,
    required String name,
    String? color,
    String? typeId,
    String? parentId,
    int? filled,
    String? managerId,
    String? status,
  }) = _Department;

  factory Department.fromJson(Map<String, dynamic> json) =>
      _$DepartmentFromJson(json);

  factory Department.fromFirestore(
      DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? {};
    return Department.fromJson({'id': doc.id, ...data});
  }
}
