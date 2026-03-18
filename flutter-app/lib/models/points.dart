import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:freezed_annotation/freezed_annotation.dart';

part 'points.freezed.dart';
part 'points.g.dart';

@freezed
abstract class UserPointProfile with _$UserPointProfile {
  const factory UserPointProfile({
    required String userId,
    @Default(0) int balance,
    @Default(0) int monthlyAllowance,
    String? lastAllowanceResetMonth,
    @Default(0) int totalEarned,
    @Default(0) int totalGiven,
  }) = _UserPointProfile;

  factory UserPointProfile.fromJson(Map<String, dynamic> json) =>
      _$UserPointProfileFromJson(json);

  factory UserPointProfile.fromFirestore(
      DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? {};
    return UserPointProfile.fromJson({'userId': doc.id, ...data});
  }
}
