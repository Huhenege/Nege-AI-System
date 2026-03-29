import 'dart:developer' as developer;
import 'dart:io';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

import '../../core/config/app_config.dart';
import '../../core/firebase/firebase_providers.dart';
import '../../core/firebase/tenant_providers.dart';
import '../../core/auth/auth_provider.dart';

class DocumentUploadService {
  final FirebaseStorage _storage;
  final FirebaseFirestore _firestore;
  final String _companyId;
  final String _uid;
  final String? _idToken;

  DocumentUploadService({
    required FirebaseStorage storage,
    required FirebaseFirestore firestore,
    required String companyId,
    required String uid,
    String? idToken,
  })  : _storage = storage,
        _firestore = firestore,
        _companyId = companyId,
        _uid = uid,
        _idToken = idToken;

  /// Uploads [file] to Firebase Storage and saves a document record to Firestore.
  /// Returns the Firestore document ID on success.
  Future<String> upload({
    required File file,
    required String title,
    required String documentType,
    required String filename,
    required String mimeType,
  }) async {
    final fileSize = await file.length();
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    final storagePath = 'documents/$_uid/${timestamp}_$filename';

    // 1. Upload to Firebase Storage
    final ref = _storage.ref(storagePath);
    final uploadTask = ref.putFile(
      file,
      SettableMetadata(contentType: mimeType),
    );
    final snapshot = await uploadTask;
    final downloadUrl = await snapshot.ref.getDownloadURL();

    // 2. Save document record to Firestore
    final docRef = await _firestore
        .collection('companies/$_companyId/documents')
        .add({
      'title': title,
      'documentType': documentType,
      'url': downloadUrl,
      'uploadDate': DateTime.now().toIso8601String(),
      'uploadedBy': _uid,
      'fileSize': fileSize,
      'mimeType': mimeType,
      'metadata': {'employeeId': _uid},
      'createdAt': FieldValue.serverTimestamp(),
    });

    // 3. Fire-and-forget vectorize call
    _vectorize(docRef.id);

    return docRef.id;
  }

  void _vectorize(String documentId) {
    final baseUrl = AppConfig.apiBaseUrl;
    final uri = Uri.parse('$baseUrl/api/documents/vectorize');

    Future(() async {
      try {
        final headers = <String, String>{
          'Content-Type': 'application/json',
        };
        if (_idToken != null) {
          headers['Authorization'] = 'Bearer $_idToken';
        }
        await http.post(
          uri,
          headers: headers,
          body: jsonEncode({
            'documentId': documentId,
            'employeeId': _uid,
          }),
        );
      } catch (e) {
        developer.log(
          'Vectorize API call failed (non-critical): $e',
          name: 'DocumentUploadService',
        );
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Riverpod provider
// ---------------------------------------------------------------------------

final documentUploadServiceProvider =
    FutureProvider<DocumentUploadService?>((ref) async {
  final tenant = ref.watch(tenantServiceProvider);
  final authUser = ref.watch(authStateProvider).valueOrNull;
  final storage = ref.watch(firebaseStorageProvider);
  final firestore = ref.watch(firestoreProvider);

  if (tenant == null || authUser == null) return null;

  // Fetch a fresh ID token for the vectorize API header
  String? idToken;
  try {
    idToken = await authUser.getIdToken();
  } catch (_) {}

  return DocumentUploadService(
    storage: storage,
    firestore: firestore,
    companyId: tenant.companyId,
    uid: authUser.uid,
    idToken: idToken,
  );
});
