import 'package:cloud_firestore/cloud_firestore.dart';

enum ReactionType { like, love, care }

ReactionType? reactionTypeFromString(String? value) {
  switch (value) {
    case 'like':
      return ReactionType.like;
    case 'love':
      return ReactionType.love;
    case 'care':
      return ReactionType.care;
    default:
      return null;
  }
}

String reactionTypeToString(ReactionType type) {
  switch (type) {
    case ReactionType.like:
      return 'like';
    case ReactionType.love:
      return 'love';
    case ReactionType.care:
      return 'care';
  }
}

class Post {
  final String id;
  final String title;
  final String content;
  final List<String> imageUrls;
  final String authorName;
  final String? authorId;
  final DateTime createdAt;
  final Map<String, ReactionType> reactions;

  const Post({
    required this.id,
    required this.title,
    required this.content,
    this.imageUrls = const [],
    required this.authorName,
    this.authorId,
    required this.createdAt,
    this.reactions = const {},
  });

  factory Post.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? {};
    final rawReactions = data['reactions'] as Map<String, dynamic>? ?? {};
    final reactions = <String, ReactionType>{};
    for (final entry in rawReactions.entries) {
      final type = reactionTypeFromString(entry.value as String?);
      if (type != null) reactions[entry.key] = type;
    }

    DateTime createdAt;
    final rawDate = data['createdAt'];
    if (rawDate is Timestamp) {
      createdAt = rawDate.toDate();
    } else if (rawDate is String) {
      createdAt = DateTime.tryParse(rawDate) ?? DateTime.now();
    } else {
      createdAt = DateTime.now();
    }

    final rawImages = data['imageUrls'];
    List<String> imageUrls;
    if (rawImages is List) {
      imageUrls = rawImages.cast<String>();
    } else if (data['imageUrl'] is String) {
      imageUrls = [data['imageUrl'] as String];
    } else {
      imageUrls = [];
    }

    return Post(
      id: doc.id,
      title: data['title'] as String? ?? '',
      content: data['content'] as String? ?? '',
      imageUrls: imageUrls,
      authorName: data['authorName'] as String? ?? 'Тодорхойгүй',
      authorId: data['authorId'] as String?,
      createdAt: createdAt,
      reactions: reactions,
    );
  }

  int get totalReactions => reactions.length;

  Map<ReactionType, int> get reactionCounts {
    final counts = <ReactionType, int>{};
    for (final type in reactions.values) {
      counts[type] = (counts[type] ?? 0) + 1;
    }
    return counts;
  }

  ReactionType? userReaction(String? userId) {
    if (userId == null) return null;
    return reactions[userId];
  }
}
