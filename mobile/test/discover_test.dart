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
  artistId: 'a',
  artistName: 'Northwind',
  year: 2018,
  download: true,
);

class _DiscoverApi extends ApiClient {
  _DiscoverApi() : super(baseUrl: 'http://127.0.0.1:9');

  @override
  Future<bool> hasSession() async => false;

  @override
  Future<Map<String, dynamic>> home() async {
    return {
      'greeting': 'Good afternoon',
      'recommended': <dynamic>[],
      'recentlyPlayed': <dynamic>[],
    };
  }

  @override
  Future<List<TrackSummary>> trending() async => [_horizon];

  @override
  Future<List<TrackSummary>> search(
    String query, {
    int? yearFrom,
    int? yearTo,
  }) async {
    if (yearFrom != null && yearFrom > 2018) {
      return [];
    }
    if (query.toLowerCase() == 'bollywood') {
      return [];
    }
    if (query.toLowerCase().contains('indian') ||
        query.toLowerCase().contains('horizon')) {
      return [_horizon];
    }
    return [_horizon];
  }
}

void main() {
  setUp(() {
    onboardingGate.reset();
    appRouter.go('/discover');
  });

  testWidgets('Discover shows scene tiles, singers, and year search', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [apiClientProvider.overrideWithValue(_DiscoverApi())],
        child: const OpenTuneApp(),
      ),
    );
    await tester.pump();
    await tester.pump();

    expect(find.text('Bollywood'), findsOneWidget);
    expect(find.text('Indian scenes'), findsOneWidget);
    expect(find.text('Any year'), findsOneWidget);

    await tester.tap(find.text('Bollywood'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    expect(find.text('Songs'), findsWidgets);
    expect(find.text('Singers'), findsWidgets);
    expect(find.text('1 song'), findsOneWidget);
    expect(find.text('Open Horizon'), findsWidgets);
    expect(find.text('01'), findsOneWidget);
    expect(find.byTooltip('Play'), findsWidgets);
    expect(find.byTooltip('Download'), findsWidgets);
    expect(find.textContaining('http'), findsNothing);

    await tester.tap(find.text('Singers'));
    await tester.pump();
    expect(find.text('Northwind'), findsWidgets);
  });
}
