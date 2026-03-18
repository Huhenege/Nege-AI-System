import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:freezed_annotation/freezed_annotation.dart';

part 'position.freezed.dart';
part 'position.g.dart';

@freezed
abstract class Position with _$Position {
  const factory Position({
    required String id,
    required String title,
    required String departmentId,
    String? reportsToId,
    String? levelId,
    String? employmentTypeId,
    String? jobCategoryId,
    String? workScheduleId,
    bool? isActive,
    bool? canApproveAttendance,
    bool? canApproveVacation,
    @Default(0) int filled,
    bool? isApproved,
    String? description,
  }) = _Position;

  factory Position.fromJson(Map<String, dynamic> json) =>
      _$PositionFromJson(json);

  factory Position.fromFirestore(
      DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? {};
    return Position.fromJson({'id': doc.id, ...data});
  }
}
