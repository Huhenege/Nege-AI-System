import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:go_router/go_router.dart';
import '../../core/firebase/firebase_providers.dart';
import '../../core/firebase/tenant_providers.dart';
import '../../core/theme/app_theme.dart';

// ── Layout constants ─────────────────────────────────────────
const double _kNodeW = 200;
const double _kNodeH = 90;
const double _kHGap = 24;
const double _kVGap = 60;
const double _kPadding = 40;

class MyDepartmentScreen extends ConsumerWidget {
  const MyDepartmentScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tenantService = ref.watch(tenantServiceProvider);
    final userId = ref.watch(authStateProvider).valueOrNull?.uid;

    if (tenantService == null || userId == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Манай алба'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/user'),
        ),
      ),
      body: StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
        stream: tenantService.doc('employees', userId).snapshots(),
        builder: (context, empSnap) {
          if (empSnap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          final empData = empSnap.data?.data();
          if (empData == null) {
            return const Center(child: Text('Ажилтны мэдээлэл олдсонгүй'));
          }

          final positionId = empData['positionId'] as String?;
          var departmentId = empData['departmentId'] as String?;

          if (departmentId != null && departmentId.isNotEmpty) {
            return _DepartmentContent(
              tenantService: tenantService,
              departmentId: departmentId,
              currentUserId: userId,
            );
          }

          if (positionId == null || positionId.isEmpty) {
            return const Center(child: Text('Алба тодорхойлогдоогүй байна'));
          }

          return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
            stream: tenantService.doc('positions', positionId).snapshots(),
            builder: (context, posSnap) {
              if (posSnap.connectionState == ConnectionState.waiting) {
                return const Center(child: CircularProgressIndicator());
              }
              departmentId = posSnap.data?.data()?['departmentId'] as String?;
              if (departmentId == null || departmentId!.isEmpty) {
                return const Center(child: Text('Алба тодорхойлогдоогүй байна'));
              }
              return _DepartmentContent(
                tenantService: tenantService,
                departmentId: departmentId!,
                currentUserId: userId,
              );
            },
          );
        },
      ),
    );
  }
}

// ── Department content: streams → layout → chart ─────────────
class _DepartmentContent extends StatelessWidget {
  final dynamic tenantService;
  final String departmentId;
  final String currentUserId;

  const _DepartmentContent({
    required this.tenantService,
    required this.departmentId,
    required this.currentUserId,
  });

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
      stream: tenantService.doc('departments', departmentId).snapshots()
          as Stream<DocumentSnapshot<Map<String, dynamic>>>,
      builder: (context, deptSnap) {
        if (deptSnap.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        final deptData = deptSnap.data?.data();
        final deptName = deptData?['name'] as String? ?? 'Алба';
        final deptColor = _parseColor(deptData?['color'] as String?);

        return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
          stream: (tenantService.collection('positions') as CollectionReference<Map<String, dynamic>>)
              .where('departmentId', isEqualTo: departmentId)
              .snapshots(),
          builder: (context, posSnap) {
            if (posSnap.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            final positions = posSnap.data?.docs ?? [];

            return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
              stream: (tenantService.collection('employees') as CollectionReference<Map<String, dynamic>>)
                  .where('status', whereIn: ['active', 'active_probation', 'active_permanent', 'appointing'])
                  .snapshots(),
              builder: (context, empSnap) {
                final employees = empSnap.data?.docs ?? [];
                final empByPosition = <String, Map<String, dynamic>>{};
                for (final e in employees) {
                  final pid = e.data()['positionId'] as String?;
                  if (pid != null) {
                    empByPosition[pid] = {...e.data(), 'id': e.id};
                  }
                }

                final nodes = positions
                    .map((d) => _TreeNode(
                          id: d.id,
                          data: d.data(),
                          employee: empByPosition[d.id],
                          isCurrentUser: empByPosition[d.id]?['id'] == currentUserId,
                        ))
                    .toList();

                if (nodes.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.account_tree_outlined, size: 48, color: AppColors.textMuted),
                        const SizedBox(height: 12),
                        Text('Ажлын байр бүртгэгдээгүй байна',
                            style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.textSecondary)),
                      ],
                    ),
                  );
                }

                return _OrgChart(
                  nodes: nodes,
                  deptName: deptName,
                  deptColor: deptColor,
                );
              },
            );
          },
        );
      },
    );
  }
}

// ── Org chart with layout + interactive viewer ───────────────
class _OrgChart extends StatefulWidget {
  final List<_TreeNode> nodes;
  final String deptName;
  final Color deptColor;

  const _OrgChart({
    required this.nodes,
    required this.deptName,
    required this.deptColor,
  });

  @override
  State<_OrgChart> createState() => _OrgChartState();
}

class _OrgChartState extends State<_OrgChart> {
  late _LayoutResult _layout;
  final TransformationController _transformCtrl = TransformationController();

  @override
  void initState() {
    super.initState();
    _layout = _computeLayout(widget.nodes);
  }

  @override
  void didUpdateWidget(covariant _OrgChart old) {
    super.didUpdateWidget(old);
    if (old.nodes != widget.nodes) {
      _layout = _computeLayout(widget.nodes);
    }
  }

  @override
  void dispose() {
    _transformCtrl.dispose();
    super.dispose();
  }

  void _fitToScreen() {
    final screenW = MediaQuery.of(context).size.width;
    final screenH = MediaQuery.of(context).size.height - kToolbarHeight - MediaQuery.of(context).padding.top - 20;
    final scaleX = screenW / _layout.canvasSize.width;
    final scaleY = screenH / _layout.canvasSize.height;
    final scale = math.min(scaleX, scaleY).clamp(0.3, 1.0);
    final dx = (screenW - _layout.canvasSize.width * scale) / 2;
    final dy = 10.0;
    final m = Matrix4.identity()
      ..setEntry(0, 0, scale)
      ..setEntry(1, 1, scale)
      ..setEntry(2, 2, scale)
      ..setEntry(0, 3, dx)
      ..setEntry(1, 3, dy);
    _transformCtrl.value = m;
  }

  @override
  Widget build(BuildContext context) {
    WidgetsBinding.instance.addPostFrameCallback((_) => _fitToScreen());

    return Stack(
      children: [
        InteractiveViewer(
          transformationController: _transformCtrl,
          constrained: false,
          boundaryMargin: const EdgeInsets.all(200),
          minScale: 0.15,
          maxScale: 2.0,
          child: SizedBox(
            width: _layout.canvasSize.width,
            height: _layout.canvasSize.height,
            child: Stack(
              children: [
                CustomPaint(
                  size: _layout.canvasSize,
                  painter: _EdgePainter(edges: _layout.edges, color: widget.deptColor),
                ),
                ..._layout.positioned.map((p) => Positioned(
                      left: p.x,
                      top: p.y,
                      child: _NodeCard(
                        node: p.node,
                        deptColor: widget.deptColor,
                      ),
                    )),
              ],
            ),
          ),
        ),
        Positioned(
          right: 12,
          bottom: 12,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _MiniButton(
                icon: Icons.center_focus_strong,
                onTap: _fitToScreen,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ── Tree layout algorithm (top-down, centered) ───────────────
class _LayoutResult {
  final Size canvasSize;
  final List<_PositionedNode> positioned;
  final List<_Edge> edges;
  _LayoutResult({required this.canvasSize, required this.positioned, required this.edges});
}

class _PositionedNode {
  final double x, y;
  final _TreeNode node;
  _PositionedNode({required this.x, required this.y, required this.node});
}

class _Edge {
  final Offset from, to;
  _Edge({required this.from, required this.to});
}

_LayoutResult _computeLayout(List<_TreeNode> allNodes) {
  final nodeMap = {for (final n in allNodes) n.id: n};
  final childMap = <String, List<_TreeNode>>{};
  final idSet = allNodes.map((n) => n.id).toSet();
  final roots = <_TreeNode>[];

  for (final n in allNodes) {
    final parent = n.data['reportsToId'] as String? ?? n.data['reportsTo'] as String?;
    if (parent != null && idSet.contains(parent)) {
      childMap.putIfAbsent(parent, () => []).add(n);
    } else {
      roots.add(n);
    }
  }

  if (roots.isEmpty && allNodes.isNotEmpty) {
    roots.add(allNodes.first);
  }

  final widthCache = <String, double>{};

  double subtreeWidth(String id) {
    if (widthCache.containsKey(id)) return widthCache[id]!;
    final children = childMap[id] ?? [];
    if (children.isEmpty) {
      widthCache[id] = _kNodeW;
      return _kNodeW;
    }
    double w = 0;
    for (final c in children) {
      if (w > 0) w += _kHGap;
      w += subtreeWidth(c.id);
    }
    final result = math.max(w, _kNodeW);
    widthCache[id] = result;
    return result;
  }

  final positioned = <_PositionedNode>[];
  final edges = <_Edge>[];

  void layoutNode(String id, double left, double top) {
    final node = nodeMap[id]!;
    final myWidth = subtreeWidth(id);
    final x = left + (myWidth - _kNodeW) / 2;
    positioned.add(_PositionedNode(x: x, y: top, node: node));

    final children = childMap[id] ?? [];
    if (children.isEmpty) return;

    double childLeft = left;
    final childTop = top + _kNodeH + _kVGap;

    final fromPt = Offset(x + _kNodeW / 2, top + _kNodeH);

    for (final child in children) {
      final cw = subtreeWidth(child.id);
      final cx = childLeft + (cw - _kNodeW) / 2;
      final toPt = Offset(cx + _kNodeW / 2, childTop);
      edges.add(_Edge(from: fromPt, to: toPt));

      layoutNode(child.id, childLeft, childTop);
      childLeft += cw + _kHGap;
    }
  }

  double totalWidth = 0;
  for (final r in roots) {
    if (totalWidth > 0) totalWidth += _kHGap;
    totalWidth += subtreeWidth(r.id);
  }

  double maxDepth = 0;
  void findMaxDepth(String id, int depth) {
    maxDepth = math.max(maxDepth, depth.toDouble());
    for (final c in childMap[id] ?? []) {
      findMaxDepth(c.id, depth + 1);
    }
  }
  for (final r in roots) {
    findMaxDepth(r.id, 0);
  }

  double offsetX = _kPadding;
  for (final r in roots) {
    layoutNode(r.id, offsetX, _kPadding);
    offsetX += subtreeWidth(r.id) + _kHGap;
  }

  final canvasW = totalWidth + _kPadding * 2;
  final canvasH = (maxDepth + 1) * (_kNodeH + _kVGap) + _kPadding * 2;

  return _LayoutResult(
    canvasSize: Size(canvasW, canvasH),
    positioned: positioned,
    edges: edges,
  );
}

// ── Edge painter (smooth step connections) ────────────────────
class _EdgePainter extends CustomPainter {
  final List<_Edge> edges;
  final Color color;
  _EdgePainter({required this.edges, required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color.withValues(alpha: 0.25)
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke;

    for (final e in edges) {
      final midY = (e.from.dy + e.to.dy) / 2;
      final path = Path()
        ..moveTo(e.from.dx, e.from.dy)
        ..lineTo(e.from.dx, midY)
        ..lineTo(e.to.dx, midY)
        ..lineTo(e.to.dx, e.to.dy);
      canvas.drawPath(path, paint);

      final dotPaint = Paint()..color = color.withValues(alpha: 0.4);
      canvas.drawCircle(e.to, 3, dotPaint);
    }
  }

  @override
  bool shouldRepaint(covariant _EdgePainter old) => true;
}

// ── Node card (compact position card) ─────────────────────────
class _NodeCard extends StatelessWidget {
  final _TreeNode node;
  final Color deptColor;

  const _NodeCard({required this.node, required this.deptColor});

  @override
  Widget build(BuildContext context) {
    final title = node.data['title'] as String? ?? 'Ажлын байр';
    final emp = node.employee;
    final empName = emp != null ? '${emp['lastName'] ?? ''} ${emp['firstName'] ?? ''}'.trim() : null;
    final photoURL = emp?['photoURL'] as String?;
    final isMe = node.isCurrentUser;

    return Container(
      width: _kNodeW,
      height: _kNodeH,
      decoration: BoxDecoration(
        color: isMe ? deptColor : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isMe ? deptColor : deptColor.withValues(alpha: 0.2),
          width: isMe ? 2 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: (isMe ? deptColor : Colors.black).withValues(alpha: isMe ? 0.2 : 0.06),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      child: Row(
        children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: isMe
                ? Colors.white.withValues(alpha: 0.25)
                : (emp != null ? deptColor.withValues(alpha: 0.12) : AppColors.border),
            backgroundImage: photoURL != null ? NetworkImage(photoURL) : null,
            child: photoURL == null
                ? Icon(
                    emp != null ? Icons.person : Icons.person_outline,
                    size: 16,
                    color: isMe ? Colors.white : (emp != null ? deptColor : AppColors.textMuted),
                  )
                : null,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: isMe ? Colors.white : const Color(0xFF1e293b),
                    height: 1.2,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  empName ?? 'Сул орон тоо',
                  style: TextStyle(
                    fontSize: 10,
                    color: isMe
                        ? Colors.white.withValues(alpha: 0.8)
                        : (empName != null ? const Color(0xFF64748b) : const Color(0xFF94a3b8)),
                    fontStyle: empName == null ? FontStyle.italic : FontStyle.normal,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          if (isMe)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.25),
                borderRadius: BorderRadius.circular(5),
              ),
              child: const Text('Би', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: Colors.white)),
            ),
        ],
      ),
    );
  }
}

// ── Mini floating button ──────────────────────────────────────
class _MiniButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  const _MiniButton({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      elevation: 4,
      borderRadius: BorderRadius.circular(10),
      color: Colors.white,
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Icon(icon, size: 18, color: AppColors.textSecondary),
        ),
      ),
    );
  }
}

// ── Data model ────────────────────────────────────────────────
class _TreeNode {
  final String id;
  final Map<String, dynamic> data;
  final Map<String, dynamic>? employee;
  final bool isCurrentUser;

  _TreeNode({
    required this.id,
    required this.data,
    this.employee,
    this.isCurrentUser = false,
  });
}

Color _parseColor(String? hex) {
  if (hex == null || hex.isEmpty) return const Color(0xFF6366F1);
  hex = hex.replaceFirst('#', '');
  if (hex.length == 6) hex = 'FF$hex';
  return Color(int.tryParse(hex, radix: 16) ?? 0xFF6366F1);
}
