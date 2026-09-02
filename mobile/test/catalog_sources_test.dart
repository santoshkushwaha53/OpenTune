import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:opentune/src/data/api_client.dart';
import 'package:opentune/src/domain/track.dart';
import 'package:opentune/src/presentation/app.dart';
import 'package:opentune/src/presentation/router.dart';

class _SourcesApiClient extends ApiClient {
  _SourcesApiClient() : super(baseUrl: 'http://127.0.0.1:9');

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
  Future<List<Map<String, dynamic>>> providers() async {
    return [
      {
        'slug': 'fake',
        'name': 'Fake Open Catalog',
        'isEnabled': true,
        'priority': 0,
        'healthStatus': 'healthy',
        'lastHealthCheckAt': '2026-09-01T00:00:00.000Z',
        'capabilities': {'supportsStreaming': true, 'supportsDownload': true},
      },
      {
        'slug': 'jamendo',
        'name': 'Jamendo',
        'isEnabled': false,
        'priority': 2,
        'healthStatus': 'down',
        'lastHealthCheckAt': null,
        'capabilities': {'supportsStreaming': true, 'supportsDownload': true},
      },
    ];
  }
}

void main() {
  setUp(() {
    appRouter.go('/home');
  });

  testWidgets('library lists catalog source health without audio URLs', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [apiClientProvider.overrideWithValue(_SourcesApiClient())],
        child: const OpenTuneApp(),
      ),
    );
    await tester.pump();
    await tester.pump();

    await tester.tap(find.text('Library'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    expect(find.text('Catalog sources'), findsOneWidget);
    await tester.tap(find.text('Catalog sources'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    expect(find.text('Fake Open Catalog'), findsOneWidget);
    expect(
      find.textContaining('P0 · fake · enabled · healthy'),
      findsOneWidget,
    );
    expect(find.text('Jamendo'), findsOneWidget);
    expect(
      find.textContaining('P2 · jamendo · disabled · down'),
      findsOneWidget,
    );
    expect(
      find.textContaining('OpenTune never hosts or proxies audio'),
      findsOneWidget,
    );
    expect(find.textContaining('.mp3'), findsNothing);
    expect(find.textContaining('playbackUrl'), findsNothing);
  });
}
