class EmployeeDocument {
  final String id;
  final String title;
  final String documentType;
  final String url;
  final String uploadDate;
  final String? uploadedBy;
  final int? fileSize;
  final String? mimeType;
  final Map<String, dynamic> metadata;

  const EmployeeDocument({
    required this.id,
    required this.title,
    required this.documentType,
    required this.url,
    required this.uploadDate,
    this.uploadedBy,
    this.fileSize,
    this.mimeType,
    this.metadata = const {},
  });

  factory EmployeeDocument.fromFirestore(Map<String, dynamic> data, String id) {
    return EmployeeDocument(
      id: id,
      title: data['title'] ?? '',
      documentType: data['documentType'] ?? '',
      url: data['url'] ?? '',
      uploadDate: data['uploadDate'] ?? '',
      uploadedBy: data['uploadedBy'],
      fileSize: data['fileSize'],
      mimeType: data['mimeType'],
      metadata: Map<String, dynamic>.from(data['metadata'] ?? {}),
    );
  }
}
