import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:freezed_annotation/freezed_annotation.dart';

part 'attendance.freezed.dart';
part 'attendance.g.dart';

@freezed
abstract class AttendanceRecord with _$AttendanceRecord {
  const factory AttendanceRecord({
    required String id,
    required String employeeId,
    required String date,
    required String checkInTime,
    String? checkInLocationId,
    String? checkInLocationName,
    String? checkOutTime,
    String? checkOutLocationId,
    String? checkOutLocationName,
    @Default('PRESENT') String status,
    double? lat,
    double? lng,
  }) = _AttendanceRecord;

  factory AttendanceRecord.fromJson(Map<String, dynamic> json) =>
      _$AttendanceRecordFromJson(json);

  factory AttendanceRecord.fromFirestore(
      DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? {};
    return AttendanceRecord.fromJson({'id': doc.id, ...data});
  }
}

@freezed
abstract class AttendanceLocation with _$AttendanceLocation {
  const factory AttendanceLocation({
    required String id,
    required String name,
    required double latitude,
    required double longitude,
    required double radius,
    String? address,
    @Default(true) bool isActive,
  }) = _AttendanceLocation;

  factory AttendanceLocation.fromJson(Map<String, dynamic> json) =>
      _$AttendanceLocationFromJson(json);

  factory AttendanceLocation.fromFirestore(
      DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? {};
    return AttendanceLocation.fromJson({'id': doc.id, ...data});
  }
}
