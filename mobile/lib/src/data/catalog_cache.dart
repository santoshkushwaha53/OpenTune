import 'dart:convert';
import 'dart:io';

import 'package:path_provider/path_provider.dart';

class CatalogCache {
  CatalogCache({this.root});

  /// Optional override so tests can avoid `path_provider`.
  final Directory? root;

  Future<File?> _file() async {
    try {
      final directory = root ?? (await getApplicationDocumentsDirectory());
      return File('${directory.path}/catalog-home.json');
    } catch (_) {
      return null;
    }
  }

  Future<void> writeHome(Map<String, dynamic> data) async {
    final file = await _file();
    if (file == null) {
      return;
    }
    await file.writeAsString(jsonEncode(data));
  }

  Future<Map<String, dynamic>?> readHome() async {
    final file = await _file();
    if (file == null || !await file.exists()) {
      return null;
    }
    final decoded = jsonDecode(await file.readAsString());
    if (decoded is Map<String, dynamic>) {
      return {...decoded, 'offline': true};
    }
    return null;
  }
}
