import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:intl/intl.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/firebase/firebase_providers.dart';
import '../../core/firebase/tenant_providers.dart';
import '../../core/theme/app_theme.dart';
import '../../models/post.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authStateProvider);
    final tenantState = ref.watch(tenantStateProvider);
    final tenantService = ref.watch(tenantServiceProvider);

    final user = authState.valueOrNull;

    if (tenantState.isLoading) {
      return const Scaffold(
        backgroundColor: Color(0xFFF8FAFC),
        body: Center(child: CircularProgressIndicator()),
      );
    }

    if (tenantService == null) {
      return const Scaffold(
        backgroundColor: Color(0xFFF8FAFC),
        body: Center(child: Text('Tenant тохируулагдаагүй байна')),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: CustomScrollView(
        slivers: [
          // Header
          SliverToBoxAdapter(
            child: _HomeHeader(
              userId: user?.uid,
              tenantService: tenantService,
            ),
          ),

          // Attendance card
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: _AttendanceQuickCard(
                onTap: () => context.go('/attendance'),
              ),
            ),
          ),

          // Quick actions
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
              child: _QuickActionsRow(),
            ),
          ),

          // Feed title
          const SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.fromLTRB(16, 20, 16, 8),
              child: Text(
                'Шинэ мэдээ',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF0F172A),
                ),
              ),
            ),
          ),

          // Posts feed
          _PostsFeed(
            tenantService: tenantService,
            userId: user?.uid,
          ),

          const SliverToBoxAdapter(child: SizedBox(height: 100)),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Home Header
// ---------------------------------------------------------------------------

class _HomeHeader extends StatelessWidget {
  final String? userId;
  final dynamic tenantService;

  const _HomeHeader({this.userId, this.tenantService});

  String _getGreeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Өглөөний мэнд';
    if (hour < 17) return 'Өдрийн мэнд';
    return 'Оройн мэнд';
  }

  @override
  Widget build(BuildContext context) {
    final topPadding = MediaQuery.of(context).padding.top;

    return Container(
      color: Colors.white,
      padding: EdgeInsets.only(
        top: topPadding + 12,
        left: 16,
        right: 16,
        bottom: 12,
      ),
      child: userId != null && tenantService != null
          ? StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
              stream: tenantService!.doc('employees', userId!).snapshots(),
              builder: (context, snapshot) {
                final data = snapshot.data?.data();
                final firstName = data?['firstName'] ?? '';
                final photoUrl = data?['photoURL'] as String?;

                return Row(
                  children: [
                    // Avatar
                    ClipRRect(
                      borderRadius: BorderRadius.circular(14),
                      child: Container(
                        width: 44,
                        height: 44,
                        color: const Color(0xFFF1F5F9),
                        child: photoUrl != null && photoUrl.isNotEmpty
                            ? CachedNetworkImage(
                                imageUrl: photoUrl,
                                width: 44,
                                height: 44,
                                fit: BoxFit.cover,
                                placeholder: (_, _) => _avatarFallback(firstName),
                                errorWidget: (_, _, _) => _avatarFallback(firstName),
                              )
                            : _avatarFallback(firstName),
                      ),
                    ),
                    const SizedBox(width: 12),
                    // Text
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            firstName.isNotEmpty
                                ? '${_getGreeting()}, $firstName'
                                : _getGreeting(),
                            style: const TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF0F172A),
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 2),
                          Text(
                            DateFormat('M сарын d, EEEE').format(DateTime.now()),
                            style: const TextStyle(
                              fontSize: 12,
                              color: Color(0xFF94A3B8),
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                    // Bell icon
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: const Color(0xFFE2E8F0),
                          width: 0.5,
                        ),
                      ),
                      child: const Icon(
                        Icons.notifications_outlined,
                        color: Color(0xFF64748B),
                        size: 20,
                      ),
                    ),
                  ],
                );
              },
            )
          : Row(
              children: [
                Text(
                  _getGreeting(),
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF0F172A),
                  ),
                ),
              ],
            ),
    );
  }

  Widget _avatarFallback(String name) {
    return Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF6366F1), Color(0xFFA855F7)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Center(
        child: Text(
          name.isNotEmpty ? name[0].toUpperCase() : 'N',
          style: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w700,
            fontSize: 18,
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Attendance Card
// ---------------------------------------------------------------------------

class _AttendanceQuickCard extends StatelessWidget {
  final VoidCallback onTap;
  const _AttendanceQuickCard({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      borderRadius: BorderRadius.circular(16),
      clipBehavior: Clip.antiAlias,
      child: Ink(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          gradient: const LinearGradient(
            colors: [Color(0xFF4F46E5), Color(0xFF7C3AED)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(Icons.access_time_rounded,
                              size: 14,
                              color: Colors.white.withValues(alpha: 0.8)),
                          const SizedBox(width: 4),
                          Text(
                            'Өнөөдрийн ирц',
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.8),
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      const Text(
                        'Ирц бүртгүүлэх',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.arrow_forward_rounded,
                      color: Colors.white, size: 22),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Quick Actions
// ---------------------------------------------------------------------------

class _QuickActionsRow extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final actions = [
      _QA('Ирц', Icons.access_time_rounded, const Color(0xFF4F46E5), '/attendance'),
      _QA('Судалгаа', Icons.poll_outlined, const Color(0xFFE11D48), '/home/survey'),
      _QA('Төсөл', Icons.folder_outlined, const Color(0xFF7C3AED), '/home/projects'),
      _QA('Амралт', Icons.beach_access_outlined, const Color(0xFF059669), '/home/vacation'),
      _QA('Оноо', Icons.star_rounded, const Color(0xFFF59E0B), '/home/points'),
    ];

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: actions.map((a) {
        return GestureDetector(
          onTap: () => context.go(a.route),
          child: Column(
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.04),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Icon(a.icon, color: a.color, size: 24),
              ),
              const SizedBox(height: 6),
              Text(
                a.label,
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF64748B),
                ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }
}

class _QA {
  final String label;
  final IconData icon;
  final Color color;
  final String route;
  const _QA(this.label, this.icon, this.color, this.route);
}

// ---------------------------------------------------------------------------
// Posts Feed
// ---------------------------------------------------------------------------

class _PostsFeed extends StatelessWidget {
  final dynamic tenantService;
  final String? userId;

  const _PostsFeed({required this.tenantService, this.userId});

  @override
  Widget build(BuildContext context) {
    if (tenantService == null) {
      return const SliverToBoxAdapter(child: SizedBox.shrink());
    }

    final postsRef = tenantService!.collection('posts') as CollectionReference<Map<String, dynamic>>;

    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: postsRef.orderBy('createdAt', descending: true).limit(20).snapshots(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            sliver: SliverList(
              delegate: SliverChildBuilderDelegate(
                (_, _) => const _PostSkeleton(),
                childCount: 3,
              ),
            ),
          );
        }

        final posts = snapshot.data?.docs
                .map((doc) => Post.fromFirestore(doc))
                .toList() ??
            [];

        if (posts.isEmpty) {
          return SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Container(
                padding: const EdgeInsets.all(40),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: const Color(0xFFE2E8F0),
                    width: 1.5,
                    strokeAlign: BorderSide.strokeAlignInside,
                  ),
                ),
                child: Column(
                  children: [
                    Container(
                      width: 56,
                      height: 56,
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(28),
                      ),
                      child: const Icon(Icons.article_outlined,
                          color: Color(0xFF94A3B8), size: 28),
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'Одоогоор мэдээ алга',
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Шинэ мэдээлэл орохоор энд харагдах болно.',
                      style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                    ),
                  ],
                ),
              ),
            ),
          );
        }

        return SliverPadding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          sliver: SliverList(
            delegate: SliverChildBuilderDelegate(
              (context, index) {
                return PostCard(
                  post: posts[index],
                  userId: userId,
                  tenantService: tenantService,
                );
              },
              childCount: posts.length,
            ),
          ),
        );
      },
    );
  }
}

// ---------------------------------------------------------------------------
// Post Card
// ---------------------------------------------------------------------------

class PostCard extends StatefulWidget {
  final Post post;
  final String? userId;
  final dynamic tenantService;

  const PostCard({
    super.key,
    required this.post,
    this.userId,
    this.tenantService,
  });

  @override
  State<PostCard> createState() => _PostCardState();
}

class _PostCardState extends State<PostCard> {
  bool _isExpanded = false;
  int _currentImageIndex = 0;

  ReactionType? get _userReaction => widget.post.userReaction(widget.userId);

  void _handleReaction(ReactionType reaction) {
    if (widget.userId == null || widget.tenantService == null) return;

    final postRef = widget.tenantService!.doc('posts', widget.post.id);
    final newReactions = Map<String, dynamic>.from(
      widget.post.reactions.map((k, v) => MapEntry(k, reactionTypeToString(v))),
    );

    if (_userReaction == reaction) {
      newReactions.remove(widget.userId);
    } else {
      newReactions[widget.userId!] = reactionTypeToString(reaction);
    }

    postRef.update({'reactions': newReactions});
    Navigator.of(context).pop();
  }

  void _showReactionPicker() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => _ReactionPicker(
        currentReaction: _userReaction,
        onReaction: _handleReaction,
      ),
    );
  }

  void _showReactionDetails() {
    if (widget.post.totalReactions == 0 || widget.tenantService == null) return;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => _ReactionDetailsSheet(
        reactions: widget.post.reactions,
        tenantService: widget.tenantService,
      ),
    );
  }

  String _timeAgo(DateTime date) {
    final diff = DateTime.now().difference(date);
    if (diff.inMinutes < 1) return 'Саяхан';
    if (diff.inMinutes < 60) return '${diff.inMinutes} минутын өмнө';
    if (diff.inHours < 24) return '${diff.inHours} цагийн өмнө';
    if (diff.inDays < 7) return '${diff.inDays} өдрийн өмнө';
    return DateFormat('yyyy.MM.dd').format(date);
  }

  @override
  Widget build(BuildContext context) {
    final post = widget.post;
    final reactionCounts = post.reactionCounts;
    final totalReactions = post.totalReactions;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Author header
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 14, 14, 0),
            child: Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(18),
                    gradient: const LinearGradient(
                      colors: [Color(0xFF6366F1), Color(0xFFA855F7)],
                    ),
                  ),
                  child: Center(
                    child: Text(
                      post.authorName.isNotEmpty
                          ? post.authorName[0].toUpperCase()
                          : '?',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        post.authorName,
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 13,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                      Text(
                        _timeAgo(post.createdAt),
                        style: const TextStyle(
                          fontSize: 10,
                          color: Color(0xFF94A3B8),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Title + content
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 10, 14, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (post.title.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Text(
                      post.title,
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                        color: Color(0xFF0F172A),
                        height: 1.3,
                      ),
                    ),
                  ),
                if (post.content.isNotEmpty)
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        post.content,
                        maxLines: _isExpanded ? null : 3,
                        overflow:
                            _isExpanded ? null : TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 13,
                          color: Color(0xFF475569),
                          height: 1.5,
                        ),
                      ),
                      if (post.content.length > 150)
                        GestureDetector(
                          onTap: () =>
                              setState(() => _isExpanded = !_isExpanded),
                          child: Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Text(
                              _isExpanded ? 'Хураах' : 'Цааш унших',
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: AppColors.primary,
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
              ],
            ),
          ),

          // Image carousel
          if (post.imageUrls.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: _ImageCarousel(
                imageUrls: post.imageUrls,
                currentIndex: _currentImageIndex,
                onPageChanged: (i) =>
                    setState(() => _currentImageIndex = i),
              ),
            ),

          // Reaction summary
          if (totalReactions > 0)
            GestureDetector(
              onTap: _showReactionDetails,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(14, 10, 14, 0),
                child: Row(
                  children: [
                    ...reactionCounts.keys.map((type) {
                      return Padding(
                        padding: const EdgeInsets.only(right: 2),
                        child: _ReactionBubble(type: type, size: 20),
                      );
                    }),
                    const SizedBox(width: 6),
                    Text(
                      '$totalReactions',
                      style: const TextStyle(
                        fontSize: 12,
                        color: Color(0xFF64748B),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ),

          // Action buttons
          Padding(
            padding: const EdgeInsets.fromLTRB(8, 6, 8, 8),
            child: Container(
              decoration: const BoxDecoration(
                border: Border(
                  top: BorderSide(color: Color(0xFFF1F5F9), width: 1),
                ),
              ),
              padding: const EdgeInsets.only(top: 6),
              child: Row(
                children: [
                  Expanded(
                    child: _ActionButton(
                      icon: _userReaction != null
                          ? _reactionIcon(_userReaction!)
                          : Icons.thumb_up_outlined,
                      label: 'Таалагдлаа',
                      color: _userReaction != null
                          ? _reactionColor(_userReaction!)
                          : const Color(0xFF64748B),
                      onTap: _showReactionPicker,
                      onLongPress: _showReactionPicker,
                    ),
                  ),
                  Expanded(
                    child: _ActionButton(
                      icon: Icons.chat_bubble_outline_rounded,
                      label: 'Сэтгэгдэл',
                      color: const Color(0xFF64748B),
                      onTap: () {},
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  IconData _reactionIcon(ReactionType type) {
    switch (type) {
      case ReactionType.like:
        return Icons.thumb_up_rounded;
      case ReactionType.love:
        return Icons.favorite_rounded;
      case ReactionType.care:
        return Icons.volunteer_activism_rounded;
    }
  }

  Color _reactionColor(ReactionType type) {
    switch (type) {
      case ReactionType.like:
        return const Color(0xFF3B82F6);
      case ReactionType.love:
        return const Color(0xFFEF4444);
      case ReactionType.care:
        return const Color(0xFFF59E0B);
    }
  }
}

// ---------------------------------------------------------------------------
// Image Carousel
// ---------------------------------------------------------------------------

class _ImageCarousel extends StatelessWidget {
  final List<String> imageUrls;
  final int currentIndex;
  final ValueChanged<int> onPageChanged;

  const _ImageCarousel({
    required this.imageUrls,
    required this.currentIndex,
    required this.onPageChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        SizedBox(
          height: 220,
          child: PageView.builder(
            itemCount: imageUrls.length,
            onPageChanged: onPageChanged,
            itemBuilder: (context, index) {
              return Image.network(
                imageUrls[index],
                fit: BoxFit.cover,
                width: double.infinity,
                height: 220,
                loadingBuilder: (context, child, loadingProgress) {
                  if (loadingProgress == null) return child;
                  final total = loadingProgress.expectedTotalBytes;
                  final loaded = loadingProgress.cumulativeBytesLoaded;
                  return Container(
                    color: const Color(0xFFF1F5F9),
                    child: Center(
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        value: total != null ? loaded / total : null,
                        color: const Color(0xFF94A3B8),
                      ),
                    ),
                  );
                },
                errorBuilder: (_, error, _) {
                  debugPrint('Image load error: $error');
                  return Container(
                    color: const Color(0xFFF1F5F9),
                    child: const Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.broken_image_outlined,
                              color: Color(0xFF94A3B8), size: 36),
                          SizedBox(height: 8),
                          Text(
                            'Зураг ачаалагдсангүй',
                            style: TextStyle(
                              fontSize: 12,
                              color: Color(0xFF94A3B8),
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              );
            },
          ),
        ),
        if (imageUrls.length > 1)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(imageUrls.length, (i) {
                return Container(
                  width: i == currentIndex ? 16 : 6,
                  height: 6,
                  margin: const EdgeInsets.symmetric(horizontal: 2),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(3),
                    color: i == currentIndex
                        ? AppColors.primary
                        : const Color(0xFFE2E8F0),
                  ),
                );
              }),
            ),
          ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Action Button
// ---------------------------------------------------------------------------

class _ActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;
  final VoidCallback? onLongPress;

  const _ActionButton({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
    this.onLongPress,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      onLongPress: onLongPress,
      borderRadius: BorderRadius.circular(10),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 18, color: color),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Reaction Bubble (small icon circle)
// ---------------------------------------------------------------------------

class _ReactionBubble extends StatelessWidget {
  final ReactionType type;
  final double size;

  const _ReactionBubble({required this.type, required this.size});

  @override
  Widget build(BuildContext context) {
    Color bgColor;
    Widget child;

    switch (type) {
      case ReactionType.like:
        bgColor = const Color(0xFF3B82F6);
        child = Icon(Icons.thumb_up_rounded, color: Colors.white, size: size * 0.55);
      case ReactionType.love:
        bgColor = const Color(0xFFEF4444);
        child = Icon(Icons.favorite_rounded, color: Colors.white, size: size * 0.55);
      case ReactionType.care:
        bgColor = const Color(0xFFF59E0B);
        child = Text('🤗', style: TextStyle(fontSize: size * 0.5));
    }

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: bgColor,
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white, width: 1.5),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.1),
            blurRadius: 2,
          ),
        ],
      ),
      child: Center(child: child),
    );
  }
}

// ---------------------------------------------------------------------------
// Reaction Picker (bottom sheet)
// ---------------------------------------------------------------------------

class _ReactionPicker extends StatelessWidget {
  final ReactionType? currentReaction;
  final void Function(ReactionType) onReaction;

  const _ReactionPicker({
    this.currentReaction,
    required this.onReaction,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.all(20),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(50),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.15),
            blurRadius: 20,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _ReactionOption(
            icon: Icons.thumb_up_rounded,
            label: 'Таалагдлаа',
            color: const Color(0xFF3B82F6),
            bgColor: const Color(0xFFEFF6FF),
            isSelected: currentReaction == ReactionType.like,
            onTap: () => onReaction(ReactionType.like),
          ),
          const SizedBox(width: 8),
          _ReactionOption(
            icon: Icons.favorite_rounded,
            label: 'Хайртай',
            color: const Color(0xFFEF4444),
            bgColor: const Color(0xFFFEF2F2),
            isSelected: currentReaction == ReactionType.love,
            onTap: () => onReaction(ReactionType.love),
          ),
          const SizedBox(width: 8),
          _ReactionOption(
            emoji: '🤗',
            label: 'Тааладсан',
            color: const Color(0xFFF59E0B),
            bgColor: const Color(0xFFFFFBEB),
            isSelected: currentReaction == ReactionType.care,
            onTap: () => onReaction(ReactionType.care),
          ),
        ],
      ),
    );
  }
}

class _ReactionOption extends StatelessWidget {
  final IconData? icon;
  final String? emoji;
  final String label;
  final Color color;
  final Color bgColor;
  final bool isSelected;
  final VoidCallback onTap;

  const _ReactionOption({
    this.icon,
    this.emoji,
    required this.label,
    required this.color,
    required this.bgColor,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          color: isSelected ? bgColor : Colors.transparent,
          borderRadius: BorderRadius.circular(30),
          border: isSelected ? Border.all(color: color.withValues(alpha: 0.3)) : null,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) Icon(icon!, color: color, size: 28),
            if (emoji != null)
              Text(emoji!, style: const TextStyle(fontSize: 26)),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w600,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Reaction Details Sheet
// ---------------------------------------------------------------------------

class _ReactionDetailsSheet extends StatelessWidget {
  final Map<String, ReactionType> reactions;
  final dynamic tenantService;

  const _ReactionDetailsSheet({
    required this.reactions,
    required this.tenantService,
  });

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.5,
      minChildSize: 0.3,
      maxChildSize: 0.8,
      expand: false,
      builder: (context, scrollController) {
        return Column(
          children: [
            // Handle
            Padding(
              padding: const EdgeInsets.only(top: 12, bottom: 8),
              child: Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFFE2E8F0),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 20, vertical: 8),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'Реакцууд',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0F172A),
                  ),
                ),
              ),
            ),
            Expanded(
              child: ListView.builder(
                controller: scrollController,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: reactions.length,
                itemBuilder: (context, index) {
                  final uid = reactions.keys.elementAt(index);
                  final type = reactions[uid]!;

                  return FutureBuilder<DocumentSnapshot<Map<String, dynamic>>>(
                    future: tenantService!.doc('employees', uid).get(),
                    builder: (context, snap) {
                      final empData = snap.data?.data();
                      final name = empData != null
                          ? '${empData['firstName'] ?? ''} ${empData['lastName'] ?? ''}'
                          : 'Ачаалж байна...';
                      final photoUrl = empData?['photoURL'] as String?;

                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 6),
                        child: Row(
                          children: [
                            CircleAvatar(
                              radius: 18,
                              backgroundColor:
                                  const Color(0xFFF1F5F9),
                              backgroundImage: photoUrl != null
                                  ? CachedNetworkImageProvider(photoUrl)
                                  : null,
                              child: photoUrl == null
                                  ? Text(
                                      name.isNotEmpty
                                          ? name[0].toUpperCase()
                                          : '?',
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w600,
                                        fontSize: 14,
                                        color: Color(0xFF64748B),
                                      ),
                                    )
                                  : null,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                name,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w500,
                                  fontSize: 14,
                                  color: Color(0xFF0F172A),
                                ),
                              ),
                            ),
                            _ReactionBubble(type: type, size: 24),
                          ],
                        ),
                      );
                    },
                  );
                },
              ),
            ),
          ],
        );
      },
    );
  }
}

// ---------------------------------------------------------------------------
// Post Skeleton
// ---------------------------------------------------------------------------

class _PostSkeleton extends StatelessWidget {
  const _PostSkeleton();

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _shimmerBox(36, 36, borderRadius: 18),
              const SizedBox(width: 10),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _shimmerBox(100, 12),
                  const SizedBox(height: 6),
                  _shimmerBox(70, 10),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),
          _shimmerBox(double.infinity, 12),
          const SizedBox(height: 8),
          _shimmerBox(200, 12),
          const SizedBox(height: 12),
          _shimmerBox(double.infinity, 160, borderRadius: 12),
          const SizedBox(height: 12),
          _shimmerBox(80, 28, borderRadius: 8),
        ],
      ),
    );
  }

  Widget _shimmerBox(double width, double height, {double borderRadius = 6}) {
    return Container(
      width: width == double.infinity ? null : width,
      height: height,
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(borderRadius),
      ),
    );
  }
}
