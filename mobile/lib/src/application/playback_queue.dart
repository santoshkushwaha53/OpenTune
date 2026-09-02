import 'dart:math';

import '../domain/track.dart';

enum QueueRepeatMode { off, all, one }

class QueuedItem {
  const QueuedItem({
    required this.track,
    required this.url,
    this.license,
    this.attribution,
    this.licenseUrl,
    this.localFile = false,
  });

  final TrackSummary track;
  final String url;
  final String? license;
  final String? attribution;
  final String? licenseUrl;
  final bool localFile;
}

class PlaybackQueue {
  PlaybackQueue({Random? random}) : _random = random ?? Random();

  final Random _random;
  final List<QueuedItem> items = [];
  int index = 0;
  bool shuffle = false;
  QueueRepeatMode repeat = QueueRepeatMode.off;

  QueuedItem? get current =>
      items.isEmpty ? null : items[index.clamp(0, items.length - 1)];

  void setQueue(List<QueuedItem> next, {required String playingId}) {
    items
      ..clear()
      ..addAll(next);
    final found = items.indexWhere((item) => item.track.id == playingId);
    index = found < 0 ? 0 : found;
  }

  void upsert(QueuedItem item) {
    final existing = items.indexWhere((row) => row.track.id == item.track.id);
    if (existing >= 0) {
      items[existing] = item;
      index = existing;
      return;
    }
    items.add(item);
    index = items.length - 1;
  }

  int? nextIndex() {
    if (items.isEmpty) {
      return null;
    }
    if (repeat == QueueRepeatMode.one) {
      return index;
    }
    if (shuffle && items.length > 1) {
      var next = _random.nextInt(items.length);
      if (next == index) {
        next = (index + 1) % items.length;
      }
      return next;
    }
    if (index + 1 < items.length) {
      return index + 1;
    }
    if (repeat == QueueRepeatMode.all) {
      return 0;
    }
    return null;
  }

  int? previousIndex() {
    if (items.isEmpty) {
      return null;
    }
    if (index <= 0) {
      return repeat == QueueRepeatMode.all ? items.length - 1 : 0;
    }
    return index - 1;
  }
}
