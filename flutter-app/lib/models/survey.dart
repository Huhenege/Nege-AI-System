import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:freezed_annotation/freezed_annotation.dart';

part 'survey.freezed.dart';
part 'survey.g.dart';

@freezed
abstract class Survey with _$Survey {
  const factory Survey({
    required String id,
    required String title,
    String? description,
    @Default('custom') String type,
    @Default('draft') String status,
    bool? isAnonymous,
    String? startDate,
    String? endDate,
    int? questionsCount,
    int? responsesCount,
    String? createdBy,
  }) = _Survey;

  factory Survey.fromJson(Map<String, dynamic> json) =>
      _$SurveyFromJson(json);

  factory Survey.fromFirestore(
      DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? {};
    return Survey.fromJson({'id': doc.id, ...data});
  }
}
