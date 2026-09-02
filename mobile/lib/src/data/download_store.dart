import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';

import '../domain/download.dart';
import '../domain/media_url.dart';
import '../domain/track.dart';

export '../domain/download.dart';

typedef DownloadTransport =
    Future<void> Function({
      required String url,
      required String savePath,
      required void Function(int received, int total) onProgress,
      required CancelToken cancelToken,
    });

final downloadStoreProvider = ChangeNotifierProvider<DownloadStore>((ref) {
  final store = DownloadStore();
  store.load();
  return store;
});

/// Downloads audio from a permitted **provider** URL onto this device only.
class DownloadStore extends ChangeNotifier {
  DownloadStore({Directory? root, DownloadTransport? transport})
    : _root = root,
      _transport = transport ?? _dioTransport;

  final Directory? _root;
  final DownloadTransport _transport;
  final Map<String, DownloadRecord> _items = {};
  final Map<String, CancelToken> _cancels = {};

  Map<String, DownloadRecord> get items => Map.unmodifiable(_items);

  DownloadRecord? completed(String trackId) {
    final item = _items[trackId];
    if (item == null || !item.isCompleted) {
      return null;
    }
    if (!File(item.path).existsSync()) {
      return null;
    }
    return item;
  }

  bool isOffline(String trackId) => completed(trackId) != null;

  double progressFor(String trackId) {
    final item = _items[trackId];
    if (item == null) {
      return 0;
    }
    if (item.isCompleted) {
      return 1;
    }
    return item.progress;
  }

  Future<Directory> _downloadsDir() async {
    if (_root != null) {
      final dir = Directory('${_root.path}/downloads');
      await dir.create(recursive: true);
      return dir;
    }
    final documents = await getApplicationDocumentsDirectory();
    final dir = Directory('${documents.path}/downloads');
    await dir.create(recursive: true);
    return dir;
  }

  Future<File> _indexFile() async {
    final dir = await _downloadsDir();
    return File('${dir.path}/index.json');
  }

  Future<void> load() async {
    try {
      final file = await _indexFile();
      if (!await file.exists()) {
        return;
      }
      final decoded = jsonDecode(await file.readAsString());
      if (decoded is! List) {
        return;
      }
      for (final entry in decoded.whereType<Map<String, dynamic>>()) {
        var record = DownloadRecord.fromJson(entry);
        final exists = File(record.path).existsSync();
        if (record.state == DownloadState.downloading ||
            record.state == DownloadState.queued) {
          record = record.copyWith(
            state: DownloadState.failed,
            error: 'Interrupted',
          );
        }
        if (record.isCompleted && !exists) {
          continue;
        }
        _items[record.trackId] = record;
      }
      notifyListeners();
    } catch (_) {}
  }

  Future<void> _persist() async {
    try {
      final file = await _indexFile();
      await file.writeAsString(
        jsonEncode(_items.values.map((item) => item.toJson()).toList()),
      );
    } catch (_) {}
  }

  /// Fetches [url] from the original provider. Refuses API media and stream-only tracks.
  Future<DownloadRecord> enqueue({
    required String trackId,
    required String title,
    required String url,
    bool permitted = true,
    String? license,
    String? attribution,
    String? artistName,
    String? artworkUrl,
    int? durationMs,
  }) async {
    if (!permitted) {
      throw DownloadRejected(
        'This track is stream-only. OpenTune will not invent a download.',
      );
    }
    if (!isRemoteProviderUrl(url)) {
      throw DownloadRejected(
        'Downloads must use a provider URL. OpenTune never fetches audio through the API.',
      );
    }
    if (isYoutubeWatchUrl(url)) {
      throw DownloadRejected(
        'YouTube tracks are stream-only. OpenTune will not download or extract audio.',
      );
    }
    final existing = completed(trackId);
    if (existing != null) {
      return existing;
    }

    final dir = await _downloadsDir();
    final path = '${dir.path}/$trackId.audio';
    final token = CancelToken();
    _cancels[trackId]?.cancel();
    _cancels[trackId] = token;

    var record = DownloadRecord(
      trackId: trackId,
      path: path,
      title: title,
      state: DownloadState.downloading,
      progress: 0,
      license: license,
      attribution: attribution,
      artistName: artistName,
      artworkUrl: artworkUrl,
      durationMs: durationMs,
    );
    _items[trackId] = record;
    notifyListeners();

    try {
      await _transport(
        url: url,
        savePath: path,
        cancelToken: token,
        onProgress: (received, total) {
          final progress = total > 0 ? received / total : 0.0;
          final current = _items[trackId];
          if (current == null) {
            return;
          }
          _items[trackId] = current.copyWith(
            progress: progress.clamp(0, 1),
            state: DownloadState.downloading,
          );
          notifyListeners();
        },
      );
      if (token.isCancelled) {
        throw DownloadRejected('Download cancelled');
      }
      final file = File(path);
      if (!file.existsSync()) {
        throw DownloadRejected('Download did not write a file');
      }
      final bytes = await file.readAsBytes();
      final digest = sha256.convert(bytes);
      record = record.copyWith(
        state: DownloadState.completed,
        progress: 1,
        bytes: await file.length(),
        checksum: digest.toString(),
        downloadedAt: DateTime.now().toUtc(),
        artworkPath: await _cacheArtwork(trackId, artworkUrl, dir.path),
        clearError: true,
      );
      _items[trackId] = record;
      await _persist();
      notifyListeners();
      return record;
    } on DownloadRejected {
      await _fail(trackId, path, 'Download cancelled');
      rethrow;
    } catch (error) {
      if (error is DioException && CancelToken.isCancel(error)) {
        await _fail(trackId, path, 'Download cancelled');
        throw DownloadRejected('Download cancelled');
      }
      await _fail(trackId, path, 'Download failed');
      throw DownloadRejected('Could not download from the provider URL.');
    } finally {
      _cancels.remove(trackId);
    }
  }

  Future<void> _fail(String trackId, String path, String message) async {
    try {
      final file = File(path);
      if (file.existsSync()) {
        await file.delete();
      }
    } catch (_) {}
    final current = _items[trackId];
    if (current != null) {
      _items[trackId] = current.copyWith(
        state: DownloadState.failed,
        progress: 0,
        error: message,
      );
      await _persist();
      notifyListeners();
    }
  }

  Future<void> cancel(String trackId) async {
    _cancels[trackId]?.cancel('cancelled');
  }

  bool packPaused = false;
  bool packRunning = false;
  bool wifiOnlyDownloads = true;
  String? packCurrentTitle;
  final List<String> packTrackIds = [];

  int get packCompletedCount => packTrackIds
      .where((id) => _items[id]?.state == DownloadState.completed)
      .length;

  int get packFailedCount => packTrackIds
      .where((id) => _items[id]?.state == DownloadState.failed)
      .length;

  double get packProgress {
    if (packTrackIds.isEmpty) {
      return 0;
    }
    var sum = 0.0;
    for (final id in packTrackIds) {
      sum += progressFor(id);
    }
    return sum / packTrackIds.length;
  }

  /// Sequential provider downloads. Home can show progress immediately.
  Future<void> startStarterPack({
    required List<TrackSummary> tracks,
    required Future<String?> Function(String trackId) resolveUrl,
    bool wifiOnly = true,
  }) async {
    packPaused = false;
    packRunning = true;
    wifiOnlyDownloads = wifiOnly;
    packTrackIds
      ..clear()
      ..addAll(
        tracks.where((track) => track.download).map((track) => track.id),
      );
    notifyListeners();
    await _runPack(tracks: tracks, resolveUrl: resolveUrl, wifiOnly: wifiOnly);
  }

  Future<void> pausePack() async {
    packPaused = true;
    for (final id in packTrackIds) {
      if (_items[id]?.state == DownloadState.downloading) {
        await cancel(id);
      }
    }
    notifyListeners();
  }

  Future<void> resumePack({
    required List<TrackSummary> tracks,
    required Future<String?> Function(String trackId) resolveUrl,
    bool wifiOnly = true,
  }) async {
    packPaused = false;
    packRunning = true;
    notifyListeners();
    await _runPack(tracks: tracks, resolveUrl: resolveUrl, wifiOnly: wifiOnly);
  }

  Future<void> _runPack({
    required List<TrackSummary> tracks,
    required Future<String?> Function(String trackId) resolveUrl,
    required bool wifiOnly,
  }) async {
    wifiOnlyDownloads = wifiOnly;
    try {
      for (final track in tracks) {
        if (packPaused) {
          break;
        }
        if (!track.download) {
          continue;
        }
        if (completed(track.id) != null) {
          continue;
        }
        packCurrentTitle = track.title;
        notifyListeners();
        final url = await resolveUrl(track.id);
        if (url == null) {
          _items[track.id] = DownloadRecord(
            trackId: track.id,
            path: '',
            title: track.title,
            state: DownloadState.failed,
            error: 'No permitted download URL',
            artistName: track.artistName,
            artworkUrl: track.artworkUrl,
            durationMs: track.durationMs,
            license: track.spdxId,
          );
          await _persist();
          notifyListeners();
          continue;
        }
        try {
          await enqueue(
            trackId: track.id,
            title: track.title,
            url: url,
            permitted: true,
            license: track.spdxId,
            artistName: track.artistName,
            artworkUrl: track.artworkUrl,
            durationMs: track.durationMs,
          );
        } on DownloadRejected {
          // Recorded as failed inside enqueue.
        }
      }
    } finally {
      packRunning = !packPaused && packCompletedCount < packTrackIds.length;
      packCurrentTitle = null;
      notifyListeners();
    }
  }

  Future<void> remove(String trackId) async {
    _cancels[trackId]?.cancel('removed');
    final item = _items.remove(trackId);
    if (item != null) {
      try {
        final file = File(item.path);
        if (file.existsSync()) {
          await file.delete();
        }
        if (item.artworkPath != null) {
          final art = File(item.artworkPath!);
          if (art.existsSync()) {
            await art.delete();
          }
        }
      } catch (_) {}
    }
    await _persist();
    notifyListeners();
  }

  List<TrackSummary> libraryTracks() {
    return _items.values
        .where((item) => isOffline(item.trackId))
        .map(
          (item) => TrackSummary(
            id: item.trackId,
            title: item.title,
            durationMs: item.durationMs ?? 0,
            artworkUrl: item.artworkPath ?? item.artworkUrl,
            artistName: item.artistName,
            spdxId: item.license,
            stream: true,
            download: true,
            attributionRequired:
                item.attribution != null && item.attribution!.isNotEmpty,
          ),
        )
        .toList();
  }

  List<TrackSummary> searchLibrary(String query) {
    final q = query.trim().toLowerCase();
    if (q.isEmpty) {
      return libraryTracks();
    }
    return libraryTracks()
        .where(
          (track) =>
              track.title.toLowerCase().contains(q) ||
              (track.artistName?.toLowerCase().contains(q) ?? false),
        )
        .toList();
  }

  Future<String?> _cacheArtwork(
    String trackId,
    String? artworkUrl,
    String dir,
  ) async {
    if (artworkUrl == null || !isRemoteProviderUrl(artworkUrl)) {
      return null;
    }
    try {
      final response = await Dio().get<List<int>>(
        artworkUrl,
        options: Options(responseType: ResponseType.bytes),
      );
      final bytes = response.data;
      if (bytes == null || bytes.isEmpty) {
        return null;
      }
      final file = File('$dir/$trackId.art');
      await file.writeAsBytes(bytes);
      return file.path;
    } catch (_) {
      return null;
    }
  }
}

Future<void> _dioTransport({
  required String url,
  required String savePath,
  required void Function(int received, int total) onProgress,
  required CancelToken cancelToken,
}) {
  return Dio().download(
    url,
    savePath,
    cancelToken: cancelToken,
    onReceiveProgress: (received, total) => onProgress(received, total),
  );
}
