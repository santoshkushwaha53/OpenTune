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
  String? get currentYoutubeVideoId =>
      currentItem?.localFile == true ? null : youtubeVideoId(currentItem?.url);
  bool get isYoutube => currentYoutubeVideoId != null;

  void syncEngine({Duration? position, Duration? duration, bool? playing}) {
    if (position != null) {
      this.position = position;
    }
    if (duration != null) {
      this.duration = duration;
    }
    if (playing != null) {
      this.playing = playing;
    }
    notifyListeners();
  }

  YoutubePlaybackHost? _youtubeHost;
  YoutubePlaybackHost? get youtubeHost => _youtubeHost;
  set youtubeHost(YoutubePlaybackHost? host) {
    _youtubeHost = host;
    final id = currentYoutubeVideoId;
    if (host == null || id == null || !enableEngine) {
      return;
    }
    host.load(id).then((_) {
      if (!playing) {
        return host.pause();
      }
    });
  }

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
    if (local == null && url.isNotEmpty && !isRemoteProviderUrl(url)) {
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

  /// Queue a mix (temp session) and play [track]. URLs stay off the UI.
  Future<void> playMix({
    required TrackSummary track,
    List<TrackSummary> mix = const [],
  }) async {
    final list = mix.isEmpty ? [track] : mix;
    final queued = [
      for (final item in list)
        QueuedItem(
          track: item,
          url: _downloads.completed(item.id)?.path ?? '',
          license: item.spdxId,
          localFile: _downloads.completed(item.id) != null,
        ),
    ];
    queue.setQueue(queued, playingId: track.id);
    playing = true;
    notifyListeners();
    await _loadCurrent();
  }

  Future<void> _loadCurrent() async {
    final raw = currentItem;
    if (raw == null) {
      return;
    }
    final item = await _hydrate(raw);
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
      if (youtubeVideoId(item.url) != null) {
        await _player?.pause();
        if (enableEngine) {
          await youtubeHost?.load(youtubeVideoId(item.url)!);
        }
        playing = true;
        if (_offline?.offline != true) {
          await _api.recordPlay(item.track.id);
        }
        notifyListeners();
        return;
      }
      await youtubeHost?.stop();
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
      if (isYoutube) {
        if (playing) {
          await youtubeHost?.pause();
          playing = false;
        } else {
          await youtubeHost?.play();
          playing = true;
        }
      } else if (playing) {
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
      if (isYoutube) {
        await youtubeHost?.seek(value);
      } else {
        await _player?.seek(value);
      }
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

  Future<QueuedItem> _hydrate(QueuedItem item) async {
    final local = _downloads.completed(item.track.id);
    if (local != null) {
      final next = QueuedItem(
        track: item.track,
        url: local.path,
        license: item.license ?? local.license,
        attribution: item.attribution ?? local.attribution,
        licenseUrl: item.licenseUrl,
        localFile: true,
      );
      _replaceCurrent(next);
      return next;
    }
    if (item.url.isNotEmpty && isRemoteProviderUrl(item.url)) {
      return item;
    }
    if (_offline?.offline == true) {
      return item;
    }
    try {
      final payload = await _api.trackSources(item.track.id);
      final list = payload['sources'] as List<dynamic>? ?? [];
      Map<String, dynamic>? source;
      for (final row in list) {
        if (row is Map<String, dynamic>) {
          source = row;
          break;
        } else if (row is Map) {
          source = Map<String, dynamic>.from(row);
          break;
        }
      }
      final url = source?['playbackUrl'] as String?;
      if (url == null || !isRemoteProviderUrl(url)) {
        return item;
      }
      final license = source?['license'] as Map<String, dynamic>?;
      final next = QueuedItem(
        track: item.track,
        url: url,
        license: license?['spdxId'] as String? ?? item.license,
        attribution: source?['attributionText'] as String? ?? item.attribution,
        licenseUrl: license?['url'] as String? ?? item.licenseUrl,
      );
      _replaceCurrent(next);
      return next;
    } catch (_) {
      return item;
    }
  }

  void _replaceCurrent(QueuedItem item) {
    if (queue.items.isEmpty) {
      return;
    }
    queue.items[queue.index.clamp(0, queue.items.length - 1)] = item;
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
      notifyListeners();
      await _loadCurrent();
      if (queue.current != null && _canPlay(queue.current!)) {
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
      notifyListeners();
      await _loadCurrent();
      if (queue.current != null && _canPlay(queue.current!)) {
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
    youtubeHost = null;
    _player?.dispose();
    super.dispose();
  }
}

/// Official YouTube IFrame player, owned by the UI so tests can omit it.
abstract class YoutubePlaybackHost {
  Future<void> load(String videoId);
  Future<void> play();
  Future<void> pause();
  Future<void> seek(Duration position);
  Future<void> stop();
}
