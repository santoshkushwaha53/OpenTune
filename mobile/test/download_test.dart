import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:opentune/src/application/player_controller.dart';
import 'package:opentune/src/data/api_client.dart';
import 'package:opentune/src/data/download_store.dart';
import 'package:opentune/src/data/offline_store.dart';
import 'package:opentune/src/domain/track.dart';

Future<void> _writeFile({
  required String url,
  required String savePath,
  required void Function(int received, int total) onProgress,
  required CancelToken cancelToken,
}) async {
  final file = File(savePath);
  await file.parent.create(recursive: true);
  await file.writeAsBytes(const [1, 2, 3, 4]);
  onProgress(4, 4);
}

void main() {
  late Directory dir;

  setUp(() {
    dir = Directory.systemTemp.createTempSync('opentune-dl');
  });

  tearDown(() {
    if (dir.existsSync()) {
      dir.deleteSync(recursive: true);
    }
  });

  DownloadStore store({DownloadTransport? transport}) {
    return DownloadStore(root: dir, transport: transport ?? _writeFile);
  }

  test('refuses API-proxied audio URLs and never fetches them', () async {
    var fetched = false;
    final downloads = store(
      transport:
          ({
            required url,
            required savePath,
            required onProgress,
            required cancelToken,
          }) async {
            fetched = true;
          },
    );
    expect(
      () => downloads.enqueue(
        trackId: '11111111-1111-1111-1111-111111111111',
        title: 'Open Horizon',
        url: 'http://127.0.0.1:3000/api/v1/audio/x',
      ),
      throwsA(isA<DownloadRejected>()),
    );
    expect(fetched, isFalse);
    expect(
      downloads.isOffline('11111111-1111-1111-1111-111111111111'),
      isFalse,
    );
  });

  test('refuses stream-only tracks instead of inventing a download', () async {
    var fetched = false;
    final downloads = store(
      transport:
          ({
            required url,
            required savePath,
            required onProgress,
            required cancelToken,
          }) async {
            fetched = true;
          },
    );
    expect(
      () => downloads.enqueue(
        trackId: '22222222-2222-2222-2222-222222222222',
        title: 'Harbor Lights',
        url: 'https://example.invalid/stream/fake-2.mp3',
        permitted: false,
      ),
      throwsA(isA<DownloadRejected>()),
    );
    expect(fetched, isFalse);
  });

  test(
    'refuses YouTube watch URLs instead of downloading video bytes',
    () async {
      var fetched = false;
      final downloads = store(
        transport:
            ({
              required url,
              required savePath,
              required onProgress,
              required cancelToken,
            }) async {
              fetched = true;
            },
      );
      expect(
        () => downloads.enqueue(
          trackId: '33333333-3333-3333-3333-333333333333',
          title: 'Open Pulse',
          url: 'https://www.youtube.com/watch?v=OpenPulse11',
        ),
        throwsA(isA<DownloadRejected>()),
      );
      expect(fetched, isFalse);
    },
  );

  test(
    'stores the file on device with license snapshot and reloads the index',
    () async {
      const id = '11111111-1111-1111-1111-111111111111';
      final downloads = store();
      final record = await downloads.enqueue(
        trackId: id,
        title: 'Open Horizon',
        url: 'https://example.invalid/download/fake-1.mp3',
        license: 'CC-BY-4.0',
        attribution: '"Open Horizon" by Northwind. CC BY 4.0.',
        artistName: 'Northwind',
      );
      expect(record.isCompleted, isTrue);
      expect(File(record.path).existsSync(), isTrue);
      expect(record.bytes, 4);
      expect(record.checksum, isNotEmpty);
      expect(downloads.isOffline(id), isTrue);

      final reloaded = store();
      await reloaded.load();
      expect(reloaded.isOffline(id), isTrue);
      expect(reloaded.completed(id)?.license, 'CC-BY-4.0');
      expect(reloaded.completed(id)?.title, 'Open Horizon');
      expect(downloads.libraryTracks().single.artistName, 'Northwind');
      expect(downloads.searchLibrary('horizon').single.title, 'Open Horizon');
    },
  );

  test('offline mode plays only files already on this device', () async {
    const id = '11111111-1111-1111-1111-111111111111';
    final downloads = store();
    await downloads.enqueue(
      trackId: id,
      title: 'Open Horizon',
      url: 'https://example.invalid/download/fake-1.mp3',
      artistName: 'Northwind',
    );
    final player = PlayerController(
      downloads: downloads,
      api: ApiClient(baseUrl: 'http://127.0.0.1:9'),
      offline: OfflineStore(offline: true),
      enableEngine: false,
    );
    await player.playTrack(
      track: const TrackSummary(
        id: '22222222-2222-2222-2222-222222222222',
        title: 'Harbor Lights',
        durationMs: 1,
      ),
      url: 'https://example.invalid/stream/fake-2.mp3',
    );
    expect(player.current, isNull);
    await player.playTrack(
      track: const TrackSummary(id: id, title: 'Open Horizon', durationMs: 1),
      url: 'https://example.invalid/stream/ignored.mp3',
    );
    expect(player.current?.id, id);
    expect(player.usingLocalFile, isTrue);
    player.dispose();
  });

  test('remove deletes the local file', () async {
    const id = '11111111-1111-1111-1111-111111111111';
    final downloads = store();
    final record = await downloads.enqueue(
      trackId: id,
      title: 'Open Horizon',
      url: 'https://example.invalid/download/fake-1.mp3',
    );
    await downloads.remove(id);
    expect(File(record.path).existsSync(), isFalse);
    expect(downloads.isOffline(id), isFalse);
  });

  test('starter pack queues only download-eligible tracks', () async {
    const id = '11111111-1111-1111-1111-111111111111';
    final downloads = store();
    await downloads.startStarterPack(
      tracks: const [
        TrackSummary(
          id: id,
          title: 'Open Horizon',
          durationMs: 1,
          download: true,
        ),
        TrackSummary(
          id: '22222222-2222-2222-2222-222222222222',
          title: 'Harbor Lights',
          durationMs: 1,
          download: false,
        ),
      ],
      resolveUrl: (trackId) async =>
          'https://example.invalid/download/$trackId.mp3',
    );
    expect(downloads.packTrackIds, [id]);
    expect(downloads.isOffline(id), isTrue);
    expect(
      downloads.isOffline('22222222-2222-2222-2222-222222222222'),
      isFalse,
    );
  });
}
