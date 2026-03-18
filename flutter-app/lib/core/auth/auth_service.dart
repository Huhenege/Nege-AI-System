import 'dart:convert';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:http/http.dart' as http;

class AuthService {
  final FirebaseAuth _auth;

  AuthService({FirebaseAuth? auth}) : _auth = auth ?? FirebaseAuth.instance;

  User? get currentUser => _auth.currentUser;

  Stream<User?> get authStateChanges => _auth.authStateChanges();

  Future<UserCredential> signIn({
    required String email,
    required String password,
  }) async {
    return await _auth.signInWithEmailAndPassword(
      email: email,
      password: password,
    );
  }

  Future<void> signOut() async {
    await _auth.signOut();
  }

  Future<Map<String, dynamic>?> getCustomClaims() async {
    final user = _auth.currentUser;
    if (user == null) return null;
    final tokenResult = await user.getIdTokenResult(true);
    return tokenResult.claims;
  }

  /// Calls the ensure-claims API endpoint on the Next.js backend.
  /// This sets companyId and role in custom claims if missing.
  Future<Map<String, dynamic>?> ensureClaims({
    required String apiBaseUrl,
  }) async {
    final user = _auth.currentUser;
    if (user == null) return null;

    final token = await user.getIdToken();
    final response = await http.post(
      Uri.parse('$apiBaseUrl/api/auth/ensure-claims'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
    );

    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      // Force refresh the token to pick up new claims
      await user.getIdToken(true);
      return data;
    }

    return null;
  }
}
