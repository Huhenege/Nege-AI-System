import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/firebase/tenant_providers.dart';
import '../../core/theme/app_theme.dart';
import 'in_app_video_screen.dart';

class CompanyScreen extends ConsumerWidget {
  const CompanyScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tenantService = ref.watch(tenantServiceProvider);
    final tenantState = ref.watch(tenantStateProvider);

    if (tenantService == null || tenantState.companyId == null) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
        stream: tenantService.doc('company', 'profile').snapshots(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const _PageSkeleton();
          }

          final data = snapshot.data?.data();
          if (data == null) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.business_outlined,
                      size: 48, color: Colors.grey.shade300),
                  const SizedBox(height: 12),
                  const Text('Компанийн мэдээлэл олдсонгүй.',
                      style: TextStyle(color: Color(0xFF94A3B8))),
                ],
              ),
            );
          }

          return CustomScrollView(
            slivers: [
              // Ковер + компани карт (ковер ард, карт урд)
              SliverToBoxAdapter(
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    _CoverSection(coverUrls: _toStringList(data['coverUrls'])),
                    Positioned(
                      left: 0,
                      right: 0,
                      bottom: -40,
                      child: _CompanyCard(data: data),
                    ),
                  ],
                ),
              ),

              // Spacer to compensate for the -40 overflow of CompanyCard
              const SliverToBoxAdapter(child: SizedBox(height: 56)),

              // CEO
              if (data['ceoEmployeeId'] != null && (data['ceoEmployeeId'] as String).isNotEmpty)
                SliverToBoxAdapter(
                  child: _CeoCard(
                    ceoEmployeeId: data['ceoEmployeeId'] as String,
                    tenantService: tenantService,
                  ),
                ),

              // Mission & Vision
              if (data['mission'] != null || data['vision'] != null)
                SliverToBoxAdapter(
                  child: _MissionVisionSection(
                    mission: data['mission'] as String?,
                    vision: data['vision'] as String?,
                  ),
                ),

              // Introduction
              if (data['introduction'] != null &&
                  (data['introduction'] as String).isNotEmpty)
                SliverToBoxAdapter(
                    child: _IntroductionCard(text: data['introduction'])),

              // Core values
              SliverToBoxAdapter(
                child: _CoreValuesSection(tenantService: tenantService),
              ),

              // Компанийн видеонууд
              if (_videosFromData(data).isNotEmpty)
                SliverToBoxAdapter(
                  child: _VideosSection(videos: _videosFromData(data)),
                ),

              // Бодлого, журам (бичиг баримтууд)
              SliverToBoxAdapter(
                child: _PoliciesCard(),
              ),

              // Contact
              SliverToBoxAdapter(
                child: _ContactSection(data: data),
              ),

              // History timeline
              SliverToBoxAdapter(
                child: _HistorySection(tenantService: tenantService),
              ),

              // Footer
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 24),
                  child: Center(
                    child: Text(
                      '© ${DateTime.now().year} ${data['name'] ?? ''}',
                      style: const TextStyle(
                          fontSize: 11, color: Color(0xFF94A3B8)),
                    ),
                  ),
                ),
              ),

              const SliverToBoxAdapter(child: SizedBox(height: 80)),
            ],
          );
        },
      ),
    );
  }

  List<String> _toStringList(dynamic val) {
    if (val is List) return val.cast<String>();
    return [];
  }

  static List<Map<String, dynamic>> _videosFromData(Map<String, dynamic> data) {
    final v = data['videos'];
    if (v is! List || v.isEmpty) return [];
    return v.map((e) {
      if (e is Map<String, dynamic>) return e;
      if (e is Map) return Map<String, dynamic>.from(e as Map);
      return <String, dynamic>{};
    }).where((e) => e['url'] != null && (e['url'] as String).isNotEmpty).toList();
  }
}

// ---------------------------------------------------------------------------
// Cover Section
// ---------------------------------------------------------------------------

class _CoverSection extends StatefulWidget {
  final List<String> coverUrls;
  const _CoverSection({required this.coverUrls});

  @override
  State<_CoverSection> createState() => _CoverSectionState();
}

class _CoverSectionState extends State<_CoverSection> {
  final PageController _controller = PageController();
  int _current = 0;

  @override
  void initState() {
    super.initState();
    if (widget.coverUrls.length > 1) {
      Future.delayed(const Duration(seconds: 3), _autoScroll);
    }
  }

  void _autoScroll() {
    if (!mounted || widget.coverUrls.length <= 1) return;
    final next = (_current + 1) % widget.coverUrls.length;
    _controller.animateToPage(next,
        duration: const Duration(milliseconds: 600), curve: Curves.easeInOut);
    Future.delayed(const Duration(seconds: 5), _autoScroll);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.coverUrls.isEmpty) {
      return Container(
        height: 160,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFF4F46E5), Color(0xFF7C3AED)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
      );
    }

    return SizedBox(
      height: 220,
      child: PageView.builder(
        controller: _controller,
        itemCount: widget.coverUrls.length,
        onPageChanged: (i) => setState(() => _current = i),
        itemBuilder: (_, i) {
          return Image.network(
            widget.coverUrls[i],
            fit: BoxFit.cover,
            width: double.infinity,
            errorBuilder: (_, _, _) => Container(
              color: const Color(0xFFF1F5F9),
              child: const Icon(Icons.image_outlined,
                  size: 40, color: Color(0xFF94A3B8)),
            ),
          );
        },
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Company Card
// ---------------------------------------------------------------------------

class _CompanyCard extends StatelessWidget {
  final Map<String, dynamic> data;
  const _CompanyCard({required this.data});

  @override
  Widget build(BuildContext context) {
    final logoUrl = data['logoUrl'] as String?;
    final name = data['name'] as String? ?? '';
    final website = data['website'] as String?;
    final registrationNumber = data['registrationNumber'] as String?;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.08),
              blurRadius: 20,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: SizedBox(
                  width: 56,
                  height: 56,
                  child: logoUrl != null && logoUrl.isNotEmpty
                      ? Image.network(
                          logoUrl,
                          width: 56,
                          height: 56,
                          fit: BoxFit.contain,
                          loadingBuilder: (_, child, loadingProgress) {
                            if (loadingProgress == null) return child;
                            return Container(
                              width: 56,
                              height: 56,
                              color: const Color(0xFFF8FAFC),
                              alignment: Alignment.center,
                              child: SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  value: loadingProgress.expectedTotalBytes != null
                                      ? loadingProgress.cumulativeBytesLoaded /
                                          (loadingProgress.expectedTotalBytes ?? 1)
                                      : null,
                                ),
                              ),
                            );
                          },
                          errorBuilder: (_, _, _) => _logoFallback(name),
                        )
                      : _logoFallback(name),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                    if (registrationNumber != null &&
                        registrationNumber.toString().trim().isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          'Регистр: ${registrationNumber.toString().trim()}',
                          style: const TextStyle(
                            fontSize: 12,
                            color: Color(0xFF64748B),
                          ),
                        ),
                      ),
                    if (website != null && website.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: GestureDetector(
                          onTap: () => _openUrl(website),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.language,
                                  size: 12, color: AppColors.primary),
                              const SizedBox(width: 4),
                              Text(
                                Uri.tryParse(website)?.host ?? website,
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w500,
                                  color: AppColors.primary,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ],
        ),
      ),
    );
  }

  Widget _logoFallback(String name) {
    return Container(
      width: 56,
      height: 56,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFF6366F1), Color(0xFF9333EA)],
        ),
        borderRadius: BorderRadius.all(Radius.circular(12)),
      ),
      child: Center(
        child: Text(
          name.isNotEmpty ? name[0].toUpperCase() : 'N',
          style: const TextStyle(
              color: Colors.white, fontWeight: FontWeight.w700, fontSize: 24),
        ),
      ),
    );
  }

  void _openUrl(String url) async {
    final uri = Uri.parse(url.startsWith('http') ? url : 'https://$url');
    if (await canLaunchUrl(uri)) launchUrl(uri);
  }
}

// ---------------------------------------------------------------------------
// CEO Card
// ---------------------------------------------------------------------------

class _CeoCard extends StatelessWidget {
  final String ceoEmployeeId;
  final dynamic tenantService;

  const _CeoCard({
    required this.ceoEmployeeId,
    required this.tenantService,
  });

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
      stream: tenantService.doc('employees', ceoEmployeeId).snapshots(),
      builder: (context, snapshot) {
        final empData = snapshot.data?.data();
        if (empData == null) return const SizedBox.shrink();

        final firstName = empData['firstName'] as String? ?? '';
        final lastName = empData['lastName'] as String? ?? '';
        final photoUrl = empData['photoURL'] as String?;
        final fullName = [lastName, firstName].where((s) => s.isNotEmpty).join(' ');

        if (fullName.isEmpty) return const SizedBox.shrink();

        return _section(
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: _cardDecoration(),
            child: Row(
              children: [
                _ceoAvatar(fullName, photoUrl, 44),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(fullName,
                          style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF0F172A))),
                      const SizedBox(height: 2),
                      const Text('Гүйцэтгэх захирал',
                          style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _ceoAvatar(String name, String? photoUrl, double size) {
    if (photoUrl != null && photoUrl.isNotEmpty) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(size / 2),
        child: SizedBox(
          width: size,
          height: size,
          child: Image.network(
            photoUrl,
            width: size,
            height: size,
            fit: BoxFit.cover,
            errorBuilder: (_, _, _) => _ceoFallback(name, size),
          ),
        ),
      );
    }
    return _ceoFallback(name, size);
  }

  Widget _ceoFallback(String name, double size) {
    final initial = name.isNotEmpty ? name[0].toUpperCase() : '?';
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(size / 2),
        gradient: const LinearGradient(
          colors: [Color(0xFFF1F5F9), Color(0xFFE2E8F0)],
        ),
      ),
      child: Center(
        child: Text(
          initial,
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: Color(0xFF64748B),
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Mission & Vision
// ---------------------------------------------------------------------------

class _MissionVisionSection extends StatelessWidget {
  final String? mission;
  final String? vision;
  const _MissionVisionSection({this.mission, this.vision});

  @override
  Widget build(BuildContext context) {
    return _section(
      title: 'Бидний тухай',
      child: Column(
        children: [
          if (mission != null && mission!.isNotEmpty)
            _MissionVisionCard(
              icon: Icons.rocket_launch_rounded,
              title: 'Эрхэм зорилго',
              content: mission!,
              gradientColors: const [Color(0xFFEFF6FF), Colors.white],
              iconBg: const Color(0xFFDBEAFE),
              iconColor: const Color(0xFF3B82F6),
            ),
          if (vision != null && vision!.isNotEmpty)
            Padding(
              padding: EdgeInsets.only(top: mission != null ? 10 : 0),
              child: _MissionVisionCard(
                icon: Icons.visibility_rounded,
                title: 'Алсын хараа',
                content: vision!,
                gradientColors: const [Color(0xFFF5F3FF), Colors.white],
                iconBg: const Color(0xFFEDE9FE),
                iconColor: const Color(0xFF8B5CF6),
              ),
            ),
        ],
      ),
    );
  }
}

class _MissionVisionCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String content;
  final List<Color> gradientColors;
  final Color iconBg;
  final Color iconColor;

  const _MissionVisionCard({
    required this.icon,
    required this.title,
    required this.content,
    required this.gradientColors,
    required this.iconBg,
    required this.iconColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: LinearGradient(
          colors: gradientColors,
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: iconBg,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: iconColor, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 13,
                        color: Color(0xFF1E293B))),
                const SizedBox(height: 4),
                Text(content,
                    style: const TextStyle(
                        fontSize: 13,
                        color: Color(0xFF475569),
                        height: 1.5)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Introduction
// ---------------------------------------------------------------------------

class _IntroductionCard extends StatelessWidget {
  final String text;
  const _IntroductionCard({required this.text});

  @override
  Widget build(BuildContext context) {
    return _section(
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: _cardDecoration(),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.format_quote_rounded,
                color: Color(0xFFE2E8F0), size: 24),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                text,
                style: const TextStyle(
                  fontSize: 13,
                  color: Color(0xFF475569),
                  fontStyle: FontStyle.italic,
                  height: 1.6,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Core Values
// ---------------------------------------------------------------------------

class _CoreValuesSection extends StatelessWidget {
  final dynamic tenantService;
  const _CoreValuesSection({required this.tenantService});

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: tenantService
          .collection('company')
          .doc('branding')
          .collection('values')
          .snapshots(),
      builder: (context, snapshot) {
        final docs = snapshot.data?.docs ?? [];
        final activeValues =
            docs.where((d) => d.data()['isActive'] != false).toList();
        if (activeValues.isEmpty) return const SizedBox.shrink();

        return _section(
          title: 'Үнэт зүйлс',
          child: SizedBox(
            height: 140,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: activeValues.length,
              separatorBuilder: (_, _) => const SizedBox(width: 10),
              itemBuilder: (context, index) {
                final d = activeValues[index].data();
                final color = _parseColor(d['color'] as String?);
                return GestureDetector(
                  onTap: () => _showValueDetail(context, d),
                  child: Container(
                    width: 150,
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
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
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: color.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Center(
                            child: Text(
                              d['emoji'] as String? ?? '⭐',
                              style: const TextStyle(
                                fontSize: 22,
                                fontFamily: 'Apple Color Emoji',
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 10),
                        Text(
                          d['title'] as String? ?? '',
                          style: const TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 13,
                              color: Color(0xFF1E293B)),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 2),
                        Expanded(
                          child: Text(
                            d['description'] as String? ?? '',
                            style: const TextStyle(
                                fontSize: 11,
                                color: Color(0xFF94A3B8),
                                height: 1.4),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        );
      },
    );
  }

  void _showValueDetail(BuildContext context, Map<String, dynamic> d) {
    final color = _parseColor(d['color'] as String?);
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 60,
              height: 60,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(18),
              ),
              child: Center(
                child: Text(d['emoji'] as String? ?? '⭐',
                    style: const TextStyle(
                        fontSize: 32,
                        fontFamily: 'Apple Color Emoji',
                    )),
              ),
            ),
            const SizedBox(height: 14),
            Text(
              d['title'] as String? ?? '',
              style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF0F172A)),
            ),
            const SizedBox(height: 10),
            Text(
              d['description'] as String? ?? '',
              textAlign: TextAlign.center,
              style: const TextStyle(
                  fontSize: 14, color: Color(0xFF475569), height: 1.6),
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  Color _parseColor(String? hex) {
    if (hex == null || hex.isEmpty) return const Color(0xFF6366F1);
    final cleaned = hex.replaceAll('#', '');
    if (cleaned.length == 6) return Color(int.parse('FF$cleaned', radix: 16));
    return const Color(0xFF6366F1);
  }
}

// ---------------------------------------------------------------------------
// Видеонууд
// ---------------------------------------------------------------------------

class _VideosSection extends StatelessWidget {
  final List<Map<String, dynamic>> videos;

  const _VideosSection({required this.videos});

  @override
  Widget build(BuildContext context) {
    return _section(
      title: 'Видео',
      child: Column(
        children: videos.map((v) => _VideoCard(video: v)).toList(),
      ),
    );
  }
}

class _VideoCard extends StatelessWidget {
  final Map<String, dynamic> video;

  const _VideoCard({required this.video});

  static String? _youtubeThumbnail(String url) {
    final regExp = RegExp(
      r'(?:youtu\.be/|v/|u/\w/|embed/|watch\?v=|&v=)([^#&?]{11})',
    );
    final match = regExp.firstMatch(url);
    final videoId = match?.group(1);
    if (videoId != null) return 'https://img.youtube.com/vi/$videoId/mqdefault.jpg';
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final url = video['url'] as String? ?? '';
    final title = video['title'] as String? ?? 'Видео';
    final description = video['description'] as String?;
    final thumbUrl = _youtubeThumbnail(url);

    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => _openVideo(context, url, title),
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.06),
                  blurRadius: 10,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Thumbnail + play button
                AspectRatio(
                  aspectRatio: 16 / 9,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      if (thumbUrl != null)
                        Image.network(
                          thumbUrl,
                          fit: BoxFit.cover,
                          loadingBuilder: (_, child, progress) {
                            if (progress == null) return child;
                            return Container(
                              color: const Color(0xFF1E293B),
                              child: const Center(
                                child: CircularProgressIndicator(
                                  color: Colors.white54,
                                  strokeWidth: 2,
                                ),
                              ),
                            );
                          },
                          errorBuilder: (_, __, ___) => _placeholder(),
                        )
                      else
                        _placeholder(),
                      // Play overlay
                      Center(
                        child: Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.5),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.play_arrow_rounded,
                            color: Colors.white,
                            size: 40,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                // Title & description
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 15,
                          color: Color(0xFF1E293B),
                        ),
                      ),
                      if (description != null && description.isNotEmpty) ...[
                        const SizedBox(height: 6),
                        Text(
                          description,
                          style: TextStyle(
                            fontSize: 13,
                            color: Colors.grey.shade600,
                            height: 1.35,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _placeholder() {
    return Container(
      color: const Color(0xFF1E293B),
      child: const Center(
        child: Icon(Icons.videocam_outlined, color: Colors.white38, size: 48),
      ),
    );
  }

  void _openVideo(BuildContext context, String url, String title) {
    if (url.isEmpty) return;
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (context) => InAppVideoScreen(
          videoUrl: url,
          title: title,
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Бодлого, журам (бичиг баримтууд)
// ---------------------------------------------------------------------------

class _PoliciesCard extends StatelessWidget {
  const _PoliciesCard();

  @override
  Widget build(BuildContext context) {
    return _section(
      title: 'Бодлого, журам',
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          onTap: () => context.push('/company/policies'),
          borderRadius: BorderRadius.circular(20),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: _cardDecoration(),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFFBEB),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFFDE68A)),
                  ),
                  child: const Icon(
                    Icons.description_outlined,
                    color: Color(0xFFD97706),
                    size: 22,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Дүрэм, журам',
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF1E293B),
                          fontSize: 15,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Компанийн бодлого, журмууд',
                        style: TextStyle(
                          fontSize: 13,
                          color: Colors.grey.shade600,
                        ),
                      ),
                    ],
                  ),
                ),
                Icon(Icons.chevron_right, color: Colors.grey.shade400, size: 24),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Contact
// ---------------------------------------------------------------------------

class _ContactSection extends StatelessWidget {
  final Map<String, dynamic> data;
  const _ContactSection({required this.data});

  @override
  Widget build(BuildContext context) {
    final phone = data['phoneNumber'] as String?;
    final email = data['contactEmail'] as String?;
    final address = data['address'] as String?;
    if ((phone == null || phone.isEmpty) &&
        (email == null || email.isEmpty) &&
        (address == null || address.isEmpty)) {
      return const SizedBox.shrink();
    }

    return _section(
      title: 'Холбоо барих',
      child: Container(
        decoration: _cardDecoration(),
        child: Column(
          children: [
            if (phone != null && phone.isNotEmpty)
              _contactRow(
                Icons.phone_outlined,
                'Утас',
                '+976 $phone',
                () => _launch('tel:+976$phone'),
              ),
            if (email != null && email.isNotEmpty)
              _contactRow(
                Icons.email_outlined,
                'Имэйл',
                email,
                () => _launch('mailto:$email'),
                showBorder: phone != null && phone.isNotEmpty,
              ),
            if (address != null && address.isNotEmpty)
              _contactRow(
                Icons.location_on_outlined,
                'Хаяг',
                address,
                null,
                showBorder: (phone != null && phone.isNotEmpty) ||
                    (email != null && email.isNotEmpty),
              ),
          ],
        ),
      ),
    );
  }

  Widget _contactRow(
    IconData icon,
    String label,
    String value,
    VoidCallback? onTap, {
    bool showBorder = false,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: showBorder
            ? const BoxDecoration(
                border:
                    Border(top: BorderSide(color: Color(0xFFF8FAFC), width: 1)),
              )
            : null,
        child: Row(
          children: [
            Icon(icon, size: 16, color: const Color(0xFF94A3B8)),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label,
                      style: const TextStyle(
                          fontSize: 11, color: Color(0xFF94A3B8))),
                  Text(value,
                      style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          color: Color(0xFF334155))),
                ],
              ),
            ),
            if (onTap != null)
              const Icon(Icons.chevron_right,
                  size: 18, color: Color(0xFFCBD5E1)),
          ],
        ),
      ),
    );
  }

  void _launch(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) launchUrl(uri);
  }
}

// ---------------------------------------------------------------------------
// History Timeline
// ---------------------------------------------------------------------------

class _HistorySection extends StatelessWidget {
  final dynamic tenantService;
  const _HistorySection({required this.tenantService});

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: (tenantService.collection('companyHistory')
              as CollectionReference<Map<String, dynamic>>)
          .orderBy('startDate')
          .snapshots(),
      builder: (context, snapshot) {
        final docs = snapshot.data?.docs ?? [];
        final events =
            docs.where((d) => d.data()['isActive'] != false).toList();
        if (events.isEmpty) return const SizedBox.shrink();

        return _section(
          title: 'Манай түүх',
          titleIcon: Icons.history_rounded,
          titleIconColor: const Color(0xFFD97706),
          child: Column(
            children: [
              ...events.asMap().entries.map((entry) {
                final d = entry.value.data();
                final startDate = d['startDate'] as String?;
                final endDate = d['endDate'] as String?;
                final year = startDate != null
                    ? DateTime.tryParse(startDate)?.year.toString() ?? ''
                    : '';
                final endYear = endDate != null
                    ? DateTime.tryParse(endDate)?.year.toString()
                    : null;
                final yearDisplay = endYear != null && endYear != year
                    ? '$year - $endYear'
                    : year;
                final images = d['imageUrls'] is List
                    ? (d['imageUrls'] as List).cast<String>()
                    : <String>[];

                return _TimelineEvent(
                  year: year,
                  yearDisplay: yearDisplay,
                  title: d['title'] as String? ?? '',
                  description: d['description'] as String?,
                  imageUrls: images,
                  isLast: entry.key == events.length - 1,
                );
              }),
              // "Одоо" end point
              Padding(
                padding: const EdgeInsets.only(left: 2),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: LinearGradient(
                          colors: [Color(0xFF059669), Color(0xFF14B8A6)],
                        ),
                      ),
                      child: const Center(
                        child: Text('Одоо',
                            style: TextStyle(
                                fontSize: 8,
                                fontWeight: FontWeight.w700,
                                color: Colors.white)),
                      ),
                    ),
                    const SizedBox(width: 14),
                    const Padding(
                      padding: EdgeInsets.only(top: 4),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Бид өнөөдөр',
                              style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFF059669))),
                          Text('Хамтдаа ирээдүйг бүтээж байна',
                              style: TextStyle(
                                  fontSize: 11, color: Color(0xFF94A3B8))),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _TimelineEvent extends StatelessWidget {
  final String year;
  final String yearDisplay;
  final String title;
  final String? description;
  final List<String> imageUrls;
  final bool isLast;

  const _TimelineEvent({
    required this.year,
    required this.yearDisplay,
    required this.title,
    this.description,
    required this.imageUrls,
    required this.isLast,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 20, left: 2),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Timeline dot + line
            SizedBox(
              width: 36,
              child: Column(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: LinearGradient(
                        colors: [Color(0xFF4F46E5), Color(0xFF7C3AED)],
                      ),
                    ),
                    child: Center(
                      child: Text(year,
                          style: const TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.w700,
                              color: Colors.white)),
                    ),
                  ),
                  if (!isLast)
                    Expanded(
                      child: Container(
                        width: 2,
                        decoration: const BoxDecoration(
                          gradient: LinearGradient(
                            colors: [Color(0xFF4F46E5), Color(0xFF059669)],
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(width: 14),
            // Event card
            Expanded(
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.05),
                      blurRadius: 12,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                clipBehavior: Clip.antiAlias,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (imageUrls.isNotEmpty)
                      SizedBox(
                        height: 130,
                        width: double.infinity,
                        child: Image.network(
                          imageUrls.first,
                          fit: BoxFit.cover,
                          errorBuilder: (_, _, _) =>
                              const SizedBox.shrink(),
                        ),
                      ),
                    Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: AppColors.primary.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(yearDisplay,
                                style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w600,
                                    color: AppColors.primary)),
                          ),
                          const SizedBox(height: 6),
                          Text(title,
                              style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 13,
                                  color: Color(0xFF0F172A))),
                          if (description != null &&
                              description!.isNotEmpty) ...[
                            const SizedBox(height: 4),
                            Text(description!,
                                maxLines: 3,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                    fontSize: 12,
                                    color: Color(0xFF64748B),
                                    height: 1.5)),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Shared Helpers
// ---------------------------------------------------------------------------

Widget _section({
  String? title,
  IconData? titleIcon,
  Color? titleIconColor,
  required Widget child,
}) {
  return Padding(
    padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (title != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 10, left: 2),
            child: Row(
              children: [
                if (titleIcon != null) ...[
                  Icon(titleIcon, size: 18, color: titleIconColor),
                  const SizedBox(width: 6),
                ],
                Text(title,
                    style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF0F172A))),
              ],
            ),
          ),
        child,
      ],
    ),
  );
}

BoxDecoration _cardDecoration() {
  return BoxDecoration(
    color: Colors.white,
    borderRadius: BorderRadius.circular(16),
    boxShadow: [
      BoxShadow(
        color: Colors.black.withValues(alpha: 0.04),
        blurRadius: 8,
        offset: const Offset(0, 2),
      ),
    ],
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

class _PageSkeleton extends StatelessWidget {
  const _PageSkeleton();

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Column(
        children: [
          Container(height: 200, color: const Color(0xFFF1F5F9)),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                _box(double.infinity, 80, radius: 16),
                const SizedBox(height: 16),
                _box(double.infinity, 100, radius: 16),
                const SizedBox(height: 16),
                _box(double.infinity, 100, radius: 16),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(child: _box(double.infinity, 120, radius: 14)),
                    const SizedBox(width: 10),
                    Expanded(child: _box(double.infinity, 120, radius: 14)),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _box(double w, double h, {double radius = 8}) {
    return Container(
      width: w,
      height: h,
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(radius),
      ),
    );
  }
}
