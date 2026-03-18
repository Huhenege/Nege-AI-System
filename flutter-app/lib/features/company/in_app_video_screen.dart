import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

/// YouTube болон шууд видео URL-ыг апп дотор WebView-аар тоглуулна.
class InAppVideoScreen extends StatefulWidget {
  final String videoUrl;
  final String title;

  const InAppVideoScreen({
    super.key,
    required this.videoUrl,
    this.title = 'Видео',
  });

  /// YouTube URL-аас embed URL болгох
  static String? getYouTubeEmbedUrl(String url) {
    final regExp = RegExp(
      r'(?:youtu\.be/|v/|u/\w/|embed/|watch\?v=|&v=)([^#&?]{11})',
    );
    final match = regExp.firstMatch(url);
    final videoId = match?.group(1);
    if (videoId != null) {
      return 'https://www.youtube.com/embed/$videoId?autoplay=1';
    }
    return null;
  }

  static bool isYouTube(String url) => getYouTubeEmbedUrl(url) != null;

  @override
  State<InAppVideoScreen> createState() => _InAppVideoScreenState();
}

class _InAppVideoScreenState extends State<InAppVideoScreen> {
  late final WebViewController _controller;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    final embedUrl = InAppVideoScreen.getYouTubeEmbedUrl(widget.videoUrl);
    if (embedUrl != null) {
      _controller = WebViewController()
        ..setJavaScriptMode(JavaScriptMode.unrestricted)
        ..setNavigationDelegate(
          NavigationDelegate(
            onPageFinished: (_) => setState(() => _isLoading = false),
          ),
        )
        ..loadRequest(Uri.parse(embedUrl));
    } else {
      // Шууд видео URL — HTML5 video ашиглана
      final escapedUrl = widget.videoUrl
          .replaceAll('&', '&amp;')
          .replaceAll('"', '&quot;')
          .replaceAll("'", '&#39;');
      final html = '''
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body, html { width: 100%; height: 100%; background: #000; }
    video { width: 100%; height: 100%; object-fit: contain; }
  </style>
</head>
<body>
  <video src="$escapedUrl" controls autoplay playsinline></video>
</body>
</html>
''';
      _controller = WebViewController()
        ..setJavaScriptMode(JavaScriptMode.unrestricted)
        ..setNavigationDelegate(
          NavigationDelegate(
            onPageFinished: (_) => setState(() => _isLoading = false),
          ),
        )
        ..loadHtmlString(html, baseUrl: null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        title: Text(
          widget.title,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(color: Colors.white, fontSize: 16),
        ),
        backgroundColor: Colors.black,
        iconTheme: const IconThemeData(color: Colors.white),
        elevation: 0,
      ),
      body: Stack(
        children: [
          WebViewWidget(controller: _controller),
          if (_isLoading)
            const Center(
              child: CircularProgressIndicator(color: Colors.white70),
            ),
        ],
      ),
    );
  }
}
