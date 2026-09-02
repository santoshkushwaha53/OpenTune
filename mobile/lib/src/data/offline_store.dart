import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final offlineStoreProvider = ChangeNotifierProvider<OfflineStore>((ref) {
  return OfflineStore();
});

/// API-failure offline flag. Avoids retry storms; playback uses local files only.
class OfflineStore extends ChangeNotifier {
  OfflineStore({bool offline = false}) : _offline = offline;

  bool _offline;

  bool get offline => _offline;

  void enterOffline() {
    if (_offline) {
      return;
    }
    _offline = true;
    notifyListeners();
  }

  void enterOnline() {
    if (!_offline) {
      return;
    }
    _offline = false;
    notifyListeners();
  }
}
