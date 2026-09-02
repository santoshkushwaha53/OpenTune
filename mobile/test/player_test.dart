import 'dart:math';

import 'package:flutter_test/flutter_test.dart';
import 'package:opentune/src/application/player_controller.dart';
import 'package:opentune/src/data/api_client.dart';
import 'package:opentune/src/data/download_store.dart';
import 'package:opentune/src/domain/media_url.dart';
import 'package:opentune/src/domain/track.dart';

const _horizon = TrackSummary(
  id: '11111111-1111-1111-1111-111111111111',
  title: 'Open Horizon',
  durationMs: 180000,
  artistName: 'Northwind',
);

const _harbor = TrackSummary(
  id: '22222222-2222-2222-2222-222222222222',
  title: 'Harbor Lights',
  durationMs: 210000,
  artistName: 'Northwind',
);

QueuedItem _item(TrackSummary track, String url) =>
    QueuedItem(track: track, url: url);

void main() {
  test('rejects OpenTune API audio paths and accepts provider URLs', () {
    expect(
      isOpenTuneApiAudioUrl('https://api.example/api/v1/audio/abc'),
      isTrue,
    );
    expect(
      isRemoteProviderUrl('https://api.example/api/v1/audio/abc'),
      isFalse,
    );
    expect(
      isRemoteProviderUrl('https://www.youtube.com/watch?v=OpenPulse11'),
      isTrue,
    );
    expect(
      youtubeVideoId('https://www.youtube.com/watch?v=OpenPulse11'),
      'OpenPulse11',
    );
    expect(isYoutubeWatchUrl('https://cdn.example/horizon.mp3'), isFalse);
  });

  test(
    'queue next/previous use each item URL; repeat one stays; repeat all wraps',
    () {
      final queue = PlaybackQueue();
      queue.setQueue([
        _item(_horizon, 'https://cdn.example/horizon.mp3'),
        _item(_harbor, 'https://cdn.example/harbor.mp3'),
      ], playingId: _horizon.id);
      expect(queue.current?.url, 'https://cdn.example/horizon.mp3');
      queue.index = queue.nextIndex()!;
      expect(queue.current?.track.id, _harbor.id);
      expect(queue.current?.url, 'https://cdn.example/harbor.mp3');
      expect(queue.nextIndex(), isNull);

      queue.repeat = QueueRepeatMode.all;
      expect(queue.nextIndex(), 0);
      queue.index = queue.previousIndex()!;
      expect(queue.current?.track.id, _horizon.id);

      queue.repeat = QueueRepeatMode.one;
      expect(queue.nextIndex(), queue.index);
    },
  );

  test('shuffle next is a different queue item', () {
    final queue = PlaybackQueue(random: Random(0));
    queue
      ..setQueue([
        _item(_horizon, 'https://cdn.example/horizon.mp3'),
        _item(_harbor, 'https://cdn.example/harbor.mp3'),
      ], playingId: _horizon.id)
      ..shuffle = true;
    expect(queue.nextIndex(), 1);
  });

  test(
    'playTrack refuses API-proxied audio and keeps provider URLs per queue item',
    () async {
      final player = PlayerController(
        downloads: DownloadStore(),
        api: ApiClient(baseUrl: 'http://127.0.0.1:9'),
        enableEngine: false,
      );
      await player.playTrack(
        track: _horizon,
        url: 'http://127.0.0.1:3000/api/v1/audio/x',
      );
      expect(player.current, isNull);

      await player.playTrack(
        track: _horizon,
        url: 'https://cdn.example/horizon.mp3',
        license: 'CC-BY-4.0',
      );
      await player.playTrack(
        track: _harbor,
        url: 'https://cdn.example/harbor.mp3',
        license: 'CC-BY-4.0',
      );
      expect(player.sourceUrl, 'https://cdn.example/harbor.mp3');
      await player.previous();
      expect(player.current?.id, _horizon.id);
      expect(player.sourceUrl, 'https://cdn.example/horizon.mp3');
      await player.next();
      expect(player.sourceUrl, 'https://cdn.example/harbor.mp3');
      player.dispose();
    },
  );

  test('queues YouTube watch URLs as stream-only in-app playback', () async {
    final player = PlayerController(
      downloads: DownloadStore(),
      api: ApiClient(baseUrl: 'http://127.0.0.1:9'),
      enableEngine: false,
    );
    await player.playTrack(
      track: _horizon,
      url: 'https://www.youtube.com/watch?v=OpenPulse11',
    );
    expect(player.current?.id, _horizon.id);
    expect(player.isYoutube, isTrue);
    expect(player.currentYoutubeVideoId, 'OpenPulse11');
    player.dispose();
  });

  test(
    'playMix stores a temp queue and hydrates the provider source',
    () async {
      final player = PlayerController(
        downloads: DownloadStore(),
        api: _MixApi(),
        enableEngine: false,
      );
      await player.playMix(track: _horizon, mix: [_horizon, _harbor]);
      expect(player.current?.id, _horizon.id);
      expect(player.queue.items.length, 2);
      expect(player.sourceUrl, 'https://cdn.example/horizon.mp3');
      player.dispose();
    },
  );
}

class _MixApi extends ApiClient {
  _MixApi() : super(baseUrl: 'http://127.0.0.1:9');

  @override
  Future<Map<String, dynamic>> trackSources(String id) async {
    return {
      'sources': [
        {
          'playbackUrl': id == _horizon.id
              ? 'https://cdn.example/horizon.mp3'
              : 'https://cdn.example/harbor.mp3',
        },
      ],
    };
  }

  @override
  Future<void> recordPlay(String trackId) async {}
}
