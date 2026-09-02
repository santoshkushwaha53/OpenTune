import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:opentune/src/data/api_client.dart';
import 'package:opentune/src/domain/track.dart';
import 'package:opentune/src/presentation/app.dart';
import 'package:opentune/src/presentation/router.dart';

const _artistId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const _albumId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

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

class _CatalogPagesApi extends ApiClient {
  _CatalogPagesApi() : super(baseUrl: 'http://127.0.0.1:9');

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
  Future<Map<String, dynamic>> artist(String id) async {
    return {
      'id': _artistId,
      'name': 'Northwind',
      'bio': 'Open-licensed recordings.',
      'albums': [
        {'id': _albumId, 'title': 'Public Skies'},
      ],
      'tracks': [_horizon.toJson(), _harbor.toJson()],
    };
  }

  @override
  Future<Map<String, dynamic>> album(String id) async {
    return {
      'id': _albumId,
      'title': 'Public Skies',
      'artists': [
        {'id': _artistId, 'name': 'Northwind'},
      ],
      'tracks': [_horizon.toJson(), _harbor.toJson()],
    };
  }
}

void main() {
  setUp(() {
    appRouter.go('/home');
  });

  testWidgets('artist page lists albums and licensed track refs', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [apiClientProvider.overrideWithValue(_CatalogPagesApi())],
        child: const OpenTuneApp(),
      ),
    );
    await tester.pump();
    await tester.pump();

    appRouter.go('/artist/$_artistId');
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    expect(find.text('Northwind'), findsWidgets);
    expect(find.text('Open-licensed recordings.'), findsOneWidget);
    expect(find.text('Albums'), findsOneWidget);
    expect(find.text('Public Skies'), findsOneWidget);
    expect(find.text('Open Horizon'), findsWidgets);
    expect(find.text('Stream'), findsWidgets);
    expect(find.text('Download unavailable'), findsWidgets);

    await tester.tap(find.text('Public Skies'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text('Play all'), findsOneWidget);
    expect(find.text('Harbor Lights'), findsWidgets);
  });
}
