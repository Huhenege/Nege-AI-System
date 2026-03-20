import 'package:flutter/foundation.dart';

class AppConfig {
  static const String productionApiUrl = 'https://nege-ai-system.web.app';

  static String get apiBaseUrl {
    if (kDebugMode) {
      return const String.fromEnvironment(
        'API_BASE_URL',
        defaultValue: productionApiUrl,
      );
    }
    return productionApiUrl;
  }
}
