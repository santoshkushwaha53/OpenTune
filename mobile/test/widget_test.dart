import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:opentune/src/application/player_controller.dart';
import 'package:opentune/src/data/api_client.dart';
import 'package:opentune/src/data/session_store.dart';
import 'package:opentune/src/data/download_store.dart';
import 'package:opentune/src/domain/track.dart';
import 'package:opentune/src/presentation/app.dart';
import 'package:opentune/src/presentation/router.dart';
import 'package:opentune/src/presentation/widgets/mini_player.dart';

const _horizon = TrackSummary(
  id: '11111111-1111-1111-1111-111111111111',
  title: 'Open Horizon',
  durationMs: 180000,
  artistName: 'Northwind',
  stream: true,
  download: true,
  attributionRequired: true,
);

const _harbor = TrackSummary(
  id: '22222222-2222-2222-2222-222222222222',
  title: 'Harbor Lights',
  durationMs: 210000,
  artistName: 'Northwind',
  stream: true,
  download: false,
  attributionRequired: true,
);

class _EmptyApiClient extends ApiClient {
  _EmptyApiClient() : super(baseUrl: 'http://127.0.0.1:9');

  @override
  Future<bool> hasSession() async => false;

  @override
  Future<Map<String, dynamic>> home() async {
    return {
      'greeting': 'Discover open music',
      'recommended': <dynamic>[],
      'recentlyPlayed': <dynamic>[],
      'offline': true,
    };
  }

  @override
  Future<List<TrackSummary>> trending() async => [];

  @override
  Future<List<String>> genres() async => [];

  @override
  Future<List<Map<String, dynamic>>> providers() async => [];
}

class _CatalogApiClient extends _EmptyApiClient {
  @override
  Future<Map<String, dynamic>> home() async {
    return {
      'greeting': 'Discover open music',
      'recommended': [
        {
          'id': _horizon.id,
          'title': _horizon.title,
          'durationMs': _horizon.durationMs,
          'artist': {'id': 'a', 'name': _horizon.artistName},
          'availability': {
            'stream': true,
            'download': true,
            'attributionRequired': true,
          },
        },
        {
          'id': _harbor.id,
          'title': _harbor.title,
          'durationMs': _harbor.durationMs,
          'artist': {'id': 'a', 'name': _harbor.artistName},
          'availability': {
            'stream': true,
            'download': false,
            'attributionRequired': true,
          },
        },
      ],
      'trending': <dynamic>[],
      'genres': [
        {'name': 'harbor'},
      ],
      'offline': false,
    };
  }

  @override
  Future<List<TrackSummary>> search(String query) async {
    if (query.toLowerCase().contains('harbor')) {
      return [_harbor];
    }
    return [_horizon, _harbor];
  }

  @override
  Future<List<TrackSummary>> trending() async => [_horizon];
}

void main() {
  setUp(() {
    onboardingGate.reset();
    appRouter.go('/home');
  });

  testWidgets(
    'shows Home/Discover/Library shell and a music-first empty Home',
    (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [apiClientProvider.overrideWithValue(_EmptyApiClient())],
          child: const OpenTuneApp(),
        ),
      );
      await tester.pump();
      await tester.pump();

      expect(find.text('Home'), findsWidgets);
      expect(find.text('Discover'), findsWidgets);
      expect(find.text('Library'), findsWidgets);
      expect(find.text('Press play'), findsOneWidget);
      expect(find.text('Explore'), findsOneWidget);
      expect(find.textContaining('Offline mode'), findsNothing);
      expect(find.text('No catalog yet'), findsNothing);
    },
  );

  testWidgets(
    'home shelves are artwork-first; Discover search still shows availability',
    (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [apiClientProvider.overrideWithValue(_CatalogApiClient())],
          child: const OpenTuneApp(),
        ),
      );
      await tester.pump();
      await tester.pump();

      expect(find.text('For you'), findsOneWidget);
      expect(find.text('Open Horizon'), findsWidgets);
      expect(find.text('Play'), findsWidgets);
      expect(find.text('Stream'), findsNothing);
      expect(find.text('Download unavailable'), findsNothing);
      expect(find.widgetWithText(ActionChip, 'harbor'), findsOneWidget);

      await tester.tap(find.widgetWithText(ActionChip, 'harbor'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.text('Harbor Lights'), findsWidgets);

      await tester.enterText(find.byType(TextField), 'harbor');
      await tester.tap(find.byIcon(Icons.search));
      await tester.pumpAndSettle();
      expect(find.text('Harbor Lights'), findsWidgets);
      expect(find.text('Download unavailable'), findsWidgets);
    },
  );

  testWidgets('playTrack shows mini-player, now playing, and license sheet', (
    tester,
  ) async {
    final player = PlayerController(
      downloads: DownloadStore(),
      api: _EmptyApiClient(),
      enableEngine: false,
    );
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          apiClientProvider.overrideWithValue(_EmptyApiClient()),
          downloadStoreProvider.overrideWith((ref) => DownloadStore()),
          playerControllerProvider.overrideWith((ref) => player),
        ],
        child: const OpenTuneApp(),
      ),
    );
    await tester.pump();
    await tester.pump();

    await player.playTrack(
      track: _horizon,
      url: 'https://cdn.example/horizon.mp3',
      license: 'CC-BY-4.0',
      attribution: '"Open Horizon" by Northwind. CC BY 4.0.',
    );
    await tester.pump();

    expect(find.byType(MiniPlayer), findsOneWidget);
    expect(find.text('Open Horizon'), findsWidgets);

    await tester.tap(find.byType(MiniPlayer));
    await tester.pumpAndSettle();
    expect(find.text('Now playing'), findsOneWidget);
    expect(find.text('Streaming from the provider URL'), findsOneWidget);
    expect(find.text('Queue'), findsOneWidget);

    await tester.ensureVisible(find.widgetWithText(TextButton, 'License'));
    await tester.tap(find.widgetWithText(TextButton, 'License'));
    await tester.pumpAndSettle();
    expect(
      find.textContaining('OpenTune does not host or proxy this audio'),
      findsOneWidget,
    );
    expect(find.text('CC-BY-4.0'), findsOneWidget);
  });

  testWidgets('permitted download is stored on device and plays from Library', (
    tester,
  ) async {
    final dir = Directory.systemTemp.createTempSync('opentune-dl-widget');
    addTearDown(() {
      if (dir.existsSync()) {
        dir.deleteSync(recursive: true);
      }
    });
    final downloads = DownloadStore(
      root: dir,
      transport:
          ({
            required url,
            required savePath,
            required onProgress,
            required cancelToken,
          }) async {
            final file = File(savePath);
            await file.parent.create(recursive: true);
            await file.writeAsBytes(const [1, 2, 3, 4]);
            onProgress(4, 4);
          },
    );
    final player = PlayerController(
      downloads: downloads,
      api: _EmptyApiClient(),
      enableEngine: false,
    );
    await tester.runAsync(() async {
      await downloads.enqueue(
        trackId: _horizon.id,
        title: _horizon.title,
        url: 'https://example.invalid/download/fake-1.mp3',
        license: 'CC-BY-4.0',
      );
    });

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          apiClientProvider.overrideWithValue(_EmptyApiClient()),
          downloadStoreProvider.overrideWith((ref) => downloads),
          playerControllerProvider.overrideWith((ref) => player),
        ],
        child: const OpenTuneApp(),
      ),
    );
    await tester.pump();
    await tester.pump();

    expect(find.text('Saved'), findsOneWidget);
    expect(find.text('Open Horizon'), findsWidgets);
    expect(find.text('Play'), findsWidgets);

    expect(find.text('Library'), findsWidgets);
    await tester.tap(find.text('Library'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text('1 on this device'), findsOneWidget);

    await tester.tap(find.text('Downloads'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text('Open Horizon'), findsWidgets);
    expect(find.textContaining('bytes on this device'), findsOneWidget);

    await tester.tap(find.textContaining('bytes on this device'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text('Now playing'), findsOneWidget);
    expect(find.text('Playing from this device'), findsOneWidget);
  });
}
