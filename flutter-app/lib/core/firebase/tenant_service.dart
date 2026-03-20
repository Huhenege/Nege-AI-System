import 'package:cloud_firestore/cloud_firestore.dart';

const _tenantScoped = <String>{
  'employees',
  'departments',
  'positions',
  'projects',
  'project_groups',
  'attendance',
  'attendanceLocations',
  'documents',
  'company',
  'company_profile',
  'companyHistory',
  'companyPolicies',
  'vacancies',
  'candidates',
  'applications',
  'application_events',
  'application_notes',
  'interviews',
  'scorecards',
  'evaluation_requests',
  'surveys',
  'survey_templates',
  'onboarding_processes',
  'onboardingPrograms',
  'offboarding_processes',
  'training_courses',
  'training_plans',
  'training_categories',
  'skill_assessments',
  'skills_inventory',
  'meeting_rooms',
  'room_bookings',
  'recognition_posts',
  'point_transactions',
  'points_config',
  'rewards',
  'redemption_requests',
  'budget_point_requests',
  'posts',
  'er_documents',
  'er_document_types',
  'er_templates',
  'er_workflows',
  'er_process_document_types',
  'newHires',
  'organization_actions',
  'settings',
  'positionLevels',
  'employmentTypes',
  'jobCategories',
  'workSchedules',
  'salaryRangeVersions',
  'benefitReferences',
  'departmentTypes',
  'timeOffRequests',
  'departmentHistory',
  'organization_settings',
  'questionnaireCountries',
  'questionnaireSchools',
  'questionnaireDegrees',
  'questionnaireAcademicRanks',
  'questionnaireLanguages',
  'questionnaireFamilyRelationships',
  'questionnaireEmergencyRelationships',
};

bool isTenantScoped(String collectionName) =>
    _tenantScoped.contains(collectionName);

class TenantService {
  final FirebaseFirestore _firestore;
  final String companyId;

  TenantService({
    required this.companyId,
    FirebaseFirestore? firestore,
  }) : _firestore = firestore ?? FirebaseFirestore.instance;

  String get companyPath => 'companies/$companyId';

  CollectionReference<Map<String, dynamic>> collection(String name) {
    if (isTenantScoped(name)) {
      return _firestore.collection('$companyPath/$name');
    }
    return _firestore.collection(name);
  }

  DocumentReference<Map<String, dynamic>> doc(
      String collectionName, String docId) {
    if (isTenantScoped(collectionName)) {
      return _firestore.doc('$companyPath/$collectionName/$docId');
    }
    return _firestore.doc('$collectionName/$docId');
  }

  CollectionReference<Map<String, dynamic>> subCollection(
    String parentCollection,
    String parentDocId,
    String childCollection,
  ) {
    return doc(parentCollection, parentDocId).collection(childCollection);
  }
}
