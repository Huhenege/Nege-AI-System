import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:freezed_annotation/freezed_annotation.dart';

part 'project.freezed.dart';
part 'project.g.dart';

@freezed
abstract class Project with _$Project {
  const factory Project({
    required String id,
    required String name,
    String? goal,
    String? expectedOutcome,
    String? startDate,
    String? endDate,
    String? ownerId,
    @Default([]) List<String> teamMemberIds,
    @Default('DRAFT') String status,
    @Default('MEDIUM') String priority,
    String? type,
    String? groupId,
  }) = _Project;

  factory Project.fromJson(Map<String, dynamic> json) =>
      _$ProjectFromJson(json);

  factory Project.fromFirestore(
      DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? {};
    return Project.fromJson({'id': doc.id, ...data});
  }
}

@freezed
abstract class Task with _$Task {
  const factory Task({
    required String id,
    required String projectId,
    required String title,
    String? dueDate,
    String? ownerId,
    @Default([]) List<String> assigneeIds,
    @Default('TODO') String status,
    @Default('MEDIUM') String priority,
  }) = _Task;

  factory Task.fromJson(Map<String, dynamic> json) => _$TaskFromJson(json);

  factory Task.fromFirestore(
      DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? {};
    return Task.fromJson({'id': doc.id, ...data});
  }
}
