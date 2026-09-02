import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:opentune/src/domain/track.dart';
import 'package:opentune/src/presentation/theme/app_theme.dart';
import 'package:opentune/src/presentation/widgets/availability_badges.dart';
import 'package:opentune/src/presentation/widgets/empty_state.dart';
import 'package:opentune/src/presentation/widgets/offline_banner.dart';

const _horizon = TrackSummary(
  id: '11111111-1111-1111-1111-111111111111',
  title: 'Open Horizon',
  durationMs: 180000,
  artistName: 'Northwind',
  stream: true,
  download: true,
  attributionRequired: true,
);

Future<void> _pumpDark(WidgetTester tester, Widget child) async {
  await tester.binding.setSurfaceSize(const Size(420, 240));
  addTearDown(() => tester.binding.setSurfaceSize(null));
  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.dark(),
      home: Scaffold(body: Center(child: child)),
    ),
  );
  await tester.pump();
}

void main() {
  testWidgets(
    'availability badges show stream, download, offline, and attribution',
    (tester) async {
      await _pumpDark(
        tester,
        const AvailabilityBadges(track: _horizon, offline: true),
      );
      expect(find.text('Available offline'), findsOneWidget);
      expect(find.text('Stream'), findsOneWidget);
      expect(find.text('Download'), findsOneWidget);
      expect(find.text('Attribution required'), findsOneWidget);
      expect(find.text('Download unavailable'), findsNothing);
    },
  );

  testWidgets('offline banner and empty catalog copy stay metadata-only', (
    tester,
  ) async {
    await _pumpDark(
      tester,
      const SingleChildScrollView(
        child: Column(
          children: [
            OfflineBanner(),
            EmptyState(
              title: 'No catalog yet',
              message:
                  'Search Discover for open music. Audio always streams from the original provider.',
            ),
          ],
        ),
      ),
    );
    expect(find.textContaining('Offline mode'), findsOneWidget);
    expect(find.text('No catalog yet'), findsOneWidget);
    expect(find.textContaining('original provider'), findsOneWidget);
    expect(find.textContaining('.mp3'), findsNothing);
  });

  testWidgets(
    'pixel goldens for badges and offline banner',
    (tester) async {
      await _pumpDark(
        tester,
        const AvailabilityBadges(track: _horizon, offline: true),
      );
      await expectLater(
        find.byType(AvailabilityBadges),
        matchesGoldenFile('goldens/availability_badges.png'),
      );

      await _pumpDark(tester, const OfflineBanner());
      await expectLater(
        find.byType(OfflineBanner),
        matchesGoldenFile('goldens/offline_banner.png'),
      );
    },
    skip: Platform.environment['CI'] == 'true' || !Platform.isMacOS,
  );
}
