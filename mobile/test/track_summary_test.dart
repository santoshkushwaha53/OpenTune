import 'package:flutter_test/flutter_test.dart';
import 'package:opentune/src/domain/track.dart';

void main() {
  test('TrackSummary parses catalog JSON', () {
    final track = TrackSummary.fromJson({
      'id': '11111111-1111-1111-1111-111111111111',
      'title': 'Open Horizon',
      'durationMs': 180000,
      'artist': {'id': 'a', 'name': 'Northwind'},
      'license': {'spdxId': 'CC-BY-4.0'},
      'availability': {
        'stream': true,
        'download': true,
        'attributionRequired': true,
      },
    });
    expect(track.title, 'Open Horizon');
    expect(track.artistName, 'Northwind');
    expect(track.download, isTrue);
  });
}
