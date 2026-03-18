import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:freezed_annotation/freezed_annotation.dart';

part 'vacation.freezed.dart';
part 'vacation.g.dart';

@freezed
abstract class VacationRequest with _$VacationRequest {
  const factory VacationRequest({
    required String id,
    required String employeeId,
    required String startDate,
    required String endDate,
    required int totalDays,
    @Default('PENDING') String status,
    String? requestDate,
    String? reason,
    String? approverId,
    String? workYearStart,
    String? workYearEnd,
  }) = _VacationRequest;

  factory VacationRequest.fromJson(Map<String, dynamic> json) =>
      _$VacationRequestFromJson(json);

  factory VacationRequest.fromFirestore(
      DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? {};
    return VacationRequest.fromJson({'id': doc.id, ...data});
  }
}
