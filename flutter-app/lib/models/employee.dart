import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:freezed_annotation/freezed_annotation.dart';

part 'employee.freezed.dart';
part 'employee.g.dart';

@freezed
abstract class Employee with _$Employee {
  const factory Employee({
    required String id,
    String? employeeCode,
    required String firstName,
    required String lastName,
    required String email,
    @Default('active') String status,
    String? avatarId,
    String? photoURL,
    String? jobTitle,
    String? departmentId,
    String? positionId,
    String? phoneNumber,
    String? hireDate,
    String? candidateId,
    String? terminationDate,
    @Default([]) List<String> skills,
    String? deviceId,
    double? questionnaireCompletion,
    String? lifecycleStage,
    bool? loginDisabled,
    bool? questionnaireLocked,
    @Default('employee') String role,
  }) = _Employee;

  factory Employee.fromJson(Map<String, dynamic> json) =>
      _$EmployeeFromJson(json);

  factory Employee.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? {};
    return Employee.fromJson({'id': doc.id, ...data});
  }
}

const employeeStatusLabels = <String, String>{
  'active_recruitment': 'Идэвхтэй бүрдүүлэлт',
  'appointing': 'Томилогдож буй',
  'active': 'Идэвхтэй',
  'active_probation': 'Идэвхтэй туршилт',
  'active_permanent': 'Идэвхтэй үндсэн',
  'on_leave': 'Түр эзгүй',
  'releasing': 'Чөлөөлөгдөж буй',
  'terminated': 'Ажлаас гарсан',
  'suspended': 'Түр түдгэлзүүлсэн',
};

bool isActiveStatus(String? status) {
  return status == 'active' ||
      status == 'active_probation' ||
      status == 'active_permanent' ||
      status == 'active_recruitment';
}
