import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/track.dart';

final tasteStoreProvider = ChangeNotifierProvider<TasteStore>((ref) {
  return TasteStore();
});

/// Local listening + search taste. Metadata only; no audio.
class TasteStore extends ChangeNotifier {
  String? lastQuery;
  String? lastScene;
  List<TrackSummary> lastTracks = [];

  void rememberSearch({
    required String query,
    String? scene,
    required List<TrackSummary> tracks,
  }) {
    final trimmed = query.trim();
    if (trimmed.isEmpty && tracks.isEmpty) {
      return;
    }
    lastQuery = trimmed.isEmpty ? lastQuery : trimmed;
    lastScene = scene ?? lastScene;
    if (tracks.isNotEmpty) {
      lastTracks = tracks.take(12).toList();
    }
    notifyListeners();
  }
}
