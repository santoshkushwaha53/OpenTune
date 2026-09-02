import 'package:audio_session/audio_session.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:just_audio/just_audio.dart';

import '../data/api_client.dart';
import '../data/download_store.dart';
import '../data/offline_store.dart';
import '../domain/media_url.dart';
import '../domain/track.dart';
import 'playback_queue.dart';

export 'playback_queue.dart';

final playerControllerProvider = ChangeNotifierProvider<PlayerController>((
  ref,
) {
  return PlayerController(
    downloads: ref.read(downloadStoreProvider),
    api: ref.read(apiClientProvider),
    offline: ref.read(offlineStoreProvider),
  );
});

class PlayerController extends ChangeNotifier {
  PlayerController({
    required DownloadStore downloads,
    required ApiClient api,
    OfflineStore? offline,
    this.enableEngine = true,
  }) : _downloads = downloads,
       _api = api,
       _offline = offline;

  final DownloadStore _downloads;
  final ApiClient _api;
  final OfflineStore? _offline;
  final bool enableEngine;
  AudioPlayer? _player;
  final PlaybackQueue queue = PlaybackQueue();

  Duration position = Duration.zero;
  Duration duration = Duration.zero;
  bool playing = false;

  QueuedItem? get currentItem => queue.current;
  TrackSummary? get current => currentItem?.track;
  String? get licenseLabel => currentItem?.license;
  String? get attribution => currentItem?.attribution;
  String? get sourceUrl => currentItem?.url;
  bool get shuffle => queue.shuffle;
  QueueRepeatMode get repeat => queue.repeat;
  bool get usingLocalFile => currentItem?.localFile ?? false;

  Future<void> playTrack({
    required TrackSummary track,
    required String url,
    String? license,
    String? attribution,
    String? licenseUrl,
    List<QueuedItem>? newQueue,
  }) async {
    final local = _downloads.completed(track.id);
    final offlineOnly = _offline?.offline ?? false;
    if (offlineOnly && local == null) {
      return;
    }
    if (local == null && !isRemoteProviderUrl(url)) {
      return;
    }
    final item = QueuedItem(
      track: track,
      url: local?.path ?? url,
      license: license ?? track.spdxId,
      attribution: attribution,
      licenseUrl: licenseUrl,
      localFile: local != null,
    );
    if (newQueue != null) {
      queue.setQueue(newQueue, playingId: track.id);
      queue.upsert(item);
    } else {
      queue.upsert(item);
    }
    playing = true;
    notifyListeners();
    await _loadCurrent();
  }

  Future<void> _loadCurrent() async {
    final item = currentItem;
    if (item == null) {
      return;
    }
    if (!_canPlay(item)) {
      return;
    }
    if (!enableEngine) {
      playing = true;
      notifyListeners();
      return;
    }
    try {
      final session = await AudioSession.instance;
      await session.configure(const AudioSessionConfiguration.music());
    } catch (_) {}
    try {
      final player = _ensurePlayer();
      if (item.localFile) {
        await player.setFilePath(item.url);
      } else {
        await player.setUrl(item.url);
      }
      await player.play();
      if (_offline?.offline != true) {
        await _api.recordPlay(item.track.id);
      }
    } catch (_) {}
    notifyListeners();
  }

  AudioPlayer _ensurePlayer() {
    if (_player != null) {
      return _player!;
    }
    final player = AudioPlayer();
    player.playerStateStream.listen((state) {
      playing = state.playing;
      notifyListeners();
    });
    player.positionStream.listen((value) {
      position = value;
      notifyListeners();
    });
    player.durationStream.listen((value) {
      duration = value ?? Duration.zero;
      notifyListeners();
    });
    player.processingStateStream.listen((state) {
      if (state == ProcessingState.completed) {
        next();
      }
    });
    _player = player;
    return player;
  }

  Future<void> togglePlay() async {
    if (current == null) {
      return;
    }
    try {
      if (playing) {
        await _player?.pause();
        playing = false;
      } else {
        await _player?.play();
        playing = true;
      }
    } catch (_) {
      playing = !playing;
    }
    notifyListeners();
  }

  Future<void> seek(Duration value) async {
    try {
      await _player?.seek(value);
    } catch (_) {}
    position = value;
    notifyListeners();
  }

  void toggleShuffle() {
    queue.shuffle = !queue.shuffle;
    notifyListeners();
  }

  void cycleRepeat() {
    queue.repeat = QueueRepeatMode
        .values[(queue.repeat.index + 1) % QueueRepeatMode.values.length];
    notifyListeners();
  }

  bool _canPlay(QueuedItem item) {
    if (item.localFile || _downloads.completed(item.track.id) != null) {
      return true;
    }
    if (_offline?.offline == true) {
      return false;
    }
    return isRemoteProviderUrl(item.url);
  }

  Future<void> next() async {
    for (var i = 0; i < queue.items.length; i++) {
      final next = queue.nextIndex();
      if (next == null) {
        return;
      }
      queue.index = next;
      if (_canPlay(queue.current!)) {
        notifyListeners();
        await _loadCurrent();
        return;
      }
    }
  }

  Future<void> previous() async {
    for (var i = 0; i < queue.items.length; i++) {
      final prev = queue.previousIndex();
      if (prev == null) {
        return;
      }
      queue.index = prev;
      if (_canPlay(queue.current!)) {
        notifyListeners();
        await _loadCurrent();
        return;
      }
    }
  }

  Future<void> playAt(int i) async {
    if (i < 0 || i >= queue.items.length) {
      return;
    }
    queue.index = i;
    notifyListeners();
    await _loadCurrent();
  }

  @override
  void dispose() {
    _player?.dispose();
    super.dispose();
  }
}
