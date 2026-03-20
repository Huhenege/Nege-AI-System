import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:intl/intl.dart';
import '../../core/firebase/firebase_providers.dart';
import '../../core/firebase/tenant_providers.dart';
import '../../core/theme/app_theme.dart';

// ─── Helpers ─────────────────────────────────────────────────────────────────

DateTime? _parseDate(dynamic value) {
  if (value == null) return null;
  if (value is Timestamp) return value.toDate();
  if (value is DateTime) return value;
  if (value is String && value.isNotEmpty) return DateTime.tryParse(value);
  return null;
}

String _formatDate(DateTime? d) {
  if (d == null) return '';
  return DateFormat('yyyy-MM-dd').format(d);
}

double _calcCompletion(Map<String, dynamic> data) {
  const fields = [
    'lastName',
    'firstName',
    'registrationNumber',
    'birthDate',
    'gender',
    'personalPhone',
    'personalEmail',
    'homeAddress',
  ];
  const arrayFields = [
    {'name': 'emergencyContacts', 'na': null},
    {'name': 'education', 'na': 'educationNotApplicable'},
    {'name': 'languages', 'na': 'languagesNotApplicable'},
    {'name': 'trainings', 'na': 'trainingsNotApplicable'},
    {'name': 'familyMembers', 'na': 'familyMembersNotApplicable'},
    {'name': 'experiences', 'na': 'experienceNotApplicable'},
  ];
  final total = fields.length + arrayFields.length;
  var filled = 0;
  for (final f in fields) {
    final v = data[f];
    if (v != null && v != '') filled++;
  }
  for (final af in arrayFields) {
    final na = af['na'];
    if (na != null && data[na] == true) {
      filled++;
    } else {
      final arr = data[af['name']!];
      if (arr is List && arr.isNotEmpty) filled++;
    }
  }
  return total > 0 ? (filled / total) * 100 : 0;
}

const _proficiencyLevels = ['Анхан', 'Дунд', 'Ахисан', 'Мэргэжлийн'];
const _maritalStatuses = ['Гэрлээгүй', 'Гэрлэсэн', 'Салсан', 'Бэлэвсэн'];
const _genders = {'male': 'Эрэгтэй', 'female': 'Эмэгтэй'};
const _driverCategories = ['A', 'B', 'C', 'D', 'E', 'M'];

// ─── Reusable Widgets ────────────────────────────────────────────────────────

class _SectionCard extends StatelessWidget {
  final String title;
  final IconData? icon;
  final List<Widget> children;
  const _SectionCard({required this.title, this.icon, required this.children});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              if (icon != null) ...[
                Icon(icon, size: 18, color: AppColors.primary),
                const SizedBox(width: 8),
              ],
              Text(title,
                  style: const TextStyle(
                      fontSize: 14, fontWeight: FontWeight.w600)),
            ]),
            const SizedBox(height: 12),
            const Divider(height: 1),
            const SizedBox(height: 16),
            ...children,
          ],
        ),
      ),
    );
  }
}

class _Field extends StatelessWidget {
  final String label;
  final Widget child;
  const _Field({required this.label, required this.child});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: const TextStyle(
                  fontSize: 12, color: AppColors.textSecondary)),
          const SizedBox(height: 6),
          child,
        ],
      ),
    );
  }
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

class QuestionnaireScreen extends ConsumerStatefulWidget {
  const QuestionnaireScreen({super.key});

  @override
  ConsumerState<QuestionnaireScreen> createState() =>
      _QuestionnaireScreenState();
}

class _QuestionnaireScreenState extends ConsumerState<QuestionnaireScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;

  Map<String, dynamic> _data = {};
  bool _isLoading = true;
  bool _isSaving = false;
  bool _isLocked = false;
  String? _error;

  // Reference lists
  List<String> _countries = [];
  List<String> _schools = [];
  List<String> _degrees = [];
  List<String> _academicRanks = [];
  List<String> _languageRefs = [];
  List<String> _familyRelationships = [];
  List<String> _emergencyRelationships = [];

  static const _tabs = [
    Tab(icon: Icon(Icons.person_outline, size: 20), text: 'Ерөнхий'),
    Tab(icon: Icon(Icons.phone_outlined, size: 20), text: 'Холбоо'),
    Tab(icon: Icon(Icons.school_outlined, size: 20), text: 'Боловсрол'),
    Tab(icon: Icon(Icons.language_outlined, size: 20), text: 'Хэл'),
    Tab(icon: Icon(Icons.workspace_premium_outlined, size: 20), text: 'Мэргэшил'),
    Tab(icon: Icon(Icons.people_outline, size: 20), text: 'Гэр бүл'),
    Tab(icon: Icon(Icons.work_outline, size: 20), text: 'Туршлага'),
  ];

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: _tabs.length, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadData());
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  // ── Data Loading ──

  Future<void> _loadData() async {
    final authState = ref.read(authStateProvider);
    final tenantService = ref.read(tenantServiceProvider);
    final user = authState.valueOrNull;
    if (user == null || tenantService == null) {
      setState(() {
        _error = 'Нэвтрээгүй байна';
        _isLoading = false;
      });
      return;
    }

    try {
      // Questionnaire data
      final qDoc = await tenantService
          .subCollection('employees', user.uid, 'questionnaire')
          .doc('data')
          .get();

      // Employee data (for lock status and pre-fill)
      final empDoc = await tenantService.doc('employees', user.uid).get();
      final empData = empDoc.data() ?? {};

      final qData = qDoc.data() ?? {};

      // Pre-fill from employee if questionnaire is empty
      if (qData['workEmail'] == null && empData['email'] != null) {
        qData['workEmail'] = empData['email'];
      }
      if (qData['personalPhone'] == null && empData['phoneNumber'] != null) {
        qData['personalPhone'] = empData['phoneNumber'];
      }
      if (qData['lastName'] == null && empData['lastName'] != null) {
        qData['lastName'] = empData['lastName'];
      }
      if (qData['firstName'] == null && empData['firstName'] != null) {
        qData['firstName'] = empData['firstName'];
      }

      // References
      await _loadReferences(tenantService);

      setState(() {
        _data = qData;
        _isLocked = empData['questionnaireLocked'] == true;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Мэдээлэл ачаалахад алдаа гарлаа';
        _isLoading = false;
      });
    }
  }

  Future<void> _loadReferences(dynamic tenantService) async {
    Future<List<String>> fetchNames(String col) async {
      try {
        final snap = await tenantService.collection(col).get()
            as QuerySnapshot<Map<String, dynamic>>;
        return snap.docs
            .map((d) => (d.data()['name'] ?? '') as String)
            .where((n) => n.isNotEmpty)
            .toList()
          ..sort();
      } catch (_) {
        return <String>[];
      }
    }

    final results = await Future.wait([
      fetchNames('questionnaireCountries'),
      fetchNames('questionnaireSchools'),
      fetchNames('questionnaireDegrees'),
      fetchNames('questionnaireAcademicRanks'),
      fetchNames('questionnaireLanguages'),
      fetchNames('questionnaireFamilyRelationships'),
      fetchNames('questionnaireEmergencyRelationships'),
    ]);
    _countries = results[0];
    _schools = results[1];
    _degrees = results[2];
    _academicRanks = results[3];
    _languageRefs = results[4];
    _familyRelationships = results[5];
    _emergencyRelationships = results[6];
  }

  // ── Save ──

  Future<void> _save() async {
    final user = ref.read(authStateProvider).valueOrNull;
    final tenantService = ref.read(tenantServiceProvider);
    if (user == null || tenantService == null) return;

    setState(() => _isSaving = true);

    try {
      final qRef = tenantService
          .subCollection('employees', user.uid, 'questionnaire')
          .doc('data');
      await qRef.set(_data, SetOptions(merge: true));

      final completion = _calcCompletion(_data);
      await tenantService
          .doc('employees', user.uid)
          .update({'questionnaireCompletion': completion});

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Амжилттай хадгаллаа'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Хадгалахад алдаа: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  // ── Field Helpers ──

  void _set(String key, dynamic value) {
    setState(() => _data[key] = value);
  }

  List<Map<String, dynamic>> _getArray(String key) {
    final arr = _data[key];
    if (arr is List) return arr.cast<Map<String, dynamic>>();
    return [];
  }

  void _setArrayItem(String key, int i, String field, dynamic value) {
    setState(() {
      final arr = List<Map<String, dynamic>>.from(_getArray(key));
      arr[i] = Map<String, dynamic>.from(arr[i])..[field] = value;
      _data[key] = arr;
    });
  }

  void _addArrayItem(String key, Map<String, dynamic> item) {
    setState(() {
      final arr = List<Map<String, dynamic>>.from(_getArray(key));
      arr.add(item);
      _data[key] = arr;
    });
  }

  void _removeArrayItem(String key, int i) {
    setState(() {
      final arr = List<Map<String, dynamic>>.from(_getArray(key));
      arr.removeAt(i);
      _data[key] = arr;
    });
  }

  Widget _textField(String key, {String? hint, int maxLines = 1, TextInputType? keyboardType}) {
    return TextFormField(
      initialValue: (_data[key] ?? '').toString(),
      readOnly: _isLocked,
      decoration: InputDecoration(
        hintText: hint,
        isDense: true,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      ),
      maxLines: maxLines,
      keyboardType: keyboardType,
      onChanged: (v) => _data[key] = v,
    );
  }

  Widget _dropdown(String key, List<String> items, {String? hint}) {
    final current = (_data[key] ?? '').toString();
    final hasValue = items.contains(current);
    return DropdownButtonFormField<String>(
      initialValue: hasValue ? current : null,
      isExpanded: true,
      decoration: InputDecoration(
        hintText: hint ?? 'Сонгох',
        isDense: true,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      ),
      items: items.map((v) => DropdownMenuItem(value: v, child: Text(v, overflow: TextOverflow.ellipsis))).toList(),
      onChanged: _isLocked ? null : (v) => _set(key, v),
    );
  }

  Widget _datePicker(String key, {String? label}) {
    final date = _parseDate(_data[key]);
    return InkWell(
      onTap: _isLocked
          ? null
          : () async {
              final picked = await showDatePicker(
                context: context,
                initialDate: date ?? DateTime(2000),
                firstDate: DateTime(1950),
                lastDate: DateTime.now().add(const Duration(days: 3650)),
              );
              if (picked != null) {
                setState(() => _data[key] = Timestamp.fromDate(picked));
              }
            },
      child: InputDecorator(
        decoration: InputDecoration(
          hintText: label ?? 'Огноо',
          isDense: true,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          suffixIcon:
              const Icon(Icons.calendar_today, size: 18, color: AppColors.textMuted),
        ),
        child: Text(
          date != null ? _formatDate(date) : '',
          style: TextStyle(
            color: date != null ? AppColors.textPrimary : AppColors.textMuted,
          ),
        ),
      ),
    );
  }

  // ── Build ──

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        appBar: AppBar(title: const Text('Миний анкет')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }
    if (_error != null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Миний анкет')),
        body: Center(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Icon(Icons.error_outline, size: 48, color: AppColors.error),
            const SizedBox(height: 12),
            Text(_error!, style: const TextStyle(color: AppColors.textSecondary)),
            const SizedBox(height: 16),
            ElevatedButton(onPressed: () { setState(() { _isLoading = true; _error = null; }); _loadData(); }, child: const Text('Дахин оролдох')),
          ]),
        ),
      );
    }

    final completion = _calcCompletion(_data).round();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Миний анкет'),
        actions: [
          if (_isLocked)
            const Padding(
              padding: EdgeInsets.only(right: 8),
              child: Chip(
                avatar: Icon(Icons.lock, size: 16, color: AppColors.warning),
                label: Text('Түгжигдсэн', style: TextStyle(fontSize: 12)),
                visualDensity: VisualDensity.compact,
              ),
            ),
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Center(
              child: SizedBox(
                width: 36,
                height: 36,
                child: Stack(alignment: Alignment.center, children: [
                  CircularProgressIndicator(
                    value: completion / 100,
                    strokeWidth: 3,
                    backgroundColor: AppColors.border,
                    valueColor: AlwaysStoppedAnimation(
                      completion >= 90
                          ? AppColors.success
                          : completion >= 50
                              ? AppColors.warning
                              : AppColors.error,
                    ),
                  ),
                  Text('$completion',
                      style: const TextStyle(
                          fontSize: 10, fontWeight: FontWeight.w600)),
                ]),
              ),
            ),
          ),
        ],
        bottom: TabBar(
          controller: _tabCtrl,
          isScrollable: true,
          tabAlignment: TabAlignment.start,
          labelStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
          unselectedLabelStyle: const TextStyle(fontSize: 12),
          tabs: _tabs,
        ),
      ),
      body: TabBarView(
        controller: _tabCtrl,
        children: [
          _buildGeneralTab(),
          _buildContactTab(),
          _buildEducationTab(),
          _buildLanguageTab(),
          _buildTrainingTab(),
          _buildFamilyTab(),
          _buildExperienceTab(),
        ],
      ),
      bottomNavigationBar: _isLocked
          ? null
          : SafeArea(
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                child: SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton.icon(
                    onPressed: _isSaving ? null : _save,
                    icon: _isSaving
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white))
                        : const Icon(Icons.save_outlined, size: 20),
                    label: Text(_isSaving ? 'Хадгалж байна...' : 'Хадгалах'),
                  ),
                ),
              ),
            ),
    );
  }

  // ─── Tab 1: General ───

  Widget _buildGeneralTab() {
    final hasDisability = _data['hasDisability'] == true;
    final hasLicense = _data['hasDriversLicense'] == true;
    final categories = (_data['driverLicenseCategories'] is List)
        ? List<String>.from(_data['driverLicenseCategories'])
        : <String>[];

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _SectionCard(
          title: 'Хувийн мэдээлэл',
          icon: Icons.person_outline,
          children: [
            Row(children: [
              Expanded(child: _Field(label: 'Овог', child: _textField('lastName', hint: 'Овог'))),
              const SizedBox(width: 12),
              Expanded(child: _Field(label: 'Нэр', child: _textField('firstName', hint: 'Нэр'))),
            ]),
            Row(children: [
              Expanded(
                child: _Field(
                  label: 'Регистрийн дугаар',
                  child: _textField('registrationNumber', hint: 'АА00112233'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _Field(
                  label: 'ТТД',
                  child: _textField('idCardNumber'),
                ),
              ),
            ]),
            Row(children: [
              Expanded(child: _Field(label: 'Төрсөн огноо', child: _datePicker('birthDate'))),
              const SizedBox(width: 12),
              Expanded(
                child: _Field(
                  label: 'Хүйс',
                  child: _dropdown(
                    'gender',
                    _genders.keys.toList(),
                    hint: 'Сонгох',
                  ),
                ),
              ),
            ]),
          ],
        ),
        _SectionCard(
          title: 'Хөгжлийн бэрхшээл',
          icon: Icons.accessible_outlined,
          children: [
            SwitchListTile(
              title: const Text('Хөгжлийн бэрхшээлтэй', style: TextStyle(fontSize: 14)),
              value: hasDisability,
              dense: true,
              contentPadding: EdgeInsets.zero,
              onChanged: _isLocked ? null : (v) => _set('hasDisability', v),
            ),
            if (hasDisability) ...[
              _Field(label: 'Хувь', child: _textField('disabilityPercentage', keyboardType: TextInputType.number)),
              _Field(label: 'Огноо', child: _datePicker('disabilityDate')),
            ],
          ],
        ),
        _SectionCard(
          title: 'Жолооны үнэмлэх',
          icon: Icons.directions_car_outlined,
          children: [
            SwitchListTile(
              title: const Text('Жолооны үнэмлэхтэй', style: TextStyle(fontSize: 14)),
              value: hasLicense,
              dense: true,
              contentPadding: EdgeInsets.zero,
              onChanged: _isLocked ? null : (v) => _set('hasDriversLicense', v),
            ),
            if (hasLicense)
              Wrap(
                spacing: 8,
                children: _driverCategories.map((cat) {
                  final selected = categories.contains(cat);
                  return FilterChip(
                    label: Text(cat),
                    selected: selected,
                    onSelected: _isLocked
                        ? null
                        : (v) {
                            final updated = List<String>.from(categories);
                            v ? updated.add(cat) : updated.remove(cat);
                            _set('driverLicenseCategories', updated);
                          },
                  );
                }).toList(),
              ),
          ],
        ),
      ],
    );
  }

  // ─── Tab 2: Contact ───

  Widget _buildContactTab() {
    final contacts = _getArray('emergencyContacts');

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _SectionCard(
          title: 'Утас & Имэйл',
          icon: Icons.phone_outlined,
          children: [
            Row(children: [
              Expanded(child: _Field(label: 'Ажлын утас', child: _textField('workPhone', keyboardType: TextInputType.phone))),
              const SizedBox(width: 12),
              Expanded(child: _Field(label: 'Хувийн утас', child: _textField('personalPhone', keyboardType: TextInputType.phone))),
            ]),
            Row(children: [
              Expanded(child: _Field(label: 'Ажлын имэйл', child: _textField('workEmail', keyboardType: TextInputType.emailAddress))),
              const SizedBox(width: 12),
              Expanded(child: _Field(label: 'Хувийн имэйл', child: _textField('personalEmail', keyboardType: TextInputType.emailAddress))),
            ]),
          ],
        ),
        _SectionCard(
          title: 'Хаяг',
          icon: Icons.location_on_outlined,
          children: [
            _Field(label: 'Гэрийн хаяг', child: _textField('homeAddress')),
            _Field(label: 'Түр хаяг', child: _textField('temporaryAddress')),
          ],
        ),
        _SectionCard(
          title: 'Сошиал',
          icon: Icons.share_outlined,
          children: [
            _Field(label: 'Facebook', child: _textField('facebook', hint: 'https://facebook.com/...')),
            _Field(label: 'Instagram', child: _textField('instagram', hint: 'https://instagram.com/...')),
          ],
        ),
        _SectionCard(
          title: 'Яаралтай холбоо барих',
          icon: Icons.emergency_outlined,
          children: [
            ...contacts.asMap().entries.map((entry) {
              final i = entry.key;
              final c = entry.value;
              return Card(
                margin: const EdgeInsets.only(bottom: 12),
                color: AppColors.background,
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(children: [
                    Row(children: [
                      Text('Холбоо барих #${i + 1}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                      const Spacer(),
                      if (!_isLocked)
                        IconButton(
                          icon: const Icon(Icons.delete_outline, size: 20, color: AppColors.error),
                          onPressed: () => _removeArrayItem('emergencyContacts', i),
                          visualDensity: VisualDensity.compact,
                        ),
                    ]),
                    const SizedBox(height: 8),
                    _Field(
                      label: 'Овог, нэр',
                      child: TextFormField(
                        initialValue: (c['fullName'] ?? '').toString(),
                        readOnly: _isLocked,
                        decoration: const InputDecoration(isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 12)),
                        onChanged: (v) => _setArrayItem('emergencyContacts', i, 'fullName', v),
                      ),
                    ),
                    Row(children: [
                      Expanded(
                        child: _Field(
                          label: 'Таны хэн болох',
                          child: DropdownButtonFormField<String>(
                            initialValue: _emergencyRelationships.contains((c['relationship'] ?? '').toString()) ? c['relationship'] : null,
                            isExpanded: true,
                            decoration: const InputDecoration(isDense: true, hintText: 'Сонгох', contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 12)),
                            items: _emergencyRelationships.map((v) => DropdownMenuItem(value: v, child: Text(v, overflow: TextOverflow.ellipsis))).toList(),
                            onChanged: _isLocked ? null : (v) => _setArrayItem('emergencyContacts', i, 'relationship', v),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _Field(
                          label: 'Утас',
                          child: TextFormField(
                            initialValue: (c['phone'] ?? '').toString(),
                            readOnly: _isLocked,
                            keyboardType: TextInputType.phone,
                            decoration: const InputDecoration(isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 12)),
                            onChanged: (v) => _setArrayItem('emergencyContacts', i, 'phone', v),
                          ),
                        ),
                      ),
                    ]),
                  ]),
                ),
              );
            }),
            if (!_isLocked)
              OutlinedButton.icon(
                onPressed: () => _addArrayItem('emergencyContacts', {'fullName': '', 'relationship': '', 'phone': ''}),
                icon: const Icon(Icons.add, size: 18),
                label: const Text('Холбоо барих нэмэх'),
              ),
          ],
        ),
      ],
    );
  }

  // ─── Tab 3: Education ───

  Widget _buildEducationTab() {
    final notApplicable = _data['educationNotApplicable'] == true;
    final items = _getArray('education');

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          margin: const EdgeInsets.only(bottom: 16),
          child: CheckboxListTile(
            title: const Text('Боловсролын мэдээлэл байхгүй', style: TextStyle(fontSize: 14)),
            value: notApplicable,
            dense: true,
            onChanged: _isLocked ? null : (v) => _set('educationNotApplicable', v),
          ),
        ),
        if (!notApplicable) ...[
          ...items.asMap().entries.map((entry) {
            final i = entry.key;
            final edu = entry.value;
            final entryDate = _parseDate(edu['entryDate']);
            final gradDate = _parseDate(edu['gradDate']);

            return Card(
              margin: const EdgeInsets.only(bottom: 12),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(children: [
                  Row(children: [
                    Text('Боловсрол #${i + 1}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
                    const Spacer(),
                    if (!_isLocked)
                      IconButton(
                        icon: const Icon(Icons.delete_outline, size: 20, color: AppColors.error),
                        onPressed: () => _removeArrayItem('education', i),
                        visualDensity: VisualDensity.compact,
                      ),
                  ]),
                  const SizedBox(height: 8),
                  Row(children: [
                    Expanded(
                      child: _Field(
                        label: 'Улс',
                        child: _arrayDropdown(i, 'education', 'country', _countries),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _Field(
                        label: 'Зэрэг',
                        child: _arrayDropdown(i, 'education', 'academicRank', _academicRanks),
                      ),
                    ),
                  ]),
                  _Field(label: 'Сургууль', child: _arrayDropdown(i, 'education', 'school', _schools)),
                  _Field(label: 'Мэргэжил', child: _arrayDropdown(i, 'education', 'degree', _degrees)),
                  Row(children: [
                    Expanded(
                      child: _Field(
                        label: 'Элссэн',
                        child: _arrayDatePicker(i, 'education', 'entryDate', entryDate),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _Field(
                        label: 'Төгссөн',
                        child: _arrayDatePicker(i, 'education', 'gradDate', gradDate),
                      ),
                    ),
                  ]),
                  _Field(
                    label: 'Дипломын дугаар',
                    child: TextFormField(
                      initialValue: (edu['diplomaNumber'] ?? '').toString(),
                      readOnly: _isLocked,
                      decoration: const InputDecoration(isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 12)),
                      onChanged: (v) => _setArrayItem('education', i, 'diplomaNumber', v),
                    ),
                  ),
                ]),
              ),
            );
          }),
          if (!_isLocked)
            OutlinedButton.icon(
              onPressed: () => _addArrayItem('education', {
                'country': 'Монгол',
                'school': '',
                'degree': '',
                'academicRank': '',
                'entryDate': null,
                'gradDate': null,
                'diplomaNumber': '',
                'isCurrent': false,
              }),
              icon: const Icon(Icons.add, size: 18),
              label: const Text('Боловсрол нэмэх'),
            ),
        ],
      ],
    );
  }

  // ─── Tab 4: Language ───

  Widget _buildLanguageTab() {
    final notApplicable = _data['languagesNotApplicable'] == true;
    final items = _getArray('languages');

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          margin: const EdgeInsets.only(bottom: 16),
          child: CheckboxListTile(
            title: const Text('Гадаад хэлний мэдээлэл байхгүй', style: TextStyle(fontSize: 14)),
            value: notApplicable,
            dense: true,
            onChanged: _isLocked ? null : (v) => _set('languagesNotApplicable', v),
          ),
        ),
        if (!notApplicable) ...[
          ...items.asMap().entries.map((entry) {
            final i = entry.key;
            final lang = entry.value;
            return Card(
              margin: const EdgeInsets.only(bottom: 12),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(children: [
                  Row(children: [
                    Text('Хэл #${i + 1}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
                    const Spacer(),
                    if (!_isLocked)
                      IconButton(
                        icon: const Icon(Icons.delete_outline, size: 20, color: AppColors.error),
                        onPressed: () => _removeArrayItem('languages', i),
                        visualDensity: VisualDensity.compact,
                      ),
                  ]),
                  const SizedBox(height: 8),
                  _Field(label: 'Хэл', child: _arrayDropdown(i, 'languages', 'language', _languageRefs)),
                  Row(children: [
                    Expanded(child: _Field(label: 'Сонсох', child: _arrayDropdown(i, 'languages', 'listening', _proficiencyLevels))),
                    const SizedBox(width: 8),
                    Expanded(child: _Field(label: 'Унших', child: _arrayDropdown(i, 'languages', 'reading', _proficiencyLevels))),
                  ]),
                  Row(children: [
                    Expanded(child: _Field(label: 'Ярих', child: _arrayDropdown(i, 'languages', 'speaking', _proficiencyLevels))),
                    const SizedBox(width: 8),
                    Expanded(child: _Field(label: 'Бичих', child: _arrayDropdown(i, 'languages', 'writing', _proficiencyLevels))),
                  ]),
                  _Field(
                    label: 'Шалгалтын оноо',
                    child: TextFormField(
                      initialValue: (lang['testScore'] ?? '').toString(),
                      readOnly: _isLocked,
                      decoration: const InputDecoration(isDense: true, hintText: 'IELTS 6.5, TOPIK 4...', contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 12)),
                      onChanged: (v) => _setArrayItem('languages', i, 'testScore', v),
                    ),
                  ),
                ]),
              ),
            );
          }),
          if (!_isLocked)
            OutlinedButton.icon(
              onPressed: () => _addArrayItem('languages', {
                'language': '',
                'listening': '',
                'reading': '',
                'speaking': '',
                'writing': '',
                'testScore': '',
              }),
              icon: const Icon(Icons.add, size: 18),
              label: const Text('Хэл нэмэх'),
            ),
        ],
      ],
    );
  }

  // ─── Tab 5: Training ───

  Widget _buildTrainingTab() {
    final notApplicable = _data['trainingsNotApplicable'] == true;
    final items = _getArray('trainings');

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          margin: const EdgeInsets.only(bottom: 16),
          child: CheckboxListTile(
            title: const Text('Мэргэшлийн мэдээлэл байхгүй', style: TextStyle(fontSize: 14)),
            value: notApplicable,
            dense: true,
            onChanged: _isLocked ? null : (v) => _set('trainingsNotApplicable', v),
          ),
        ),
        if (!notApplicable) ...[
          ...items.asMap().entries.map((entry) {
            final i = entry.key;
            final t = entry.value;
            final startDate = _parseDate(t['startDate']);
            final endDate = _parseDate(t['endDate']);

            return Card(
              margin: const EdgeInsets.only(bottom: 12),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(children: [
                  Row(children: [
                    Text('Сургалт #${i + 1}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
                    const Spacer(),
                    if (!_isLocked)
                      IconButton(
                        icon: const Icon(Icons.delete_outline, size: 20, color: AppColors.error),
                        onPressed: () => _removeArrayItem('trainings', i),
                        visualDensity: VisualDensity.compact,
                      ),
                  ]),
                  const SizedBox(height: 8),
                  _Field(
                    label: 'Сургалтын нэр',
                    child: TextFormField(
                      initialValue: (t['name'] ?? '').toString(),
                      readOnly: _isLocked,
                      decoration: const InputDecoration(isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 12)),
                      onChanged: (v) => _setArrayItem('trainings', i, 'name', v),
                    ),
                  ),
                  _Field(
                    label: 'Байгууллага',
                    child: TextFormField(
                      initialValue: (t['organization'] ?? '').toString(),
                      readOnly: _isLocked,
                      decoration: const InputDecoration(isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 12)),
                      onChanged: (v) => _setArrayItem('trainings', i, 'organization', v),
                    ),
                  ),
                  Row(children: [
                    Expanded(child: _Field(label: 'Эхэлсэн', child: _arrayDatePicker(i, 'trainings', 'startDate', startDate))),
                    const SizedBox(width: 12),
                    Expanded(child: _Field(label: 'Дууссан', child: _arrayDatePicker(i, 'trainings', 'endDate', endDate))),
                  ]),
                  _Field(
                    label: 'Гэрчилгээний дугаар',
                    child: TextFormField(
                      initialValue: (t['certificateNumber'] ?? '').toString(),
                      readOnly: _isLocked,
                      decoration: const InputDecoration(isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 12)),
                      onChanged: (v) => _setArrayItem('trainings', i, 'certificateNumber', v),
                    ),
                  ),
                ]),
              ),
            );
          }),
          if (!_isLocked)
            OutlinedButton.icon(
              onPressed: () => _addArrayItem('trainings', {
                'name': '',
                'organization': '',
                'startDate': null,
                'endDate': null,
                'certificateNumber': '',
              }),
              icon: const Icon(Icons.add, size: 18),
              label: const Text('Сургалт нэмэх'),
            ),
        ],
      ],
    );
  }

  // ─── Tab 6: Family ───

  Widget _buildFamilyTab() {
    final notApplicable = _data['familyMembersNotApplicable'] == true;
    final items = _getArray('familyMembers');

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _SectionCard(
          title: 'Гэрлэлтийн байдал',
          icon: Icons.favorite_outline,
          children: [
            _Field(
              label: 'Байдал',
              child: _dropdown('maritalStatus', _maritalStatuses),
            ),
          ],
        ),
        Card(
          margin: const EdgeInsets.only(bottom: 16),
          child: CheckboxListTile(
            title: const Text('Гэр бүлийн гишүүдийн мэдээлэл байхгүй', style: TextStyle(fontSize: 14)),
            value: notApplicable,
            dense: true,
            onChanged: _isLocked ? null : (v) => _set('familyMembersNotApplicable', v),
          ),
        ),
        if (!notApplicable) ...[
          ...items.asMap().entries.map((entry) {
            final i = entry.key;
            final m = entry.value;
            final bDate = _parseDate(m['birthDate']);

            return Card(
              margin: const EdgeInsets.only(bottom: 12),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(children: [
                  Row(children: [
                    Text('Гишүүн #${i + 1}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
                    const Spacer(),
                    if (!_isLocked)
                      IconButton(
                        icon: const Icon(Icons.delete_outline, size: 20, color: AppColors.error),
                        onPressed: () => _removeArrayItem('familyMembers', i),
                        visualDensity: VisualDensity.compact,
                      ),
                  ]),
                  const SizedBox(height: 8),
                  _Field(
                    label: 'Таны хэн болох',
                    child: _arrayDropdown(i, 'familyMembers', 'relationship', _familyRelationships),
                  ),
                  Row(children: [
                    Expanded(
                      child: _Field(
                        label: 'Овог',
                        child: TextFormField(
                          initialValue: (m['lastName'] ?? '').toString(),
                          readOnly: _isLocked,
                          decoration: const InputDecoration(isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 12)),
                          onChanged: (v) => _setArrayItem('familyMembers', i, 'lastName', v),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _Field(
                        label: 'Нэр',
                        child: TextFormField(
                          initialValue: (m['firstName'] ?? '').toString(),
                          readOnly: _isLocked,
                          decoration: const InputDecoration(isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 12)),
                          onChanged: (v) => _setArrayItem('familyMembers', i, 'firstName', v),
                        ),
                      ),
                    ),
                  ]),
                  Row(children: [
                    Expanded(child: _Field(label: 'Төрсөн огноо', child: _arrayDatePicker(i, 'familyMembers', 'birthDate', bDate))),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _Field(
                        label: 'Утас',
                        child: TextFormField(
                          initialValue: (m['phone'] ?? '').toString(),
                          readOnly: _isLocked,
                          keyboardType: TextInputType.phone,
                          decoration: const InputDecoration(isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 12)),
                          onChanged: (v) => _setArrayItem('familyMembers', i, 'phone', v),
                        ),
                      ),
                    ),
                  ]),
                ]),
              ),
            );
          }),
          if (!_isLocked)
            OutlinedButton.icon(
              onPressed: () => _addArrayItem('familyMembers', {
                'relationship': '',
                'lastName': '',
                'firstName': '',
                'birthDate': null,
                'phone': '',
              }),
              icon: const Icon(Icons.add, size: 18),
              label: const Text('Гишүүн нэмэх'),
            ),
        ],
      ],
    );
  }

  // ─── Tab 7: Experience ───

  Widget _buildExperienceTab() {
    final notApplicable = _data['experienceNotApplicable'] == true;
    final items = _getArray('experiences');

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          margin: const EdgeInsets.only(bottom: 16),
          child: CheckboxListTile(
            title: const Text('Ажлын туршлагын мэдээлэл байхгүй', style: TextStyle(fontSize: 14)),
            value: notApplicable,
            dense: true,
            onChanged: _isLocked ? null : (v) => _set('experienceNotApplicable', v),
          ),
        ),
        if (!notApplicable) ...[
          ...items.asMap().entries.map((entry) {
            final i = entry.key;
            final exp = entry.value;
            final startDate = _parseDate(exp['startDate']);
            final endDate = _parseDate(exp['endDate']);

            return Card(
              margin: const EdgeInsets.only(bottom: 12),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(children: [
                  Row(children: [
                    Text('Туршлага #${i + 1}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
                    const Spacer(),
                    if (!_isLocked)
                      IconButton(
                        icon: const Icon(Icons.delete_outline, size: 20, color: AppColors.error),
                        onPressed: () => _removeArrayItem('experiences', i),
                        visualDensity: VisualDensity.compact,
                      ),
                  ]),
                  const SizedBox(height: 8),
                  Row(children: [
                    Expanded(
                      child: _Field(
                        label: 'Компани',
                        child: TextFormField(
                          initialValue: (exp['company'] ?? '').toString(),
                          readOnly: _isLocked,
                          decoration: const InputDecoration(isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 12)),
                          onChanged: (v) => _setArrayItem('experiences', i, 'company', v),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _Field(
                        label: 'Албан тушаал',
                        child: TextFormField(
                          initialValue: (exp['position'] ?? '').toString(),
                          readOnly: _isLocked,
                          decoration: const InputDecoration(isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 12)),
                          onChanged: (v) => _setArrayItem('experiences', i, 'position', v),
                        ),
                      ),
                    ),
                  ]),
                  Row(children: [
                    Expanded(child: _Field(label: 'Эхэлсэн', child: _arrayDatePicker(i, 'experiences', 'startDate', startDate))),
                    const SizedBox(width: 12),
                    Expanded(child: _Field(label: 'Дууссан', child: _arrayDatePicker(i, 'experiences', 'endDate', endDate))),
                  ]),
                  _Field(
                    label: 'Тодорхойлолт',
                    child: TextFormField(
                      initialValue: (exp['description'] ?? '').toString(),
                      readOnly: _isLocked,
                      maxLines: 3,
                      decoration: const InputDecoration(isDense: true, hintText: 'Гүйцэтгэсэн үүрэг...', contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 12)),
                      onChanged: (v) => _setArrayItem('experiences', i, 'description', v),
                    ),
                  ),
                ]),
              ),
            );
          }),
          if (!_isLocked)
            OutlinedButton.icon(
              onPressed: () => _addArrayItem('experiences', {
                'company': '',
                'position': '',
                'startDate': null,
                'endDate': null,
                'description': '',
              }),
              icon: const Icon(Icons.add, size: 18),
              label: const Text('Туршлага нэмэх'),
            ),
        ],
      ],
    );
  }

  // ─── Array Field Helpers ───

  Widget _arrayDropdown(int index, String arrayKey, String field, List<String> items) {
    final arr = _getArray(arrayKey);
    final current = (index < arr.length ? (arr[index][field] ?? '') : '').toString();
    final hasValue = items.contains(current);

    // If current value isn't in the list but is non-empty, add it temporarily
    final effectiveItems = hasValue || current.isEmpty
        ? items
        : [current, ...items];

    return DropdownButtonFormField<String>(
      initialValue: effectiveItems.contains(current) && current.isNotEmpty ? current : null,
      isExpanded: true,
      decoration: const InputDecoration(
        isDense: true,
        hintText: 'Сонгох',
        contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      ),
      items: effectiveItems
          .map((v) => DropdownMenuItem(value: v, child: Text(v, overflow: TextOverflow.ellipsis)))
          .toList(),
      onChanged: _isLocked ? null : (v) => _setArrayItem(arrayKey, index, field, v),
    );
  }

  Widget _arrayDatePicker(int index, String arrayKey, String field, DateTime? date) {
    return InkWell(
      onTap: _isLocked
          ? null
          : () async {
              final picked = await showDatePicker(
                context: context,
                initialDate: date ?? DateTime(2010),
                firstDate: DateTime(1950),
                lastDate: DateTime.now().add(const Duration(days: 3650)),
              );
              if (picked != null) {
                _setArrayItem(arrayKey, index, field, Timestamp.fromDate(picked));
              }
            },
      child: InputDecorator(
        decoration: const InputDecoration(
          isDense: true,
          hintText: 'Огноо',
          contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          suffixIcon: Icon(Icons.calendar_today, size: 18, color: AppColors.textMuted),
        ),
        child: Text(
          date != null ? _formatDate(date) : '',
          style: TextStyle(color: date != null ? AppColors.textPrimary : AppColors.textMuted),
        ),
      ),
    );
  }
}
