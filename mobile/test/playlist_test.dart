import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:opentune/src/data/api_client.dart';
import 'package:opentune/src/data/session_store.dart';
import 'package:opentune/src/domain/track.dart';
import 'package:opentune/src/presentation/app.dart';
import 'package:opentune/src/presentation/router.dart';

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

const _playlistId = '33333333-3333-3333-3333-333333333333';

class _LibraryApiClient extends ApiClient {
  _LibraryApiClient() : super(baseUrl: 'http://127.0.0.1:9');

  final playlists = <Map<String, dynamic>>[
    {'id': _playlistId, 'title': 'Open mix', 'visibility': 'private'},
  ];
  final favoriteIds = <String>{_horizon.id};
  var forkedFromShare = false;
  Map<String, dynamic>? lastReport;

  @override
  Future<bool> hasSession() async => true;

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

  @override
  Future<Map<String, dynamic>> library() async {
    return {
      'playlists': playlists,
      'favorites': [
        for (final id in favoriteIds)
          {
            'trackId': id,
            'track': (id == _harbor.id ? _harbor : _horizon).toJson(),
          },
      ],
      'recents': <dynamic>[],
    };
  }

  @override
  Future<Map<String, dynamic>> playlist(String id) async {
    return {
      'id': id,
      'title': playlists.firstWhere(
        (row) => row['id'] == id,
        orElse: () => {'title': 'Open mix'},
      )['title'],
      'visibility': 'private',
      'tracks': [
        {'trackId': _horizon.id, 'position': 0, 'track': _horizon.toJson()},
        {'trackId': _harbor.id, 'position': 1, 'track': _harbor.toJson()},
      ],
    };
  }

  @override
  Future<void> deletePlaylist(String playlistId) async {
    playlists.removeWhere((row) => row['id'] == playlistId);
  }

  @override
  Future<Map<String, dynamic>> reorderPlaylistTracks(
    String playlistId,
    List<String> trackIds,
  ) async {
    return {
      'id': playlistId,
      'title': 'Open mix',
      'tracks': [
        for (var i = 0; i < trackIds.length; i++)
          {
            'trackId': trackIds[i],
            'position': i,
            'track': (trackIds[i] == _harbor.id ? _harbor : _horizon).toJson(),
          },
      ],
    };
  }

  @override
  Future<void> removePlaylistTrack(String playlistId, String trackId) async {}

  @override
  Future<Map<String, dynamic>> sharedPlaylist(String token) async {
    return playlist(_playlistId);
  }

  @override
  Future<Map<String, dynamic>> forkSharedPlaylist(String token) async {
    forkedFromShare = true;
    return {
      'id': '44444444-4444-4444-4444-444444444444',
      'title': 'Open mix (fork)',
    };
  }

  @override
  Future<Map<String, dynamic>> sharePlaylist(String playlistId) async {
    return {
      'token': 'opentune-share-token',
      'path': '/playlists/shared/opentune-share-token',
    };
  }

  @override
  Future<Map<String, dynamic>> report({
    required String entityType,
    required String entityId,
    required String reason,
  }) async {
    lastReport = {
      'entityType': entityType,
      'entityId': entityId,
      'reason': reason,
    };
    return {'id': '55555555-5555-5555-5555-555555555555', 'status': 'open'};
  }
}

void main() {
  setUp(() {
    appRouter.go('/home');
  });

  testWidgets('library lists playlists and favorites as metadata references', (
    tester,
  ) async {
    final api = _LibraryApiClient();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          apiClientProvider.overrideWithValue(api),
          sessionStoreProvider.overrideWith((ref) {
            final store = SessionStore(ref.read(apiClientProvider));
            store.loggedIn = true;
            return store;
          }),
        ],
        child: const OpenTuneApp(),
      ),
    );
    await tester.pump();
    await tester.pump();

    await tester.tap(find.text('Library'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    expect(find.text('1 saved'), findsOneWidget);
    expect(find.text('Open mix'), findsWidgets);

    await tester.tap(find.text('Favorites'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text('Open Horizon'), findsWidgets);
    expect(find.text('Northwind'), findsWidgets);

    appRouter.go('/playlists');
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text('Open mix'), findsWidgets);
    expect(find.byType(FloatingActionButton), findsOneWidget);

    appRouter.go('/playlist/$_playlistId');
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text('Play all'), findsOneWidget);
    expect(find.text('Open Horizon'), findsWidgets);
    expect(find.text('Harbor Lights'), findsWidgets);
    expect(find.textContaining('track references only'), findsOneWidget);
  });

  testWidgets('shared playlist is metadata-only and can be forked', (
    tester,
  ) async {
    final api = _LibraryApiClient();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          apiClientProvider.overrideWithValue(api),
          sessionStoreProvider.overrideWith((ref) {
            final store = SessionStore(ref.read(apiClientProvider));
            store.loggedIn = true;
            return store;
          }),
        ],
        child: const OpenTuneApp(),
      ),
    );
    await tester.pump();
    await tester.pump();

    appRouter.go('/playlists/shared/opentune-share-token');
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    expect(find.text('Open mix'), findsWidgets);
    expect(find.text('Open Horizon'), findsWidgets);
    expect(find.textContaining('audio is never uploaded'), findsOneWidget);
    expect(find.text('Fork to my library'), findsOneWidget);

    await tester.tap(find.text('Fork to my library'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    expect(api.forkedFromShare, isTrue);
  });

  testWidgets('playlist report submits metadata only', (tester) async {
    final api = _LibraryApiClient();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          apiClientProvider.overrideWithValue(api),
          sessionStoreProvider.overrideWith((ref) {
            final store = SessionStore(ref.read(apiClientProvider));
            store.loggedIn = true;
            return store;
          }),
        ],
        child: const OpenTuneApp(),
      ),
    );
    await tester.pump();
    await tester.pump();

    appRouter.go('/playlist/$_playlistId');
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    await tester.tap(find.byTooltip('Report'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text('Report'), findsWidgets);
    await tester.enterText(
      find.byType(TextField),
      'License looks incorrect here',
    );
    await tester.tap(find.text('Submit'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    expect(api.lastReport?['entityType'], 'playlist');
    expect(api.lastReport?['entityId'], _playlistId);
    expect(api.lastReport?['reason'], 'License looks incorrect here');
    expect(find.text('Report submitted. Thank you.'), findsOneWidget);
  });
}
