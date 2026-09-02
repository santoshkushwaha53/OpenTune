import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:opentune/src/application/onboarding_controller.dart';
import 'package:opentune/src/data/api_client.dart';
import 'package:opentune/src/data/download_store.dart';
import 'package:opentune/src/data/session_store.dart';
import 'package:opentune/src/domain/track.dart';
import 'package:opentune/src/presentation/screens/onboarding_screen.dart';
import 'package:opentune/src/presentation/widgets/onboarding_widgets.dart';

class _OnboardingApi extends ApiClient {
  _OnboardingApi() : super(baseUrl: 'http://127.0.0.1:9');

  bool skipped = false;
  bool completed = false;
  Map<String, dynamic>? saved;

  @override
  Future<List<Map<String, dynamic>>> onboardingArtists({String? query}) async {
    return [
      {'id': '11111111-1111-1111-1111-111111111111', 'name': 'Northwind'},
      {'id': '22222222-2222-2222-2222-222222222222', 'name': 'Cedar Room'},
      {'id': '33333333-3333-3333-3333-333333333333', 'name': 'Lumen Park'},
    ];
  }

  @override
  Future<List<Map<String, dynamic>>> onboardingCategories({
    bool more = false,
  }) async {
    return [
      {'slug': 'acoustic', 'name': 'Acoustic'},
      {'slug': 'indie', 'name': 'Indie'},
    ];
  }

  @override
  Future<List<Map<String, dynamic>>> onboardingLanguages() async {
    return [
      {'code': 'en', 'name': 'English'},
      {'code': 'hi', 'name': 'Hindi'},
    ];
  }

  @override
  Future<List<Map<String, dynamic>>> onboardingMoods() async {
    return [
      {'slug': 'relax', 'name': 'Relax'},
    ];
  }

  @override
  Future<Map<String, dynamic>> savePreferences(
    Map<String, dynamic> body,
  ) async {
    saved = body;
    return body;
  }

  @override
  Future<Map<String, dynamic>> completeOnboarding({bool skip = false}) async {
    skipped = skip;
    completed = true;
    return {'onboardingCompleted': true};
  }

  @override
  Future<Map<String, dynamic>> starterPack() async {
    return {
      'found': 1,
      'downloadableCount': 1,
      'estimatedBytes': 3_000_000,
      'honestLabel': 'We found 1 tracks available for offline listening.',
      'tracks': [
        {
          'id': '11111111-1111-1111-1111-111111111111',
          'title': 'Open Horizon',
          'durationMs': 180000,
          'artist': {'name': 'Northwind'},
          'license': {'spdxId': 'CC-BY-4.0'},
          'availability': {
            'stream': true,
            'download': true,
            'attributionRequired': true,
          },
        },
        {
          'id': '22222222-2222-2222-2222-222222222222',
          'title': 'Harbor Lights',
          'durationMs': 210000,
          'artist': {'name': 'Northwind'},
          'availability': {
            'stream': true,
            'download': false,
            'attributionRequired': true,
          },
        },
      ],
    };
  }

  @override
  Future<String?> downloadSourceUrl(String trackId) async {
    if (trackId.endsWith('2222')) {
      return null;
    }
    return 'https://example.invalid/download/fake-1.mp3';
  }
}

void main() {
  testWidgets('welcome skip completes onboarding without a fake catalog', (
    tester,
  ) async {
    final api = _OnboardingApi();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          apiClientProvider.overrideWithValue(api),
          sessionStoreProvider.overrideWith((ref) => SessionStore(api)),
        ],
        child: const MaterialApp(home: OnboardingScreen()),
      ),
    );
    await tester.pump();
    await tester.pump();
    expect(find.text("Let's make music yours."), findsOneWidget);
    await tester.tap(find.text('Skip for now'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 200));
    expect(api.skipped, isTrue);
    expect(api.completed, isTrue);
  });

  test('continue stays disabled until three artists are selected', () async {
    final api = _OnboardingApi();
    final controller = OnboardingController(
      api: api,
      session: SessionStore(api),
      downloads: DownloadStore(),
    );
    await controller.loadCatalogs();
    expect(controller.canContinueArtists(), isFalse);
    controller.toggleArtist('11111111-1111-1111-1111-111111111111');
    controller.toggleArtist('22222222-2222-2222-2222-222222222222');
    expect(controller.canContinueArtists(), isFalse);
    controller.toggleArtist('33333333-3333-3333-3333-333333333333');
    expect(controller.canContinueArtists(), isTrue);
    expect(controller.selectedArtistIds.length, 3);
  });

  testWidgets(
    'starter cards distinguish downloadable and streaming-only tracks',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ListView(
              children: [
                StarterTrackCard(
                  index: 1,
                  track: const TrackSummary(
                    id: '1',
                    title: 'Open Horizon',
                    durationMs: 180000,
                    artistName: 'Northwind',
                    download: true,
                    spdxId: 'CC-BY-4.0',
                  ),
                  selected: true,
                  onToggle: () {},
                ),
                StarterTrackCard(
                  index: 2,
                  track: const TrackSummary(
                    id: '2',
                    title: 'Harbor Lights',
                    durationMs: 210000,
                    artistName: 'Northwind',
                    download: false,
                  ),
                  selected: false,
                  onToggle: () {},
                ),
              ],
            ),
          ),
        ),
      );
      expect(
        find.textContaining('Included in offline starter pack'),
        findsOneWidget,
      );
      expect(find.textContaining('Streaming only'), findsOneWidget);
      expect(find.byType(Checkbox), findsOneWidget);
    },
  );
}
